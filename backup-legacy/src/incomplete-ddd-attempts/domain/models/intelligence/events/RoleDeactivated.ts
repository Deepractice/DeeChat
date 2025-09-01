/**
 * 角色停用领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { RoleId } from '../value-objects/RoleId'
import { RoleName } from '../value-objects/RoleName'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class RoleDeactivated extends DomainEvent {
  constructor(
    private readonly roleId: RoleId,
    private readonly roleName: RoleName,
    private readonly deactivatedAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'RoleDeactivated'
  }

  getEventData(): Record<string, any> {
    return {
      roleId: this.roleId.getValue(),
      roleName: this.roleName.getValue(),
      deactivatedAt: this.deactivatedAt.toISOString(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getRoleId(): RoleId {
    return this.roleId
  }

  getRoleName(): RoleName {
    return this.roleName
  }

  getDeactivatedAt(): Timestamp {
    return this.deactivatedAt
  }
}