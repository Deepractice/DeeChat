/**
 * 对话应用服务
 * 协调对话领域的业务用例
 */

import { HybridApplicationService, IApplicationContext } from './ApplicationService'
import { Result } from '../../domain/shared/primitives/Result'
import { 
  ConversationDomainService,
  IMessageCreationRequest,
  ISessionCreationRequest,
  ChatSession,
  Message,
  SessionId,
  MessageId,
  ISessionRepository,
  IMessageRepository
} from '../../domain/models/conversation'

export interface ICreateSessionRequest {
  title?: string
  userId?: string
  initialMessage?: string
}

export interface ICreateSessionResponse {
  sessionId: string
  session: ChatSession
}

export interface ISendMessageRequest {
  sessionId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  userId?: string
}

export interface ISendMessageResponse {
  messageId: string
  message: Message
  session: ChatSession
}

export interface IGetSessionRequest {
  sessionId: string
  userId?: string
}

export interface IGetSessionResponse {
  session: ChatSession | null
  found: boolean
}

export interface IListSessionsRequest {
  userId?: string
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface IListSessionsResponse {
  sessions: ChatSession[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export class ConversationApplicationService extends HybridApplicationService {
  constructor(
    private readonly conversationDomainService: ConversationDomainService,
    private readonly sessionRepository: ISessionRepository,
    private readonly messageRepository: IMessageRepository
  ) {
    super('ConversationService')
  }

  /**
   * 创建新会话
   */
  async createSession(request: ICreateSessionRequest): Promise<Result<ICreateSessionResponse, Error>> {
    const context = this.createContext(request.userId)

    return this.executeCommand('createSession', context, async () => {
      // 创建会话请求
      const sessionRequest: ISessionCreationRequest = {
        title: request.title || '新对话',
        userId: request.userId
      }

      // 通过领域服务创建会话
      const sessionResult = await this.conversationDomainService.createSession(sessionRequest)
      if (sessionResult.isError()) {
        return Result.error(sessionResult.getError())
      }

      const session = sessionResult.getValue()

      // 如果有初始消息，添加到会话中
      if (request.initialMessage) {
        const messageRequest: IMessageCreationRequest = {
          sessionId: session.getId(),
          content: request.initialMessage,
          role: 'user'
        }

        const messageResult = await this.conversationDomainService.addMessage(messageRequest)
        if (messageResult.isError()) {
          return Result.error(messageResult.getError())
        }
      }

      // 发布会话创建事件
      await this.publishEvent('session.created', {
        sessionId: session.getId().getValue(),
        userId: request.userId,
        hasInitialMessage: !!request.initialMessage
      }, context)

      return Result.success({
        sessionId: session.getId().getValue(),
        session
      })
    })
  }

  /**
   * 发送消息
   */
  async sendMessage(request: ISendMessageRequest): Promise<Result<ISendMessageResponse, Error>> {
    const context = this.createContext(request.userId, request.sessionId)

    return this.executeCommand('sendMessage', context, async () => {
      const sessionId = SessionId.fromString(request.sessionId)
      
      // 创建消息请求
      const messageRequest: IMessageCreationRequest = {
        sessionId,
        content: request.content,
        role: request.role
      }

      // 通过领域服务添加消息
      const result = await this.conversationDomainService.addMessage(messageRequest)
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const { message, session } = result.getValue()

      // 发布消息发送事件
      await this.publishEvent('message.sent', {
        messageId: message.getId().getValue(),
        sessionId: request.sessionId,
        role: request.role,
        contentLength: request.content.length
      }, context)

      return Result.success({
        messageId: message.getId().getValue(),
        message,
        session
      })
    })
  }

  /**
   * 获取会话
   */
  async getSession(request: IGetSessionRequest): Promise<Result<IGetSessionResponse, Error>> {
    const context = this.createContext(request.userId, request.sessionId)

    return this.executeQuery('getSession', context, async () => {
      const sessionId = SessionId.fromString(request.sessionId)
      const result = await this.sessionRepository.findById(sessionId)
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const session = result.getValue()
      return Result.success({
        session,
        found: session !== null
      })
    })
  }

  /**
   * 获取会话列表
   */
  async listSessions(request: IListSessionsRequest): Promise<Result<IListSessionsResponse, Error>> {
    const context = this.createContext(request.userId)

    return this.executeQuery('listSessions', context, async () => {
      const page = Math.max(1, request.page || 1)
      const limit = Math.min(100, Math.max(1, request.limit || 10))

      const criteria = {
        userId: request.userId
      }

      const options = {
        offset: (page - 1) * limit,
        limit,
        sortBy: request.sortBy || 'updatedAt',
        sortOrder: request.sortOrder || 'desc'
      }

      // 获取会话列表
      const sessionsResult = await this.sessionRepository.findByCriteria(criteria, options)
      if (sessionsResult.isError()) {
        return Result.error(sessionsResult.getError())
      }

      // 获取总数
      const countResult = await this.sessionRepository.count(criteria)
      if (countResult.isError()) {
        return Result.error(countResult.getError())
      }

      const sessions = sessionsResult.getValue()
      const total = countResult.getValue()

      return Result.success({
        sessions,
        total,
        page,
        limit,
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      })
    })
  }

  /**
   * 归档会话
   */
  async archiveSession(sessionId: string, userId?: string): Promise<Result<void, Error>> {
    const context = this.createContext(userId, sessionId)

    return this.executeCommand('archiveSession', context, async () => {
      const id = SessionId.fromString(sessionId)
      const result = await this.conversationDomainService.archiveSession(id)
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      // 发布会话归档事件
      await this.publishEvent('session.archived', {
        sessionId,
        userId
      }, context)

      return Result.success()
    })
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string, userId?: string): Promise<Result<void, Error>> {
    const context = this.createContext(userId, sessionId)

    return this.executeCommand('deleteSession', context, async () => {
      const id = SessionId.fromString(sessionId)
      const result = await this.sessionRepository.delete(id)
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      // 发布会话删除事件
      await this.publishEvent('session.deleted', {
        sessionId,
        userId
      }, context)

      return Result.success()
    })
  }

  /**
   * 获取会话消息
   */
  async getSessionMessages(
    sessionId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<Result<{
    messages: Message[]
    total: number
    page: number
    limit: number
    hasNext: boolean
    hasPrev: boolean
  }, Error>> {
    const context = this.createContext(undefined, sessionId)

    return this.executeQuery('getSessionMessages', context, async () => {
      const id = SessionId.fromString(sessionId)
      const normalizedPage = Math.max(1, page)
      const normalizedLimit = Math.min(100, Math.max(1, limit))

      const criteria = { sessionId: id }
      const options = {
        offset: (normalizedPage - 1) * normalizedLimit,
        limit: normalizedLimit,
        sortBy: 'createdAt' as const,
        sortOrder: 'asc' as const
      }

      // 获取消息列表
      const messagesResult = await this.messageRepository.findByCriteria(criteria, options)
      if (messagesResult.isError()) {
        return Result.error(messagesResult.getError())
      }

      // 获取消息总数
      const countResult = await this.messageRepository.count(criteria)
      if (countResult.isError()) {
        return Result.error(countResult.getError())
      }

      const messages = messagesResult.getValue()
      const total = countResult.getValue()

      return Result.success({
        messages,
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        hasNext: (normalizedPage * normalizedLimit) < total,
        hasPrev: normalizedPage > 1
      })
    })
  }

  /**
   * 获取会话统计
   */
  async getSessionStatistics(sessionId: string): Promise<Result<{
    messageCount: number
    userMessageCount: number
    assistantMessageCount: number
    firstMessageAt?: Date
    lastMessageAt?: Date
    totalCharacters: number
  }, Error>> {
    const context = this.createContext(undefined, sessionId)

    return this.executeQuery('getSessionStatistics', context, async () => {
      const id = SessionId.fromString(sessionId)
      const result = await this.conversationDomainService.getSessionStatistics(id)
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      return Result.success(result.getValue())
    })
  }
}