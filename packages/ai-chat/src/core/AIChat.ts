/**
 * AIChat 主协调器类 - 简化后的设计
 *
 * 这是整个ai-chat包的核心协调器，负责统一管理AI对话的完整生命周期。
 * 采用职责分离架构，将复杂的AI交互过程分解为清晰的步骤。
 *
 * 核心职责：
 * - 接受外部配置（最小验证） - 避免过度验证，保持简单
 * - 直接HTTP请求处理 - 通过HttpClient统一处理网络通信
 * - 工具调用协调 - 管理Function Calling的完整生命周期
 * - 流式响应聚合 - 支持SSE实时响应，提升用户体验
 *
 * 设计理念：
 * - 适配器模式：通过AdapterFactory统一不同AI服务商的API差异
 * - 责任链模式：工具调用循环，支持多轮对话
 * - 流式处理：实时返回文本内容，然后异步处理工具调用
 * - 错误容错：智能重试和降级处理机制
 *
 * @author DeeChat Team
 * @since v0.5.0
 * @example
 * ```typescript
 * const aiChat = new AIChat({
 *   baseUrl: 'https://api.openai.com',
 *   apiKey: 'sk-...',
 *   model: 'gpt-4',
 *   temperature: 0.7
 * });
 *
 * // 流式对话
 * for await (const chunk of aiChat.sendMessage([
 *   { role: 'user', content: 'Hello!' }
 * ])) {
 *   if (chunk.content) {
 *     console.log(chunk.content); // 实时显示文本
 *   }
 * }
 * ```
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
import { createConfiguredAdapterFactory } from '../adapters/index.js'
import type { AdapterContext } from '../adapters/types.js'
import type { AdapterFactory } from '../adapters/AdapterFactory.js'

/**
 * AIChat类 - 简化的AI聊天协调器
 *
 * 这是主要的对外接口类，封装了所有AI对话相关的复杂性。
 * 通过依赖注入的方式组合各个子模块，保持松耦合的架构设计。
 *
 * 主要特性：
 * - 多AI服务商支持：OpenAI、Anthropic、Kimi等
 * - 流式响应处理：实时显示对话内容
 * - 工具调用支持：Function Calling自动管理
 * - 智能适配器：自动处理不同AI服务的格式差异
 */
export class AIChat {
  /** AI配置信息，包含API地址、模型、认证等 */
  private readonly config: AIChatConfig

  /** HTTP客户端，负责所有网络请求 */
  private readonly httpClient: HttpClient

  /** 工具执行管理器，处理Function Calling生命周期 */
  private readonly toolManager: ToolExecutionManager

  /** 适配器工厂，统一不同AI服务商的API差异 */
  private readonly adapterFactory: AdapterFactory
  
  /**
   * 构造函数 - 初始化AI聊天客户端
   *
   * 执行基础配置验证并初始化所有必要的子模块。
   * 采用"快速失败"原则，在构造阶段就发现配置问题。
   *
   * @param config AI聊天配置对象
   * @throws {AIChatError} 当必要配置缺失时抛出错误
   *
   * @example
   * ```typescript
   * const aiChat = new AIChat({
   *   baseUrl: 'https://api.openai.com',
   *   apiKey: 'sk-...',
   *   model: 'gpt-4',
   *   temperature: 0.7,
   *   maxTokens: 2000
   * });
   * ```
   */
  constructor(config: AIChatConfig) {
    // 最基本的验证 - 遵循"如非必要，勿增实体"原则
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

    // 创建HTTP客户端 - 负责所有网络通信
    this.httpClient = new HttpClient(config)

    // 初始化工具管理器 - 处理Function Calling
    this.toolManager = new ToolExecutionManager()

    // 创建适配器工厂 - 统一不同AI服务商的API格式
    this.adapterFactory = createConfiguredAdapterFactory()

    // 根据AI服务配置适配器 - 自动识别并配置最佳策略
    this.configureAdapters(config)
  }
  
  /**
   * 获取当前配置 - 用于外部访问
   *
   * 返回配置的浅拷贝，避免外部代码意外修改内部配置。
   * 这是一种防御性编程的实践。
   *
   * @returns {AIChatConfig} 当前AI配置的副本
   *
   * @example
   * ```typescript
   * const config = aiChat.getConfig();
   * console.log(`当前模型: ${config.model}`);
   * console.log(`API地址: ${config.baseUrl}`);
   * ```
   */
  public getConfig(): AIChatConfig {
    // 返回配置的拷贝，防止外部修改
    return { ...this.config }
  }

