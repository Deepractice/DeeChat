/**
 * 角色能力更新领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { RoleId } from '../value-objects/RoleId'
import { RoleCapabilities } from '../value-objects/RoleCapabilities'

export class RoleCapabilitiesUpdated extends DomainEvent {
  constructor(
    private readonly roleId: RoleId,
    private readonly oldCapabilities: RoleCapabilities,
    private readonly newCapabilities: RoleCapabilities
  ) {
    super()
  }

  getEventName(): string {
    return 'RoleCapabilitiesUpdated'
  }

  getEventData(): Record<string, any> {
    return {
      roleId: this.roleId.getValue(),
      oldCapabilities: this.oldCapabilities.getCapabilities(),
      newCapabilities: this.newCapabilities.getCapabilities(),
      addedCapabilities: this.getAddedCapabilities(),
      removedCapabilities: this.getRemovedCapabilities(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getRoleId(): RoleId {
    return this.roleId
  }

  getOldCapabilities(): RoleCapabilities {
    return this.oldCapabilities
  }

  getNewCapabilities(): RoleCapabilities {
    return this.newCapabilities
  }

  /**
   * 获取新增的能力
   */
  getAddedCapabilities(): string[] {
    return this.newCapabilities.difference(this.oldCapabilities).getCapabilities()
  }

  /**
   * 获取移除的能力
   */
  getRemovedCapabilities(): string[] {
    return this.oldCapabilities.difference(this.newCapabilities).getCapabilities()
  }

  /**
   * 检查是否有能力变更
   */
  hasChanges(): boolean {
    return !this.oldCapabilities.equals(this.newCapabilities)
  }
}