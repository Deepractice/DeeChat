/**
 * 角色激活失败事件
 * 🏗️ DDD重构: 当PromptX角色激活失败时发布的领域事件
 */

import { RoleId } from '../value-objects/RoleId';

export class RoleActivationFailed {
  public readonly eventType = 'RoleActivationFailed';
  public readonly occurredAt: Date;

  constructor(
    public readonly roleId: RoleId,
    public readonly sessionId: string,
    public readonly error: string,
    public readonly retryCount?: number
  ) {
    this.occurredAt = new Date();
  }
}