  /**
   * 获取当前配置的模型名称
   *
   * 便利方法，快速获取当前使用的AI模型。
   * 在日志记录和错误排查时特别有用。
   *
   * @returns {string} 当前使用的AI模型名称
   *
   * @example
   * ```typescript
   * console.log(`正在使用模型: ${aiChat.getCurrentModel()}`);
   * // 输出: 正在使用模型: gpt-4
   * ```
   */
  public getCurrentModel(): string {
    return this.config.model
  }

  /**
   * 配置适配器工厂
   */
  private configureAdapters(config: AIChatConfig): void {
    // 根据模型名称判断AI服务类型，配置适配器
    const modelName = config.model.toLowerCase()

    let enableDebugLog = false
    let fallbackBehavior: 'empty_args' | 'skip_call' | 'throw_error' = 'empty_args'

    // 根据不同AI服务进行特殊配置
    if (modelName.includes('kimi') || modelName.includes('moonshot')) {
      // Kimi需要更宽松的处理策略
      enableDebugLog = true
      fallbackBehavior = 'empty_args'
    } else if (modelName.includes('gpt') || modelName.includes('openai')) {
      // OpenAI相对标准，使用默认配置
      enableDebugLog = false
      fallbackBehavior = 'empty_args'
    }

    this.adapterFactory.configure({
      enableDebugLog,
      fallbackBehavior,
      maxRetries: 2
    })
  }

  /**
   * 创建适配器上下文
   */
  private createAdapterContext(messageId?: string): AdapterContext {
    return {
      aiService: {
        name: this.extractServiceName(this.config.model),
        model: this.config.model
      },
      requestContext: {
        messageId,
        timestamp: Date.now()
      },
      debug: true
    }
  }

  /**
   * 从模型名称提取AI服务名称
   */
  private extractServiceName(model: string): string {
    const modelLower = model.toLowerCase()

    if (modelLower.includes('gpt') || modelLower.includes('openai')) {
      return 'openai'
    } else if (modelLower.includes('kimi') || modelLower.includes('moonshot')) {
      return 'kimi'
    } else if (modelLower.includes('claude') || modelLower.includes('anthropic')) {
      return 'claude'
    } else {
      return 'unknown'
    }
  }
  
