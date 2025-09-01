import { ISessionRepository } from '../../../domains/conversation/repositories/ISessionRepository'
import { ChatSession } from '../../../domains/conversation/entities/ChatSession'
import { SessionId } from '../../../domains/conversation/value-objects/SessionId'
import { SqliteChatSessionRepository } from '../../../main/repositories/SqliteChatSessionRepository'

/**
 * SQLite会话仓储实现
 * 适配现有的SQLite实现，将其桥接到新的领域模型
 */
export class SqliteSessionRepository implements ISessionRepository {
  constructor(
    private legacyRepository: SqliteChatSessionRepository
  ) {}

  async findById(id: SessionId): Promise<ChatSession | null> {
    try {
      const entity = await this.legacyRepository.findById(id.value)
      if (!entity) return null

      // 转换为领域模型
      return ChatSession.reconstitute(
        entity.id,
        entity.title,
        entity.messages || [],
        entity.createdAt,
        entity.updatedAt,
        entity.selectedModelId,
        { /* metadata */ }
      )
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] findById failed:', error)
      return null
    }
  }

  async findAll(): Promise<ChatSession[]> {
    try {
      const entities = await this.legacyRepository.findAll()
      
      return entities.map(entity => 
        ChatSession.reconstitute(
          entity.id,
          entity.title,
          entity.messages || [],
          entity.createdAt,
          entity.updatedAt,
          entity.selectedModelId,
          { /* metadata */ }
        )
      )
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] findAll failed:', error)
      return []
    }
  }

  async save(session: ChatSession): Promise<void> {
    try {
      // 转换为实体格式
      const plainObject = session.toPlainObject()
      
      // 检查是否已存在
      const existing = await this.legacyRepository.findById(session.id.value)
      
      if (existing) {
        // 更新现有实体
        existing.title = plainObject.title
        existing.messages = plainObject.messages
        existing.selectedModelId = plainObject.selectedModelId
        existing.updatedAt = new Date(plainObject.updatedAt)
        
        await this.legacyRepository.update(existing)
      } else {
        // 创建新实体
        const { ChatSessionEntity } = await import('../../../shared/entities/ChatSessionEntity')
        const newEntity = new ChatSessionEntity({
          id: plainObject.id,
          title: plainObject.title,
          selectedModelId: plainObject.selectedModelId,
          messages: plainObject.messages,
          createdAt: new Date(plainObject.createdAt).toISOString(),
          updatedAt: new Date(plainObject.updatedAt).toISOString()
        })
        
        await this.legacyRepository.save(newEntity)
      }
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] save failed:', error)
      throw error
    }
  }

  async delete(id: SessionId): Promise<void> {
    try {
      await this.legacyRepository.delete(id.value)
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] delete failed:', error)
      throw error
    }
  }

  async deleteAll(): Promise<void> {
    try {
      await this.legacyRepository.deleteAll()
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] deleteAll failed:', error)
      throw error
    }
  }

  async getStats(): Promise<{
    total: number
    withMessages: number
    archived: number
    averageMessages: number
  }> {
    try {
      // 使用现有的统计功能
      const legacyStats = await this.legacyRepository.getSessionStats()
      
      return {
        total: legacyStats.total,
        withMessages: legacyStats.withMessages,
        archived: 0, // TODO: 实现归档统计
        averageMessages: legacyStats.averageMessages
      }
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] getStats failed:', error)
      return {
        total: 0,
        withMessages: 0,
        archived: 0,
        averageMessages: 0
      }
    }
  }

  async exists(id: SessionId): Promise<boolean> {
    try {
      const session = await this.legacyRepository.findById(id.value)
      return session !== null
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] exists failed:', error)
      return false
    }
  }

  async findByCondition(condition: {
    archived?: boolean
    hasMessages?: boolean
    createdAfter?: Date
    createdBefore?: Date
  }): Promise<ChatSession[]> {
    try {
      // 获取所有会话，然后在内存中过滤
      // TODO: 在真实项目中，这应该在数据库层面实现
      const allSessions = await this.findAll()
      
      return allSessions.filter(session => {
        // 归档状态过滤
        if (condition.archived !== undefined && session.isArchived() !== condition.archived) {
          return false
        }
        
        // 消息过滤
        if (condition.hasMessages !== undefined && session.hasUserMessages() !== condition.hasMessages) {
          return false
        }
        
        // 创建时间过滤
        if (condition.createdAfter && session.createdAt < condition.createdAfter) {
          return false
        }
        
        if (condition.createdBefore && session.createdAt > condition.createdBefore) {
          return false
        }
        
        return true
      })
    } catch (error) {
      console.error('❌ [SqliteSessionRepository] findByCondition failed:', error)
      return []
    }
  }
}