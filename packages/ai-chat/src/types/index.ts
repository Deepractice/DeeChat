/**
 * 简化的 AI Chat 类型定义
 * 专注于核心功能：HTTP请求 + 工具调用 + 流式处理
 */

// ============== 基础消息类型 ==============

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  name?: string         // 工具调用时的工具名
  tool_call_id?: string // 工具结果对应的调用ID
}

// ============== AI 聊天配置 ==============

export interface AIChatConfig {
  // 必需配置
  baseUrl: string       // API服务端点URL
  model: string         // 模型名称
  
  // 可选配置  
  apiKey?: string       // API密钥（某些服务可选）
  temperature?: number  // 温度参数 (0-2)
  maxTokens?: number    // 最大token数
  timeout?: number      // HTTP超时时间(ms)，默认30000
}

// ============== 聊天选项 ==============

export interface ChatOptions {
  // 动态参数（每次请求可不同）
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  model?: string        // 临时覆盖模型
  
  // 工具系统
  tools?: Tool[]        // 工具描述
  onToolCall?: (call: ToolCall) => Promise<ToolResult>  // 工具执行回调
}

// ============== 工具系统 ==============

export interface Tool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>  // JSON Schema 格式
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string  // JSON字符串
  }
}

export interface ToolResult {
  tool_call_id: string
  result: any
  error?: string
}

// 工具执行状态跟踪
export interface ToolExecuting {
  id: string
  name: string
  arguments: Record<string, any>
  startTime: number
}

// 工具执行错误详情
export interface ToolExecutionError {
  tool_call_id: string
  tool_name: string
  error: string
  details?: any
}

// ============== 响应类型 ==============

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatResponse {
  message: Message      // AI 回复消息
  usage: TokenUsage     // Token 使用统计
  model: string         // 实际使用的模型
  finishReason: string  // 结束原因
}

export interface ChatStreamChunk {
  // === 基础响应 ===
  content?: string      // AI 回复的文本内容
  done?: boolean        // 整个对话是否完成
  usage?: TokenUsage    // Token 使用统计
  model?: string        // 使用的模型
  finishReason?: string // 结束原因
  error?: string        // 错误信息

  // === 工具调用相关 ===
  toolCalls?: ToolCall[]           // AI 发起的工具调用
  toolExecuting?: ToolExecuting    // 当前正在执行的工具信息
  toolResults?: ToolResult[]       // 工具执行完成的结果
  toolError?: ToolExecutionError   // 工具执行错误
  
  // === 工具调用状态 ===
  phase?: 'thinking' | 'calling_tools' | 'processing_results' | 'responding'
}

// ============== HTTP 请求相关类型（内部使用）==============

export interface APIRequest {
  model: string
  messages: Message[]
  stream: boolean
  temperature?: number
  max_tokens?: number
  tools?: Tool[]
}

export interface APIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason: string | null
  }>
  usage: TokenUsage
}

export interface APIStreamChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string
      tool_calls?: Array<{
        index?: number
        id?: string
        type?: 'function'
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: TokenUsage
}

// ============== 错误类型 ==============

export class AIChatError extends Error {
  constructor(
    message: string, 
    public code: string, 
    public details?: any
  ) {
    super(message)
    this.name = 'AIChatError'
  }
}

export class HttpError extends AIChatError {
  constructor(message: string, public status?: number, details?: any) {
    super(message, 'HTTP_ERROR', details)
    this.name = 'HttpError'
  }
}

export class ToolError extends AIChatError {
  constructor(message: string, public toolName: string, details?: any) {
    super(message, 'TOOL_ERROR', details)
    this.name = 'ToolError'
  }
}