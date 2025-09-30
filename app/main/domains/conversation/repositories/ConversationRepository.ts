/**
 * ConversationRepository - 对话数据访问层
 *
 * 职责：
 * - 封装ConversationStorage的数据访问操作
 * - 提供领域友好的数据访问接口
 * - 处理数据转换和映射
 */

import { Service } from 'typedi'
import { ConversationStorage } from '@deepracticex/conversation-storage'
import { ConversationSession, ConversationMessage } from '../types/ConversationTypes.js'

@Service()
export class ConversationRepository {
  private conversationStorage: ConversationStorage | null = null

  /**
   * 设置存储实例
   */
  setStorage(storage: ConversationStorage): void {
    this.conversationStorage = storage
  }

  /**
   * 获取存储实例
   */
  private getStorage(): ConversationStorage {
    if (!this.conversationStorage) {
      throw new Error('ConversationStorage not initialized')
    }
    return this.conversationStorage
  }

  // ============ 会话管理 ============

  /**
   * 创建新会话
   */
  async createSession(input: { title: string; aiModel: string }): Promise<ConversationSession> {
    const storage = this.getStorage()

    // 修复：传入符合CreateSessionInput格式的对象
    const sessionInput = {
      title: input.title,
      ai_config_name: input.aiModel  // 字段名修正为ai_config_name
    }

    const session = await storage.createSession(sessionInput)
    return session
  }

  /**
   * 获取所有会话
   */
  async getAllSessions(): Promise<ConversationSession[]> {
    const storage = this.getStorage()
    return await storage.getSessions()
  }

  /**
   * 获取单个会话
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const storage = this.getStorage()
    return await storage.getSession(sessionId)
  }

  /**
   * 更新会话
   */
  async updateSession(sessionId: string, input: { title?: string; aiModel?: string }): Promise<void> {
    const storage = this.getStorage()

    // 转换输入格式为storage层期望的格式
    const updateInput: any = {}
    if (input.title !== undefined) {
      updateInput.title = input.title
    }
    if (input.aiModel !== undefined) {
      updateInput.ai_config_name = input.aiModel
    }

    await storage.updateSession(sessionId, updateInput)
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const storage = this.getStorage()
    await storage.deleteSession(sessionId)
  }

  // ============ 消息管理 ============

  /**
   * 添加消息
   */
  async addMessage(message: Omit<ConversationMessage, 'id' | 'timestamp'>): Promise<string> {
    const storage = this.getStorage()

    // 修复：调用正确的saveMessage方法，并且需要调整字段名
    const messageInput = {
      session_id: message.session_id,
      role: message.role,
      content: message.content,
      token_usage: message.token_usage,
      tool_calls: message.tool_calls,
      tool_call_id: message.tool_call_id
    }

    const savedMessage = storage.saveMessage(messageInput)
    return savedMessage.id
  }

  /**
   * 获取会话消息历史
   */
  async getMessageHistory(sessionId: string): Promise<ConversationMessage[]> {
    const storage = this.getStorage()
    return storage.getMessageHistory(sessionId)
  }

  // ============ 查询和统计 ============

  /**
   * 获取会话消息数量
   */
  async getMessageCount(sessionId: string): Promise<number> {
    const storage = this.getStorage()
    const messages = storage.getMessageHistory(sessionId)
    return messages.length
  }

  /**
   * 搜索会话
   */
  async searchSessions(query: string): Promise<ConversationSession[]> {
    const storage = this.getStorage()
    const sessions = await storage.getSessions()

    // 简单的标题搜索
    return sessions.filter(session =>
      session.title.toLowerCase().includes(query.toLowerCase())
    )
  }

  // ============ 缓存管理 ============

  /**
   * 清理缓存
   */
  async clearCache(): Promise<void> {
    const storage = this.getStorage()
    // ConversationStorage没有直接的缓存清理方法
    // 这里可以添加具体的缓存清理逻辑
    console.log('📋 ConversationRepository cache cleared')
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{ sessionCount: number; totalMessages: number }> {
    const storage = this.getStorage()
    const sessions = await storage.getSessions()

    let totalMessages = 0
    for (const session of sessions) {
      totalMessages += session.message_count
    }

    return {
      sessionCount: sessions.length,
      totalMessages
    }
  }
}