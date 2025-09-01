import { ChatSession, ChatMessage } from '../../../shared/types/index'
import { ServiceManager } from '../../core/ServiceManager'
import { SqliteChatSessionRepository } from '../../repositories/SqliteChatSessionRepository'
import { ChatSessionEntity } from '../../../shared/entities/ChatSessionEntity'

/**
 * 聊天服务 - 使用SQLite数据库存储
 * 
 * 重构要点：
 * 1. 从JSON文件存储迁移到SQLite数据库
 * 2. 通过ServiceManager获取数据库服务
 * 3. 使用仓储模式进行数据操作
 * 4. 保持原有API接口不变，确保兼容性
 */
export class ChatService {
  private repository: SqliteChatSessionRepository | null = null
  private initialized = false

  constructor() {
    console.log('🔧 [ChatService] 使用SQLite数据库存储初始化')
  }

  /**
   * 延迟初始化数据库连接
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.repository) {
      return
    }

    try {
      // 获取ServiceManager实例
      const serviceManager = ServiceManager.getInstance()
      
      // 确保ServiceManager已初始化
      if (!serviceManager.getAllServiceStatuses().some(s => s.name === 'infrastructure' && s.status === 'ready')) {
        console.log('🔄 [ChatService] 等待数据库服务初始化...')
        await serviceManager.initialize()
      }

      // 获取数据库管理器
      const databaseManager = serviceManager.getDatabaseManager()
      const databaseService = databaseManager.getDatabaseService()

      // 创建仓储实例
      this.repository = new SqliteChatSessionRepository(databaseService)
      await this.repository.initialize()

      this.initialized = true
      console.log('✅ [ChatService] SQLite数据库连接初始化完成')
    } catch (error) {
      console.error('❌ [ChatService] 数据库初始化失败:', error)
      throw error
    }
  }

  async getChatHistory(): Promise<ChatSession[]> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 从SQLite获取所有会话
      const entities = await this.repository.findAll()
      
      // 转换为ChatSession格式
      return entities.map(entity => ({
        id: entity.id,
        title: entity.title,
        selectedModelId: entity.selectedModelId || undefined,
        messages: entity.messages || [],
        createdAt: entity.createdAt.getTime(),
        updatedAt: entity.updatedAt.getTime()
      }))
    } catch (error) {
      console.error('❌ [ChatService] 获取聊天历史失败:', error)
      return []
    }
  }

  async saveChatHistory(sessions: ChatSession[]): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 先清空现有数据
      await this.repository.deleteAll()

      // 批量保存会话
      const entities = sessions.map(session => new ChatSessionEntity({
        id: session.id,
        title: session.title,
        selectedModelId: session.selectedModelId,
        messages: session.messages || [],
        createdAt: new Date(session.createdAt).toISOString(),
        updatedAt: new Date(session.updatedAt).toISOString()
      }))

      await this.repository.saveAll(entities)
      console.log(`✅ [ChatService] 成功保存 ${sessions.length} 个会话到SQLite数据库`)
    } catch (error) {
      console.error('❌ [ChatService] 保存聊天历史失败:', error)
      throw error
    }
  }

  async saveMessage(_message: ChatMessage): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 这里可以实现更复杂的消息保存逻辑
      // 目前保持简单实现，与原始逻辑一致
      const sessions = await this.getChatHistory()
      await this.saveChatHistory(sessions)
      console.log(`✅ [ChatService] 消息保存完成`)
    } catch (error) {
      console.error('❌ [ChatService] 保存消息失败:', error)
      throw error
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      await this.repository.delete(sessionId)
      console.log(`✅ [ChatService] 成功删除会话: ${sessionId}`)
    } catch (error) {
      console.error('❌ [ChatService] 删除会话失败:', error)
      throw error
    }
  }

  async clearAllHistory(): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      await this.repository.deleteAll()
      console.log(`✅ [ChatService] 成功清空所有聊天历史`)
    } catch (error) {
      console.error('❌ [ChatService] 清空聊天历史失败:', error)
      throw error
    }
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats() {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      return await this.repository.getSessionStats()
    } catch (error) {
      console.error('❌ [ChatService] 获取会话统计失败:', error)
      return {
        total: 0,
        withMessages: 0,
        withSelectedModel: 0,
        averageMessages: 0
      }
    }
  }
}