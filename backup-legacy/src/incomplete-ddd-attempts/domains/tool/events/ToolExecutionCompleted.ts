/**
 * 工具执行完成事件
 * 🏗️ DDD重构: 当工具执行完成时发布的领域事件
 */

import { ToolId } from '../value-objects/ToolId';

export class ToolExecutionCompleted {
  public readonly eventType = 'ToolExecutionCompleted';
  public readonly occurredAt: Date;

  constructor(
    public readonly executionId: string,
    public readonly toolId: ToolId,
    public readonly toolName: string,
    public readonly sessionId: string,
    public readonly duration: number,
    public readonly success: boolean,
    public readonly result?: any
  ) {
    this.occurredAt = new Date();
  }
}