/**
 * 发送消息用例
 * 实现发送聊天消息的完整业务流程
 */

import { CommandUseCase, IUseCaseRequest, IUseCaseResponse } from '../base/UseCase'
import { Result } from '../../../domain/shared/primitives/Result'
import { ConversationApplicationService } from '../../services/ConversationApplicationService'

export interface ISendMessageUseCaseRequest extends IUseCaseRequest {
  sessionId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  userId?: string
}

export interface ISendMessageUseCaseResponse extends IUseCaseResponse {
  messageId: string
  sessionId: string
  content: string
  role: string
  timestamp: Date
  success: boolean
}

export class SendMessageUseCase extends CommandUseCase<ISendMessageUseCaseRequest, ISendMessageUseCaseResponse> {
  constructor(
    private readonly conversationService: ConversationApplicationService
  ) {
    super()
  }

  protected async executeCommand(
    request: ISendMessageUseCaseRequest
  ): Promise<Result<ISendMessageUseCaseResponse, Error>> {
    // 使用应用服务发送消息
    const result = await this.conversationService.sendMessage({
      sessionId: request.sessionId,
      content: request.content,
      role: request.role,
      userId: request.userId
    })

    if (result.isError()) {
      return Result.error(result.getError())
    }

    const response = result.getValue()

    return Result.success({
      messageId: response.messageId,
      sessionId: request.sessionId,
      content: request.content,
      role: request.role,
      timestamp: new Date(),
      success: true
    })
  }

  protected validate(request: ISendMessageUseCaseRequest): Result<void, Error> {
    const baseValidation = super.validate(request)
    if (baseValidation.isError()) {
      return baseValidation
    }

    // 验证会话ID
    if (!request.sessionId || request.sessionId.trim().length === 0) {
      return Result.error(new Error('Session ID is required'))
    }

    // 验证消息内容
    if (!request.content || request.content.trim().length === 0) {
      return Result.error(new Error('Message content is required'))
    }

    if (request.content.length > 10000) {
      return Result.error(new Error('Message content cannot be longer than 10000 characters'))
    }

    // 验证角色
    if (!['user', 'assistant', 'system'].includes(request.role)) {
      return Result.error(new Error('Invalid message role'))
    }

    return Result.success()
  }

  protected async preProcess(request: ISendMessageUseCaseRequest): Promise<void> {
    // 清理消息内容
    request.content = request.content.trim()
  }

  protected getSuccessMessage(): string {
    return 'Message sent successfully'
  }
}