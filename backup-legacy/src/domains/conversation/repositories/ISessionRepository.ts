import { ChatSession } from '../entities/ChatSession'
import { SessionId } from '../value-objects/SessionId'

/**
 * 会话仓储接口
 * 定义会话数据访问的契约，由基础设施层实现
 */
export interface ISessionRepository {
  /**
   * 根据ID查找会话
   */
  findById(id: SessionId): Promise<ChatSession | null>

  /**
   * 查找所有会话
   */
  findAll(): Promise<ChatSession[]>

  /**
   * 保存会话
   */
  save(session: ChatSession): Promise<void>

  /**
   * 删除会话
   */
  delete(id: SessionId): Promise<void>

  /**
   * 删除所有会话
   */
  deleteAll(): Promise<void>

  /**
   * 获取会话统计信息
   */
  getStats(): Promise<{
    total: number
    withMessages: number
    archived: number
    averageMessages: number
  }>

  /**
   * 检查会话是否存在
   */
  exists(id: SessionId): Promise<boolean>

  /**
   * 按条件查找会话
   */
  findByCondition(condition: {
    archived?: boolean
    hasMessages?: boolean
    createdAfter?: Date
    createdBefore?: Date
  }): Promise<ChatSession[]>
}