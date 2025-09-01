/**
 * 角色状态值对象
 */

import { ValueObject } from '../../../core/ValueObject'

type StatusType = 'inactive' | 'active' | 'suspended' | 'error'

export class RoleStatus extends ValueObject {
  private constructor(
    private readonly status: StatusType,
    private readonly reason?: string
  ) {
    super()
    this.validate()
  }

  /**
   * 创建非活跃状态
   */
  static inactive(reason?: string): RoleStatus {
    return new RoleStatus('inactive', reason)
  }

  /**
   * 创建活跃状态
   */
  static active(): RoleStatus {
    return new RoleStatus('active')
  }

  /**
   * 创建暂停状态
   */
  static suspended(reason?: string): RoleStatus {
    return new RoleStatus('suspended', reason)
  }

  /**
   * 创建错误状态
   */
  static error(reason: string): RoleStatus {
    return new RoleStatus('error', reason)
  }

  /**
   * 从字符串创建状态
   */
  static fromString(status: string, reason?: string): RoleStatus {
    if (!this.isValidStatus(status)) {
      throw new Error(`Invalid role status: ${status}. Must be one of: inactive, active, suspended, error`)
    }
    return new RoleStatus(status as StatusType, reason)
  }

  /**
   * 检查是否为有效状态
   */
  private static isValidStatus(status: string): status is StatusType {
    return ['inactive', 'active', 'suspended', 'error'].includes(status)
  }

  /**
   * 获取状态值
   */
  getStatus(): StatusType {
    return this.status
  }

  /**
   * 获取状态原因
   */
  getReason(): string | undefined {
    return this.reason
  }

  /**
   * 检查是否为非活跃状态
   */
  isInactive(): boolean {
    return this.status === 'inactive'
  }

  /**
   * 检查是否为活跃状态
   */
  isActive(): boolean {
    return this.status === 'active'
  }

  /**
   * 检查是否为暂停状态
   */
  isSuspended(): boolean {
    return this.status === 'suspended'
  }

  /**
   * 检查是否为错误状态
   */
  isError(): boolean {
    return this.status === 'error'
  }

  /**
   * 检查是否可以激活
   */
  canActivate(): boolean {
    return this.status === 'inactive' || this.status === 'suspended'
  }

  /**
   * 检查是否可以停用
   */
  canDeactivate(): boolean {
    return this.status === 'active' || this.status === 'suspended'
  }

  /**
   * 检查是否可以暂停
   */
  canSuspend(): boolean {
    return this.status === 'active'
  }

  /**
   * 检查是否可以恢复
   */
  canResume(): boolean {
    return this.status === 'suspended'
  }

  /**
   * 获取状态显示名称
   */
  getDisplayName(): string {
    const displayNames: Record<StatusType, string> = {
      inactive: '未激活',
      active: '已激活',
      suspended: '已暂停',
      error: '错误'
    }
    return displayNames[this.status]
  }

  /**
   * 获取状态颜色（用于UI显示）
   */
  getColor(): string {
    const colors: Record<StatusType, string> = {
      inactive: 'gray',
      active: 'green',
      suspended: 'orange',
      error: 'red'
    }
    return colors[this.status]
  }

  /**
   * 获取状态图标（用于UI显示）
   */
  getIcon(): string {
    const icons: Record<StatusType, string> = {
      inactive: '⚪',
      active: '🟢',
      suspended: '🟡',
      error: '🔴'
    }
    return icons[this.status]
  }

  /**
   * 状态相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof RoleStatus)) return false
    return this.status === other.status && this.reason === other.reason
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return `${this.status}:${this.reason || ''}`
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.reason ? `${this.status} (${this.reason})` : this.status
  }

  /**
   * 验证状态
   */
  protected validate(): void {
    if (!RoleStatus.isValidStatus(this.status)) {
      throw new Error(`Invalid role status: ${this.status}`)
    }

    if (this.reason !== undefined) {
      if (typeof this.reason !== 'string') {
        throw new Error('Status reason must be a string')
      }
      
      if (this.reason.length > 200) {
        throw new Error('Status reason cannot be longer than 200 characters')
      }
    }

    // 错误状态必须有原因
    if (this.status === 'error' && !this.reason) {
      throw new Error('Error status must have a reason')
    }
  }
}