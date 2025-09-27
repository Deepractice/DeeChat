/**
 * IPCAdapter - IPC接口适配器
 *
 * 职责：
 * - 为前端暴露IPC接口
 * - 处理IPC请求和响应格式转换
 * - 协调各个服务的调用
 */

import { Service } from 'typedi'
import { SessionService } from '../services/SessionService.js'
import { MessageService } from '../services/MessageService.js'
import { ConversationRepository } from '../repositories/ConversationRepository.js'
import { ConversationSession, CreateSessionInput, SendMessageInput } from '../types/ConversationTypes.js'

@Service()
export class IPCAdapter {
  constructor(
    private sessionService: SessionService,
    private messageService: MessageService,
    private conversationRepository: ConversationRepository
  ) {}

  /**
   * 暴露给IPC的接口映射
   */
  exposeToIPC(): Record<string, Function> {
    return {
      // 会话管理
      'conversation:create-session': this.createSession.bind(this),
      'conversation:get-sessions': this.getSessions.bind(this),
      'conversation:get-session': this.getSession.bind(this),
      'conversation:delete-session': this.deleteSession.bind(this),

      // 消息处理
      'conversation:send-message': this.sendMessage.bind(this),
      'conversation:send-message-stream': this.sendMessageStream.bind(this),
      'conversation:get-message-history': this.getMessageHistory.bind(this),

      // 缓存和工具
      'conversation:clear-cache': this.clearCache.bind(this)
    }
  }

  // ============ 会话管理接口 ============

  /**
   * 创建新会话
   */
  private async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    console.log('📨 IPC请求: conversation:create-session', input)

    try {
      const session = await this.sessionService.createSession(input)
      console.log('✅ IPC响应: conversation:create-session')
      return session
    } catch (error) {
      console.error('❌ IPC错误: conversation:create-session', error)
      throw error
    }
  }

  /**
   * 获取所有会话
   */
  private async getSessions(): Promise<ConversationSession[]> {
    console.log('📨 IPC请求: conversation:get-sessions')

    try {
      const sessions = await this.sessionService.getAllSessions()
      console.log('✅ IPC响应: conversation:get-sessions')
      return sessions
    } catch (error) {
      console.error('❌ IPC错误: conversation:get-sessions', error)
      throw error
    }
  }

  /**
   * 获取单个会话
   */
  private async getSession(sessionId: string): Promise<ConversationSession | null> {
    console.log('📨 IPC请求: conversation:get-session', sessionId)

    try {
      const session = await this.sessionService.getSession(sessionId)
      console.log('✅ IPC响应: conversation:get-session')
      return session
    } catch (error) {
      console.error('❌ IPC错误: conversation:get-session', error)
      throw error
    }
  }

  /**
   * 删除会话
   */
  private async deleteSession(sessionId: string): Promise<void> {
    console.log('📨 IPC请求: conversation:delete-session', sessionId)

    try {
      await this.sessionService.deleteSession(sessionId)
      console.log('✅ IPC响应: conversation:delete-session')
    } catch (error) {
      console.error('❌ IPC错误: conversation:delete-session', error)
      throw error
    }
  }

  // ============ 消息处理接口 ============

  /**
   * 发送消息（非流式）
   */
  private async sendMessage(input: SendMessageInput): Promise<any> {
    console.log('📨 IPC请求: conversation:send-message', {
      sessionId: input.session_id,
      messageLength: input.content.length,
      aiModel: input.ai_config.model
    })

    try {
      const response = await this.messageService.sendMessage(input)
      console.log('✅ IPC响应: conversation:send-message')
      return response
    } catch (error) {
      console.error('❌ IPC错误: conversation:send-message', error)
      throw error
    }
  }

  /**
   * 发送消息（流式）
   */
  private async sendMessageStream(input: SendMessageInput, event?: any): Promise<{ status: string }> {
    console.log('📨 IPC请求: conversation:send-message-stream', {
      sessionId: input.session_id,
      messageLength: input.content.length,
      aiModel: input.ai_config.model
    })

    try {
      // 实时发送流式事件
      for await (const streamEvent of this.messageService.sendMessageStream(input)) {
        if (event && event.sender) {
          // 发送实时流式事件到前端
          console.log('📡 发送IPC流式事件:', JSON.stringify(streamEvent, null, 2))
          event.sender.send('conversation:stream-event', {
            sessionId: input.session_id,
            event: streamEvent
          })
        } else {
          console.log('❌ IPC事件发送失败: event或sender不存在')
        }
      }

      // 发送完成信号
      if (event && event.sender) {
        event.sender.send('conversation:stream-complete', {
          sessionId: input.session_id
        })
      }

      console.log('✅ IPC响应: conversation:send-message-stream')
      return { status: 'streaming_started' }
    } catch (error) {
      console.error('❌ IPC错误: conversation:send-message-stream', error)

      // 发送错误事件
      if (event && event.sender) {
        event.sender.send('conversation:stream-error', {
          sessionId: input.session_id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      throw error
    }
  }

  /**
   * 获取消息历史
   */
  private async getMessageHistory(sessionId: string): Promise<any[]> {
    console.log('📨 IPC请求: conversation:get-message-history', sessionId)

    try {
      const messages = await this.conversationRepository.getMessageHistory(sessionId)
      console.log('✅ IPC响应: conversation:get-message-history')
      return messages
    } catch (error) {
      console.error('❌ IPC错误: conversation:get-message-history', error)
      throw error
    }
  }

  // ============ 缓存和工具接口 ============

  /**
   * 清理缓存
   */
  private async clearCache(): Promise<void> {
    console.log('📨 IPC请求: conversation:clear-cache')

    try {
      await this.conversationRepository.clearCache()
      this.messageService.clearClientCache()
      console.log('✅ IPC响应: conversation:clear-cache')
    } catch (error) {
      console.error('❌ IPC错误: conversation:clear-cache', error)
      throw error
    }
  }
}