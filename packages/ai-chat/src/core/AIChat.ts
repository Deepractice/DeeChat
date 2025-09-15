/**
 * AIChat 主协调器类 - 简化后的设计
 * 
 * 核心职责：
 * - 接受外部配置（最小验证）
 * - 直接HTTP请求处理
 * - 工具调用协调
 * - 流式响应聚合
 */

import { 
  AIChatConfig, 
  AIChatError,
  Message,
  ChatOptions,
  ChatStreamChunk,
  ChatResponse,
  TokenUsage,
  ToolCall,
  ToolResult,
  ToolExecutionError,
  HttpError,
  APIRequest
} from '../types/index.js'
import { createErrorChunk } from '../streaming/StreamUtils.js'
import { ToolExecutionManager } from '../tools/ToolExecutionManager.js'
import { HttpClient } from '../http/HttpClient.js'

/**
 * AIChat类 - 简化的AI聊天协调器
 */
export class AIChat {
  private readonly config: AIChatConfig
  private readonly httpClient: HttpClient
  private readonly toolManager: ToolExecutionManager
  
  /**
   * 构造函数 - 简单配置接受
   */
  constructor(config: AIChatConfig) {
    // 最基本的验证
    if (!config) {
      throw new AIChatError('Config is required', 'INVALID_CONFIG')
    }
    
    if (!config.baseUrl) {
      throw new AIChatError('baseUrl is required', 'INVALID_CONFIG')
    }
    
    if (!config.model) {
      throw new AIChatError('model is required', 'INVALID_CONFIG')
    }
    
    // 存储配置
    this.config = config
    
    // 创建HTTP客户端
    this.httpClient = new HttpClient(config)
    
    // 初始化工具管理器
    this.toolManager = new ToolExecutionManager()
  }
  
  /**
   * 获取当前配置 - 用于外部访问
   */
  public getConfig(): AIChatConfig {
    // 返回配置的拷贝，防止外部修改
    return { ...this.config }
  }
  
  /**
   * 获取当前配置的模型
   */
  public getCurrentModel(): string {
    return this.config.model
  }
  
