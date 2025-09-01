/**
 * 领域事件基类
 * DDD核心构建块之一
 */

export abstract class DomainEvent {
  readonly occurredOn: Date
  readonly eventId: string

  constructor() {
    this.occurredOn = new Date()
    this.eventId = this.generateEventId()
  }

  /**
   * 生成事件ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取事件名称
   */
  abstract getEventName(): string

  /**
   * 获取事件数据
   */
  abstract getEventData(): Record<string, any>
}