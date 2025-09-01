/**
 * 工具执行结果值对象
 * 封装工具执行的输出、状态和元数据
 */

import { ValueObject } from '../../../core/ValueObject'
import { ToolId } from './ToolId'
import { ToolExecutionContext } from './ToolExecutionContext'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export type ExecutionStatus = 'success' | 'error' | 'timeout' | 'cancelled' | 'partial'

export interface IExecutionMetadata {
  executionTimeMs?: number
  memoryUsedMB?: number
  inputSize?: number
  outputSize?: number
  cacheHit?: boolean
  retryCount?: number
  warningCount?: number
  errorDetails?: string
  stackTrace?: string
}

export interface IExecutionOutput {
  data?: any
  message?: string
  type?: 'text' | 'json' | 'binary' | 'stream'
  format?: string
  encoding?: string
  size?: number
}

export class ToolExecutionResult extends ValueObject {
  private constructor(
    private readonly toolId: ToolId,
    private readonly context: ToolExecutionContext,
    private readonly status: ExecutionStatus,
    private readonly output: IExecutionOutput,
    private readonly error: Error | null,
    private readonly metadata: IExecutionMetadata,
    private readonly timestamp: Timestamp,
    private readonly warnings: string[] = []
  ) {
    super()
    this.validate()
  }

  /**
   * 创建成功结果
   */
  static success(
    toolId: ToolId,
    context: ToolExecutionContext,
    output: any,
    timestamp?: Timestamp,
    metadata: IExecutionMetadata = {}
  ): ToolExecutionResult {
    const outputData: IExecutionOutput = {
      data: output,
      type: this.inferOutputType(output),
      size: this.calculateOutputSize(output)
    }

    return new ToolExecutionResult(
      toolId,
      context,
      'success',
      outputData,
      null,
      metadata,
      timestamp || Timestamp.now()
    )
  }

  /**
   * 创建错误结果
   */
  static error(
    toolId: ToolId,
    context: ToolExecutionContext,
    error: Error,
    timestamp?: Timestamp,
    metadata: IExecutionMetadata = {}
  ): ToolExecutionResult {
    const errorMetadata: IExecutionMetadata = {
      ...metadata,
      errorDetails: error.message,
      stackTrace: error.stack
    }

    return new ToolExecutionResult(
      toolId,
      context,
      'error',
      { message: error.message, type: 'text' },
      error,
      errorMetadata,
      timestamp || Timestamp.now()
    )
  }

  /**
   * 创建超时结果
   */
  static timeout(
    toolId: ToolId,
    context: ToolExecutionContext,
    timeoutMs: number,
    timestamp?: Timestamp,
    metadata: IExecutionMetadata = {}
  ): ToolExecutionResult {
    const timeoutMetadata: IExecutionMetadata = {
      ...metadata,
      executionTimeMs: timeoutMs,
      errorDetails: `Tool execution timed out after ${timeoutMs}ms`
    }

    return new ToolExecutionResult(
      toolId,
      context,
      'timeout',
      { message: `Execution timed out after ${timeoutMs}ms`, type: 'text' },
      new Error('Execution timeout'),
      timeoutMetadata,
      timestamp || Timestamp.now()
    )
  }

  /**
   * 创建取消结果
   */
  static cancelled(
    toolId: ToolId,
    context: ToolExecutionContext,
    reason: string,
    timestamp?: Timestamp,
    metadata: IExecutionMetadata = {}
  ): ToolExecutionResult {
    return new ToolExecutionResult(
      toolId,
      context,
      'cancelled',
      { message: `Execution cancelled: ${reason}`, type: 'text' },
      new Error(`Execution cancelled: ${reason}`),
      metadata,
      timestamp || Timestamp.now()
    )
  }

  /**
   * 创建部分成功结果
   */
  static partial(
    toolId: ToolId,
    context: ToolExecutionContext,
    output: any,
    warnings: string[],
    timestamp?: Timestamp,
    metadata: IExecutionMetadata = {}
  ): ToolExecutionResult {
    const outputData: IExecutionOutput = {
      data: output,
      type: this.inferOutputType(output),
      size: this.calculateOutputSize(output)
    }

    const partialMetadata: IExecutionMetadata = {
      ...metadata,
      warningCount: warnings.length
    }

    return new ToolExecutionResult(
      toolId,
      context,
      'partial',
      outputData,
      null,
      partialMetadata,
      timestamp || Timestamp.now(),
      warnings
    )
  }

