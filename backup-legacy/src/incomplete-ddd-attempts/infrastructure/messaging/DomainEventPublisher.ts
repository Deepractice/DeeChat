/**
 * 领域事件发布器
 * 将领域事件转换为应用事件并发布到事件总线
 */

import { IDomainEvent } from '../../domain/shared/events/IDomainEvent'
import { EventBus, IApplicationEvent } from './EventBus'
import { Result } from '../../domain/shared/primitives/Result'

export class DomainEventPublisher {
  constructor(
    private readonly eventBus: EventBus
  ) {}

  /**
   * 发布领域事件
   */
  async publishDomainEvent(domainEvent: IDomainEvent): Promise<Result<void, Error>> {
    try {
      const applicationEvent = this.convertToApplicationEvent(domainEvent)
      return await this.eventBus.publish(applicationEvent)
    } catch (error) {
      return Result.error(new Error(`Failed to publish domain event: ${error.message}`))
    }
  }

  /**
   * 批量发布领域事件
   */
  async publishDomainEvents(domainEvents: IDomainEvent[]): Promise<Result<void, Error>> {
    try {
      const applicationEvents = domainEvents.map(event => 
        this.convertToApplicationEvent(event)
      )
      
      return await this.eventBus.publishBatch(applicationEvents)
    } catch (error) {
      return Result.error(new Error(`Failed to publish domain events: ${error.message}`))
    }
  }

  /**
   * 将领域事件转换为应用事件
   */
  private convertToApplicationEvent(domainEvent: IDomainEvent): IApplicationEvent {
    return {
      eventType: 'domain',
      eventName: domainEvent.getEventName(),
      payload: {
        aggregateId: domainEvent.getAggregateId(),
        eventData: domainEvent.getEventData(),
        version: domainEvent.getVersion()
      },
      correlationId: domainEvent.getCorrelationId(),
      timestamp: domainEvent.getOccurredOn(),
      metadata: {
        domainEventId: domainEvent.getEventId(),
        aggregateType: this.inferAggregateType(domainEvent.getEventName()),
        domainEventVersion: domainEvent.getVersion()
      }
    }
  }

  /**
   * 根据事件名推断聚合类型
   */
  private inferAggregateType(eventName: string): string {
    // 基于命名约定推断聚合类型
    if (eventName.includes('Session') || eventName.includes('Message')) {
      return 'Conversation'
    }
    
    if (eventName.includes('Role') || eventName.includes('Intelligence')) {
      return 'Intelligence' 
    }
    
    if (eventName.includes('Tool') || eventName.includes('Execution')) {
      return 'Tool'
    }
    
    return 'Unknown'
  }
}