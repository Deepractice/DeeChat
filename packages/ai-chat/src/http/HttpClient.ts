/**
 * 简单的HTTP客户端 - 直接处理OpenAI兼容的API请求
 * 无需复杂的Provider抽象层
 */

import { AIChatConfig, HttpError, APIRequest, APIResponse, APIStreamChunk } from '../types/index.js'

export class HttpClient {
  private readonly timeout: number

  constructor(private config: AIChatConfig) {
    this.timeout = config.timeout || 30000 // 默认30秒超时
  }

  /**
   * 发送POST请求到 /chat/completions 端点
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
   * 发送流式请求
   */
  async *postStream(data: APIRequest): AsyncIterable<APIStreamChunk> {
    const url = `${this.config.baseUrl}/chat/completions`
    const requestData = { ...data, stream: true }
    
    const response = await this.makeRequest(url, requestData)
    
    if (!response.ok) {
      await this.handleErrorResponse(response)
    }
    
    if (!response.body) {
      throw new HttpError('Response body is null for streaming request')
    }
    
    // 处理服务器发送事件 (SSE) 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        
        // 处理缓冲区中的完整行
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // 保留最后不完整的行
        
        for (const line of lines) {
          const trimmed = line.trim()
          
          // 跳过空行和注释
          if (!trimmed || trimmed.startsWith(':')) {
            continue
          }
          
          // 检查是否是数据行
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6) // 移除 'data: ' 前缀
            
            // 检查流结束标志
            if (data === '[DONE]') {
              return
            }
            
            try {
              const chunk: APIStreamChunk = JSON.parse(data)
              yield chunk
            } catch (error) {
              console.warn('Failed to parse SSE chunk:', data, error)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
  
  /**
   * 构造HTTP请求
   */
  private async makeRequest(url: string, data: any): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    // 添加授权头（如果有API密钥）
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response
      
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(`Request timeout after ${this.timeout}ms`)
      }
      
      throw new HttpError(`Request failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * 处理错误响应
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    
    try {
      const errorData = await response.json() as any
      if (errorData.error?.message) {
        errorMessage = errorData.error.message
      }
    } catch {
      // 忽略JSON解析错误，使用默认错误信息
    }
    
    throw new HttpError(errorMessage, response.status)
  }
}