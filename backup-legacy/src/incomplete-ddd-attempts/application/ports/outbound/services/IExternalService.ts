/**
 * 外部服务接口（出站端口）
 * 定义与外部系统集成的抽象契约
 */

import { Result } from '../../../../domain/shared/primitives/Result'

export interface IHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retryCount?: number
}

export interface IHttpResponse {
  status: number
  headers: Record<string, string>
  data: any
  duration: number
}

export interface IMCPConnection {
  serverId: string
  serverUrl: string
  connected: boolean
  lastConnected?: Date
  version?: string
  capabilities?: string[]
}

export interface IMCPToolSchema {
  name: string
  description: string
  parameters: Record<string, any>
  returns?: any
}

/**
 * HTTP客户端接口
 * 负责HTTP请求的发送和处理
 */
export interface IHttpClient {
  /**
   * 发送HTTP请求
   */
  request(request: IHttpRequest): Promise<Result<IHttpResponse, Error>>

  /**
   * 发送GET请求
   */
  get(url: string, headers?: Record<string, string>): Promise<Result<IHttpResponse, Error>>

  /**
   * 发送POST请求
   */
  post(
    url: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse, Error>>

  /**
   * 发送PUT请求
   */
  put(
    url: string, 
    body?: any, 
    headers?: Record<string, string>
  ): Promise<Result<IHttpResponse, Error>>

  /**
   * 发送DELETE请求
   */
  delete(url: string, headers?: Record<string, string>): Promise<Result<IHttpResponse, Error>>
}

/**
 * MCP客户端接口
 * 负责与MCP服务器的通信
 */
export interface IMCPClient {
  /**
   * 连接到MCP服务器
   */
  connect(serverUrl: string): Promise<Result<IMCPConnection, Error>>

  /**
   * 断开MCP服务器连接
   */
  disconnect(serverId: string): Promise<Result<void, Error>>

  /**
   * 获取连接状态
   */
  getConnectionStatus(serverId: string): Promise<Result<IMCPConnection, Error>>

  /**
   * 发现服务器上的工具
   */
  discoverTools(serverId: string): Promise<Result<IMCPToolSchema[], Error>>

  /**
   * 执行MCP工具
   */
  executeTool(
    serverId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<Result<any, Error>>

  /**
   * 获取工具架构
   */
  getToolSchema(serverId: string, toolName: string): Promise<Result<IMCPToolSchema, Error>>

  /**
   * 列出所有连接
   */
  listConnections(): Promise<Result<IMCPConnection[], Error>>
}

/**
 * AI服务接口
 * 负责与AI模型的交互
 */
export interface IAIService {
  /**
   * 发送聊天完成请求
   */
  chatCompletion(
    messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }>,
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
      stream?: boolean
    }
  ): Promise<Result<{
    content: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }, Error>>

  /**
   * 流式聊天完成
   */
  streamChatCompletion(
    messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }>,
    onChunk: (chunk: string) => void,
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
    }
  ): Promise<Result<void, Error>>

  /**
   * 生成文本嵌入
   */
  generateEmbedding(text: string): Promise<Result<number[], Error>>

  /**
   * 获取可用模型列表
   */
  listModels(): Promise<Result<Array<{
    id: string
    name: string
    description?: string
    capabilities: string[]
  }>, Error>>
}

/**
 * 文件系统服务接口
 * 负责文件操作
 */
export interface IFileSystemService {
  /**
   * 读取文件
   */
  readFile(path: string, encoding?: string): Promise<Result<string | Buffer, Error>>

  /**
   * 写入文件
   */
  writeFile(path: string, content: string | Buffer): Promise<Result<void, Error>>

  /**
   * 检查文件是否存在
   */
  exists(path: string): Promise<Result<boolean, Error>>

  /**
   * 创建目录
   */
  createDirectory(path: string): Promise<Result<void, Error>>

  /**
   * 删除文件或目录
   */
  delete(path: string): Promise<Result<void, Error>>

  /**
   * 列出目录内容
   */
  listDirectory(path: string): Promise<Result<Array<{
    name: string
    path: string
    isDirectory: boolean
    size?: number
    modifiedAt?: Date
  }>, Error>>

  /**
   * 获取文件信息
   */
  getFileInfo(path: string): Promise<Result<{
    name: string
    path: string
    size: number
    isDirectory: boolean
    createdAt: Date
    modifiedAt: Date
  }, Error>>
}