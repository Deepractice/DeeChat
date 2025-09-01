/**
 * 用例基类
 * 所有应用用例的基础抽象类
 */

import { Result } from '../../../domain/shared/primitives/Result'

export interface IUseCaseRequest {
  // 标记接口，所有请求必须实现
}

export interface IUseCaseResponse {
  // 标记接口，所有响应必须实现
}

/**
 * 用例基类
 * 封装单一业务用例的执行逻辑
 */
export abstract class UseCase<TRequest extends IUseCaseRequest, TResponse extends IUseCaseResponse> {
  /**
   * 执行用例
   * @param request 请求对象
   * @returns 执行结果
   */
  abstract execute(request: TRequest): Promise<Result<TResponse, Error>>

  /**
   * 验证请求参数（可选重写）
   * @param request 请求对象
   * @returns 验证结果
   */
  protected validate(request: TRequest): Result<void, Error> {
    if (!request) {
      return Result.error(new Error('Request cannot be null or undefined'))
    }
    return Result.success()
  }

  /**
   * 预处理请求（可选重写）
   * @param request 请求对象
   */
  protected async preProcess(request: TRequest): Promise<void> {
    // 默认空实现
  }

  /**
   * 后处理响应（可选重写）
   * @param response 响应对象
   * @param request 原始请求
   */
  protected async postProcess(response: TResponse, request: TRequest): Promise<void> {
    // 默认空实现
  }

  /**
   * 错误处理（可选重写）
   * @param error 错误对象
   * @param request 原始请求
   */
  protected handleError(error: Error, request: TRequest): Error {
    return error
  }
}

/**
 * 命令用例基类
 * 用于修改系统状态的操作
 */
export abstract class CommandUseCase<TRequest extends IUseCaseRequest, TResponse extends IUseCaseResponse> extends UseCase<TRequest, TResponse> {
  /**
   * 执行命令
   * @param request 命令请求
   */
  async execute(request: TRequest): Promise<Result<TResponse, Error>> {
    try {
      // 1. 验证请求
      const validationResult = this.validate(request)
      if (validationResult.isError()) {
        return Result.error(validationResult.getError())
      }

      // 2. 预处理
      await this.preProcess(request)

      // 3. 执行核心逻辑
      const result = await this.executeCommand(request)
      if (result.isError()) {
        const processedError = this.handleError(result.getError(), request)
        return Result.error(processedError)
      }

      // 4. 后处理
      await this.postProcess(result.getValue(), request)

      return result
    } catch (error) {
      const processedError = this.handleError(error as Error, request)
      return Result.error(processedError)
    }
  }

  /**
   * 执行具体命令逻辑
   * @param request 命令请求
   */
  protected abstract executeCommand(request: TRequest): Promise<Result<TResponse, Error>>
}

/**
 * 无响应命令用例基类
 * 用于不需要返回数据的命令操作
 */
export interface IVoidResponse extends IUseCaseResponse {
  success: boolean
  message?: string
}

export abstract class VoidCommandUseCase<TRequest extends IUseCaseRequest> extends CommandUseCase<TRequest, IVoidResponse> {
  protected async executeCommand(request: TRequest): Promise<Result<IVoidResponse, Error>> {
    const result = await this.executeVoidCommand(request)
    if (result.isError()) {
      return Result.error(result.getError())
    }

    return Result.success({
      success: true,
      message: this.getSuccessMessage()
    })
  }

  /**
   * 执行无返回值的命令
   */
  protected abstract executeVoidCommand(request: TRequest): Promise<Result<void, Error>>

  /**
   * 获取成功消息
   */
  protected getSuccessMessage(): string {
    return 'Command executed successfully'
  }
}