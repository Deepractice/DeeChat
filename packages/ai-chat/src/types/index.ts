/**
 * AI Chat 核心类型定义 - 简洁而完整的类型系统
 *
 * 这个文件定义了ai-chat包中所有核心的TypeScript类型。
 * 遵循"如非必要，勿增实体"原则，只包含必要的类型定义。
 *
 * 设计理念：
 * - 简洁性：避免过度复杂的类型嵌套
 * - 完整性：覆盖所有核心功能的类型需求
 * - 可扩展：支持未来功能的增加而不破坏现有代码
 * - 兼容性：与主流AI服务API格式保持兼容
 *
 * 类型分类：
 * 1. 基础消息类型：对话消息的核心结构
 * 2. 配置类型：AI服务和聊天选项配置
 * 3. 工具系统类型：Function Calling相关类型
 * 4. 响应类型：API响应和流式响应
 * 5. 错误类型：错误处理和异常定义
 * 6. 内部类型：HTTP请求等内部使用的类型
 *
 * @author DeeChat Team
 * @since v0.5.0
 */

// ============== 基础消息类型 ==============

/**
 * 对话消息接口 - AI对话系统的基本数据单元
 *
 * 这是整个对话系统的核心数据结构，兼容OpenAI消息格式。
 * 支持四种角色：用户、助手、系统和工具，覆盖所有对话场景。
 *
 * 角色说明：
 * - user: 用户输入的消息
 * - assistant: AI回复的消息
 * - system: 系统提示词，设定AI行为
 * - tool: 工具执行结果，用于Function Calling
 *
 * @example
 * ```typescript
 * const userMessage: Message = {
 *   role: 'user',
 *   content: '今天天气怎么样？'
 * };
 *
 * const assistantMessage: Message = {
 *   role: 'assistant',
 *   content: '我来查询天气信息',
 *   tool_calls: [weatherToolCall]
 * };
 * ```
 */
export interface Message {
  /** 消息角色：用户、助手、系统或工具 */
  role: 'user' | 'assistant' | 'system' | 'tool'

  /** 消息内容：主要的文本内容 */
  content: string

  /** 工具名称：当role为'tool'时使用 */
  name?: string

  /** 工具调用ID：工具结果消息必须包含对应的调用ID */
  tool_call_id?: string

  /** 工具调用列表：AI发起的工具调用（assistant消息使用） */
  tool_calls?: ToolCall[]
}

// ============== AI 聊天配置 ==============

/**
 * AI聊天客户端配置接口
 *
 * 这是AIChat类的构造函数配置，包含了连接AI服务所需的所有基础信息。
 * 设计上区分必需配置和可选配置，确保必要信息不会缺失。
 *
 * 配置优先级：
 * 1. 构造函数配置（持久性配置）
 * 2. ChatOptions配置（请求级配置）
 *
 * @example
 * ```typescript
 * const config: AIChatConfig = {
 *   baseUrl: 'https://api.openai.com',
 *   model: 'gpt-4',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   temperature: 0.7,
 *   maxTokens: 2000,
 *   timeout: 30000
 * };
 * ```
 */
export interface AIChatConfig {
  // === 必需配置 ===
  /** API服务端点URL：如 https://api.openai.com */
  baseUrl: string

  /** 模型名称：如 gpt-4、claude-3-sonnet等 */
  model: string

  // === 可选配置 ===
  /** API密钥：Bearer token认证（某些服务可选） */
  apiKey?: string

  /** 温度参数：控制生成的随机性，范围0-2 */
  temperature?: number

  /** 最大token数：限制响应长度 */
  maxTokens?: number

  /** HTTP超时时间：毫秒，默认30000（30秒） */
  timeout?: number
}

/**
 * 聊天选项接口 - 每次对话的动态配置
 *
 * 这些选项可以在每次调用sendMessage时传递，
 * 允许对单次对话进行精细控制而不影响全局配置。
 *
 * 与AIChatConfig的区别：
 * - AIChatConfig：持久性配置，影响整个客户端
 * - ChatOptions：临时性配置，只影响当次对话
 *
 * @example
 * ```typescript
 * const options: ChatOptions = {
 *   systemPrompt: '你是一个专业的技术助手',
 *   temperature: 0.1, // 更保守的输出
 *   tools: [weatherTool, searchTool],
 *   onToolCall: async (call) => executeCustomTool(call)
 * };
 * ```
 */
export interface ChatOptions {
  // === 动态参数（每次请求可不同） ===
  /** 系统提示词：设定AI的行为和角色 */
  systemPrompt?: string

  /** 温度参数：临时覆盖全局配置 */
  temperature?: number

  /** 最大token数：临时覆盖全局配置 */
  maxTokens?: number

  /** 模型名称：临时使用不同的模型 */
  model?: string

  /** 最大工具调用次数：防止无限循环，默认无限制 */
  maxToolCalls?: number

  // === 工具系统 ===
  /** 工具定义列表：可用的Function Calling工具 */
  tools?: Tool[]

  /** 工具调用处理器：实际执行工具逻辑的回调函数 */
  onToolCall?: (call: ToolCall) => Promise<ToolResult>

  // 注：MCP 集成已移至 Domain 层，通过 onToolCall 回调实现
  // 这样设计更加灵活，外部可以自由选择工具调用的实现方式
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