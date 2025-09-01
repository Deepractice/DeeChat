/**
 * 工具执行完成领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolExecutionContext } from '../value-objects/ToolExecutionContext'
import { ToolExecutionResult } from '../value-objects/ToolExecutionResult'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class ToolExecutionCompleted extends DomainEvent {
  constructor(
    private readonly toolId: ToolId,
    private readonly toolName: ToolName,
    private readonly context: ToolExecutionContext,
    private readonly result: ToolExecutionResult,
    private readonly completedAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'ToolExecutionCompleted'
  }

  getEventData(): Record<string, any> {
    const performance = this.result.getPerformanceMetrics()
    
    return {
      toolId: this.toolId.getValue(),
      toolName: this.toolName.getValue(),
      userId: this.context.getUserId(),
      sessionId: this.context.getSessionId(),
      status: this.result.getStatus(),
      executionTimeMs: performance.executionTime,
      memoryUsedMB: performance.memoryUsed,
      inputSize: performance.inputSize,
      outputSize: performance.outputSize,
      retryCount: performance.retryCount,
      efficiency: performance.efficiency,
      cacheHit: this.result.isCacheHit(),
      hasWarnings: this.result.hasWarnings(),
      warningCount: this.result.getWarnings().length,
      completedAt: this.completedAt.toISOString(),
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

  getResult(): ToolExecutionResult {
    return this.result
  }

  getCompletedAt(): Timestamp {
    return this.completedAt
  }

  /**
   * 检查是否成功执行
   */
  isSuccessful(): boolean {
    return this.result.isSuccess()
  }

  /**
   * 获取执行时间
   */
  getExecutionTime(): number {
    return this.result.getExecutionTime()
  }

  /**
   * 检查是否高效执行（快速且成功）
   */
  isEfficient(): boolean {
    return this.result.isSuccess() && 
           this.result.getExecutionTime() < 5000 && // 少于5秒
           !this.result.hasWarnings()
  }
}