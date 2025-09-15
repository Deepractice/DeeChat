/**
 * 工具执行管理器
 * 
 * 负责管理工具调用的生命周期和状态跟踪
 */

import { 
  ToolCall, 
  ToolResult, 
  ToolExecuting, 
  ToolExecutionError, 
  ChatStreamChunk 
} from '../types/index.js'

export interface ToolCallHandler {
  (call: ToolCall): Promise<ToolResult>
}

/**
 * 工具执行状态
 */
export interface ToolExecutionState {
  executing: Map<string, ToolExecuting>  // 正在执行的工具
  completed: Map<string, ToolResult>     // 已完成的工具
  failed: Map<string, ToolExecutionError>         // 失败的工具
}

/**
 * 工具执行管理器
 */
export class ToolExecutionManager {
  private state: ToolExecutionState = {
    executing: new Map(),
    completed: new Map(),
    failed: new Map()
  }

  private handlers: ToolCallHandler[] = []

  /**
   * 添加工具调用处理器
   */
  addHandler(handler: ToolCallHandler): void {
    this.handlers.push(handler)
  }

  /**
   * 清除所有处理器
   */
  clearHandlers(): void {
    this.handlers = []
  }

  /**
   * 执行工具调用
   */
  async executeToolCalls(
    toolCalls: ToolCall[], 
    onChunk?: (chunk: ChatStreamChunk) => void
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    // 并行执行所有工具调用
    const promises = toolCalls.map(async (call) => {
      try {
        // 标记为正在执行
        const executing: ToolExecuting = {
          id: call.id,
          name: call.function.name,
          arguments: JSON.parse(call.function.arguments),
          startTime: Date.now()
        }
        this.state.executing.set(call.id, executing)
        
        // 发送执行中状态
        onChunk?.({
          toolExecuting: executing,
          phase: 'calling_tools'
        })

        // 执行工具调用
        const result = await this.executeToolCall(call)
        
        // 更新状态
        this.state.executing.delete(call.id)
        this.state.completed.set(call.id, result)
        
        // 发送结果
        onChunk?.({
          toolResults: [result],
          phase: 'processing_results'
        })
        
        results.push(result)
        return result
        
      } catch (error) {
        // 处理错误
        const toolError: ToolExecutionError = {
          tool_call_id: call.id,
          tool_name: call.function.name,
          error: error instanceof Error ? error.message : String(error),
          details: error
        }
        
        this.state.executing.delete(call.id)
        this.state.failed.set(call.id, toolError)
        
        // 发送错误
        onChunk?.({
          toolError,
          phase: 'processing_results'
        })
        
        // 返回错误结果
        const errorResult: ToolResult = {
          tool_call_id: call.id,
          result: null,
          error: toolError.error
        }
        results.push(errorResult)
        return errorResult
      }
    })

    await Promise.all(promises)
    return results
  }


  /**
   * 获取当前执行状态
   */
  getExecutionState(): ToolExecutionState {
    return {
      executing: new Map(this.state.executing),
      completed: new Map(this.state.completed),
      failed: new Map(this.state.failed)
    }
  }

  /**
   * 清除所有状态
   */
  clearState(): void {
    this.state.executing.clear()
    this.state.completed.clear()
    this.state.failed.clear()
  }

  /**
   * 检查是否有正在执行的工具
   */
  hasExecutingTools(): boolean {
    return this.state.executing.size > 0
  }

  /**
   * 检查是否有注册的处理器
   */
  hasHandlers(): boolean {
    return this.handlers.length > 0
  }

  /**
   * 执行单个工具调用（内部方法）
   */
  async executeToolCall(call: ToolCall): Promise<ToolResult> {
    if (this.handlers.length === 0) {
      throw new Error('No tool call handlers registered')
    }

    // 使用第一个处理器（后续可以扩展为多处理器路由）
    const handler = this.handlers[0]
    return await handler(call)
  }

  /**
   * 获取所有已完成的结果
   */
  getAllResults(): ToolResult[] {
    return Array.from(this.state.completed.values())
  }

  /**
   * 获取所有错误
   */
  getAllErrors(): ToolExecutionError[] {
    return Array.from(this.state.failed.values())
  }
}