/**
 * 工具发现事件
 * 🏗️ DDD重构: 当新工具被发现时发布的领域事件
 */

import { ToolId } from '../value-objects/ToolId';

export class ToolDiscovered {
  public readonly eventType = 'ToolDiscovered';
  public readonly occurredAt: Date;

  constructor(
    public readonly toolId: ToolId,
    public readonly toolName: string,
    public readonly serverId: string
  ) {
    this.occurredAt = new Date();
  }
}