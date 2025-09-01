/**
 * 工具状态值对象
 */

import { ValueObject } from '../../../core/ValueObject'

type StatusType = 'available' | 'unavailable' | 'maintenance' | 'deprecated' | 'error'

export class ToolStatus extends ValueObject {
  private constructor(
    private readonly status: StatusType,
    private readonly reason?: string,
    private readonly since?: Date
  ) {
    super()
    this.validate()
  }

  /**
   * 创建可用状态
   */
  static available(): ToolStatus {
    return new ToolStatus('available', undefined, new Date())
  }

  /**
   * 创建不可用状态
   */
  static unavailable(reason?: string): ToolStatus {
    return new ToolStatus('unavailable', reason, new Date())
  }

  /**
   * 创建维护状态
   */
  static maintenance(reason?: string): ToolStatus {
    return new ToolStatus('maintenance', reason, new Date())
  }

  /**
   * 创建已弃用状态
   */
  static deprecated(reason?: string): ToolStatus {
    return new ToolStatus('deprecated', reason, new Date())
  }

  /**
   * 创建错误状态
   */
  static error(reason: string): ToolStatus {
    return new ToolStatus('error', reason, new Date())
  }

  /**
   * 从字符串创建状态
   */
  static fromString(status: string, reason?: string): ToolStatus {
    if (!this.isValidStatus(status)) {
      throw new Error(`Invalid tool status: ${status}. Must be one of: available, unavailable, maintenance, deprecated, error`)
    }
    return new ToolStatus(status as StatusType, reason, new Date())
  }

  /**
   * 检查是否为有效状态
   */
  private static isValidStatus(status: string): status is StatusType {
    return ['available', 'unavailable', 'maintenance', 'deprecated', 'error'].includes(status)
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
   * 获取状态变更时间
   */
  getSince(): Date | undefined {
    return this.since
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.status === 'available'
  }

  /**
   * 检查是否不可用
   */
  isUnavailable(): boolean {
    return this.status === 'unavailable'
  }

  /**
   * 检查是否在维护中
   */
  isMaintenance(): boolean {
    return this.status === 'maintenance'
  }

  /**
   * 检查是否已弃用
   */
  isDeprecated(): boolean {
    return this.status === 'deprecated'
  }

  /**
   * 检查是否有错误
   */
  isError(): boolean {
    return this.status === 'error'
  }

  /**
   * 检查是否可以执行
   */
  canExecute(): boolean {
    return this.status === 'available'
  }

  /**
   * 检查是否可以激活
   */
  canActivate(): boolean {
    return ['unavailable', 'maintenance', 'error'].includes(this.status)
  }

  /**
   * 检查是否可以停用
   */
  canDeactivate(): boolean {
    return this.status === 'available'
  }

  /**
   * 获取状态显示名称
   */
  getDisplayName(): string {
    const displayNames: Record<StatusType, string> = {
      available: '可用',
      unavailable: '不可用',
      maintenance: '维护中',
      deprecated: '已弃用',
      error: '错误'
    }
    return displayNames[this.status]
  }

  /**
   * 获取状态颜色（用于UI显示）
   */
  getColor(): string {
    const colors: Record<StatusType, string> = {
      available: 'green',
      unavailable: 'gray',
      maintenance: 'orange',
      deprecated: 'yellow',
      error: 'red'
    }
    return colors[this.status]
  }

  /**
   * 获取状态图标（用于UI显示）
   */
  getIcon(): string {
    const icons: Record<StatusType, string> = {
      available: '🟢',
      unavailable: '⚪',
      maintenance: '🟡',
      deprecated: '🟨',
      error: '🔴'
    }
    return icons[this.status]
  }

  /**
   * 获取状态优先级（用于排序）
   */
  getPriority(): number {
    const priorities: Record<StatusType, number> = {
      available: 5,
      maintenance: 4,
      unavailable: 3,
      deprecated: 2,
      error: 1
    }
    return priorities[this.status]
  }

  /**
   * 检查状态是否正常
   */
  isHealthy(): boolean {
    return ['available', 'maintenance'].includes(this.status)
  }

  /**
   * 检查状态是否需要关注
   */
  needsAttention(): boolean {
    return ['error', 'deprecated'].includes(this.status)
  }

  /**
   * 获取状态持续时间（毫秒）
   */
  getDuration(): number {
    if (!this.since) return 0
    return Date.now() - this.since.getTime()
  }

  /**
   * 获取状态持续时间（格式化字符串）
   */
  getDurationString(): string {
    const duration = this.getDuration()
    const seconds = Math.floor(duration / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}天前`
    if (hours > 0) return `${hours}小时前`
    if (minutes > 0) return `${minutes}分钟前`
    return `${seconds}秒前`
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof ToolStatus)) return false
    return this.status === other.status && 
           this.reason === other.reason
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
   * 转换为JSON
   */
  toJSON(): object {
    return {
      status: this.status,
      reason: this.reason,
      since: this.since?.toISOString(),
      displayName: this.getDisplayName(),
      color: this.getColor(),
      icon: this.getIcon(),
      canExecute: this.canExecute()
    }
  }

  /**
   * 验证状态
   */
  protected validate(): void {
    if (!ToolStatus.isValidStatus(this.status)) {
      throw new Error(`Invalid tool status: ${this.status}`)
    }

    if (this.reason !== undefined) {
      if (typeof this.reason !== 'string') {
        throw new Error('Status reason must be a string')
      }
      
      if (this.reason.length > 500) {
        throw new Error('Status reason cannot be longer than 500 characters')
      }
    }

    // 错误状态必须有原因
    if (this.status === 'error' && !this.reason) {
      throw new Error('Error status must have a reason')
    }
  }
}