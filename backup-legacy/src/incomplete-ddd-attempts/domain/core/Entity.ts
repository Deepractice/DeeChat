/**
 * 领域实体基类
 * DDD核心构建块之一
 */

import { Id } from '../shared/primitives/Id'

export abstract class Entity<T extends Id> {
  protected constructor(protected readonly id: T) {
    if (!id) {
      throw new Error('Entity ID cannot be null or undefined')
    }
  }

  /**
   * 实体相等性比较（基于ID）
   */
  equals(entity: Entity<T>): boolean {
    if (!entity) return false
    if (this.constructor !== entity.constructor) return false
    return this.id.equals(entity.id)
  }

  /**
   * 获取实体ID
   */
  getId(): T {
    return this.id
  }

  /**
   * 获取实体ID的值
   */
  getIdValue(): string {
    return this.id.getValue()
  }
}