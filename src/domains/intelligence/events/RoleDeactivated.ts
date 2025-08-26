/**
 * 角色停用事件
 * 🏗️ DDD重构: 当PromptX角色被停用时发布的领域事件
 */

import { RoleId } from '../value-objects/RoleId';

export class RoleDeactivated {
  public readonly eventType = 'RoleDeactivated';
  public readonly occurredAt: Date;

  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly sessionId?: string
  ) {
    this.occurredAt = new Date();
  }
}