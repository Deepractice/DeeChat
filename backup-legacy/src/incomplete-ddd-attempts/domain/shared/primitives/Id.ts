/**
 * ID值对象基类
 * 所有实体ID的基础实现
 */

import { ValueObject } from '../../core/ValueObject'

export abstract class Id extends ValueObject {
  protected constructor(protected readonly value: string) {
    super()
    this.validate()
  }

  /**
   * 获取ID值
   */
  getValue(): string {
    return this.value
  }

  /**
   * ID相等性比较
   */
  equals(other: Id): boolean {
    if (!other) return false
    if (this.constructor !== other.constructor) return false
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
   * 验证ID格式
   */
  protected validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('ID cannot be empty')
    }

    if (this.value.length > 255) {
      throw new Error('ID cannot be longer than 255 characters')
    }
  }

  /**
   * 生成UUID格式的ID
   */
  protected static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * 生成时间戳ID
   */
  protected static generateTimestamp(): string {
    return Date.now().toString()
  }
}