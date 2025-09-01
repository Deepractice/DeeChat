/**
 * 工具名称值对象
 */

import { ValueObject } from '../../../core/ValueObject'

export class ToolName extends ValueObject {
  private constructor(private readonly name: string) {
    super()
    this.validate()
  }

  /**
   * 创建工具名称
   */
  static create(name: string): ToolName {
    return new ToolName(name)
  }

  /**
   * 获取名称值
   */
  getValue(): string {
    return this.name
  }

  /**
   * 获取显示名称（格式化）
   */
  getDisplayName(): string {
    return this.name
      .split(/[_-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  /**
   * 获取短名称（去除前缀）
   */
  getShortName(): string {
    // 移除常见前缀
    const prefixes = ['mcp__', 'tool_', 'system_', 'user_', 'custom_']
    let shortName = this.name
    
    for (const prefix of prefixes) {
      if (shortName.startsWith(prefix)) {
        shortName = shortName.substring(prefix.length)
        break
      }
    }
    
    return shortName
  }

  /**
   * 检查是否为MCP工具名称
   */
  isMCPTool(): boolean {
    return this.name.startsWith('mcp__') || this.name.includes('__')
  }

  /**
   * 检查是否为系统工具
   */
  isSystemTool(): boolean {
    const systemPrefixes = ['system_', 'mcp__', 'core_', 'internal_']
    return systemPrefixes.some(prefix => this.name.startsWith(prefix))
  }

  /**
   * 检查是否为用户工具
   */
  isUserTool(): boolean {
    const userPrefixes = ['user_', 'custom_', 'plugin_']
    return userPrefixes.some(prefix => this.name.startsWith(prefix))
  }

  /**
   * 获取工具类别
   */
  getCategory(): string {
    // 从名称推断类别
    if (this.name.includes('file') || this.name.includes('read') || this.name.includes('write')) {
      return 'file-system'
    }
    if (this.name.includes('web') || this.name.includes('http') || this.name.includes('fetch')) {
      return 'web'
    }
    if (this.name.includes('db') || this.name.includes('database') || this.name.includes('sql')) {
      return 'database'
    }
    if (this.name.includes('git') || this.name.includes('repo')) {
      return 'version-control'
    }
    if (this.name.includes('bash') || this.name.includes('shell') || this.name.includes('command')) {
      return 'system'
    }
    if (this.name.includes('search') || this.name.includes('grep') || this.name.includes('find')) {
      return 'search'
    }
    if (this.name.includes('ai') || this.name.includes('llm') || this.name.includes('prompt')) {
      return 'ai'
    }
    
    return 'general'
  }

  /**
   * 转换为文件安全的名称
   */
  toFileSafeName(): string {
    return this.name
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase()
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof ToolName)) return false
    return this.name === other.name
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return this.name
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.name
  }

  /**
   * 验证工具名称
   */
  protected validate(): void {
    if (!this.name || typeof this.name !== 'string') {
      throw new Error('Tool name must be a non-empty string')
    }

    if (this.name.trim().length === 0) {
      throw new Error('Tool name cannot be empty or whitespace only')
    }

    if (this.name.length > 100) {
      throw new Error('Tool name cannot be longer than 100 characters')
    }

    // 检查是否包含无效字符（用于文件系统兼容性）
    if (/[<>:"/\\|?*\x00-\x1f]/.test(this.name)) {
      throw new Error('Tool name contains invalid characters')
    }

    // 确保名称不全是特殊字符
    if (!/[a-zA-Z0-9]/.test(this.name)) {
      throw new Error('Tool name must contain at least one alphanumeric character')
    }
  }
}