/**
 * 对话处理器接口（入站端口）
 * 定义对话相关操作的抽象契约
 */

import { Result } from '../../../../domain/shared/primitives/Result'

export interface ICreateSessionRequest {
  title?: string
  userId?: string
  initialMessage?: string
}

export interface ICreateSessionResponse {
  sessionId: string
  success: boolean
  message?: string
}

export interface ISendMessageRequest {
  sessionId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  userId?: string
}

export interface ISendMessageResponse {
  messageId: string
  sessionId: string
  success: boolean
  message?: string
}

export interface IGetSessionRequest {
  sessionId: string
  userId?: string
}

export interface IGetSessionResponse {
  session: any // 将来会定义具体的Session DTO
  found: boolean
}

export interface IListSessionsRequest {
  userId?: string
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface IListSessionsResponse {
  sessions: any[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export interface IGetSessionMessagesRequest {
  sessionId: string
  page?: number
  limit?: number
}

export interface IGetSessionMessagesResponse {
  messages: any[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * 对话处理器接口
 * 定义所有对话相关操作的契约
 */
export interface IConversationHandler {
  /**
   * 创建新会话
   */
  createSession(request: ICreateSessionRequest): Promise<Result<ICreateSessionResponse, Error>>

  /**
   * 发送消息
   */
  sendMessage(request: ISendMessageRequest): Promise<Result<ISendMessageResponse, Error>>

  /**
   * 获取会话详情
   */
  getSession(request: IGetSessionRequest): Promise<Result<IGetSessionResponse, Error>>

  /**
   * 获取会话列表
   */
  listSessions(request: IListSessionsRequest): Promise<Result<IListSessionsResponse, Error>>

  /**
   * 获取会话消息
   */
  getSessionMessages(request: IGetSessionMessagesRequest): Promise<Result<IGetSessionMessagesResponse, Error>>

  /**
   * 归档会话
   */
  archiveSession(sessionId: string, userId?: string): Promise<Result<void, Error>>

  /**
   * 删除会话
   */
  deleteSession(sessionId: string, userId?: string): Promise<Result<void, Error>>

  /**
   * 获取会话统计
   */
  getSessionStatistics(sessionId: string): Promise<Result<{
    messageCount: number
    userMessageCount: number
    assistantMessageCount: number
    firstMessageAt?: Date
    lastMessageAt?: Date
    totalCharacters: number
  }, Error>>
}