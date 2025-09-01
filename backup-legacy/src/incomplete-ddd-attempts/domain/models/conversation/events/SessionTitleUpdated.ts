/**
 * 会话标题更新领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { SessionId } from '../value-objects/SessionId'

export class SessionTitleUpdated extends DomainEvent {
  constructor(
    private readonly sessionId: SessionId,
    private readonly oldTitle: string,
    private readonly newTitle: string
  ) {
    super()
  }

  getEventName(): string {
    return 'SessionTitleUpdated'
  }

  getEventData(): Record<string, any> {
    return {
      sessionId: this.sessionId.getValue(),
      oldTitle: this.oldTitle,
      newTitle: this.newTitle,
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getSessionId(): SessionId {
    return this.sessionId
  }

  getOldTitle(): string {
    return this.oldTitle
  }

  getNewTitle(): string {
    return this.newTitle
  }
}