  /**
   * sendMessage - 流式聊天方法（包含完整工具调用循环）
   */
  public async *sendMessage(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterable<ChatStreamChunk> {
    try {
      // 基本验证
      if (!messages || messages.length === 0) {
        throw new AIChatError('Messages array is required and cannot be empty', 'INVALID_INPUT')
      }
      
      // 如果有工具调用处理器，注册到工具管理器
      if (options?.onToolCall) {
        this.toolManager.clearHandlers()
        this.toolManager.addHandler(options.onToolCall)
      }
      
      // 执行完整的工具调用循环
      yield* this.executeToolCallingLoop(messages, options)
      
    } catch (error) {
      // 流式错误处理 - yield错误chunk
      yield createErrorChunk(error)
    }
  }
  
  /**
   * 执行完整的工具调用循环
   */
  private async *executeToolCallingLoop(
    initialMessages: Message[],
    options?: ChatOptions
  ): AsyncIterable<ChatStreamChunk> {
    // 使用配置的模型或选项中的模型
    const modelToUse = options?.model || this.config.model
    
    let currentMessages = [...initialMessages]
    let toolCallCount = 0
    const maxToolCalls = 10 // 防止无限循环
    
    // 如果有系统提示，添加到消息开头
    if (options?.systemPrompt) {
      currentMessages = [
        { role: 'system', content: options.systemPrompt },
        ...currentMessages.filter(msg => msg.role !== 'system')
      ]
    }
    
    while (toolCallCount < maxToolCalls) {
      let hasToolCalls = false
      let pendingToolCalls: ToolCall[] = []
      let lastUsage: TokenUsage | undefined
      let lastModel = ''
      let lastFinishReason = ''
      
      // 第一阶段：从AI获取响应
      yield { phase: 'thinking' }
      
      // 构造API请求
      const apiRequest: APIRequest = {
        model: modelToUse,
        messages: currentMessages,
        stream: true,
        temperature: options?.temperature ?? this.config.temperature,
        max_tokens: options?.maxTokens ?? this.config.maxTokens,
        tools: options?.tools
      }
      
      for await (const apiChunk of this.httpClient.postStream(apiRequest)) {
        // 转换API响应为ChatStreamChunk
        const chunk = this.transformApiChunk(apiChunk)
        
        // 检测工具调用
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          hasToolCalls = true
          pendingToolCalls.push(...chunk.toolCalls)
          
          // 发送工具调用检测事件
          yield {
            toolCalls: chunk.toolCalls,
            phase: 'calling_tools'
          }
        }
        
        // 转发其他chunk内容（除了done标志）
        if (chunk.content || chunk.usage || chunk.model || chunk.finishReason || chunk.error) {
          const forwardChunk: ChatStreamChunk = { ...chunk }
          delete forwardChunk.done // 暂时不发送done，因为可能还有工具调用
          yield forwardChunk
        }
        
        // 保存元数据
        if (chunk.usage) lastUsage = chunk.usage
        if (chunk.model) lastModel = chunk.model
        if (chunk.finishReason) lastFinishReason = chunk.finishReason
        
        // 如果有错误，立即停止
        if (chunk.error) {
          return
        }
      }
      
      // 第二阶段：如果有工具调用，执行工具
      if (hasToolCalls && pendingToolCalls.length > 0) {
        toolCallCount++
        
        // 添加AI的工具调用消息到历史
        const toolCallMessage: Message = {
          role: 'assistant',
          content: '', // OpenAI要求content为空字符串当有tool_calls时
        }
        currentMessages.push(toolCallMessage)
        
        // 执行工具调用并发送流式状态更新
        const toolResults: ToolResult[] = []
        
        for (const call of pendingToolCalls) {
          try {
            // 解析参数
            const parsedArgs = JSON.parse(call.function.arguments)
            
            // 发送工具执行开始状态
            const executing = {
              id: call.id,
              name: call.function.name,
              arguments: parsedArgs,
              startTime: Date.now()
            }
            
            yield {
              toolExecuting: executing,
              phase: 'calling_tools' as const
            }

            // 执行单个工具调用
            if (!this.toolManager.hasHandlers()) {
              throw new Error('No tool call handlers registered')
            }
            
            const toolCallForManager: ToolCall = {
              id: call.id,
              type: 'function',
              function: {
                name: call.function.name,
                arguments: JSON.stringify(parsedArgs)
              }
            }
            
            const result = await this.toolManager.executeToolCall(toolCallForManager)
            
            // 发送工具执行结果
            yield {
              toolResults: [result],
              phase: 'processing_results' as const
            }
            
            toolResults.push(result)
            
          } catch (error) {
            const toolError: ToolExecutionError = {
              tool_call_id: call.id,
              tool_name: call.function.name,
              error: error instanceof Error ? error.message : String(error),
              details: error
            }
            
            yield {
              toolError,
              phase: 'processing_results' as const
            }
            
            const errorResult: ToolResult = {
              tool_call_id: call.id,
              result: null,
              error: toolError.error
            }
            toolResults.push(errorResult)
          }
        }
        
        // 将工具结果添加到消息历史
        for (const result of toolResults) {
          currentMessages.push({
            role: 'tool',
            content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
            tool_call_id: result.tool_call_id
          })
        }
        
        // 发送工具结果事件
        yield {
          toolResults,
          phase: 'processing_results'
        }
        
        // 继续循环，让AI处理工具结果
        continue
      }
      
      // 第三阶段：没有更多工具调用，发送最终响应
      yield { phase: 'responding' }
      
      // 发送最终的done标志
      yield {
        done: true,
        usage: lastUsage,
        model: lastModel,
        finishReason: lastFinishReason
      }
      
      break
    }
    
    // 如果达到最大工具调用次数，发送警告
    if (toolCallCount >= maxToolCalls) {
      yield {
        error: `Maximum tool call limit (${maxToolCalls}) reached`,
        done: true
      }
    }
  }
  
  /**
   * 转换API响应块为ChatStreamChunk
   */
  private transformApiChunk(apiChunk: any): ChatStreamChunk {
    const choice = apiChunk.choices?.[0]
    if (!choice) {
      return {}
    }
    
    const delta = choice.delta
    const chunk: ChatStreamChunk = {}
    
    // 提取内容
    if (delta.content) {
      chunk.content = delta.content
    }
    
    // 提取工具调用
    if (delta.tool_calls) {
      chunk.toolCalls = delta.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || ''
        }
      }))
    }
    
    // 提取元数据
    if (choice.finish_reason) {
      chunk.finishReason = choice.finish_reason
    }
    
    if (apiChunk.model) {
      chunk.model = apiChunk.model
    }
    
    if (apiChunk.usage) {
      chunk.usage = {
        prompt_tokens: apiChunk.usage.prompt_tokens,
        completion_tokens: apiChunk.usage.completion_tokens,
        total_tokens: apiChunk.usage.total_tokens
      }
    }
    
    return chunk
  }
  
  /**
   * sendMessageComplete - 便利方法，聚合流式响应为完整响应
   */
  public async sendMessageComplete(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    let content = ''
    let usage: TokenUsage | undefined
    let model = ''
    let finishReason = ''
    
    // 聚合流式响应
    for await (const chunk of this.sendMessage(messages, options)) {
      if (chunk.content) {
        content += chunk.content
      }
      if (chunk.usage) {
        usage = chunk.usage
      }
      if (chunk.model) {
        model = chunk.model
      }
      if (chunk.finishReason) {
        finishReason = chunk.finishReason
      }
      if (chunk.error) {
        throw new AIChatError(chunk.error, 'STREAM_ERROR')
      }
      if (chunk.done) {
        break
      }
    }
    
    // 确保有有效的usage
    const finalUsage: TokenUsage = usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
    
    return {
      message: { role: 'assistant', content },
      usage: finalUsage,
      model,
      finishReason
    }
  }
}