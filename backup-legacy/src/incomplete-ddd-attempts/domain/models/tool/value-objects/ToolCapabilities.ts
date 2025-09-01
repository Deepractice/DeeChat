/**
 * 工具能力值对象
 */

import { ValueObject } from '../../../core/ValueObject'

export class ToolCapabilities extends ValueObject {
  private constructor(private readonly capabilities: Set<string>) {
    super()
    this.validate()
  }

  /**
   * 创建工具能力
   */
  static create(capabilities: string[]): ToolCapabilities {
    return new ToolCapabilities(new Set(capabilities))
  }

  /**
   * 创建空的工具能力
   */
  static empty(): ToolCapabilities {
    return new ToolCapabilities(new Set())
  }

  /**
   * 从字符串创建（逗号分隔）
   */
  static fromString(capabilitiesString: string): ToolCapabilities {
    const capabilities = capabilitiesString
      .split(',')
      .map(cap => cap.trim())
      .filter(cap => cap.length > 0)
    return new ToolCapabilities(new Set(capabilities))
  }

  /**
   * 获取所有能力
   */
  getCapabilities(): string[] {
    return Array.from(this.capabilities).sort()
  }

  /**
   * 检查是否具有特定能力
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.has(capability)
  }

  /**
   * 检查是否具有所有指定能力
   */
  hasAllCapabilities(capabilities: string[]): boolean {
    return capabilities.every(cap => this.capabilities.has(cap))
  }

  /**
   * 检查是否具有任一指定能力
   */
  hasAnyCapability(capabilities: string[]): boolean {
    return capabilities.some(cap => this.capabilities.has(cap))
  }

  /**
   * 检查是否有任何能力
   */
  hasAnyCapabilities(): boolean {
    return this.capabilities.size > 0
  }

  /**
   * 添加能力
   */
  addCapability(capability: string): ToolCapabilities {
    const newCapabilities = new Set(this.capabilities)
    newCapabilities.add(capability.trim())
    return new ToolCapabilities(newCapabilities)
  }

  /**
   * 添加多个能力
   */
  addCapabilities(capabilities: string[]): ToolCapabilities {
    const newCapabilities = new Set(this.capabilities)
    capabilities.forEach(cap => newCapabilities.add(cap.trim()))
    return new ToolCapabilities(newCapabilities)
  }

  /**
   * 移除能力
   */
  removeCapability(capability: string): ToolCapabilities {
    const newCapabilities = new Set(this.capabilities)
    newCapabilities.delete(capability)
    return new ToolCapabilities(newCapabilities)
  }

  /**
   * 移除多个能力
   */
  removeCapabilities(capabilities: string[]): ToolCapabilities {
    const newCapabilities = new Set(this.capabilities)
    capabilities.forEach(cap => newCapabilities.delete(cap))
    return new ToolCapabilities(newCapabilities)
  }

  /**
   * 获取交集能力
   */
  intersect(other: ToolCapabilities): ToolCapabilities {
    const intersection = new Set<string>()
    this.capabilities.forEach(cap => {
      if (other.capabilities.has(cap)) {
        intersection.add(cap)
      }
    })
    return new ToolCapabilities(intersection)
  }

  /**
   * 获取并集能力
   */
  union(other: ToolCapabilities): ToolCapabilities {
    const union = new Set([...this.capabilities, ...other.capabilities])
    return new ToolCapabilities(union)
  }

  /**
   * 获取差集能力
   */
  difference(other: ToolCapabilities): ToolCapabilities {
    const difference = new Set<string>()
    this.capabilities.forEach(cap => {
      if (!other.capabilities.has(cap)) {
        difference.add(cap)
      }
    })
    return new ToolCapabilities(difference)
  }

  /**
   * 检查是否为空
   */
  isEmpty(): boolean {
    return this.capabilities.size === 0
  }

  /**
   * 获取能力数量
   */
  size(): number {
    return this.capabilities.size
  }

  /**
   * 按类别分组能力
   */
  groupByCategory(): Record<string, string[]> {
    const groups: Record<string, string[]> = {}
    
    this.capabilities.forEach(capability => {
      const category = this.getCapabilityCategory(capability)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(capability)
    })
    
    return groups
  }

