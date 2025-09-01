/**
 * 查询基类
 * 所有应用查询的基础抽象类
 */

import { Result } from '../../../domain/shared/primitives/Result'

export interface IQueryRequest {
  // 标记接口，所有查询请求必须实现
}

export interface IQueryResponse {
  // 标记接口，所有查询响应必须实现
}

export interface IPaginationRequest {
  page?: number
  limit?: number
  offset?: number
}

export interface IPaginationResponse {
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ISortRequest {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface IFilterRequest {
  filters?: Record<string, any>
}

/**
 * 查询基类
 * 封装查询操作的通用逻辑
 */
export abstract class Query<TRequest extends IQueryRequest, TResponse extends IQueryResponse> {
  /**
   * 执行查询
   * @param request 查询请求
   * @returns 查询结果
   */
  abstract execute(request: TRequest): Promise<Result<TResponse, Error>>

  /**
   * 验证查询请求（可选重写）
   * @param request 查询请求
   */
  protected validate(request: TRequest): Result<void, Error> {
    if (!request) {
      return Result.error(new Error('Query request cannot be null or undefined'))
    }
    return Result.success()
  }

  /**
   * 预处理查询（可选重写）
   * @param request 查询请求
   */
  protected async preProcess(request: TRequest): Promise<void> {
    // 默认空实现
  }

  /**
   * 后处理查询结果（可选重写）
   * @param response 查询响应
   * @param request 原始请求
   */
  protected async postProcess(response: TResponse, request: TRequest): Promise<TResponse> {
    return response
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
 * 分页查询基类
 */
export interface IPaginatedQueryRequest extends IQueryRequest, IPaginationRequest, ISortRequest, IFilterRequest {}

export interface IPaginatedQueryResponse<T> extends IQueryResponse, IPaginationResponse {
  data: T[]
}

export abstract class PaginatedQuery<TRequest extends IPaginatedQueryRequest, TData> extends Query<TRequest, IPaginatedQueryResponse<TData>> {
  async execute(request: TRequest): Promise<Result<IPaginatedQueryResponse<TData>, Error>> {
    try {
      // 1. 验证请求
      const validationResult = this.validate(request)
      if (validationResult.isError()) {
        return Result.error(validationResult.getError())
      }

      // 2. 标准化分页参数
      const normalizedRequest = this.normalizePagination(request)

      // 3. 预处理
      await this.preProcess(normalizedRequest)

      // 4. 执行查询
      const result = await this.executeQuery(normalizedRequest)
      if (result.isError()) {
        const processedError = this.handleError(result.getError(), request)
        return Result.error(processedError)
      }

      // 5. 后处理
      const processedResponse = await this.postProcess(result.getValue(), normalizedRequest)

      return Result.success(processedResponse)
    } catch (error) {
      const processedError = this.handleError(error as Error, request)
      return Result.error(processedError)
    }
  }

  /**
   * 执行具体查询逻辑
   */
  protected abstract executeQuery(request: TRequest): Promise<Result<IPaginatedQueryResponse<TData>, Error>>

  /**
   * 标准化分页参数
   */
  private normalizePagination(request: TRequest): TRequest {
    const page = Math.max(1, request.page || 1)
    const limit = Math.min(100, Math.max(1, request.limit || 10))
    const offset = (page - 1) * limit

    return {
      ...request,
      page,
      limit,
      offset
    }
  }

  /**
   * 创建分页响应
   */
  protected createPaginatedResponse(
    data: TData[],
    total: number,
    page: number,
    limit: number
  ): IPaginatedQueryResponse<TData> {
    return {
      data,
      total,
      page,
      limit,
      hasNext: (page * limit) < total,
      hasPrev: page > 1
    }
  }
}

/**
 * 单项查询基类
 */
export interface ISingleQueryRequest extends IQueryRequest {
  id: string
}

export interface ISingleQueryResponse<T> extends IQueryResponse {
  data: T | null
  found: boolean
}

export abstract class SingleQuery<TRequest extends ISingleQueryRequest, TData> extends Query<TRequest, ISingleQueryResponse<TData>> {
  async execute(request: TRequest): Promise<Result<ISingleQueryResponse<TData>, Error>> {
    try {
      // 1. 验证请求
      const validationResult = this.validate(request)
      if (validationResult.isError()) {
        return Result.error(validationResult.getError())
      }

      // 2. 验证ID
      if (!request.id || request.id.trim().length === 0) {
        return Result.error(new Error('ID is required for single query'))
      }

      // 3. 预处理
      await this.preProcess(request)

      // 4. 执行查询
      const result = await this.executeSingleQuery(request)
      if (result.isError()) {
        const processedError = this.handleError(result.getError(), request)
        return Result.error(processedError)
      }

      // 5. 后处理
      const processedResponse = await this.postProcess(result.getValue(), request)

      return Result.success(processedResponse)
    } catch (error) {
      const processedError = this.handleError(error as Error, request)
      return Result.error(processedError)
    }
  }

  /**
   * 执行单项查询
   */
  protected abstract executeSingleQuery(request: TRequest): Promise<Result<ISingleQueryResponse<TData>, Error>>

  /**
   * 创建单项查询响应
   */
  protected createSingleResponse(data: TData | null): ISingleQueryResponse<TData> {
    return {
      data,
      found: data !== null
    }
  }
}

/**
 * 聚合查询基类
 * 用于统计和聚合数据的查询
 */
export interface IAggregateQueryRequest extends IQueryRequest, IFilterRequest {}

export interface IAggregateQueryResponse extends IQueryResponse {
  aggregations: Record<string, any>
  metadata?: Record<string, any>
}

export abstract class AggregateQuery<TRequest extends IAggregateQueryRequest> extends Query<TRequest, IAggregateQueryResponse> {
  async execute(request: TRequest): Promise<Result<IAggregateQueryResponse, Error>> {
    try {
      // 1. 验证请求
      const validationResult = this.validate(request)
      if (validationResult.isError()) {
        return Result.error(validationResult.getError())
      }

      // 2. 预处理
      await this.preProcess(request)

      // 3. 执行聚合查询
      const result = await this.executeAggregateQuery(request)
      if (result.isError()) {
        const processedError = this.handleError(result.getError(), request)
        return Result.error(processedError)
      }

      // 4. 后处理
      const processedResponse = await this.postProcess(result.getValue(), request)

      return Result.success(processedResponse)
    } catch (error) {
      const processedError = this.handleError(error as Error, request)
      return Result.error(processedError)
    }
  }

  /**
   * 执行聚合查询
   */
  protected abstract executeAggregateQuery(request: TRequest): Promise<Result<IAggregateQueryResponse, Error>>

  /**
   * 创建聚合响应
   */
  protected createAggregateResponse(
    aggregations: Record<string, any>,
    metadata?: Record<string, any>
  ): IAggregateQueryResponse {
    return {
      aggregations,
      metadata
    }
  }
}