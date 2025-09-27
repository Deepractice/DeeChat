/**
 * 对话域类型定义
 * 包含对话会话、消息、AI配置等相关接口
 */

/**
 * 对话会话接口
 * 表示一个完整的AI对话会话，包含基本信息和统计数据
 */
export interface ConversationSession {
  id: string                 // 会话唯一标识符
  title: string              // 会话标题，用于UI显示
  ai_model: string           // 使用的AI模型名称
  created_at: string         // 创建时间（ISO字符串）
  updated_at: string         // 最后更新时间（ISO字符串）
  message_count: number      // 消息总数
}

/**
 * 工具调用定义（兼容OpenAI格式）
 */
export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

/**
 * 对话消息接口
 * 表示对话中的单条消息，支持多种消息类型和角色
 */
export interface ConversationMessage {
  id: string                 // 消息唯一标识符
  session_id: string         // 所属会话ID
  role: 'user' | 'assistant' | 'system' | 'tool'  // 消息发送者角色
  content: string            // 消息内容
  ai_model?: string          // AI模型（仅assistant消息）
  tool_calls?: ToolCall[]    // 工具调用（仅assistant消息）
  tool_call_id?: string      // 工具调用ID（仅tool消息）
  created_at: string         // 创建时间（ISO字符串）
  token_count?: number       // Token计数（可选）
  metadata?: Record<string, any>  // 扩展元数据
}

/**
 * AI配置输入接口
 * 用于传递AI配置参数，简化调用复杂性
 */
export interface AIConfigInput {
  model: string
  baseUrl: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
}

/**
 * 创建会话输入
 */
export interface CreateSessionInput {
  title?: string
  ai_config: AIConfigInput
  system_prompt?: string
}

/**
 * 发送消息输入
 */
export interface SendMessageInput {
  session_id: string
  content: string
  ai_config: AIConfigInput
  options?: {
    temperature?: number
    max_tokens?: number
    system_prompt?: string
  }
}