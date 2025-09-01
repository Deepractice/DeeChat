/**
 * 结果类型
 * 用于处理可能失败的操作，避免异常抛出
 */

export type Result<T, E = Error> = Success<T> | Failure<E>

export class Success<T> {
  readonly isSuccess = true
  readonly isFailure = false
  readonly isError = false  // 添加别名方法支持

  constructor(private readonly value: T) {}

  getValue(): T {
    return this.value
  }

  getError(): never {
    throw new Error('Cannot get error from Success result')
  }
}

export class Failure<E> {
  readonly isSuccess = false
  readonly isFailure = true
  readonly isError = true   // 添加别名方法支持

  constructor(private readonly error: E) {}

  getValue(): never {
    throw new Error('Cannot get value from Failure result')
  }

  getError(): E {
    return this.error
  }
}

/**
 * Result工厂方法
 */
export const Result = {
  /**
   * 创建成功结果
   */
  success<T>(value: T): Result<T, never> {
    return new Success(value)
  },

  /**
   * 创建失败结果 (支持别名方法)
   */
  failure<E>(error: E): Result<never, E> {
    return new Failure(error)
  },
  
  /**
   * 创建错误结果 (failure的别名)
   */
  error<E>(error: E): Result<never, E> {
    return new Failure(error)
  },

  /**
   * 从可能抛出异常的函数创建Result
   */
  fromThrowing<T>(fn: () => T): Result<T, Error> {
    try {
      const value = fn()
      return Result.success(value)
    } catch (error) {
      return Result.failure(error as Error)
    }
  },

  /**
   * 从Promise创建Result
   */
  async fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>> {
    try {
      const value = await promise
      return Result.success(value)
    } catch (error) {
      return Result.failure(error as Error)
    }
  },

  /**
   * 组合多个Result
   */
  combine<T extends readonly unknown[]>(
    ...results: { [K in keyof T]: Result<T[K], any> }
  ): Result<T, any> {
    const values: any[] = []
    
    for (const result of results) {
      if (result.isFailure) {
        return result
      }
      values.push(result.getValue())
    }
    
    return Result.success(values as T)
  }
}

/**
 * Result类型守卫
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.isSuccess
}

export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.isFailure
}

/**
 * Result类型守卫 (别名方法)
 */
export function isError<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.isError
}