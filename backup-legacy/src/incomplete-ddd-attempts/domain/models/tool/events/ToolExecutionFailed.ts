/**
 * 工具执行失败领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolExecutionContext } from '../value-objects/ToolExecutionContext'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class ToolExecutionFailed extends DomainEvent {
  constructor(
    private readonly toolId: ToolId,
    private readonly toolName: ToolName,
    private readonly context: ToolExecutionContext,
    private readonly errorMessage: string,
    private readonly failedAt: Timestamp,
    private readonly errorCode?: string,
    private readonly retryCount: number = 0
  ) {
    super()
  }

  getEventName(): string {
    return 'ToolExecutionFailed'
  }

  getEventData(): Record<string, any> {
    return {
      toolId: this.toolId.getValue(),
      toolName: this.toolName.getValue(),
      userId: this.context.getUserId(),
      sessionId: this.context.getSessionId(),
      errorMessage: this.errorMessage,
      errorCode: this.errorCode,
      retryCount: this.retryCount,
      riskLevel: this.context.getRiskLevel(),
      parameters: this.context.getParameters(),
      failedAt: this.failedAt.toISOString(),
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

  getErrorMessage(): string {
    return this.errorMessage
  }

  getErrorCode(): string | undefined {
    return this.errorCode
  }

  getFailedAt(): Timestamp {
    return this.failedAt
  }

  getRetryCount(): number {
    return this.retryCount
  }

  /**
   * 检查是否为严重错误
   */
  isCriticalError(): boolean {
    const criticalCodes = ['SYSTEM_ERROR', 'PERMISSION_DENIED', 'SECURITY_VIOLATION']
    return criticalCodes.includes(this.errorCode || '')
  }

  /**
   * 检查是否可重试
   */
  isRetryable(): boolean {
    const nonRetryableCodes = ['INVALID_INPUT', 'PERMISSION_DENIED', 'NOT_FOUND']
    return !nonRetryableCodes.includes(this.errorCode || '') && this.retryCount < 3
  }
}