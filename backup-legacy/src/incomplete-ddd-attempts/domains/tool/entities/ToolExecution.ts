/**
 * 工具执行实体 (Domain Entity)
 * 表示一次工具的执行过程和结果
 * 🏗️ DDD重构: 工具执行的生命周期管理
 */

import { ToolId } from '../value-objects/ToolId';
import { ToolExecutionResult } from '../value-objects/ToolExecutionResult';

export interface ToolExecutionConfig {
  toolId: ToolId;
  args: any;
  sessionId: string;
  userId?: string;
}

export class ToolExecution {
  private readonly _id: string;
  private readonly _toolId: ToolId;
  private readonly _args: any;
  private readonly _sessionId: string;
  private readonly _userId?: string;
  private readonly _startTime: Date;
  private _endTime?: Date;
  private _result?: ToolExecutionResult;
  private _status: 'pending' | 'running' | 'completed' | 'failed';

  constructor(config: ToolExecutionConfig) {
    this._id = this.generateExecutionId();
    this._toolId = config.toolId;
    this._args = config.args;
    this._sessionId = config.sessionId;
    this._userId = config.userId;
    this._startTime = new Date();
    this._status = 'pending';
  }

  // Getters - 暴露只读属性
  get id(): string { return this._id; }
  get toolId(): ToolId { return this._toolId; }
  get args(): any { return this._args; }
  get sessionId(): string { return this._sessionId; }
  get userId(): string | undefined { return this._userId; }
  get startTime(): Date { return this._startTime; }
  get endTime(): Date | undefined { return this._endTime; }
  get result(): ToolExecutionResult | undefined { return this._result; }
  get status(): string { return this._status; }
  get duration(): number | undefined {
    if (!this._endTime) return undefined;
    return this._endTime.getTime() - this._startTime.getTime();
  }

  /**
   * 业务方法：开始执行
   */
  start(): void {
    if (this._status !== 'pending') {
      throw new Error(`Cannot start execution in status: ${this._status}`);
    }
    this._status = 'running';
  }

  /**
   * 业务方法：完成执行
   */
  complete(result: ToolExecutionResult): void {
    if (this._status !== 'running') {
      throw new Error(`Cannot complete execution in status: ${this._status}`);
    }
    
    this._endTime = new Date();
    this._result = result;
    this._status = result.success ? 'completed' : 'failed';
  }

  /**
   * 业务方法：执行失败
   */
  fail(error: string): void {
    if (this._status !== 'running') {
      throw new Error(`Cannot fail execution in status: ${this._status}`);
    }
    
    this._endTime = new Date();
    this._result = ToolExecutionResult.failure(error, this.duration);
    this._status = 'failed';
  }

  /**
   * 业务查询：是否正在运行
   */
  isRunning(): boolean {
    return this._status === 'running';
  }

  /**
   * 业务查询：是否已完成
   */
  isCompleted(): boolean {
    return this._status === 'completed' || this._status === 'failed';
  }

  /**
   * 业务查询：是否成功
   */
  isSuccessful(): boolean {
    return this._status === 'completed' && this._result?.success === true;
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `exec_${timestamp}_${random}`;
  }

  /**
   * 工厂方法：创建新的执行
   */
  static create(config: ToolExecutionConfig): ToolExecution {
    return new ToolExecution(config);
  }

  /**
   * 转换为数据传输对象
   */
  toData(): any {
    return {
      id: this._id,
      toolId: this._toolId.value,
      args: this._args,
      sessionId: this._sessionId,
      userId: this._userId,
      startTime: this._startTime.toISOString(),
      endTime: this._endTime?.toISOString(),
      result: this._result ? {
        success: this._result.success,
        data: this._result.data,
        error: this._result.error,
        duration: this._result.duration
      } : undefined,
      status: this._status,
      duration: this.duration
    };
  }
}