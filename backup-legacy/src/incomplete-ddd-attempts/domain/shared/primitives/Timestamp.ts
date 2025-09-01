/**
 * 时间戳值对象
 * 统一处理时间相关的业务逻辑
 */

import { ValueObject } from '../../core/ValueObject'

export class Timestamp extends ValueObject {
  private constructor(private readonly date: Date) {
    super()
    this.validate()
  }

  /**
   * 创建当前时间戳
   */
  static now(): Timestamp {
    return new Timestamp(new Date())
  }

  /**
   * 从Date对象创建
   */
  static fromDate(date: Date): Timestamp {
    return new Timestamp(new Date(date.getTime()))
  }

  /**
   * 从毫秒数创建
   */
  static fromMilliseconds(ms: number): Timestamp {
    return new Timestamp(new Date(ms))
  }

  /**
   * 从ISO字符串创建
   */
  static fromISOString(isoString: string): Timestamp {
    return new Timestamp(new Date(isoString))
  }

  /**
   * 获取Date对象
   */
  getDate(): Date {
    return new Date(this.date.getTime())
  }

  /**
   * 获取毫秒数
   */
  getMilliseconds(): number {
    return this.date.getTime()
  }

  /**
   * 获取ISO字符串
   */
  toISOString(): string {
    return this.date.toISOString()
  }

  /**
   * 比较时间戳
   */
  isBefore(other: Timestamp): boolean {
    return this.date.getTime() < other.date.getTime()
  }

  isAfter(other: Timestamp): boolean {
    return this.date.getTime() > other.date.getTime()
  }

  isSameAs(other: Timestamp): boolean {
    return this.date.getTime() === other.date.getTime()
  }

  /**
   * 时间差（毫秒）
   */
  differenceInMs(other: Timestamp): number {
    return Math.abs(this.date.getTime() - other.date.getTime())
  }

  /**
   * 时间差（秒）
   */
  differenceInSeconds(other: Timestamp): number {
    return Math.floor(this.differenceInMs(other) / 1000)
  }

  /**
   * 时间差（分钟）
   */
  differenceInMinutes(other: Timestamp): number {
    return Math.floor(this.differenceInSeconds(other) / 60)
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof Timestamp)) return false
    return this.date.getTime() === other.date.getTime()
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return this.date.getTime().toString()
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.date.toISOString()
  }

  /**
   * 验证时间戳
   */
  protected validate(): void {
    if (!this.date || isNaN(this.date.getTime())) {
      throw new Error('Invalid timestamp')
    }

    // 检查时间是否在合理范围内（1970年到2100年）
    const year = this.date.getFullYear()
    if (year < 1970 || year > 2100) {
      throw new Error('Timestamp year must be between 1970 and 2100')
    }
  }
}