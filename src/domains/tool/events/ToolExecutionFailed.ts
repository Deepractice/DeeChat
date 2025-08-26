/**
 * 工具执行失败事件
 * 🏗️ DDD重构: 当工具执行失败时发布的领域事件
 */

import { ToolId } from '../value-objects/ToolId';

export class ToolExecutionFailed {
  public readonly eventType = 'ToolExecutionFailed';
  public readonly occurredAt: Date;

  constructor(
    public readonly executionId: string,
    public readonly toolId: ToolId,
    public readonly toolName: string,
    public readonly sessionId: string,
    public readonly error: string,
    public readonly duration?: number
  ) {
    this.occurredAt = new Date();
  }
}