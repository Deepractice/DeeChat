import { ConversationApplicationService, ICreateSessionRequest, ISendMessageRequest, IGetSessionRequest, IListSessionsRequest } from '../../../application/services/ConversationApplicationService'
import { Result } from '../../../domain/shared/primitives/Result'

/**
 * 聊天服务 - 基于DDD架构的纯净实现
 * 
 * 设计原则：
 * 1. 完全基于DDD应用服务层
 * 2. 面向接口编程，依赖注入
 * 3. 统一的错误处理和结果返回
 * 4. 业务逻辑委托给应用服务
 */
export class ChatService {
  private conversationService: ConversationApplicationService
  private initialized = false

  constructor(conversationService: ConversationApplicationService) {
    this.conversationService = conversationService
    console.log('🎯 [ChatService] DDD架构初始化完成')
  }

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // DDD架构中，初始化由依赖注入容器负责
      // 这里只需要标记为已初始化
      this.initialized = true
      console.log('✅ [ChatService] 服务初始化完成')
    } catch (error) {
      console.error('❌ [ChatService] 服务初始化失败:', error)
      throw error
    }
  }

  /**
   * 获取所有聊天会话
   */
  async getAllChatHistory(): Promise<any[]> {
    try {
      await this.ensureInitialized()
      
      const request: IListSessionsRequest = {
        limit: 1000, // 获取所有会话
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      }

      const result = await this.conversationService.listSessions(request)
      
      if (result.isError()) {
        console.error('❌ [ChatService] 获取聊天历史失败:', result.getError())
        return []
      }

      const { sessions } = result.getValue()
      
      // 转换为兼容格式
      return sessions.map(session => ({
        id: session.getId().getValue(),
        title: session.getTitle(),
        selectedModelId: undefined, // TODO: 需要从session中获取模型信息
        messages: [], // TODO: 需要单独获取消息
        createdAt: session.getCreatedAt().getTime(),
        updatedAt: session.getUpdatedAt().getTime()
      }))
    } catch (error) {
      console.error('❌ [ChatService] 获取聊天历史失败:', error)
      return []
    }
  }

  /**
   * 保存聊天历史 - 在DDD架构中不建议批量操作
   * 建议使用单个会话/消息的创建和更新方法
   */
  async saveChatHistory(sessions: any[]): Promise<void> {
    console.warn('⚠️ [ChatService] saveChatHistory方法在DDD架构中已弃用')
    console.warn('⚠️ [ChatService] 请使用 createNewSession 和 sendMessage 方法')
    
    // 为了向后兼容，暂时保留空实现
    console.log(`📝 [ChatService] 跳过批量保存 ${sessions.length} 个会话（DDD架构中不推荐）`)
  }

  /**
   * 保存消息 - 请使用 sendMessage 方法
   */
  async saveMessage(message: any): Promise<void> {
    console.warn('⚠️ [ChatService] saveMessage方法在DDD架构中已弃用')
    console.warn('⚠️ [ChatService] 请使用 sendMessage 方法')
    console.log(`📝 [ChatService] 跳过消息保存（请使用sendMessage方法）`)
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      await this.ensureInitialized()
      
      const result = await this.conversationService.deleteSession(sessionId)
      
      if (result.isError()) {
        throw result.getError()
      }

      console.log(`✅ [ChatService] 成功删除会话: ${sessionId}`)
    } catch (error) {
      console.error('❌ [ChatService] 删除会话失败:', error)
      throw error
    }
  }

  /**
   * 清空所有历史记录 - 在DDD架构中需要逐个删除
   */
  async clearAllHistory(): Promise<void> {
    try {
      await this.ensureInitialized()
      
      // 首先获取所有会话
      const sessions = await this.getAllChatHistory()
      
      // 逐个删除会话
      for (const session of sessions) {
        await this.deleteSession(session.id)
      }
      
      console.log(`✅ [ChatService] 成功清空所有聊天历史 (${sessions.length} 个会话)`)
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
      
      // 获取所有会话
      const sessions = await this.getAllChatHistory()
      
      // 计算统计信息
      const stats = {
        total: sessions.length,
        withMessages: sessions.filter(s => s.messages && s.messages.length > 0).length,
        withSelectedModel: sessions.filter(s => s.selectedModelId).length,
        averageMessages: sessions.length > 0 
          ? sessions.reduce((sum, s) => sum + (s.messages?.length || 0), 0) / sessions.length 
          : 0
      }
      
      return stats
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

  /**
   * 获取所有会话实体（兼容旧接口）
   */
  async getAllSessions(): Promise<any[]> {
    try {
      await this.ensureInitialized()
      
      const request: IListSessionsRequest = {
        limit: 1000,
        sortBy: 'updatedAt',
        sortOrder: 'desc'
      }

      const result = await this.conversationService.listSessions(request)
      
      if (result.isError()) {
        throw result.getError()
      }

      const { sessions } = result.getValue()
      
      // 转换为兼容格式
      return sessions.map(session => ({
        id: session.getId().getValue(),
        title: session.getTitle(),
        messages: [], // TODO: 需要单独获取消息
        createdAt: session.getCreatedAt().toISOString(),
        updatedAt: session.getUpdatedAt().toISOString(),
        selectedModelId: undefined // TODO: 从session获取模型信息
      }))
    } catch (error) {
      console.error('❌ [ChatService] 获取会话列表失败:', error)
      throw error
    }
  }

  /**
   * 创建新会话
   */
  async createNewSession(title?: string): Promise<string> {
    try {
      await this.ensureInitialized()
      
      const request: ICreateSessionRequest = {
        title: title || `新会话 - ${new Date().toLocaleString()}`
      }

      const result = await this.conversationService.createSession(request)
      
      if (result.isError()) {
        throw result.getError()
      }

      const { sessionId } = result.getValue()
      console.log(`✅ [ChatService] 成功创建新会话: ${sessionId}`)
      return sessionId
    } catch (error) {
      console.error('❌ [ChatService] 创建新会话失败:', error)
      throw error
    }
  }

  /**
   * 获取指定会话的消息历史
   */
  async getChatHistory(sessionId: string): Promise<{ messages: any[], totalCount: number }> {
    try {
      await this.ensureInitialized()
      
      const result = await this.conversationService.getSessionMessages(sessionId)
      
      if (result.isError()) {
        console.log(`⚠️ [ChatService] 会话不存在或获取失败: ${sessionId}`)
        return { messages: [], totalCount: 0 }
      }

      const { messages, total } = result.getValue()
      
      // 转换为兼容格式
      const convertedMessages = messages.map(msg => ({
        id: msg.getId().getValue(),
        content: msg.getContent(),
        role: msg.getRole(),
        createdAt: msg.getCreatedAt().toISOString()
      }))

      console.log(`✅ [ChatService] 成功获取会话历史: ${sessionId}, ${total} 条消息`)
      return { 
        messages: convertedMessages, 
        totalCount: total 
      }
    } catch (error) {
      console.error('❌ [ChatService] 获取会话历史失败:', error)
      return { messages: [], totalCount: 0 }
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(sessionId: string, content: string, role: 'user' | 'assistant' = 'user'): Promise<{ success: boolean; messageCount: number }> {
    try {
      await this.ensureInitialized()
      
      const request: ISendMessageRequest = {
        sessionId,
        content,
        role,
      }

      const result = await this.conversationService.sendMessage(request)
      
      if (result.isError()) {
        throw result.getError()
      }

      // 获取更新后的消息数量
      const historyResult = await this.getChatHistory(sessionId)
      
      console.log(`✅ [ChatService] 成功发送消息到会话: ${sessionId}`)
      return {
        success: true,
        messageCount: historyResult.totalCount
      }
    } catch (error) {
      console.error('❌ [ChatService] 发送消息失败:', error)
      throw error
    }
  }
}