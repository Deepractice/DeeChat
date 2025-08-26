/**
 * 工具执行结果值对象
 * 🏗️ DDD重构: 强类型化的工具执行结果
 */

export class ToolExecutionResult {
  private readonly _success: boolean;
  private readonly _data?: any;
  private readonly _error?: string;
  private readonly _duration?: number;

  private constructor(success: boolean, data?: any, error?: string, duration?: number) {
    this._success = success;
    this._data = data;
    this._error = error;
    this._duration = duration;
  }

  get success(): boolean {
    return this._success;
  }

  get data(): any {
    return this._data;
  }

  get error(): string | undefined {
    return this._error;
  }

  get duration(): number | undefined {
    return this._duration;
  }

  get hasError(): boolean {
    return !this._success && !!this._error;
  }

  /**
   * 创建成功结果
   */
  static success(data?: any, duration?: number): ToolExecutionResult {
    return new ToolExecutionResult(true, data, undefined, duration);
  }

  /**
   * 创建失败结果
   */
  static failure(error: string, duration?: number): ToolExecutionResult {
    return new ToolExecutionResult(false, undefined, error, duration);
  }

  /**
   * 从执行中创建结果
   */
  static fromExecution<T>(
    execution: () => T,
    startTime: number = Date.now()
  ): ToolExecutionResult {
    try {
      const result = execution();
      const duration = Date.now() - startTime;
      return ToolExecutionResult.success(result, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      return ToolExecutionResult.failure(errorMessage, duration);
    }
  }

  /**
   * 从Promise创建结果
   */
  static async fromPromise<T>(
    promise: Promise<T>,
    startTime: number = Date.now()
  ): Promise<ToolExecutionResult> {
    try {
      const result = await promise;
      const duration = Date.now() - startTime;
      return ToolExecutionResult.success(result, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      return ToolExecutionResult.failure(errorMessage, duration);
    }
  }
}