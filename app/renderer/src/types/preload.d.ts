/**
 * Preload 类型定义
 * 从 app/main/preload.ts 导出的类型
 */

// AI配置类型
export interface AIConfig {
  id: number
  name: string
  api_key: string
  base_url: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateAIConfigInput {
  name: string
  api_key: string
  base_url: string
  is_default?: boolean
  is_active?: boolean
}

// 对话相关类型
export interface ConversationSession {
  id: string
  title: string
  ai_model: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: string
  token_usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  metadata?: any
}

export interface AIConfigInput {
  baseUrl: string
  model: string
  apiKey: string
  temperature?: number
  maxTokens?: number
}

export interface CreateSessionInput {
  title?: string
  ai_config: AIConfigInput
  system_prompt?: string
}

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

// MCP相关类型
export interface McpServerConfig {
  id: string
  name: string
  description?: string
  transport: {
    type: 'stdio' | 'http' | 'websocket' | 'streamable-http'
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
    url?: string
    headers?: Record<string, string>
    sessionId?: string
    enableDnsRebindingProtection?: boolean
    allowedHosts?: string[]
    reconnectDelay?: number
    maxReconnectAttempts?: number
  }
  enabled: boolean
  autoReconnect?: boolean
  timeout?: number
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface McpServerWithStatus extends McpServerConfig {
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  error?: string
  lastError?: string
  connectedAt?: Date
}

// McpServerStatus - 来自后端的服务器状态响应
export interface McpServerStatus {
  id: string
  name: string
  description?: string
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  toolCount?: number
  resourceCount?: number
  promptCount?: number
  error?: string
  lastError?: string
  connectedAt?: Date
  // 注意: 后端响应可能不包含完整的 transport 和 enabled 字段
  // 这些字段在前端使用时需要补充
}

export interface McpToolInfo {
  name: string
  description?: string
  inputSchema?: any
}

export interface McpResourceInfo {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}