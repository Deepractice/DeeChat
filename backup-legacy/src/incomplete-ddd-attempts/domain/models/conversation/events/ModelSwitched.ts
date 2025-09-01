/**
 * 模型切换领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { SessionId } from '../value-objects/SessionId'

export class ModelSwitched extends DomainEvent {
  constructor(
    private readonly sessionId: SessionId,
    private readonly oldModelId: string | undefined,
    private readonly newModelId: string
  ) {
    super()
  }

  getEventName(): string {
    return 'ModelSwitched'
  }

  getEventData(): Record<string, any> {
    return {
      sessionId: this.sessionId.getValue(),
      oldModelId: this.oldModelId,
      newModelId: this.newModelId,
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getSessionId(): SessionId {
    return this.sessionId
  }

  getOldModelId(): string | undefined {
    return this.oldModelId
  }

  getNewModelId(): string {
    return this.newModelId
  }
}