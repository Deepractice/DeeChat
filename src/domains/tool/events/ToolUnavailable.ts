/**
 * 工具不可用事件
 * 🏗️ DDD重构: 当工具变为不可用时发布的领域事件
 */

import { ToolId } from '../value-objects/ToolId';

export class ToolUnavailable {
  public readonly eventType = 'ToolUnavailable';
  public readonly occurredAt: Date;

  constructor(
    public readonly toolId: ToolId,
    public readonly toolName: string,
    public readonly serverId: string,
    public readonly reason?: string
  ) {
    this.occurredAt = new Date();
  }
}