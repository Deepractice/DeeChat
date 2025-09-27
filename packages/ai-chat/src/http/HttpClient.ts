/**
 * HTTP客户端 - 专门处理AI服务API请求
 *
 * 这是一个轻量级的HTTP客户端，专为OpenAI兼容的API设计。
 * 遵循"简单即是美"的原则，避免过度抽象，直接处理具体的AI API需求。
 *
 * 核心特性：
 * - OpenAI兼容：支持所有遵循OpenAI API格式的服务
 * - 流式支持：完整的Server-Sent Events (SSE)处理
 * - 超时控制：防止长时间挂起的网络请求
 * - 错误处理：统一的错误格式和详细的错误信息
 * - 认证支持：自动处理Bearer token认证
 *
 * 设计理念：
 * - 无复杂Provider抽象层：直接针对AI API特点优化
 * - 内存友好：流式处理大量数据时不会占用过多内存
 * - 错误透明：保留原始错误信息，便于调试
 *
 * @author DeeChat Team
 * @since v0.5.0
 * @example
 * ```typescript
 * const httpClient = new HttpClient({
 *   baseUrl: 'https://api.openai.com',
 *   apiKey: 'sk-...',
 *   timeout: 30000
 * });
 *
 * // 普通请求
 * const response = await httpClient.post({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 *
 * // 流式请求
 * for await (const chunk of httpClient.postStream(request)) {
 *   console.log(chunk);
 * }
 * ```
 */

import { AIChatConfig, HttpError, APIRequest, APIResponse, APIStreamChunk } from '../types/index.js'

/**
 * HTTP客户端类 - 处理所有与AI服务的网络通信
 *
 * 职责单一：专注于网络层面的请求处理，不涉及业务逻辑。
 * 所有的AI服务差异都在上层的适配器中处理。
 */
export class HttpClient {
  /** 请求超时时间（毫秒），防止网络请求挂起 */
  private readonly timeout: number

  /**
   * 构造HttpClient实例
   *
   * @param config AI服务配置，包含URL、认证等信息
   */
  constructor(private config: AIChatConfig) {
    this.timeout = config.timeout || 30000 // 默认30秒超时，对AI API来说是合理的时间
  }

  /**
   * 发送POST请求到/chat/completions端点（非流式）
   *
   * 用于获取完整的AI响应，适合不需要实时显示的场景，
   * 比如获取工具调用信息或者批量处理。
   *
   * @param data API请求数据，符合OpenAI格式
   * @returns Promise解析为完整的API响应
   * @throws {HttpError} 当网络错误或API错误时抛出
   *
   * @example
   * ```typescript
   * const response = await httpClient.post({
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello' }],
   *   temperature: 0.7
   * });
   * console.log(response.choices[0].message.content);
   * ```
   */
  async post(data: APIRequest): Promise<APIResponse> {
    const url = `${this.config.baseUrl}/chat/completions`

    const response = await this.makeRequest(url, data)

    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    return response.json() as Promise<APIResponse>
  }

