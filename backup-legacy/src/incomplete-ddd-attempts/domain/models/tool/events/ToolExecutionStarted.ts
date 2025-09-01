/**
 * 工具执行开始领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolExecutionContext } from '../value-objects/ToolExecutionContext'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class ToolExecutionStarted extends DomainEvent {
  constructor(
    private readonly toolId: ToolId,
    private readonly toolName: ToolName,
    private readonly context: ToolExecutionContext,
    private readonly startedAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'ToolExecutionStarted'
  }

  getEventData(): Record<string, any> {
    return {
      toolId: this.toolId.getValue(),
      toolName: this.toolName.getValue(),
      userId: this.context.getUserId(),
      sessionId: this.context.getSessionId(),
      parameters: this.context.getParameters(),
      permissions: this.context.getPermissions(),
      riskLevel: this.context.getRiskLevel(),
      startedAt: this.startedAt.toISOString(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getToolId(): ToolId {
    return this.toolId
  }

  getToolName(): ToolName {
    return this.toolName
  }

  getContext(): ToolExecutionContext {
    return this.context
  }

  getStartedAt(): Timestamp {
    return this.startedAt
  }
}