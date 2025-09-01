/**
 * 创建会话用例
 * 实现创建新聊天会话的完整业务流程
 */

import { CommandUseCase, IUseCaseRequest, IUseCaseResponse } from '../base/UseCase'
import { Result } from '../../../domain/shared/primitives/Result'
import { ConversationApplicationService } from '../../services/ConversationApplicationService'

export interface ICreateSessionUseCaseRequest extends IUseCaseRequest {
  title?: string
  userId?: string
  initialMessage?: string
}

export interface ICreateSessionUseCaseResponse extends IUseCaseResponse {
  sessionId: string
  title: string
  success: boolean
  message?: string
}

export class CreateSessionUseCase extends CommandUseCase<ICreateSessionUseCaseRequest, ICreateSessionUseCaseResponse> {
  constructor(
    private readonly conversationService: ConversationApplicationService
  ) {
    super()
  }

  protected async executeCommand(
    request: ICreateSessionUseCaseRequest
  ): Promise<Result<ICreateSessionUseCaseResponse, Error>> {
    // 使用应用服务创建会话
    const result = await this.conversationService.createSession({
      title: request.title,
      userId: request.userId,
      initialMessage: request.initialMessage
    })

    if (result.isError()) {
      return Result.error(result.getError())
    }

    const response = result.getValue()

    return Result.success({
      sessionId: response.sessionId,
      title: request.title || '新对话',
      success: true,
      message: 'Session created successfully'
    })
  }

  protected validate(request: ICreateSessionUseCaseRequest): Result<void, Error> {
    const baseValidation = super.validate(request)
    if (baseValidation.isError()) {
      return baseValidation
    }

    // 验证标题长度
    if (request.title && request.title.length > 100) {
      return Result.error(new Error('Session title cannot be longer than 100 characters'))
    }

    // 验证初始消息长度
    if (request.initialMessage && request.initialMessage.length > 10000) {
      return Result.error(new Error('Initial message cannot be longer than 10000 characters'))
    }

    return Result.success()
  }

  protected getSuccessMessage(): string {
    return 'Chat session created successfully'
  }
}