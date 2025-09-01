/**
 * 事件发布器接口（出站端口）
 * 定义事件发布的抽象契约
 */

import { Result } from '../../../../domain/shared/primitives/Result'

export interface IApplicationEvent {
  type: string
  data: any
  context: {
    userId?: string
    sessionId?: string
    correlationId?: string
    timestamp: Date
  }
  metadata?: Record<string, any>
}

export interface IEventSubscription {
  eventType: string
  handler: (event: IApplicationEvent) => Promise<void>
  options?: {
    priority?: number
    async?: boolean
    retryCount?: number
  }
}

/**
 * 事件发布器接口
 * 负责应用事件的发布和订阅管理
 */
export interface IEventPublisher {
  /**
   * 发布单个事件
   */
  publish(event: IApplicationEvent): Promise<Result<void, Error>>

  /**
   * 批量发布事件
   */
  publishBatch(events: IApplicationEvent[]): Promise<Result<void, Error>>

  /**
   * 订阅事件
   */
  subscribe(subscription: IEventSubscription): Promise<Result<string, Error>>

  /**
   * 取消订阅
   */
  unsubscribe(subscriptionId: string): Promise<Result<void, Error>>

  /**
   * 获取事件历史
   */
  getEventHistory(
    eventType?: string,
    fromDate?: Date,
    toDate?: Date,
    limit?: number
  ): Promise<Result<IApplicationEvent[], Error>>

  /**
   * 清理过期事件
   */
  cleanupExpiredEvents(olderThanDays: number): Promise<Result<number, Error>>
}