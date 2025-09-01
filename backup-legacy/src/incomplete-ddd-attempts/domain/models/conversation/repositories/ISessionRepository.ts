/**
 * 会话仓储接口
 * 定义会话数据访问的抽象契约
 */

import { ChatSession } from '../entities/ChatSession'
import { SessionId } from '../value-objects/SessionId'
import { Result } from '../../../shared/primitives/Result'

export interface SessionSearchCriteria {
  keyword?: string
  isArchived?: boolean
  tags?: string[]
  category?: string
  modelId?: string
  createdAfter?: Date
  createdBefore?: Date
  hasMessages?: boolean
  minMessageCount?: number
  maxMessageCount?: number
}

export interface SessionListOptions {
  offset?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'messageCount'
  sortOrder?: 'asc' | 'desc'
}

export interface ISessionRepository {
  /**
   * 根据ID查找会话
   */
  findById(id: SessionId): Promise<Result<ChatSession | null, Error>>

  /**
   * 保存会话（创建或更新）
   */
  save(session: ChatSession): Promise<Result<void, Error>>

  /**
   * 删除会话
   */
  delete(id: SessionId): Promise<Result<void, Error>>

  /**
   * 查找所有会话
   */
  findAll(options?: SessionListOptions): Promise<Result<ChatSession[], Error>>

  /**
   * 根据条件搜索会话
   */
  findByCriteria(
    criteria: SessionSearchCriteria,
    options?: SessionListOptions
  ): Promise<Result<ChatSession[], Error>>

  /**
   * 获取会话总数
   */
  count(criteria?: SessionSearchCriteria): Promise<Result<number, Error>>

  /**
   * 检查会话是否存在
   */
  exists(id: SessionId): Promise<Result<boolean, Error>>

  /**
   * 获取最近的会话
   */
  findRecent(limit: number): Promise<Result<ChatSession[], Error>>

  /**
   * 获取收藏的会话
   */
  findBookmarked(options?: SessionListOptions): Promise<Result<ChatSession[], Error>>

  /**
   * 批量删除会话
   */
  deleteMany(ids: SessionId[]): Promise<Result<number, Error>>

  /**
   * 归档会话
   */
  archive(id: SessionId): Promise<Result<void, Error>>

  /**
   * 取消归档会话
   */
  unarchive(id: SessionId): Promise<Result<void, Error>>

  /**
   * 批量归档会话
   */
  archiveMany(ids: SessionId[]): Promise<Result<number, Error>>

  /**
   * 根据标签查找会话
   */
  findByTags(tags: string[], options?: SessionListOptions): Promise<Result<ChatSession[], Error>>

  /**
   * 获取所有标签
   */
  getAllTags(): Promise<Result<string[], Error>>

  /**
   * 获取会话统计信息
   */
  getStatistics(): Promise<Result<{
    totalSessions: number
    archivedSessions: number
    totalMessages: number
    averageMessagesPerSession: number
    mostUsedModels: Array<{ modelId: string; count: number }>
    dailySessionCount: Array<{ date: string; count: number }>
  }, Error>>
}