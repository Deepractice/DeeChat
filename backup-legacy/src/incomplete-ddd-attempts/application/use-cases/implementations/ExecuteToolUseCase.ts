/**
 * 执行工具用例
 * 实现MCP工具执行的完整业务流程
 */

import { CommandUseCase, IUseCaseRequest, IUseCaseResponse } from '../base/UseCase'
import { Result } from '../../../domain/shared/primitives/Result'
import { ToolApplicationService } from '../../services/ToolApplicationService'

export interface IExecuteToolUseCaseRequest extends IUseCaseRequest {
  toolId: string
  parameters: Record<string, any>
  context?: {
    userId?: string
    sessionId?: string
    workspaceId?: string
  }
  options?: {
    timeout?: number
    retryOnFailure?: boolean
    useCache?: boolean
    priority?: 'low' | 'normal' | 'high'
  }
}

export interface IExecuteToolUseCaseResponse extends IUseCaseResponse {
  toolId: string
  toolName: string
  success: boolean
  data?: any
  message?: string
  executionTime: number
  cached: boolean
  metadata?: {
    capabilities: string[]
    version?: string
  }
}

export class ExecuteToolUseCase extends CommandUseCase<IExecuteToolUseCaseRequest, IExecuteToolUseCaseResponse> {
  constructor(
    private readonly toolService: ToolApplicationService
  ) {
    super()
  }

  protected async executeCommand(
    request: IExecuteToolUseCaseRequest
  ): Promise<Result<IExecuteToolUseCaseResponse, Error>> {
    // 记录工具执行开始
    const startTime = Date.now()
    
    // 使用应用服务执行工具
    const result = await this.toolService.executeTool({
      toolId: request.toolId,
      parameters: request.parameters,
      context: request.context,
      options: request.options
    })

    if (result.isError()) {
      return Result.error(result.getError())
    }

    const response = result.getValue()
    const executionResult = response.result

    return Result.success({
      toolId: request.toolId,
      toolName: executionResult.getToolId().getValue(),
      success: executionResult.isSuccess(),
      data: executionResult.getData(),
      message: executionResult.getMessage() || 'Tool executed successfully',
      executionTime: response.executionTime,
      cached: response.cached,
      metadata: response.result.getMetadata()
    })
  }

  protected validate(request: IExecuteToolUseCaseRequest): Result<void, Error> {
    const baseValidation = super.validate(request)
    if (baseValidation.isError()) {
      return baseValidation
    }

    // 验证工具ID
    if (!request.toolId || request.toolId.trim().length === 0) {
      return Result.error(new Error('Tool ID is required'))
    }

    // 验证参数
    if (!request.parameters || typeof request.parameters !== 'object') {
      return Result.error(new Error('Tool parameters must be an object'))
    }

    // 验证选项
    if (request.options?.timeout && (request.options.timeout < 1000 || request.options.timeout > 300000)) {
      return Result.error(new Error('Timeout must be between 1 second and 5 minutes'))
    }

    if (request.options?.priority && !['low', 'normal', 'high'].includes(request.options.priority)) {
      return Result.error(new Error('Priority must be low, normal, or high'))
    }

    return Result.success()
  }

  protected async preProcess(request: IExecuteToolUseCaseRequest): Promise<void> {
    // 记录工具执行请求
    console.log(`🔧 Executing tool: ${request.toolId}`, {
      parameters: Object.keys(request.parameters),
      context: request.context,
      options: request.options,
      timestamp: new Date().toISOString()
    })

    // 清理和标准化参数
    this.sanitizeParameters(request.parameters)
  }

  protected async postProcess(
    response: IExecuteToolUseCaseResponse, 
    request: IExecuteToolUseCaseRequest
  ): Promise<void> {
    // 记录执行结果
    const logData = {
      toolId: response.toolId,
      success: response.success,
      executionTime: response.executionTime,
      cached: response.cached,
      dataSize: this.calculateDataSize(response.data)
    }

    if (response.success) {
      console.log(`✅ Tool executed successfully: ${response.toolName}`, logData)
    } else {
      console.error(`❌ Tool execution failed: ${response.toolName}`, {
        ...logData,
        error: response.message
      })
    }
  }

  protected handleError(error: Error, request: IExecuteToolUseCaseRequest): Error {
    // 增强错误信息
    const enhancedError = new Error(
      `Tool execution failed for ${request.toolId}: ${error.message}`
    )
    enhancedError.name = 'ToolExecutionError'
    enhancedError.stack = error.stack
    
    return enhancedError
  }

  /**
   * 清理和验证参数
   */
  private sanitizeParameters(parameters: Record<string, any>): void {
    // 移除undefined值
    Object.keys(parameters).forEach(key => {
      if (parameters[key] === undefined) {
        delete parameters[key]
      }
    })

    // 转换字符串数字
    Object.keys(parameters).forEach(key => {
      if (typeof parameters[key] === 'string') {
        const trimmed = parameters[key].trim()
        if (trimmed !== parameters[key]) {
          parameters[key] = trimmed
        }
      }
    })
  }

  /**
   * 计算数据大小
   */
  private calculateDataSize(data: any): number {
    if (!data) return 0
    
    try {
      return JSON.stringify(data).length
    } catch {
      return 0
    }
  }

  protected getSuccessMessage(): string {
    return 'Tool executed successfully'
  }
}