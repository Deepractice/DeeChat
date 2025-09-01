/**
 * 角色能力值对象
 */

import { ValueObject } from '../../../core/ValueObject'

export class RoleCapabilities extends ValueObject {
  private constructor(private readonly capabilities: Set<string>) {
    super()
    this.validate()
  }

  /**
   * 创建角色能力
   */
  static create(capabilities: string[]): RoleCapabilities {
    return new RoleCapabilities(new Set(capabilities.map(c => c.toLowerCase().trim())))
  }

  /**
   * 创建空能力集
   */
  static empty(): RoleCapabilities {
    return new RoleCapabilities(new Set())
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
    return this.capabilities.has(capability.toLowerCase().trim())
  }

  /**
   * 检查是否具有任何能力
   */
  hasAnyCapabilities(): boolean {
    return this.capabilities.size > 0
  }

  /**
   * 检查是否具有所有指定能力
   */
  hasAllCapabilities(requiredCapabilities: string[]): boolean {
    return requiredCapabilities.every(cap => this.hasCapability(cap))
  }

  /**
   * 检查是否具有任何指定能力
   */
  hasAnyOfCapabilities(requiredCapabilities: string[]): boolean {
    return requiredCapabilities.some(cap => this.hasCapability(cap))
  }

  /**
   * 获取能力数量
   */
  getCapabilityCount(): number {
    return this.capabilities.size
  }

  /**
   * 添加能力（返回新的实例）
   */
  addCapability(capability: string): RoleCapabilities {
    const newCapabilities = new Set(this.capabilities)
    newCapabilities.add(capability.toLowerCase().trim())
    return new RoleCapabilities(newCapabilities)
  }

  /**
   * 移除能力（返回新的实例）
   */
  removeCapability(capability: string): RoleCapabilities {
    const newCapabilities = new Set(this.capabilities)
    newCapabilities.delete(capability.toLowerCase().trim())
    return new RoleCapabilities(newCapabilities)
  }

  /**
   * 合并能力（返回新的实例）
   */
  merge(other: RoleCapabilities): RoleCapabilities {
    const merged = new Set([...this.capabilities, ...other.capabilities])
    return new RoleCapabilities(merged)
  }

  /**
   * 获取交集能力
   */
  intersect(other: RoleCapabilities): RoleCapabilities {
    const intersection = new Set(
      Array.from(this.capabilities).filter(cap => other.hasCapability(cap))
    )
    return new RoleCapabilities(intersection)
  }

  /**
   * 获取差集能力
   */
  difference(other: RoleCapabilities): RoleCapabilities {
    const diff = new Set(
      Array.from(this.capabilities).filter(cap => !other.hasCapability(cap))
    )
    return new RoleCapabilities(diff)
  }

  /**
   * 按类别分组能力
   */
  groupByCategory(): Record<string, string[]> {
    const groups: Record<string, string[]> = {}
    
    for (const capability of this.capabilities) {
      const category = this.getCapabilityCategory(capability)
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(capability)
    }
    
    return groups
  }

  /**
   * 获取能力的类别
   */
  private getCapabilityCategory(capability: string): string {
    const categoryMap: Record<string, string> = {
      // 编程能力
      'programming': 'development',
      'coding': 'development', 
      'debugging': 'development',
      'testing': 'development',
      'refactoring': 'development',
      
      // 设计能力
      'ui-design': 'design',
      'ux-design': 'design',
      'graphics': 'design',
      'branding': 'design',
      
      // 分析能力
      'data-analysis': 'analysis',
      'research': 'analysis',
      'problem-solving': 'analysis',
      
      // 沟通能力
      'communication': 'communication',
      'writing': 'communication',
      'documentation': 'communication',
      'presentation': 'communication',
      
      // 管理能力
      'project-management': 'management',
      'team-leadership': 'management',
      'planning': 'management'
    }
    
    for (const [key, category] of Object.entries(categoryMap)) {
      if (capability.includes(key)) {
        return category
      }
    }
    
    return 'general'
  }

  /**
   * 能力相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof RoleCapabilities)) return false
    
    if (this.capabilities.size !== other.capabilities.size) {
      return false
    }
    
    for (const capability of this.capabilities) {
      if (!other.hasCapability(capability)) {
        return false
      }
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
   * 字符串表示
   */
  toString(): string {
    return this.getCapabilities().join(', ')
  }

  /**
   * 验证能力
   */
  protected validate(): void {
    // 检查每个能力的有效性
    for (const capability of this.capabilities) {
      if (!capability || capability.trim().length === 0) {
        throw new Error('Capability cannot be empty')
      }
      
      if (capability.length > 50) {
        throw new Error(`Capability '${capability}' cannot be longer than 50 characters`)
      }
      
      // 检查能力名称格式（只允许字母、数字、连字符、下划线）
      const validPattern = /^[a-zA-Z0-9\-_]+$/
      if (!validPattern.test(capability)) {
        throw new Error(`Capability '${capability}' contains invalid characters`)
      }
    }
    
    // 检查能力数量限制
    if (this.capabilities.size > 50) {
      throw new Error('Cannot have more than 50 capabilities')
    }
  }
}