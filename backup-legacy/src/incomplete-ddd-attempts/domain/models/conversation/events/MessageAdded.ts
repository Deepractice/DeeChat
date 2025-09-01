/**
 * 消息添加领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { SessionId } from '../value-objects/SessionId'
import { MessageId } from '../value-objects/MessageId'
import { MessageRole } from '../value-objects/MessageRole'

export class MessageAdded extends DomainEvent {
  constructor(
    private readonly sessionId: SessionId,
    private readonly messageId: MessageId,
    private readonly messageRole: MessageRole
  ) {
    super()
  }

  getEventName(): string {
    return 'MessageAdded'
  }

  getEventData(): Record<string, any> {
    return {
      sessionId: this.sessionId.getValue(),
      messageId: this.messageId.getValue(),
      messageRole: this.messageRole.getValue(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getSessionId(): SessionId {
    return this.sessionId
  }

  getMessageId(): MessageId {
    return this.messageId
  }

  getMessageRole(): MessageRole {
    return this.messageRole
  }
}