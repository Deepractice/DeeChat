/**
 * 事件总线实现
 * 提供应用内的事件发布订阅机制
 */

import { EventEmitter } from 'events'
import { IEventPublisher } from '../../application/ports/outbound/services/IEventPublisher'
import { Result } from '../../domain/shared/primitives/Result'

export interface IApplicationEvent {
  eventType: string
  eventName: string
  payload: any
  correlationId?: string
  userId?: string
  sessionId?: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface IEventHandler<T = any> {
  handle(event: IApplicationEvent & { payload: T }): Promise<Result<void, Error>>
}

export interface IEventFilter {
  (event: IApplicationEvent): boolean
}

export interface IEventSubscription {
  eventType?: string
  eventName?: string
  handler: IEventHandler
  filter?: IEventFilter
  priority?: number
}

export class EventBus extends EventEmitter implements IEventPublisher {
  private subscriptions: Map<string, IEventSubscription[]> = new Map()
  private eventHistory: IApplicationEvent[] = []
  private maxHistorySize = 1000
  private isInitialized = false

  constructor() {
    super()
    this.setMaxListeners(100) // 增加最大监听器数量
  }

  /**
   * 初始化事件总线
   */
  async initialize(): Promise<Result<void, Error>> {
    try {
      if (this.isInitialized) {
        return Result.success()
      }

      console.log('🔄 [EventBus] 初始化事件总线')
      
      // 设置错误处理
      this.on('error', (error) => {
        console.error('❌ [EventBus] 事件总线错误:', error)
      })

      // 注册系统级事件处理器
      await this.registerSystemEventHandlers()

      this.isInitialized = true
      console.log('✅ [EventBus] 事件总线初始化完成')
      
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to initialize event bus: ${error.message}`))
    }
  }

  /**
   * 发布事件
   */
  async publish(event: IApplicationEvent): Promise<Result<void, Error>> {
    try {
      // 添加时间戳
      if (!event.timestamp) {
        event.timestamp = new Date()
      }

      console.log(`📢 [EventBus] 发布事件: ${event.eventType}.${event.eventName}`, {
        correlationId: event.correlationId,
        userId: event.userId,
        sessionId: event.sessionId
      })

      // 记录事件历史
      this.addToHistory(event)

      // 获取订阅者
      const subscriptions = this.getSubscriptionsForEvent(event)
      
      if (subscriptions.length === 0) {
        console.log(`ℹ️ [EventBus] 没有找到事件订阅者: ${event.eventType}.${event.eventName}`)
        return Result.success()
      }

      // 按优先级排序
      subscriptions.sort((a, b) => (b.priority || 0) - (a.priority || 0))

      // 并发处理所有订阅者
      const promises = subscriptions.map(subscription => 
        this.handleEventWithSubscription(event, subscription)
      )

      const results = await Promise.allSettled(promises)
      
      // 检查是否有失败的处理器
      const failures = results.filter(result => result.status === 'rejected')
      if (failures.length > 0) {
        console.warn(`⚠️ [EventBus] ${failures.length}/${results.length} 事件处理器执行失败`)
        // 记录失败但不阻断整个流程
        failures.forEach((failure, index) => {
          console.error(`❌ [EventBus] 处理器 ${index} 失败:`, failure.reason)
        })
      }

      // 发射Node.js EventEmitter事件（兼容性）
      this.emit(event.eventType, event)
      this.emit(`${event.eventType}.${event.eventName}`, event)

      return Result.success()
    } catch (error) {
      console.error('❌ [EventBus] 发布事件失败:', error)
      return Result.error(new Error(`Failed to publish event: ${error.message}`))
    }
  }

  /**
   * 订阅事件
   */
  subscribe(subscription: IEventSubscription): Result<() => void, Error> {
    try {
      const key = this.getSubscriptionKey(subscription.eventType, subscription.eventName)
      
      if (!this.subscriptions.has(key)) {
        this.subscriptions.set(key, [])
      }

      const subscriptions = this.subscriptions.get(key)!
      subscriptions.push(subscription)

      console.log(`📥 [EventBus] 新增订阅: ${key}`)

      // 返回取消订阅函数
      return Result.success(() => {
        const index = subscriptions.indexOf(subscription)
        if (index > -1) {
          subscriptions.splice(index, 1)
          console.log(`📤 [EventBus] 取消订阅: ${key}`)
        }
      })
    } catch (error) {
      return Result.error(new Error(`Failed to subscribe: ${error.message}`))
    }
  }

  /**
   * 批量发布事件
   */
  async publishBatch(events: IApplicationEvent[]): Promise<Result<void, Error>> {
    try {
      console.log(`📢 [EventBus] 批量发布 ${events.length} 个事件`)
      
      const results = await Promise.allSettled(
        events.map(event => this.publish(event))
      )

      const failures = results.filter(result => result.status === 'rejected')
      if (failures.length > 0) {
        console.warn(`⚠️ [EventBus] 批量发布中 ${failures.length}/${events.length} 个事件失败`)
      }

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to publish batch: ${error.message}`))
    }
  }

  /**
   * 查询事件历史
   */
  getEventHistory(filter?: {
    eventType?: string
    eventName?: string
    userId?: string
    sessionId?: string
    since?: Date
    limit?: number
  }): IApplicationEvent[] {
    let history = this.eventHistory

    if (filter) {
      history = history.filter(event => {
        if (filter.eventType && event.eventType !== filter.eventType) return false
        if (filter.eventName && event.eventName !== filter.eventName) return false
        if (filter.userId && event.userId !== filter.userId) return false
        if (filter.sessionId && event.sessionId !== filter.sessionId) return false
        if (filter.since && event.timestamp < filter.since) return false
        return true
      })
    }

    // 最新的在前
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    if (filter?.limit) {
      history = history.slice(0, filter.limit)
    }

    return history
  }

  /**
   * 清理事件历史
   */
  clearHistory(): void {
    this.eventHistory = []
    console.log('🧹 [EventBus] 事件历史已清理')
  }

  /**
   * 获取订阅统计
   */
  getSubscriptionStats(): {
    totalSubscriptions: number
    subscriptionsByType: Record<string, number>
  } {
    let totalSubscriptions = 0
    const subscriptionsByType: Record<string, number> = {}

    for (const [key, subscriptions] of this.subscriptions) {
      totalSubscriptions += subscriptions.length
      subscriptionsByType[key] = subscriptions.length
    }

    return { totalSubscriptions, subscriptionsByType }
  }

  /**
   * 注册系统级事件处理器
   */
  private async registerSystemEventHandlers(): Promise<void> {
    // 错误事件处理器
    this.subscribe({
      eventType: 'system',
      eventName: 'error',
      handler: {
        handle: async (event) => {
          console.error('🚨 [EventBus] 系统错误事件:', event.payload)
          return Result.success()
        }
      },
      priority: 100
    })

    // 应用启动事件处理器
    this.subscribe({
      eventType: 'application',
      eventName: 'started',
      handler: {
        handle: async (event) => {
          console.log('🚀 [EventBus] 应用启动事件')
          return Result.success()
        }
      },
      priority: 100
    })

    // 应用关闭事件处理器
    this.subscribe({
      eventType: 'application',
      eventName: 'shutdown',
      handler: {
        handle: async (event) => {
          console.log('🛑 [EventBus] 应用关闭事件')
          return Result.success()
        }
      },
      priority: 100
    })
  }

  /**
   * 处理单个订阅的事件
   */
  private async handleEventWithSubscription(
    event: IApplicationEvent,
    subscription: IEventSubscription
  ): Promise<void> {
    try {
      // 应用过滤器
      if (subscription.filter && !subscription.filter(event)) {
        return
      }

      // 执行处理器
      const result = await subscription.handler.handle(event)
      
      if (result.isError()) {
        throw result.getError()
      }
    } catch (error) {
      console.error('❌ [EventBus] 事件处理器执行失败:', error)
      throw error
    }
  }

  /**
   * 获取事件的所有订阅
   */
  private getSubscriptionsForEvent(event: IApplicationEvent): IEventSubscription[] {
    const subscriptions: IEventSubscription[] = []

    // 通配符订阅 (*)
    const wildcardSubs = this.subscriptions.get('*') || []
    subscriptions.push(...wildcardSubs)

    // 事件类型订阅 (eventType.*)
    const typeSubs = this.subscriptions.get(`${event.eventType}.*`) || []
    subscriptions.push(...typeSubs)

    // 精确匹配订阅 (eventType.eventName)
    const exactSubs = this.subscriptions.get(`${event.eventType}.${event.eventName}`) || []
    subscriptions.push(...exactSubs)

    return subscriptions
  }

  /**
   * 生成订阅键
   */
  private getSubscriptionKey(eventType?: string, eventName?: string): string {
    if (!eventType && !eventName) return '*'
    if (!eventName) return `${eventType}.*`
    return `${eventType}.${eventName}`
  }

  /**
   * 添加到事件历史
   */
  private addToHistory(event: IApplicationEvent): void {
    this.eventHistory.push({ ...event })

    // 保持历史大小限制
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize)
    }
  }
}