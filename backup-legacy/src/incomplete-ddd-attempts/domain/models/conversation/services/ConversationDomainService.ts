/**
 * 对话领域服务
 * 处理跨聚合的业务逻辑和复杂的业务规则
 */

import { ChatSession } from '../entities/ChatSession'
import { Message } from '../entities/Message'
import { SessionId } from '../value-objects/SessionId'
import { ISessionRepository } from '../repositories/ISessionRepository'
import { Result } from '../../../shared/primitives/Result'

export class ConversationDomainService {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  /**
   * 创建新会话并添加首条消息
   */
  async startConversation(
    userMessage: string,
    modelId?: string,
    title?: string
  ): Promise<Result<ChatSession, Error>> {
    try {
      // 创建新会话
      const session = ChatSession.create(title, modelId)
      
      // 添加用户消息
      const message = Message.createUserMessage(userMessage)
      session.addMessage(message)
      
      // 保存会话
      const saveResult = await this.sessionRepository.save(session)
      if (saveResult.isFailure) {
        return Result.failure(saveResult.getError())
      }
      
      return Result.success(session)
      
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  /**
   * 继续对话（添加消息到现有会话）
   */
  async continueConversation(
    sessionId: SessionId,
    userMessage: string
  ): Promise<Result<ChatSession, Error>> {
    try {
      // 查找会话
      const findResult = await this.sessionRepository.findById(sessionId)
      if (findResult.isFailure) {
        return Result.failure(findResult.getError())
      }
      
      const session = findResult.getValue()
      if (!session) {
        return Result.failure(new Error(`Session not found: ${sessionId.getValue()}`))
      }
      
      // 检查会话状态
      if (session.getIsArchived()) {
        return Result.failure(new Error('Cannot continue archived conversation'))
      }
      
      // 添加用户消息
      const message = Message.createUserMessage(userMessage)
      session.addMessage(message)
      
      // 保存会话
      const saveResult = await this.sessionRepository.save(session)
      if (saveResult.isFailure) {
        return Result.failure(saveResult.getError())
      }
      
      return Result.success(session)
      
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  /**
   * 添加AI响应到会话
   */
  async addAssistantResponse(
    sessionId: SessionId,
    response: string,
    metadata?: {
      modelId?: string
      tokens?: number
      responseTime?: number
      toolExecutions?: any[]
    }
  ): Promise<Result<ChatSession, Error>> {
    try {
      // 查找会话
      const findResult = await this.sessionRepository.findById(sessionId)
      if (findResult.isFailure) {
        return Result.failure(findResult.getError())
      }
      
      const session = findResult.getValue()
      if (!session) {
        return Result.failure(new Error(`Session not found: ${sessionId.getValue()}`))
      }
      
      // 创建AI消息
      const message = Message.createAssistantMessage(response, metadata)
      session.addMessage(message)
      
      // 更新会话元数据
      if (metadata) {
        const currentMetadata = session.getMetadata() || {}
        session.updateMetadata({
          ...currentMetadata,
          lastModelUsed: metadata.modelId || currentMetadata.lastModelUsed,
          tokenCount: (currentMetadata.tokenCount || 0) + (metadata.tokens || 0)
        })
      }
      
      // 保存会话
      const saveResult = await this.sessionRepository.save(session)
      if (saveResult.isFailure) {
        return Result.failure(saveResult.getError())
      }
      
      return Result.success(session)
      
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  /**
   * 合并两个会话（将源会话的消息合并到目标会话）
   */
  async mergeSessions(
    targetSessionId: SessionId,
    sourceSessionId: SessionId
  ): Promise<Result<ChatSession, Error>> {
    try {
      // 查找两个会话
      const [targetResult, sourceResult] = await Promise.all([
        this.sessionRepository.findById(targetSessionId),
        this.sessionRepository.findById(sourceSessionId)
      ])
      
      if (targetResult.isFailure) return Result.failure(targetResult.getError())
      if (sourceResult.isFailure) return Result.failure(sourceResult.getError())
      
      const targetSession = targetResult.getValue()
      const sourceSession = sourceResult.getValue()
      
      if (!targetSession) {
        return Result.failure(new Error(`Target session not found: ${targetSessionId.getValue()}`))
      }
      if (!sourceSession) {
        return Result.failure(new Error(`Source session not found: ${sourceSessionId.getValue()}`))
      }
      
      // 业务规则：不能合并已归档的会话
      if (targetSession.getIsArchived() || sourceSession.getIsArchived()) {
        return Result.failure(new Error('Cannot merge archived sessions'))
      }
      
      // 将源会话的消息添加到目标会话
      const sourceMessages = sourceSession.getMessages()
      for (const message of sourceMessages) {
        targetSession.addMessage(message)
      }
      
      // 保存目标会话
      const saveResult = await this.sessionRepository.save(targetSession)
      if (saveResult.isFailure) {
        return Result.failure(saveResult.getError())
      }
      
      // 删除源会话
      const deleteResult = await this.sessionRepository.delete(sourceSessionId)
      if (deleteResult.isFailure) {
        return Result.failure(deleteResult.getError())
      }
      
      return Result.success(targetSession)
      
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  /**
   * 复制会话
   */
  async duplicateSession(
    sourceSessionId: SessionId,
    newTitle?: string
  ): Promise<Result<ChatSession, Error>> {
    try {
      // 查找源会话
      const findResult = await this.sessionRepository.findById(sourceSessionId)
      if (findResult.isFailure) {
        return Result.failure(findResult.getError())
      }
      
      const sourceSession = findResult.getValue()
      if (!sourceSession) {
        return Result.failure(new Error(`Session not found: ${sourceSessionId.getValue()}`))
      }
      
      // 创建新会话
      const title = newTitle || `${sourceSession.getTitle().getValue()} (副本)`
      const newSession = ChatSession.create(title, sourceSession.getSelectedModelId())
      
      // 复制消息
      const sourceMessages = sourceSession.getMessages()
      for (const message of sourceMessages) {
        const newMessage = Message.reconstruct(
          Message.createUserMessage('').getId().getValue(), // 生成新ID
          message.getRole().getValue(),
          message.getContent(),
          message.getTimestamp().getMilliseconds(),
          message.getMetadata()
        )
        newSession.addMessage(newMessage)
      }
      
      // 复制元数据和偏好设置
      const metadata = sourceSession.getMetadata()
      const preferences = sourceSession.getPreferences()
      
      if (metadata) {
        newSession.updateMetadata(metadata)
      }
      
      if (preferences) {
        newSession.updatePreferences(preferences)
      }
      
      // 保存新会话
      const saveResult = await this.sessionRepository.save(newSession)
      if (saveResult.isFailure) {
        return Result.failure(saveResult.getError())
      }
      
      return Result.success(newSession)
      
    } catch (error) {
      return Result.failure(error as Error)
    }
  }

  /**
   * 清理空会话（没有消息的会话）
   */
  async cleanupEmptySessions(): Promise<Result<number, Error>> {
    try {
      // 查找没有消息的会话
      const findResult = await this.sessionRepository.findByCriteria({
        hasMessages: false
      })
      
      if (findResult.isFailure) {
        return Result.failure(findResult.getError())
      }
      
      const emptySessions = findResult.getValue()
      const sessionIds = emptySessions.map(session => session.getId())
      
      if (sessionIds.length === 0) {
        return Result.success(0)
      }
      
      // 批量删除空会话
      const deleteResult = await this.sessionRepository.deleteMany(sessionIds)
      if (deleteResult.isFailure) {
        return Result.failure(deleteResult.getError())
      }
      
      return Result.success(deleteResult.getValue())
      
    } catch (error) {
      return Result.failure(error as Error)
    }
  }
}