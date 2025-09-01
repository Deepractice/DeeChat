/**
 * 值对象基类
 * DDD核心构建块之一
 */

export abstract class ValueObject {
  /**
   * 值对象相等性比较
   */
  abstract equals(other: ValueObject): boolean

  /**
   * 获取哈希码（用于比较和缓存）
   */
  abstract getHashCode(): string
  
  /**
   * 验证值对象的有效性
   */
  protected abstract validate(): void

  /**
   * 获取值对象的字符串表示
   */
  abstract toString(): string
}