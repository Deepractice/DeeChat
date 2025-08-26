/**
 * 角色激活事件
 * 🏗️ DDD重构: 当PromptX角色被激活时发布的领域事件
 */

import { RoleId } from '../value-objects/RoleId';

export class RoleActivated {
  public readonly eventType = 'RoleActivated';
  public readonly occurredAt: Date;

  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly sessionId: string,
    public readonly modelKey: string,
    public readonly context?: any
  ) {
    this.occurredAt = new Date();
  }
}