/**
 * 工具执行开始事件
 * 🏗️ DDD重构: 当工具开始执行时发布的领域事件
 */

import { ToolId } from '../value-objects/ToolId';

export class ToolExecutionStarted {
  public readonly eventType = 'ToolExecutionStarted';
  public readonly occurredAt: Date;

  constructor(
    public readonly executionId: string,
    public readonly toolId: ToolId,
    public readonly toolName: string,
    public readonly sessionId: string,
    public readonly args?: any
  ) {
    this.occurredAt = new Date();
  }
}