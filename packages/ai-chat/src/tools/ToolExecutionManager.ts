/**
 * 工具执行管理器 - Function Calling生命周期管理的核心组件
 *
 * 这个管理器是AI工具调用系统的执行引擎，负责协调和管理所有工具调用的执行过程。
 * 它提供了完整的生命周期管理、状态跟踪、错误处理和并发控制能力。
 *
 * 核心功能：
 * - 生命周期管理：从工具调用开始到结果返回的全程管理
 * - 状态跟踪：实时跟踪每个工具的执行状态
 * - 并发执行：支持多个工具同时执行，提升效率
 * - 错误处理：完善的异常捕获和错误恢复机制
 * - 流式反馈：实时向调用者报告执行进度
 *
 * 设计特点：
 * - 状态机模式：工具执行状态的清晰转换
 * - 观察者模式：通过回调实时通知状态变化
 * - 责任委托：将具体工具执行委托给外部处理器
 * - 内存管理：合理管理执行状态，避免内存泄露
 *
 * 使用场景：
 * - AI需要调用外部API（搜索、天气查询等）
 * - 执行复杂的计算任务
 * - 访问数据库或文件系统
 * - 与其他服务进行交互
 *
 * @author DeeChat Team
 * @since v0.5.0
 * @example
 * ```typescript
 * const manager = new ToolExecutionManager();
 * manager.addHandler(async (call) => {
 *   // 执行具体的工具逻辑
 *   return { tool_call_id: call.id, result: 'success' };
 * });
 *
 * const results = await manager.executeToolCalls(toolCalls, (chunk) => {
 *   console.log('工具执行状态:', chunk.phase);
 * });
 * ```
 */

import {
  ToolCall,
  ToolResult,
  ToolExecuting,
  ToolExecutionError,
  ChatStreamChunk
} from '../types/index.js'

/**
 * 工具调用处理器接口
 *
 * 这是实际执行工具逻辑的函数接口。外部可以注册多个处理器，
 * 管理器会选择合适的处理器来执行具体的工具调用。
 *
 * @param call 标准化的工具调用对象
 * @returns Promise解析为工具执行结果
 */
export interface ToolCallHandler {
  (call: ToolCall): Promise<ToolResult>
}

/**
 * 工具执行状态接口
 *
 * 定义了工具执行的三种状态，每种状态都用Map管理，
 * 以tool_call_id为键，便于快速查询和更新。
 *
 * 状态转换流程：
 * 1. 工具调用开始 -> executing
 * 2. 执行成功 -> completed
 * 3. 执行失败 -> failed
 */
export interface ToolExecutionState {
  /** 正在执行的工具：id -> 执行信息 */
  executing: Map<string, ToolExecuting>

  /** 已成功完成的工具：id -> 执行结果 */
  completed: Map<string, ToolResult>

  /** 执行失败的工具：id -> 错误信息 */
  failed: Map<string, ToolExecutionError>
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