/**
 * 通知服务接口（出站端口）
 * 定义各类通知的抽象契约
 */

import { Result } from '../../../../domain/shared/primitives/Result'

export type NotificationType = 'info' | 'success' | 'warning' | 'error'

export interface INotification {
  id?: string
  type: NotificationType
  title: string
  message: string
  data?: any
  actions?: Array<{
    label: string
    action: string
    primary?: boolean
  }>
  options?: {
    persistent?: boolean
    duration?: number
    sound?: boolean
    showInOS?: boolean
  }
}

export interface INotificationFilter {
  userId?: string
  type?: NotificationType
  fromDate?: Date
  toDate?: Date
  read?: boolean
}

/**
 * 通知服务接口
 * 负责向用户发送各类通知
 */
export interface INotificationService {
  /**
   * 发送应用内通知
   */
  sendNotification(notification: INotification, userId?: string): Promise<Result<string, Error>>

  /**
   * 发送系统通知（OS级别）
   */
  sendSystemNotification(notification: INotification): Promise<Result<void, Error>>

  /**
   * 发送批量通知
   */
  sendBulkNotifications(
    notifications: INotification[],
    userIds?: string[]
  ): Promise<Result<string[], Error>>

  /**
   * 获取用户通知列表
   */
  getNotifications(
    userId: string,
    filter?: INotificationFilter,
    page?: number,
    limit?: number
  ): Promise<Result<{
    notifications: (INotification & { id: string; createdAt: Date; read: boolean })[]
    total: number
    unreadCount: number
  }, Error>>

  /**
   * 标记通知为已读
   */
  markAsRead(notificationId: string, userId: string): Promise<Result<void, Error>>

  /**
   * 标记所有通知为已读
   */
  markAllAsRead(userId: string): Promise<Result<void, Error>>

  /**
   * 删除通知
   */
  deleteNotification(notificationId: string, userId: string): Promise<Result<void, Error>>

  /**
   * 清理过期通知
   */
  cleanupExpiredNotifications(olderThanDays: number): Promise<Result<number, Error>>
}