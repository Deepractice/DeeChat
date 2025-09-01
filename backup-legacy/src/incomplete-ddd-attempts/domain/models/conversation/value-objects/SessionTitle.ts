/**
 * 会话标题值对象
 */

import { ValueObject } from '../../../core/ValueObject'

export class SessionTitle extends ValueObject {
  private constructor(private readonly value: string) {
    super()
    this.validate()
  }

  /**
   * 创建会话标题
   */
  static create(title: string): SessionTitle {
    return new SessionTitle(title)
  }

  /**
   * 创建默认标题
   */
  static createDefault(): SessionTitle {
    return new SessionTitle('新对话')
  }

  /**
   * 获取标题值
   */
  getValue(): string {
    return this.value
  }

  /**
   * 标题相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof SessionTitle)) return false
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
   * 检查是否为默认标题
   */
  isDefault(): boolean {
    return this.value === '新对话'
  }

  /**
   * 验证标题
   */
  protected validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Session title cannot be empty')
    }

    if (this.value.length > 100) {
      throw new Error('Session title cannot be longer than 100 characters')
    }

    // 检查是否包含特殊字符
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(this.value)) {
      throw new Error('Session title contains invalid characters')
    }
  }
}