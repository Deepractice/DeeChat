/**
 * SessionService - 会话管理服务
 *
 * 职责：
 * - 管理对话会话的生命周期
 * - 处理会话创建、查询、删除等操作
 * - 提供会话相关的业务逻辑
 */

import { Service } from 'typedi'
import { ConversationRepository } from '../repositories/ConversationRepository.js'
import { ConversationSession, CreateSessionInput } from '../types/ConversationTypes.js'

@Service()
export class SessionService {
  constructor(private conversationRepository: ConversationRepository) {}

  /**
   * 创建新会话
   */
  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    console.log(`📝 [SessionService] 创建新会话`, {
      title: input.title,
      ai_config: input.ai_config
    })

    // 验证AI配置
    if (!input.ai_config.baseUrl || !input.ai_config.model || !input.ai_config.apiKey) {
      throw new Error('AI配置不完整：需要 baseUrl、model 和 apiKey')
    }

    // 生成默认标题
    const title = input.title || this.generateDefaultTitle()

    const session = await this.conversationRepository.createSession({
      title,
      aiModel: input.ai_config.model
    })

    console.log(`✅ 会话创建成功: ${session.id}`)
    return session
  }

  /**
   * 获取所有会话
   */
  async getAllSessions(): Promise<ConversationSession[]> {
    console.log(`📋 [SessionService] 获取所有会话`)

    const sessions = await this.conversationRepository.getAllSessions()

    console.log(`📋 获取到 ${sessions.length} 个会话`)
    return sessions
  }

  /**
   * 获取单个会话
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    console.log(`🔍 [SessionService] 获取会话: ${sessionId}`)

    const session = await this.conversationRepository.getSession(sessionId)

    if (session) {
      console.log(`✅ 会话找到: ${session.title}`)
    } else {
      console.log(`❌ 会话未找到: ${sessionId}`)
    }

    return session
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    console.log(`🗑️ [SessionService] 删除会话: ${sessionId}`)

    // 先检查会话是否存在
    const session = await this.conversationRepository.getSession(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    await this.conversationRepository.deleteSession(sessionId)

    console.log(`✅ 会话删除成功: ${session.title}`)
  }

  /**
   * 搜索会话
   */
  async searchSessions(query: string): Promise<ConversationSession[]> {
    console.log(`🔍 [SessionService] 搜索会话: "${query}"`)

    if (!query.trim()) {
      return await this.getAllSessions()
    }

    const sessions = await this.conversationRepository.searchSessions(query)

    console.log(`🔍 搜索结果: ${sessions.length} 个会话`)
    return sessions
  }

  /**
   * 获取会话统计信息
   */
  async getSessionStats(): Promise<{
    totalSessions: number
    totalMessages: number
    averageMessagesPerSession: number
  }> {
    console.log(`📊 [SessionService] 获取会话统计`)

    const stats = await this.conversationRepository.getStats()
    const averageMessagesPerSession = stats.sessionCount > 0
      ? Math.round(stats.totalMessages / stats.sessionCount * 100) / 100
      : 0

    const result = {
      totalSessions: stats.sessionCount,
      totalMessages: stats.totalMessages,
      averageMessagesPerSession
    }

    console.log(`📊 统计结果:`, result)
    return result
  }

  /**
   * 更新会话标题
   */
  async updateSessionTitle(sessionId: string, newTitle: string): Promise<void> {
    console.log(`✏️ [SessionService] 更新会话标题: ${sessionId} -> "${newTitle}"`)

    const session = await this.conversationRepository.getSession(sessionId)
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`)
    }

    // 这里需要添加updateSession方法到Repository，目前暂时不实现
    console.log(`⚠️ 会话标题更新功能待实现`)
  }

  /**
   * 获取最近活跃的会话
   */
  async getRecentSessions(limit: number = 10): Promise<ConversationSession[]> {
    console.log(`📅 [SessionService] 获取最近 ${limit} 个活跃会话`)

    const allSessions = await this.conversationRepository.getAllSessions()

    // 按更新时间排序，取最近的
    const recentSessions = allSessions
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit)

    console.log(`📅 获取到 ${recentSessions.length} 个最近会话`)
    return recentSessions
  }

  /**
   * 生成默认会话标题
   */
  private generateDefaultTitle(): string {
    const timestamp = new Date().toLocaleString('zh-CN')
    return `新对话 - ${timestamp}`
  }

  /**
   * 验证会话输入
   */
  private validateSessionInput(input: CreateSessionInput): void {
    if (!input.aiModel?.trim()) {
      throw new Error('AI模型不能为空')
    }

    if (input.title && input.title.length > 100) {
      throw new Error('会话标题不能超过100个字符')
    }
  }
}