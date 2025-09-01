/**
 * 值对象基类
 * DDD战术模式中的值对象抽象
 */

export abstract class ValueObject<T> {
  public readonly props: T

  constructor(props: T) {
    this.props = Object.freeze(props)
  }

  /**
   * 值对象相等性比较
   */
  equals(other: ValueObject<T>): boolean {
    if (!other || other.constructor !== this.constructor) {
      return false
    }

    return this.shallowEqual(this.props, other.props)
  }

  /**
   * 浅层相等性比较
   */
  private shallowEqual(props1: any, props2: any): boolean {
    if (props1 === props2) return true

    if (typeof props1 !== 'object' || typeof props2 !== 'object') {
      return false
    }

    if (props1 === null || props2 === null) return false

    const keys1 = Object.keys(props1)
    const keys2 = Object.keys(props2)

    if (keys1.length !== keys2.length) return false

    for (const key of keys1) {
      if (!keys2.includes(key)) return false
      if (props1[key] !== props2[key]) return false
    }

    return true
  }
}