  /**
   * 发送消息并获取AI响应 - 流式聊天方法（包含完整工具调用循环）
   *
   * 这是AIChat类的核心公共API，支持完整的AI对话流程：
   * 1. 接收用户消息数组
   * 2. 发送给AI服务获取响应
   * 3. 实时流式返回文本内容
   * 4. 自动处理工具调用（Function Calling）
   * 5. 支持多轮工具调用循环
   *
   * 流式处理优势：
   * - 实时显示：用户立即看到AI回复的开始
   * - 更好体验：避免长时间等待
   * - 可中断性：支持取消长时间运行的对话
   *
   * 工具调用支持：
   * - 自动循环：AI可以连续调用多个工具
   * - 错误处理：工具调用失败时自动降级
   * - 状态透明：实时报告工具执行状态
   *
   * @param messages 对话消息数组，按时间顺序排列
   * @param options 可选的聊天选项（模型参数、工具定义等）
   * @returns 异步迭代器，实时返回响应块
   * @throws {AIChatError} 当输入无效或网络错误时抛出
   *
   * @example
   * ```typescript
   * // 简单对话
   * for await (const chunk of aiChat.sendMessage([
   *   { role: 'user', content: '你好，请介绍一下自己' }
   * ])) {
   *   if (chunk.content) {
   *     process.stdout.write(chunk.content); // 实时显示
   *   }
   *   if (chunk.done) {
   *     console.log('\n对话结束');
   *     break;
   *   }
   * }
   *
   * // 带工具调用的对话
   * const messages = [
   *   { role: 'system', content: '你是一个有用的助手，可以搜索信息' },
   *   { role: 'user', content: '请搜索今天的天气' }
   * ];
   *
   * const options = {
   *   tools: [weatherTool], // 天气查询工具
   *   onToolCall: async (toolCall) => {
   *     // 自定义工具执行逻辑
   *     return await executeWeatherSearch(toolCall);
   *   }
   * };
   *
   * for await (const chunk of aiChat.sendMessage(messages, options)) {
   *   if (chunk.phase === 'calling_tools') {
   *     console.log('AI正在调用工具...');
   *   }
   *   // 处理其他响应块...
   * }
   * ```
   */
  public async *sendMessage(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterable<ChatStreamChunk> {
    try {
      // 基本验证 - 确保输入有效
      if (!messages || messages.length === 0) {
        throw new AIChatError('Messages array is required and cannot be empty', 'INVALID_INPUT')
      }

      // 清除之前的工具处理器 - 避免状态污染
      this.toolManager.clearHandlers()

      // MCP 特定逻辑已移除，统一使用 onToolCall 回调
      // 这样设计更加简洁，外部可以自由实现工具调用逻辑

      // 注册自定义工具调用处理器
      if (options?.onToolCall) {
        this.toolManager.addHandler(options.onToolCall)
      }

      // 执行完整的工具调用循环 - 这是核心处理逻辑
      yield* this.executeToolCallingLoop(messages, options)

    } catch (error) {
      // 流式错误处理 - 通过yield返回错误chunk
      // 这样可以保持流式接口的一致性
      yield createErrorChunk(error)
    }
  }
  
  /**
   * 执行完整的工具调用循环 - 重构版：分离流式文本和工具调用执行
   */
  private async *executeToolCallingLoop(
    initialMessages: Message[],
    options?: ChatOptions
  ): AsyncIterable<ChatStreamChunk> {
    // 使用配置的模型或选项中的模型
    const modelToUse = options?.model || this.config.model

    let currentMessages = [...initialMessages]
    let toolCallCount = 0
    // 允许无限工具调用，由AI自主决定何时停止
    // 如果需要限制，可以在options中传入maxToolCalls
    const maxToolCalls = options?.maxToolCalls || Number.MAX_SAFE_INTEGER

    // 如果有系统提示，添加到消息开头
    if (options?.systemPrompt) {
      currentMessages = [
        { role: 'system', content: options.systemPrompt },
        ...currentMessages.filter(msg => msg.role !== 'system')
      ]
    }

    while (toolCallCount < maxToolCalls) {
      // 阶段1：收集完整的流式响应
      const response = yield* this.collectStreamResponse(currentMessages, modelToUse, options)

      // 检查是否有工具调用需要执行
      if (!response.toolCalls || response.toolCalls.length === 0) {
        // 没有工具调用，对话结束
        yield { phase: 'responding' }
        yield {
          done: true,
          usage: response.usage,
          model: response.model,
          finishReason: response.finishReason
        }
        break
      }

      // 阶段2：执行工具调用
      toolCallCount++

      // 添加AI的工具调用消息到历史
      const toolCallMessage: Message = {
        role: 'assistant',
        content: response.content || '', // 保留AI的文本回复
        tool_calls: response.toolCalls.map(call => ({
          id: call.id,
          type: call.type,
          function: call.function
        }))
      }
      currentMessages.push(toolCallMessage)

      // 执行所有工具调用
      const toolResults = yield* this.executeToolCalls(response.toolCalls)

      // 将工具结果添加到消息历史
      for (const result of toolResults) {
        currentMessages.push({
          role: 'tool',
          content: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
          tool_call_id: result.tool_call_id
        })
      }

      // 发送工具结果处理完成事件
      yield { phase: 'processing_results' }

      // 继续循环，让AI处理工具结果
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
   * 收集完整的流式响应 - 只关注文本内容的实时显示
   */
  private async *collectStreamResponse(
    messages: Message[],
    model: string,
    options?: ChatOptions
  ): AsyncGenerator<ChatStreamChunk, { content: string; toolCalls: ToolCall[]; usage?: TokenUsage; model?: string; finishReason?: string }> {
    yield { phase: 'thinking' }

    // 构造API请求
    const apiRequest: APIRequest = {
      model,
      messages,
      stream: true,
      temperature: options?.temperature ?? this.config.temperature,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      tools: options?.tools
    }

    let content = ''
    let toolCalls: ToolCall[] = []
    let usage: TokenUsage | undefined
    let responseModel: string | undefined
    let finishReason: string | undefined

    // 流式处理：专注于文本内容的实时显示
    for await (const apiChunk of this.httpClient.postStream(apiRequest)) {
      const chunk = this.extractTextFromChunk(apiChunk)

      // 实时发送文本内容给前端
      if (chunk.content) {
        content += chunk.content
        yield { content: chunk.content }
      }

      // 收集元数据
      if (chunk.usage) usage = chunk.usage
      if (chunk.model) responseModel = chunk.model
      if (chunk.finishReason) finishReason = chunk.finishReason

      // 如果有错误，立即停止
      if (chunk.error) {
        throw new Error(chunk.error)
      }
    }

    // 流式文本显示完成后，检查是否需要工具调用
    if (finishReason === 'tool_calls') {
      toolCalls = await this.extractToolCallsFromResponse(messages, model, options)
      if (toolCalls.length > 0) {
        // 通知前端即将开始工具调用
        yield {
          toolCalls,
          phase: 'calling_tools'
        }
      }
    }

    return {
      content,
      toolCalls,
      usage,
      model: responseModel,
      finishReason
    }
  }

  /**
   * 执行工具调用列表
   */
  private async *executeToolCalls(toolCalls: ToolCall[]): AsyncGenerator<ChatStreamChunk, ToolResult[]> {
    const results: ToolResult[] = []

    for (const call of toolCalls) {
      try {
        console.log('🔧 开始处理工具调用:', {
          id: call.id,
          name: call.function.name,
          argumentsLength: call.function.arguments?.length || 0
        })

        // 使用适配器处理工具调用
        const context = this.createAdapterContext()
        const adaptResult = await this.adapterFactory.processToolCall(call, context)

        if (!adaptResult.success) {
          console.warn('⚠️ 工具调用适配失败:', adaptResult.error)
        }

        const standardToolCall = adaptResult.data
        const parsedArgs = standardToolCall.function.arguments

        // 发送工具执行开始状态
        yield {
          toolExecuting: {
            id: call.id,
            name: call.function.name,
            arguments: parsedArgs,
            startTime: Date.now()
          },
          phase: 'calling_tools'
        }

        // 执行工具调用
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

        yield {
          toolResults: [result],
          phase: 'processing_results'
        }

        results.push(result)

      } catch (error) {
        const toolError: ToolExecutionError = {
          tool_call_id: call.id,
          tool_name: call.function.name,
          error: error instanceof Error ? error.message : String(error),
          details: error
        }

        yield {
          toolError,
          phase: 'processing_results'
        }

        const errorResult: ToolResult = {
          tool_call_id: call.id,
          result: null,
          error: toolError.error
        }
        results.push(errorResult)
      }
    }

    return results
  }
  
  /**
   * 从API chunk中提取文本内容 - 简化版，不处理工具调用
   */
  private extractTextFromChunk(apiChunk: any): Partial<ChatStreamChunk> {
    const choice = apiChunk.choices?.[0]
    if (!choice) {
      return {}
    }

    const delta = choice.delta
    const chunk: Partial<ChatStreamChunk> = {}

    // 只提取文本内容
    if (delta.content) {
      chunk.content = delta.content
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
   * 从完整的API响应中提取工具调用信息
   */
  private async extractToolCallsFromResponse(
    messages: Message[],
    model: string,
    options?: ChatOptions
  ): Promise<ToolCall[]> {
    // 发送非流式请求来获取完整的工具调用信息
    const apiRequest: APIRequest = {
      model,
      messages,
      stream: false, // 关键：非流式
      temperature: options?.temperature ?? this.config.temperature,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      tools: options?.tools
    }

    try {
      const response = await this.httpClient.post(apiRequest)
      const choice = response.choices?.[0]

      if (!choice || !choice.message?.tool_calls) {
        return []
      }

      return choice.message.tool_calls.map((tc: any) => ({
        id: tc.id || this.generateToolCallId(),
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments
        }
      }))
    } catch (error) {
      console.error('获取工具调用信息失败:', error)
      return []
    }
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

  /**
   * 生成工具调用ID
   * 用于修复某些AI服务(如Kimi)不提供tool_calls id的问题
   */
  private generateToolCallId(): string {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}