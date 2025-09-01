/**
 * 工具状态变更领域事件
 */

import { DomainEvent } from '../../../core/DomainEvent'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolStatus } from '../value-objects/ToolStatus'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export class ToolStatusChanged extends DomainEvent {
  constructor(
    private readonly toolId: ToolId,
    private readonly toolName: ToolName,
    private readonly oldStatus: ToolStatus,
    private readonly newStatus: ToolStatus,
    private readonly changedAt: Timestamp
  ) {
    super()
  }

  getEventName(): string {
    return 'ToolStatusChanged'
  }

  getEventData(): Record<string, any> {
    return {
      toolId: this.toolId.getValue(),
      toolName: this.toolName.getValue(),
      oldStatus: this.oldStatus.getStatus(),
      newStatus: this.newStatus.getStatus(),
      oldReason: this.oldStatus.getReason(),
      newReason: this.newStatus.getReason(),
      changedAt: this.changedAt.toISOString(),
      occurredOn: this.occurredOn.toISOString()
    }
  }

  getToolId(): ToolId {
    return this.toolId
  }

  getToolName(): ToolName {
    return this.toolName
  }

  getOldStatus(): ToolStatus {
    return this.oldStatus
  }

  getNewStatus(): ToolStatus {
    return this.newStatus
  }

  getChangedAt(): Timestamp {
    return this.changedAt
  }

  /**
   * 检查是否从可用变为不可用
   */
  isBecamingUnavailable(): boolean {
    return this.oldStatus.isAvailable() && !this.newStatus.isAvailable()
  }

  /**
   * 检查是否从不可用变为可用
   */
  isBecamingAvailable(): boolean {
    return !this.oldStatus.isAvailable() && this.newStatus.isAvailable()
  }

  /**
   * 检查是否进入维护状态
   */
  isEnteringMaintenance(): boolean {
    return !this.oldStatus.isMaintenance() && this.newStatus.isMaintenance()
  }

  /**
   * 检查是否退出维护状态
   */
  isExitingMaintenance(): boolean {
    return this.oldStatus.isMaintenance() && !this.newStatus.isMaintenance()
  }

  /**
   * 检查是否进入错误状态
   */
  isEnteringError(): boolean {
    return !this.oldStatus.isError() && this.newStatus.isError()
  }
}