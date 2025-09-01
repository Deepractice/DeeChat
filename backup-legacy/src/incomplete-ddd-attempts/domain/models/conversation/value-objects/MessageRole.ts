/**
 * 消息角色值对象
 */

import { ValueObject } from '../../../core/ValueObject'

type RoleType = 'user' | 'assistant' | 'system'

export class MessageRole extends ValueObject {
  private constructor(private readonly value: RoleType) {
    super()
    this.validate()
  }

  /**
   * 创建用户角色
   */
  static user(): MessageRole {
    return new MessageRole('user')
  }

  /**
   * 创建助手角色
   */
  static assistant(): MessageRole {
    return new MessageRole('assistant')
  }

  /**
   * 创建系统角色
   */
  static system(): MessageRole {
    return new MessageRole('system')
  }

  /**
   * 从字符串创建角色
   */
  static fromString(value: string): MessageRole {
    if (!this.isValidRole(value)) {
      throw new Error(`Invalid message role: ${value}. Must be one of: user, assistant, system`)
    }
    return new MessageRole(value as RoleType)
  }

  /**
   * 检查是否为有效角色
   */
  private static isValidRole(value: string): value is RoleType {
    return ['user', 'assistant', 'system'].includes(value)
  }

  /**
   * 获取角色值
   */
  getValue(): RoleType {
    return this.value
  }

  /**
   * 检查是否为用户角色
   */
  isUser(): boolean {
    return this.value === 'user'
  }

  /**
   * 检查是否为助手角色
   */
  isAssistant(): boolean {
    return this.value === 'assistant'
  }

  /**
   * 检查是否为系统角色
   */
  isSystem(): boolean {
    return this.value === 'system'
  }

  /**
   * 获取角色显示名称
   */
  getDisplayName(): string {
    const displayNames = {
      user: '用户',
      assistant: 'AI助手',
      system: '系统'
    }
    return displayNames[this.value]
  }

  /**
   * 角色相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof MessageRole)) return false
    return this.value === other.value
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return this.value
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.value
  }

  /**
   * 验证角色
   */
  protected validate(): void {
    if (!MessageRole.isValidRole(this.value)) {
      throw new Error(`Invalid message role: ${this.value}`)
    }
  }
}