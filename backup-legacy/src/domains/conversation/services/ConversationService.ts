import { ChatSession } from '../entities/ChatSession'
import { SessionId } from '../value-objects/SessionId'
import { ISessionRepository } from '../repositories/ISessionRepository'

/**
 * 对话领域服务
 * 处理跨聚合的业务逻辑和复杂业务规则
 */
export class ConversationService {
  constructor(
    private sessionRepository: ISessionRepository
  ) {}

  /**
   * 创建新的聊天会话
   */
  async createNewSession(title?: string): Promise<SessionId> {
    // 业务规则：检查会话数量限制
    const existingSessions = await this.sessionRepository.findAll()
    const activeSessionsCount = existingSessions.filter(session => !session.isArchived()).length

    if (activeSessionsCount >= 100) { // 最多100个活跃会话
      throw new Error('Maximum number of active sessions reached (100)')
    }

    // 创建新会话
    const session = ChatSession.create(title)
    await this.sessionRepository.save(session)

    return session.id
  }

  /**
   * 发送消息到会话
   */
  async sendMessage(
    sessionId: SessionId, 
    content: string, 
    role: 'user' | 'assistant' = 'user'
  ): Promise<void> {
    // 获取会话
    const session = await this.sessionRepository.findById(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId.value}`)
    }

    // 业务规则：不能向已归档的会话发送消息
    if (session.isArchived()) {
      throw new Error('Cannot send message to archived session')
    }

    // 添加消息
    if (role === 'user') {
      session.addUserMessage(content)
    } else {
      session.addAssistantMessage(content)
    }

    // 保存会话
    await this.sessionRepository.save(session)
  }

  /**
   * 获取会话历史
   */
  async getSessionHistory(sessionId: SessionId): Promise<{
    session: ChatSession
    messageCount: number
  }> {
    const session = await this.sessionRepository.findById(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId.value}`)
    }

    return {
      session,
      messageCount: session.messageCount
    }
  }

  /**
   * 批量归档旧会话
   * 业务规则：30天未更新的会话自动归档
   */
  async archiveOldSessions(): Promise<number> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const oldSessions = await this.sessionRepository.findByCondition({
      archived: false,
      createdBefore: thirtyDaysAgo
    })

    let archivedCount = 0
    for (const session of oldSessions) {
      if (!session.isArchived() && session.hasUserMessages()) {
        session.archive()
        await this.sessionRepository.save(session)
        archivedCount++
      }
    }

    return archivedCount
  }

  /**
   * 清理可删除的会话
   * 业务规则：空会话或归档超过90天的会话可以删除
   */
  async cleanupDeletableSessions(): Promise<number> {
    const allSessions = await this.sessionRepository.findAll()
    const deletableSessions = allSessions.filter(session => session.canBeDeleted())

    let deletedCount = 0
    for (const session of deletableSessions) {
      await this.sessionRepository.delete(session.id)
      deletedCount++
    }

    return deletedCount
  }

  /**
   * 获取会话概览统计
   */
  async getSessionOverview(): Promise<{
    totalSessions: number
    activeSessions: number
    archivedSessions: number
    totalMessages: number
    averageMessagesPerSession: number
  }> {
    const stats = await this.sessionRepository.getStats()
    const allSessions = await this.sessionRepository.findAll()
    
    const activeSessions = allSessions.filter(session => !session.isArchived()).length
    const archivedSessions = allSessions.filter(session => session.isArchived()).length
    
    return {
      totalSessions: stats.total,
      activeSessions,
      archivedSessions,
      totalMessages: allSessions.reduce((sum, session) => sum + session.messageCount, 0),
      averageMessagesPerSession: stats.averageMessages
    }
  }

  /**
   * 智能建议会话标题
   * 基于会话内容自动生成合适的标题
   */
  async suggestSessionTitle(sessionId: SessionId): Promise<string> {
    const session = await this.sessionRepository.findById(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId.value}`)
    }

    // 简单的标题生成逻辑
    const firstUserMessage = session.messages.find(msg => msg.isFromUser())
    if (firstUserMessage) {
      const content = firstUserMessage.content.getValue()
      // 取前50个字符作为标题
      const title = content.length > 50 
        ? content.substring(0, 50) + '...'
        : content
      
      return title.replace(/\n/g, ' ').trim()
    }

    return `会话 - ${session.createdAt.toLocaleDateString()}`
  }
}