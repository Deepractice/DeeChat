/**
 * 角色激活领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { RoleId } from '../value-objects/RoleId'
import { RoleName } from '../value-objects/RoleName'
import { RoleCapabilities } from '../value-objects/RoleCapabilities'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class RoleActivated extends DomainEvent {
  constructor(
    private readonly roleId: RoleId,
    private readonly roleName: RoleName,
    private readonly capabilities: RoleCapabilities,
    private readonly activatedAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'RoleActivated'
  }

  getEventData(): Record<string, any> {
    return {
      roleId: this.roleId.getValue(),
      roleName: this.roleName.getValue(),
      capabilities: this.capabilities.getCapabilities(),
      activatedAt: this.activatedAt.toISOString(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getRoleId(): RoleId {
    return this.roleId
  }

  getRoleName(): RoleName {
    return this.roleName
  }

  getCapabilities(): RoleCapabilities {
    return this.capabilities
  }

  getActivatedAt(): Timestamp {
    return this.activatedAt
  }
}