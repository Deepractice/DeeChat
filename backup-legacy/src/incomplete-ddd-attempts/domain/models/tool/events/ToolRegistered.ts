/**
 * 工具注册领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolCapabilities } from '../value-objects/ToolCapabilities'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class ToolRegistered extends DomainEvent {
  constructor(
    private readonly toolId: ToolId,
    private readonly toolName: ToolName,
    private readonly capabilities: ToolCapabilities,
    private readonly registeredAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'ToolRegistered'
  }

  getEventData(): Record<string, any> {
    return {
      toolId: this.toolId.getValue(),
      toolName: this.toolName.getValue(),
      capabilities: this.capabilities.getCapabilities(),
      registeredAt: this.registeredAt.toISOString(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getToolId(): ToolId {
    return this.toolId
  }

  getToolName(): ToolName {
    return this.toolName
  }

  getCapabilities(): ToolCapabilities {
    return this.capabilities
  }

  getRegisteredAt(): Timestamp {
    return this.registeredAt
  }
}