  /**
   * 获取能力类别
   */
  private getCapabilityCategory(capability: string): string {
    // 文件系统相关能力
    if (['read', 'write', 'edit', 'create', 'delete', 'file-access', 'directory-access'].includes(capability)) {
      return 'file-system'
    }
    
    // 网络相关能力
    if (['http', 'web-fetch', 'api-call', 'webhook', 'download', 'upload'].includes(capability)) {
      return 'network'
    }
    
    // 数据库相关能力
    if (['database', 'sql', 'query', 'transaction', 'migration'].includes(capability)) {
      return 'database'
    }
    
    // 系统相关能力
    if (['shell', 'command', 'process', 'system-info', 'environment'].includes(capability)) {
      return 'system'
    }
    
    // AI相关能力
    if (['llm', 'embedding', 'completion', 'chat', 'analysis', 'generation'].includes(capability)) {
      return 'ai'
    }
    
    // 搜索相关能力
    if (['search', 'index', 'query', 'filter', 'sort'].includes(capability)) {
      return 'search'
    }
    
    // 版本控制相关能力
    if (['git', 'version-control', 'commit', 'branch', 'merge'].includes(capability)) {
      return 'version-control'
    }
    
    return 'general'
  }

  /**
   * 获取核心能力（最重要的能力）
   */
  getCoreCapabilities(): string[] {
    const coreCapabilities = ['read', 'write', 'execute', 'search', 'create', 'delete', 'update']
    return this.getCapabilities().filter(cap => coreCapabilities.includes(cap))
  }

  /**
   * 检查是否为只读工具
   */
  isReadOnly(): boolean {
    const writeCapabilities = ['write', 'edit', 'create', 'delete', 'update', 'modify']
    return !this.hasAnyCapability(writeCapabilities)
  }

  /**
   * 检查是否为写入工具
   */
  canWrite(): boolean {
    const writeCapabilities = ['write', 'edit', 'create', 'delete', 'update', 'modify']
    return this.hasAnyCapability(writeCapabilities)
  }

  /**
   * 检查是否为危险工具
   */
  isDangerous(): boolean {
    const dangerousCapabilities = ['delete', 'shell', 'command', 'system', 'admin', 'root', 'sudo']
    return this.hasAnyCapability(dangerousCapabilities)
  }

  /**
   * 获取匹配度分数（与目标能力列表）
   */
  getMatchScore(targetCapabilities: string[]): number {
    if (targetCapabilities.length === 0) return 0
    
    const matchCount = targetCapabilities.filter(cap => this.capabilities.has(cap)).length
    return matchCount / targetCapabilities.length
  }

  /**
   * 转换为字符串（逗号分隔）
   */
  toString(): string {
    return this.getCapabilities().join(', ')
  }

  /**
   * 转换为标签数组（用于UI显示）
   */
  toTags(): Array<{ name: string; category: string; color: string }> {
    return this.getCapabilities().map(capability => ({
      name: capability,
      category: this.getCapabilityCategory(capability),
      color: this.getCapabilityColor(capability)
    }))
  }

  /**
   * 获取能力颜色（用于UI显示）
   */
  private getCapabilityColor(capability: string): string {
    const category = this.getCapabilityCategory(capability)
    const colors: Record<string, string> = {
      'file-system': 'blue',
      'network': 'green',
      'database': 'purple',
      'system': 'red',
      'ai': 'orange',
      'search': 'yellow',
      'version-control': 'pink',
      'general': 'gray'
    }
    return colors[category] || 'gray'
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof ToolCapabilities)) return false
    
    if (this.capabilities.size !== other.capabilities.size) return false
    
    for (const capability of this.capabilities) {
      if (!other.capabilities.has(capability)) return false
    }
    
    return true
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return Array.from(this.capabilities).sort().join(',')
  }

  /**
   * 验证能力
   */
  protected validate(): void {
    this.capabilities.forEach(capability => {
      if (!capability || typeof capability !== 'string') {
        throw new Error('Capability must be a non-empty string')
      }
      
      if (capability.trim().length === 0) {
        throw new Error('Capability cannot be empty or whitespace only')
      }
      
      if (capability.length > 50) {
        throw new Error('Capability name cannot be longer than 50 characters')
      }
      
      // 检查是否包含无效字符
      if (!/^[a-zA-Z0-9_-]+$/.test(capability)) {
        throw new Error(`Invalid capability name: ${capability}. Must contain only letters, numbers, hyphens, and underscores`)
      }
    })
  }
}