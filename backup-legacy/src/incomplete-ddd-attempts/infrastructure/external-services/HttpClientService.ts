/**
 * HTTP客户端服务实现
 * 提供统一的外部API调用接口
 */

import { IHttpClient } from '../../application/ports/outbound/services/IExternalService'
import { Result } from '../../domain/shared/primitives/Result'

export interface IHttpConfig {
  baseURL?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  headers?: Record<string, string>
}

export interface IHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  headers?: Record<string, string>
  params?: Record<string, any>
  data?: any
  timeout?: number
}

export interface IHttpResponse<T = any> {
  status: number
  statusText: string
  headers: Record<string, string>
  data: T
  request: IHttpRequest
}

export class HttpClientService implements IHttpClient {
  private config: IHttpConfig

  constructor(config: IHttpConfig = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DeeChat/1.0.0'
      },
      ...config
    }
  }

  /**
   * 发送HTTP请求
   */
  async request<T = any>(request: IHttpRequest): Promise<Result<IHttpResponse<T>, Error>> {
    const startTime = Date.now()
    
    try {
      console.log(`🌐 [HttpClient] ${request.method} ${request.url}`)
      
      const response = await this.executeRequestWithRetry(request)
      const duration = Date.now() - startTime
      
      console.log(`✅ [HttpClient] ${request.method} ${request.url} - ${response.status} (${duration}ms)`)
      
      return Result.success(response)
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ [HttpClient] ${request.method} ${request.url} - Failed (${duration}ms):`, error.message)
      
      return Result.error(new Error(`HTTP request failed: ${error.message}`))
    }
  }

  /**
   * GET请求
   */
  async get<T = any>(
    url: string, 
    params?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse<T>, Error>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
      headers
    })
  }

  /**
   * POST请求
   */
  async post<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse<T>, Error>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      headers
    })
  }

  /**
   * PUT请求
   */
  async put<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse<T>, Error>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      headers
    })
  }

  /**
   * DELETE请求
   */
  async delete<T = any>(
    url: string,
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse<T>, Error>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      headers
    })
  }

  /**
   * PATCH请求
   */
  async patch<T = any>(
    url: string,
    data?: any,
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse<T>, Error>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      headers
    })
  }

  /**
   * 带重试的请求执行
   */
  private async executeRequestWithRetry<T>(request: IHttpRequest): Promise<IHttpResponse<T>> {
    let lastError: Error
    const maxRetries = this.config.retries || 3

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt - 1) // 指数退避
          console.log(`🔄 [HttpClient] 重试第 ${attempt} 次，延迟 ${delay}ms`)
          await this.sleep(delay)
        }

        const response = await this.executeRequest<T>(request)
        return response
      } catch (error) {
        lastError = error
        
        // 检查是否应该重试
        if (!this.shouldRetry(error, attempt, maxRetries)) {
          break
        }
      }
    }

    throw lastError!
  }

  /**
   * 执行具体的HTTP请求
   */
  private async executeRequest<T>(request: IHttpRequest): Promise<IHttpResponse<T>> {
    const url = this.buildFullUrl(request.url)
    const headers = this.mergeHeaders(request.headers)
    const timeout = request.timeout || this.config.timeout!

    // 构建fetch options
    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
      signal: AbortSignal.timeout(timeout)
    }

    // 添加请求体（如果需要）
    if (request.data && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      if (headers['Content-Type']?.includes('application/json')) {
        fetchOptions.body = JSON.stringify(request.data)
      } else {
        fetchOptions.body = request.data
      }
    }

    // 添加查询参数
    const finalUrl = this.addQueryParams(url, request.params)

    // 执行请求
    const response = await fetch(finalUrl, fetchOptions)
    
    // 解析响应
    const responseHeaders = this.parseHeaders(response.headers)
    let responseData: T

    try {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = await response.text() as any
      }
    } catch (error) {
      responseData = null as any
    }

    // 检查HTTP状态
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: responseData,
      request
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error, attempt: number, maxRetries: number): boolean {
    if (attempt >= maxRetries) {
      return false
    }

    // 网络错误或服务器错误才重试
    if (error.message.includes('fetch') || 
        error.message.includes('timeout') ||
        error.message.includes('5')) { // 5xx错误
      return true
    }

    return false
  }

  /**
   * 构建完整URL
   */
  private buildFullUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    const baseURL = this.config.baseURL || ''
    return `${baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
  }

  /**
   * 合并请求头
   */
  private mergeHeaders(requestHeaders?: Record<string, string>): Record<string, string> {
    return {
      ...this.config.headers,
      ...requestHeaders
    }
  }

  /**
   * 添加查询参数
   */
  private addQueryParams(url: string, params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) {
      return url
    }

    const urlObj = new URL(url)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        urlObj.searchParams.append(key, String(value))
      }
    })

    return urlObj.toString()
  }

  /**
   * 解析响应头
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value
    })
    return result
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}