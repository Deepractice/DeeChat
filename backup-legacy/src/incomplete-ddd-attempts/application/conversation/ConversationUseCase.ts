import { ChatSession } from '../../domains/conversation/entities/ChatSession'
import { SessionId } from '../../domains/conversation/value-objects/SessionId'
import { ConversationService } from '../../domains/conversation/services/ConversationService'
import { ISessionRepository } from '../../domains/conversation/repositories/ISessionRepository'

/**
 * 对话用例 - 应用服务层
 * 协调领域服务，处理完整的业务流程
 */
export class ConversationUseCase {
  constructor(
    private conversationService: ConversationService,
    private sessionRepository: ISessionRepository
  ) {}

  /**
   * 创建新会话用例
   */
  async createNewSession(title?: string): Promise<{
    sessionId: string
    session: any // 兼容现有格式
  }> {
    try {
      const sessionId = await this.conversationService.createNewSession(title)
      const session = await this.sessionRepository.findById(sessionId)
      
      if (!session) {
        throw new Error('Failed to retrieve created session')
      }

      return {
        sessionId: sessionId.value,
        session: session.toPlainObject()
      }
    } catch (error) {
      console.error('❌ [ConversationUseCase] 创建会话失败:', error)
      throw error
    }
  }

  /**
   * 发送消息用例
   */
  async sendMessage(
    sessionId: string,
    content: string,
    role: 'user' | 'assistant' = 'user'
  ): Promise<{
    success: boolean
    messageCount: number
  }> {
    try {
      const domainSessionId = SessionId.of(sessionId)
      await this.conversationService.sendMessage(domainSessionId, content, role)
      
      const { messageCount } = await this.conversationService.getSessionHistory(domainSessionId)

      console.log(`✅ [ConversationUseCase] 消息发送成功: ${sessionId}`)
      
      return {
        success: true,
        messageCount
      }
    } catch (error) {
      console.error('❌ [ConversationUseCase] 发送消息失败:', error)
      throw error
    }
  }

  /**
   * 获取所有会话用例
   */
  async getAllSessions(): Promise<any[]> {
    try {
      const sessions = await this.sessionRepository.findAll()
      
      // 转换为兼容格式
      return sessions.map(session => session.toPlainObject())
    } catch (error) {
      console.error('❌ [ConversationUseCase] 获取会话列表失败:', error)
      throw error
    }
  }

  /**
   * 获取会话历史用例
   */
  async getChatHistory(sessionId: string): Promise<{
    messages: any[]
    totalCount: number
  }> {
    try {
      const domainSessionId = SessionId.of(sessionId)
      const { session, messageCount } = await this.conversationService.getSessionHistory(domainSessionId)

      return {
        messages: session.messages.map(msg => msg.toPlainObject()),
        totalCount: messageCount
      }
    } catch (error) {
      console.error('❌ [ConversationUseCase] 获取会话历史失败:', error)
      return { messages: [], totalCount: 0 }
    }
  }

  /**
   * 删除会话用例
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const domainSessionId = SessionId.of(sessionId)
      await this.sessionRepository.delete(domainSessionId)
      
      console.log(`✅ [ConversationUseCase] 会话删除成功: ${sessionId}`)
    } catch (error) {
      console.error('❌ [ConversationUseCase] 删除会话失败:', error)
      throw error
    }
  }

  /**
   * 获取会话统计用例
   */
  async getSessionStats(): Promise<{
    total: number
    withMessages: number
    withSelectedModel: number
    averageMessages: number
  }> {
    try {
      const overview = await this.conversationService.getSessionOverview()
      
      return {
        total: overview.totalSessions,
        withMessages: overview.totalSessions - overview.activeSessions, // 简化实现
        withSelectedModel: 0, // TODO: 实现模型统计
        averageMessages: overview.averageMessagesPerSession
      }
    } catch (error) {
      console.error('❌ [ConversationUseCase] 获取统计失败:', error)
      return {
        total: 0,
        withMessages: 0,
        withSelectedModel: 0,
        averageMessages: 0
      }
    }
  }

  /**
   * 维护用例 - 定期清理和归档
   */
  async performMaintenance(): Promise<{
    archivedSessions: number
    deletedSessions: number
  }> {
    try {
      console.log('🧹 [ConversationUseCase] 开始执行维护任务...')
      
      const archivedCount = await this.conversationService.archiveOldSessions()
      const deletedCount = await this.conversationService.cleanupDeletableSessions()
      
      console.log(`✅ [ConversationUseCase] 维护完成: 归档${archivedCount}个会话, 删除${deletedCount}个会话`)
      
      return {
        archivedSessions: archivedCount,
        deletedSessions: deletedCount
      }
    } catch (error) {
      console.error('❌ [ConversationUseCase] 维护任务失败:', error)
      throw error
    }
  }
}