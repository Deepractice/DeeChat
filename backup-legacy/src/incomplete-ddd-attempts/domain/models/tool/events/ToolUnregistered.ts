/**
 * 工具注销领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class ToolUnregistered extends DomainEvent {
  constructor(
    private readonly toolId: ToolId,
    private readonly toolName: ToolName,
    private readonly reason: string | undefined,
    private readonly unregisteredAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'ToolUnregistered'
  }

  getEventData(): Record<string, any> {
    return {
      toolId: this.toolId.getValue(),
      toolName: this.toolName.getValue(),
      reason: this.reason,
      unregisteredAt: this.unregisteredAt.toISOString(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getToolId(): ToolId {
    return this.toolId
  }

  getToolName(): ToolName {
    return this.toolName
  }

  getReason(): string | undefined {
    return this.reason
  }

  getUnregisteredAt(): Timestamp {
    return this.unregisteredAt
  }
}