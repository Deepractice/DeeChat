/**
 * 对话IPC处理器
 * 实现IConversationHandler入站端口，处理来自渲染进程的对话相关请求
 */

import { IConversationHandler } from '../../../../application/ports/inbound/handlers/IConversationHandler'
import { 
  ICreateSessionRequest, 
  ICreateSessionResponse,
  ISendMessageRequest,
  ISendMessageResponse 
} from '../../../../application/services/ConversationApplicationService'
import { Result } from '../../../../domain/shared/primitives/Result'
import { BaseIPCHandler } from '../base/BaseIPCHandler'

export interface IIPCConversationRequest {
  action: 'createSession' | 'sendMessage' | 'getSession' | 'listSessions' | 'archiveSession' | 'deleteSession' | 'getSessionMessages'
  payload: any
  correlationId?: string
}

export interface IIPCConversationResponse {
  success: boolean
  data?: any
  error?: string
  correlationId?: string
}

export class ConversationIPCHandler extends BaseIPCHandler implements IConversationHandler {
  
  /**
   * 处理IPC消息
   */
  async handleIPCMessage(request: IIPCConversationRequest): Promise<IIPCConversationResponse> {
    const startTime = Date.now()
    
    try {
      this.logger.info(`🔄 [ConversationIPC] 处理请求: ${request.action}`, 'ConversationIPCHandler', {
        correlationId: request.correlationId,
        action: request.action
      })

      let result: Result<any, Error>

      switch (request.action) {
        case 'createSession':
          result = await this.createSession(request.payload)
          break
        case 'sendMessage':
          result = await this.sendMessage(request.payload)
          break
        case 'getSession':
          result = await this.getSession(request.payload)
          break
        case 'listSessions':
          result = await this.listSessions(request.payload)
          break
        case 'archiveSession':
          result = await this.archiveSession(request.payload)
          break
        case 'deleteSession':
          result = await this.deleteSession(request.payload)
          break
        case 'getSessionMessages':
          result = await this.getSessionMessages(request.payload)
          break
        default:
          result = Result.error(new Error(`Unknown action: ${request.action}`))
      }

      const duration = Date.now() - startTime

      if (result.isSuccess()) {
        this.logger.info(`✅ [ConversationIPC] 请求成功: ${request.action} (${duration}ms)`, 'ConversationIPCHandler', {
          correlationId: request.correlationId,
          duration
        })

        return {
          success: true,
          data: result.getValue(),
          correlationId: request.correlationId
        }
      } else {
        this.logger.error(`❌ [ConversationIPC] 请求失败: ${request.action} (${duration}ms)`, result.getError(), 'ConversationIPCHandler', {
          correlationId: request.correlationId,
          duration
        })

        return {
          success: false,
          error: result.getError().message,
          correlationId: request.correlationId
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`💥 [ConversationIPC] 请求异常: ${request.action} (${duration}ms)`, error, 'ConversationIPCHandler', {
        correlationId: request.correlationId,
        duration
      })

      return {
        success: false,
        error: error.message || 'Unknown error',
        correlationId: request.correlationId
      }
    }
  }

  // IConversationHandler 接口实现

  async createSession(request: ICreateSessionRequest): Promise<Result<ICreateSessionResponse, Error>> {
    try {
      // 数据验证和清理
      const cleanedRequest = this.validateAndCleanCreateSessionRequest(request)
      if (cleanedRequest.isError()) {
        return cleanedRequest
      }

      // 调用应用服务
      const result = await this.conversationService.createSession(cleanedRequest.getValue())
      
      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('conversation:sessionCreated', {
          session: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Create session failed: ${error.message}`))
    }
  }

  async sendMessage(request: ISendMessageRequest): Promise<Result<ISendMessageResponse, Error>> {
    try {
      // 数据验证和清理
      const cleanedRequest = this.validateAndCleanSendMessageRequest(request)
      if (cleanedRequest.isError()) {
        return cleanedRequest
      }

      // 调用应用服务
      const result = await this.conversationService.sendMessage(cleanedRequest.getValue())
      
      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('conversation:messageSent', {
          message: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Send message failed: ${error.message}`))
    }
  }

  async getSession(request: { sessionId: string }): Promise<Result<any, Error>> {
    try {
      if (!request.sessionId) {
        return Result.error(new Error('Session ID is required'))
      }

      const result = await this.conversationService.getSession({
        sessionId: request.sessionId
      })

      return result
    } catch (error) {
      return Result.error(new Error(`Get session failed: ${error.message}`))
    }
  }

  async listSessions(request: { 
    userId?: string 
    page?: number 
    limit?: number 
  }): Promise<Result<any, Error>> {
    try {
      const result = await this.conversationService.listSessions({
        userId: request.userId,
        page: request.page || 1,
        limit: request.limit || 20
      })

      return result
    } catch (error) {
      return Result.error(new Error(`List sessions failed: ${error.message}`))
    }
  }

  async archiveSession(request: { sessionId: string }): Promise<Result<void, Error>> {
    try {
      if (!request.sessionId) {
        return Result.error(new Error('Session ID is required'))
      }

      const result = await this.conversationService.archiveSession({
        sessionId: request.sessionId
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('conversation:sessionArchived', {
          sessionId: request.sessionId
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Archive session failed: ${error.message}`))
    }
  }

  async deleteSession(request: { sessionId: string }): Promise<Result<void, Error>> {
    try {
      if (!request.sessionId) {
        return Result.error(new Error('Session ID is required'))
      }

      const result = await this.conversationService.deleteSession({
        sessionId: request.sessionId
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('conversation:sessionDeleted', {
          sessionId: request.sessionId
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Delete session failed: ${error.message}`))
    }
  }

  async getSessionMessages(request: { 
    sessionId: string 
    page?: number 
    limit?: number 
  }): Promise<Result<any, Error>> {
    try {
      if (!request.sessionId) {
        return Result.error(new Error('Session ID is required'))
      }

      const result = await this.conversationService.getSessionMessages({
        sessionId: request.sessionId,
        page: request.page || 1,
        limit: request.limit || 50
      })

      return result
    } catch (error) {
      return Result.error(new Error(`Get session messages failed: ${error.message}`))
    }
  }

  /**
   * 验证和清理创建会话请求
   */
  private validateAndCleanCreateSessionRequest(request: ICreateSessionRequest): Result<ICreateSessionRequest, Error> {
    try {
      if (!request.title || request.title.trim().length === 0) {
        return Result.error(new Error('Session title is required'))
      }

      const cleaned: ICreateSessionRequest = {
        title: request.title.trim(),
        userId: request.userId?.trim() || undefined,
        initialMessage: request.initialMessage?.trim() || undefined
      }

      return Result.success(cleaned)
    } catch (error) {
      return Result.error(new Error(`Invalid create session request: ${error.message}`))
    }
  }

  /**
   * 验证和清理发送消息请求
   */
  private validateAndCleanSendMessageRequest(request: ISendMessageRequest): Result<ISendMessageRequest, Error> {
    try {
      if (!request.sessionId || request.sessionId.trim().length === 0) {
        return Result.error(new Error('Session ID is required'))
      }

      if (!request.content || request.content.trim().length === 0) {
        return Result.error(new Error('Message content is required'))
      }

      if (!['user', 'assistant', 'system'].includes(request.role)) {
        return Result.error(new Error('Invalid message role'))
      }

      const cleaned: ISendMessageRequest = {
        sessionId: request.sessionId.trim(),
        content: request.content.trim(),
        role: request.role,
        userId: request.userId?.trim() || undefined
      }

      return Result.success(cleaned)
    } catch (error) {
      return Result.error(new Error(`Invalid send message request: ${error.message}`))
    }
  }
}