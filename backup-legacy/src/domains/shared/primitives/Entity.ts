/**
 * 领域实体基类
 * DDD战术模式中的实体抽象
 */

import { UniqueEntityID } from './UniqueEntityID'

export abstract class Entity<T> {
  protected readonly _id: UniqueEntityID
  public readonly props: T

  constructor(props: T, id?: UniqueEntityID) {
    this._id = id || new UniqueEntityID()
    this.props = props
  }

  /**
   * 获取实体ID
   */
  get id(): UniqueEntityID {
    return this._id
  }

  /**
   * 实体相等性比较（基于ID）
   */
  equals(object?: Entity<T>): boolean {
    if (object === null || object === undefined) return false
    if (this === object) return true
    if (!(object instanceof Entity)) return false
    return this._id.equals(object._id)
  }
}