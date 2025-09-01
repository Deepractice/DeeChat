/**
 * 应用服务基类
 * 提供横切关注点和通用功能
 */

import { Result } from '../../domain/shared/primitives/Result'

export interface IApplicationContext {
  userId?: string
  sessionId?: string
  correlationId?: string
  timestamp: Date
}

export interface IApplicationEvent {
  type: string
  data: any
  context: IApplicationContext
  timestamp: Date
}

/**
 * 应用服务基类
 * 封装通用的横切关注点
 */
export abstract class ApplicationService {
  protected readonly serviceName: string

  constructor(serviceName: string) {
    this.serviceName = serviceName
  }

  /**
   * 创建应用上下文
   */
  protected createContext(
    userId?: string,
    sessionId?: string,
    correlationId?: string
  ): IApplicationContext {
    return {
      userId,
      sessionId,
      correlationId: correlationId || this.generateCorrelationId(),
      timestamp: new Date()
    }
  }

  /**
   * 生成关联ID
   */
  private generateCorrelationId(): string {
    return `${this.serviceName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 记录服务开始
   */
  protected logStart(operation: string, context: IApplicationContext, data?: any): void {
    console.log(`🔄 [${this.serviceName}] Starting ${operation}`, {
      correlationId: context.correlationId,
      userId: context.userId,
      sessionId: context.sessionId,
      data
    })
  }

  /**
   * 记录服务完成
   */
  protected logSuccess(operation: string, context: IApplicationContext, result?: any): void {
    console.log(`✅ [${this.serviceName}] Completed ${operation}`, {
      correlationId: context.correlationId,
      result
    })
  }

  /**
   * 记录服务错误
   */
  protected logError(operation: string, context: IApplicationContext, error: Error): void {
    console.error(`❌ [${this.serviceName}] Failed ${operation}`, {
      correlationId: context.correlationId,
      error: error.message,
      stack: error.stack
    })
  }

  /**
   * 发布应用事件
   */
  protected async publishEvent(type: string, data: any, context: IApplicationContext): Promise<void> {
    const event: IApplicationEvent = {
      type,
      data,
      context,
      timestamp: new Date()
    }

    // 这里将来会集成事件总线
    console.log(`📡 [${this.serviceName}] Publishing event: ${type}`, event)
  }

  /**
   * 处理错误并转换为应用层错误
   */
  protected handleError(operation: string, error: Error, context: IApplicationContext): Error {
    this.logError(operation, context, error)

    // 将领域错误转换为应用层错误
    if (error.name === 'DomainError') {
      return new ApplicationError(
        `${this.serviceName}.${operation}`,
        error.message,
        'DOMAIN_ERROR',
        context.correlationId
      )
    }

    if (error.name === 'ValidationError') {
      return new ApplicationError(
        `${this.serviceName}.${operation}`,
        error.message,
        'VALIDATION_ERROR',
        context.correlationId
      )
    }

    return new ApplicationError(
      `${this.serviceName}.${operation}`,
      error.message,
      'UNKNOWN_ERROR',
      context.correlationId
    )
  }

  /**
   * 安全执行操作（包含错误处理）
   */
  protected async safeExecute<T>(
    operation: string,
    context: IApplicationContext,
    executor: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    try {
      this.logStart(operation, context)

      const result = await executor()

      if (result.isSuccess) {
        this.logSuccess(operation, context, result.getValue())
      } else {
        this.logError(operation, context, result.getError())
      }

      return result
    } catch (error) {
      const processedError = this.handleError(operation, error as Error, context)
      return Result.error(processedError)
    }
  }
}

/**
 * 应用错误类
 */
export class ApplicationError extends Error {
  constructor(
    public readonly operation: string,
    message: string,
    public readonly code: string = 'APPLICATION_ERROR',
    public readonly correlationId?: string
  ) {
    super(message)
    this.name = 'ApplicationError'
  }

  toJSON() {
    return {
      name: this.name,
      operation: this.operation,
      message: this.message,
      code: this.code,
      correlationId: this.correlationId,
      stack: this.stack
    }
  }
}

/**
 * 查询应用服务基类
 */
export abstract class QueryApplicationService extends ApplicationService {
  constructor(serviceName: string) {
    super(`Query.${serviceName}`)
  }

  /**
   * 执行查询操作
   */
  public async executeQuery<T>(
    queryName: string,
    context: IApplicationContext,
    queryExecutor: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    return this.safeExecute(`query.${queryName}`, context, queryExecutor)
  }
}

/**
 * 命令应用服务基类
 */
export abstract class CommandApplicationService extends ApplicationService {
  constructor(serviceName: string) {
    super(`Command.${serviceName}`)
  }

  /**
   * 执行命令操作
   */
  public async executeCommand<T>(
    commandName: string,
    context: IApplicationContext,
    commandExecutor: () => Promise<Result<T, Error>>,
    publishEvents: boolean = true
  ): Promise<Result<T, Error>> {
    const result = await this.safeExecute(`command.${commandName}`, context, commandExecutor)

    // 发布命令执行事件
    if (publishEvents) {
      const eventType = result.isSuccess ? 
        `${commandName}.completed` : 
        `${commandName}.failed`
      
      await this.publishEvent(eventType, {
        success: result.isSuccess,
        error: result.isError ? result.getError().message : undefined
      }, context)
    }

    return result
  }
}

/**
 * 混合应用服务基类（包含查询和命令）
 */
export abstract class HybridApplicationService extends ApplicationService {
  protected readonly queryService: QueryApplicationService
  protected readonly commandService: CommandApplicationService

  constructor(serviceName: string) {
    super(serviceName)
    
    // 创建内部查询和命令服务
    this.queryService = new (class extends QueryApplicationService {
      constructor() {
        super(serviceName)
      }
      
      // 公开executeQuery方法供HybridApplicationService使用
      public async executeQuery<T>(
        queryName: string,
        context: IApplicationContext,
        queryExecutor: () => Promise<Result<T, Error>>
      ): Promise<Result<T, Error>> {
        return super.executeQuery(queryName, context, queryExecutor)
      }
    })()

    this.commandService = new (class extends CommandApplicationService {
      constructor() {
        super(serviceName)
      }
      
      // 公开executeCommand方法供HybridApplicationService使用
      public async executeCommand<T>(
        commandName: string,
        context: IApplicationContext,
        commandExecutor: () => Promise<Result<T, Error>>,
        publishEvents: boolean = true
      ): Promise<Result<T, Error>> {
        return super.executeCommand(commandName, context, commandExecutor, publishEvents)
      }
    })()
  }

  /**
   * 执行查询操作
   */
  protected async executeQuery<T>(
    queryName: string,
    context: IApplicationContext,
    queryExecutor: () => Promise<Result<T, Error>>
  ): Promise<Result<T, Error>> {
    return this.queryService.executeQuery(queryName, context, queryExecutor)
  }

  /**
   * 执行命令操作
   */
  protected async executeCommand<T>(
    commandName: string,
    context: IApplicationContext,
    commandExecutor: () => Promise<Result<T, Error>>,
    publishEvents: boolean = true
  ): Promise<Result<T, Error>> {
    return this.commandService.executeCommand(commandName, context, commandExecutor, publishEvents)
  }
}