  /**
   * 发送流式POST请求到/chat/completions端点
   *
   * 这是核心的流式处理方法，使用Server-Sent Events (SSE)协议
   * 实时接收AI响应。每个chunk都是一个独立的JSON对象。
   *
   * 流式处理的优势：
   * - 实时响应：用户立即看到AI开始回复
   * - 内存友好：不需要等待完整响应再处理
   * - 可中断：可以随时停止长时间的对话
   * - 更好体验：类似真人对话的感觉
   *
   * SSE格式处理：
   * - 解析 "data: " 前缀的行
   * - 处理 "[DONE]" 结束标志
   * - 自动跳过注释和空行
   * - 容错JSON解析
   *
   * @param data API请求数据，会自动设置stream: true
   * @returns 异步迭代器，yielding每个响应chunk
   * @throws {HttpError} 当网络错误或API错误时抛出
   *
   * @example
   * ```typescript
   * for await (const chunk of httpClient.postStream({
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello' }]
   * })) {
   *   const content = chunk.choices?.[0]?.delta?.content;
   *   if (content) {
   *     process.stdout.write(content); // 实时显示
   *   }
   * }
   * ```
   */
  async *postStream(data: APIRequest): AsyncIterable<APIStreamChunk> {
    const url = `${this.config.baseUrl}/chat/completions`
    const requestData = { ...data, stream: true } // 强制启用流式模式

    const response = await this.makeRequest(url, requestData)

    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    if (!response.body) {
      throw new HttpError('Response body is null for streaming request')
    }

    // 处理服务器发送事件 (SSE) 流
    // 使用ReadableStream的Reader API来逐步读取数据
    const reader = response.body.getReader()
    const decoder = new TextDecoder() // 将字节流转换为字符串
    let buffer = '' // 缓冲区，处理不完整的行

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break // 流结束

        // 解码新数据并添加到缓冲区
        buffer += decoder.decode(value, { stream: true })

        // 按行分割处理 - SSE是基于行的协议
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后可能不完整的行

        for (const line of lines) {
          const trimmed = line.trim()

          // 跳过空行和SSE注释行（以:开头）
          if (!trimmed || trimmed.startsWith(':')) {
            continue
          }

          // 处理SSE数据行
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6) // 移除 'data: ' 前缀

            // 检查流结束标志 - OpenAI用[DONE]标记流结束
            if (data === '[DONE]') {
              return
            }

            try {
              // 解析JSON chunk并yield给调用者
              const chunk: APIStreamChunk = JSON.parse(data)
              yield chunk
            } catch (error) {
              // 容错处理：JSON解析失败时警告但不中断流
              console.warn('Failed to parse SSE chunk:', data, error)
            }
          }
        }
      }
    } finally {
      // 确保释放资源，避免内存泄露
      reader.releaseLock()
    }
  }
  
  /**
   * 构造和发送HTTP请求
   *
   * 这是所有网络请求的核心方法，统一处理认证、超时、错误等。
   * 使用fetch API + AbortController实现可取消的请求。
   *
   * 关键特性：
   * - 自动添加认证头：Bearer token方式
   * - 超时控制：防止请求无限挂起
   * - 统一错误处理：网络错误和超时错误
   * - Content-Type：自动设置JSON格式
   *
   * @param url 请求的完整URL
   * @param data 请求体数据，会被JSON序列化
   * @returns fetch Response对象
   * @throws {HttpError} 网络错误或超时时抛出
   * @private
   */
  private async makeRequest(url: string, data: any): Promise<Response> {
    // 构造请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', // AI API都使用JSON格式
    }

    // 添加Bearer token认证（如果配置了API密钥）
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    // 设置请求超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method: 'POST', // AI API基本都是POST请求
        headers,
        body: JSON.stringify(data),
        signal: controller.signal // 支持请求取消
      })

      clearTimeout(timeoutId) // 成功时清除超时定时器
      return response

    } catch (error) {
      clearTimeout(timeoutId) // 出错时也要清除定时器

      // 区分超时错误和其他网络错误
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(`Request timeout after ${this.timeout}ms`)
      }

      // 包装其他网络错误
      throw new HttpError(`Request failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 处理HTTP错误响应
   *
   * AI服务通常会在响应体中返回详细的错误信息，这个方法尝试解析
   * 这些错误信息，为用户提供更友好的错误提示。
   *
   * 错误信息优先级：
   * 1. API响应体中的error.message字段
   * 2. 针对特定状态码的友好提示
   * 3. HTTP状态码和状态文本
   *
   * 常见AI API错误：
   * - 401: API密钥无效
   * - 422: 请求参数无效或账户余额不足
   * - 429: 请求频率超限
   * - 500: AI服务内部错误
   *
   * @param response 错误的HTTP响应对象
   * @throws {HttpError} 总是抛出包含详细错误信息的HttpError
   * @private
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    let customMessage = ''

    try {
      // 尝试解析响应体中的详细错误信息
      const errorData = await response.json() as any
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // 忽略JSON解析错误，使用默认HTTP错误信息
      // 有些服务可能返回非JSON格式的错误响应
    }

    // 针对特定状态码提供更友好的错误提示
    switch (response.status) {
      case 422:
        customMessage = '💡 API 请求失败：可能是账户余额不足或请求参数有误。请检查：\n' +
                       '• 账户是否有足够的 API 额度\n' +
                       '• API 密钥是否有效\n' +
                       '• 请求参数是否符合要求'
        break
      case 401:
        customMessage = '🔑 认证失败：API 密钥无效或已过期，请检查您的 API 密钥配置'
        break
      case 429:
        customMessage = '⏰ 请求过于频繁：已超出 API 调用限制，请稍后再试'
        break
      case 500:
      case 502:
      case 503:
        customMessage = '🔧 AI 服务暂时不可用：服务器出现问题，请稍后重试'
        break
    }

    // 如果有自定义提示，使用自定义提示；否则使用原始错误信息
    const finalMessage = customMessage || errorMessage

    throw new HttpError(finalMessage, response.status)
  }
}