  /**
   * 推断输出类型
   */
  private static inferOutputType(output: any): 'text' | 'json' | 'binary' | 'stream' {
    if (typeof output === 'string') return 'text'
    if (output instanceof Buffer || output instanceof Uint8Array) return 'binary'
    if (output && typeof output === 'object') return 'json'
    return 'text'
  }

  /**
   * 计算输出大小
   */
  private static calculateOutputSize(output: any): number {
    if (typeof output === 'string') return output.length
    if (output instanceof Buffer) return output.length
    if (output instanceof Uint8Array) return output.byteLength
    return JSON.stringify(output).length
  }

  /**
   * 获取工具ID
   */
  getToolId(): ToolId {
    return this.toolId
  }

  /**
   * 获取执行上下文
   */
  getContext(): ToolExecutionContext {
    return this.context
  }

  /**
   * 获取执行状态
   */
  getStatus(): ExecutionStatus {
    return this.status
  }

  /**
   * 获取输出数据
   */
  getOutput(): IExecutionOutput {
    return { ...this.output }
  }

  /**
   * 获取输出数据
   */
  getData(): any {
    return this.output.data
  }

  /**
   * 获取输出消息
   */
  getMessage(): string {
    return this.output.message || ''
  }

  /**
   * 获取输出类型
   */
  getOutputType(): string {
    return this.output.type || 'text'
  }

  /**
   * 获取错误信息
   */
  getError(): Error | null {
    return this.error
  }

  /**
   * 获取元数据
   */
  getMetadata(): IExecutionMetadata {
    return { ...this.metadata }
  }

  /**
   * 获取时间戳
   */
  getTimestamp(): Timestamp {
    return this.timestamp
  }

  /**
   * 获取警告列表
   */
  getWarnings(): string[] {
    return [...this.warnings]
  }

  /**
   * 检查是否成功
   */
  isSuccess(): boolean {
    return this.status === 'success'
  }

  /**
   * 检查是否失败
   */
  isError(): boolean {
    return this.status === 'error'
  }

  /**
   * 检查是否超时
   */
  isTimeout(): boolean {
    return this.status === 'timeout'
  }

  /**
   * 检查是否被取消
   */
  isCancelled(): boolean {
    return this.status === 'cancelled'
  }

  /**
   * 检查是否部分成功
   */
  isPartial(): boolean {
    return this.status === 'partial'
  }

  /**
   * 检查是否有警告
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0
  }

  /**
   * 检查是否有输出数据
   */
  hasData(): boolean {
    return this.output.data !== undefined && this.output.data !== null
  }

  /**
   * 获取执行时间
   */
  getExecutionTime(): number {
    return this.metadata.executionTimeMs || 0
  }

  /**
   * 获取内存使用量
   */
  getMemoryUsed(): number {
    return this.metadata.memoryUsedMB || 0
  }

  /**
   * 获取输入大小
   */
  getInputSize(): number {
    return this.metadata.inputSize || 0
  }

  /**
   * 获取输出大小
   */
  getOutputSize(): number {
    return this.metadata.outputSize || this.output.size || 0
  }

  /**
   * 检查是否命中缓存
   */
  isCacheHit(): boolean {
    return this.metadata.cacheHit === true
  }

  /**
   * 获取重试次数
   */
  getRetryCount(): number {
    return this.metadata.retryCount || 0
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): {
    executionTime: number
    memoryUsed: number
    inputSize: number
    outputSize: number
    retryCount: number
    efficiency: number
  } {
    const executionTime = this.getExecutionTime()
    const memoryUsed = this.getMemoryUsed()
    const inputSize = this.getInputSize()
    const outputSize = this.getOutputSize()
    const retryCount = this.getRetryCount()
    
    // 计算效率分数（输出大小/执行时间，考虑重试）
    const efficiency = executionTime > 0 ? 
      (outputSize / executionTime) * (1 / Math.max(1, retryCount)) : 0

    return {
      executionTime,
      memoryUsed,
      inputSize,
      outputSize,
      retryCount,
      efficiency
    }
  }

