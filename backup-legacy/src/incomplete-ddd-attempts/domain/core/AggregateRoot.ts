/**
 * 聚合根基类
 * DDD核心构建块之一，管理领域事件
 */

import { Entity } from './Entity'
import { DomainEvent } from './DomainEvent'
import { Id } from '../shared/primitives/Id'

export abstract class AggregateRoot<T extends Id> extends Entity<T> {
  private domainEvents: DomainEvent[] = []

  /**
   * 添加领域事件
   */
  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event)
  }

  /**
   * 清除所有领域事件
   */
  clearDomainEvents(): void {
    this.domainEvents = []
  }

  /**
   * 获取所有领域事件
   */
  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents]
  }

  /**
   * 检查是否有领域事件
   */
  hasDomainEvents(): boolean {
    return this.domainEvents.length > 0
  }

  /**
   * 获取领域事件数量
   */
  getDomainEventCount(): number {
    return this.domainEvents.length
  }
}