  /**
   * 转换为文本输出
   */
  toText(): string {
    if (this.isError()) {
      return this.error?.message || 'Unknown error'
    }
    
    if (typeof this.output.data === 'string') {
      return this.output.data
    }
    
    if (this.output.message) {
      return this.output.message
    }
    
    try {
      return JSON.stringify(this.output.data, null, 2)
    } catch {
      return String(this.output.data)
    }
  }

  /**
   * 转换为JSON输出
   */
  toJSON(): object {
    return {
      toolId: this.toolId.getValue(),
      status: this.status,
      timestamp: this.timestamp.toISOString(),
      output: this.output,
      error: this.error ? {
        name: this.error.name,
        message: this.error.message,
        stack: this.error.stack
      } : null,
      metadata: this.metadata,
      warnings: this.warnings,
      performance: this.getPerformanceMetrics()
    }
  }

  /**
   * 创建摘要
   */
  getSummary(): string {
    const status = this.status.toUpperCase()
    const time = this.getExecutionTime()
    const size = this.getOutputSize()
    
    let summary = `[${status}]`
    
    if (time > 0) {
      summary += ` ${time}ms`
    }
    
    if (size > 0) {
      summary += ` ${size} bytes`
    }
    
    if (this.hasWarnings()) {
      summary += ` (${this.warnings.length} warnings)`
    }
    
    if (this.isCacheHit()) {
      summary += ` [CACHED]`
    }
    
    return summary
  }

  /**
   * 检查结果是否可缓存
   */
  isCacheable(): boolean {
    return this.isSuccess() && 
           !this.hasWarnings() && 
           this.getOutputSize() > 0 &&
           this.getExecutionTime() > 100 // 只缓存耗时操作
  }

  /**
   * 获取缓存键
   */
  getCacheKey(): string {
    return this.context.getCacheKey(this.toolId.getValue())
  }

  /**
   * 添加警告
   */
  withWarning(warning: string): ToolExecutionResult {
    return new ToolExecutionResult(
      this.toolId,
      this.context,
      this.status,
      this.output,
      this.error,
      this.metadata,
      this.timestamp,
      [...this.warnings, warning]
    )
  }

  /**
   * 更新元数据
   */
  withMetadata(newMetadata: IExecutionMetadata): ToolExecutionResult {
    return new ToolExecutionResult(
      this.toolId,
      this.context,
      this.status,
      this.output,
      this.error,
      { ...this.metadata, ...newMetadata },
      this.timestamp,
      this.warnings
    )
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof ToolExecutionResult)) return false
    
    return this.toolId.equals(other.toolId) &&
           this.context.equals(other.context) &&
           this.status === other.status &&
           this.timestamp.equals(other.timestamp) &&
           JSON.stringify(this.output) === JSON.stringify(other.output)
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return `${this.toolId.getValue()}_${this.status}_${this.timestamp.toISOString()}`
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return `ToolExecutionResult(${this.toolId.getValue()}, ${this.status}, ${this.getSummary()})`
  }

  /**
   * 验证结果
   */
  protected validate(): void {
    if (!this.toolId) {
      throw new Error('Tool ID is required')
    }

    if (!this.context) {
      throw new Error('Execution context is required')
    }

    if (!['success', 'error', 'timeout', 'cancelled', 'partial'].includes(this.status)) {
      throw new Error(`Invalid execution status: ${this.status}`)
    }

    if (!this.output || typeof this.output !== 'object') {
      throw new Error('Output must be an object')
    }

    if (!this.metadata || typeof this.metadata !== 'object') {
      throw new Error('Metadata must be an object')
    }

    if (!this.timestamp) {
      throw new Error('Timestamp is required')
    }

    if (!Array.isArray(this.warnings)) {
      throw new Error('Warnings must be an array')
    }

    // 错误状态必须有错误对象
    if (this.status === 'error' && !this.error) {
      throw new Error('Error status must have an error object')
    }

    // 成功状态不应有错误对象
    if (this.status === 'success' && this.error) {
      throw new Error('Success status should not have an error object')
    }
  }
}