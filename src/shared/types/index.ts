// MCP工具执行记录类型
export interface ToolExecution {
  id: string
  toolName: string
  params: any
  result?: any
  error?: string
  duration?: number
  timestamp: number
}

// 聊天消息类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number  // 使用Unix时间戳保持一致性
  modelId?: string
  toolExecutions?: ToolExecution[]  // 新增：工具执行记录
  metadata?: {
    tokens?: number
    responseTime?: number
    error?: string
  }
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 模型提供商类型 - 支持更多提供商和自定义
export type ModelProvider = 'openai' | 'claude' | 'grok' | 'mistral' | 'ollama' | 'custom' | string

// 模型状态类型
export type ModelStatus = 'available' | 'error' | 'untested' | 'testing'

// 先导入实体类型
import { ModelConfigEntity } from '../entities/ModelConfigEntity'
import type { ModelConfigData, TestResult, ValidationResult } from '../entities/ModelConfigEntity'
import { ChatSessionEntity } from '../entities/ChatSessionEntity'
import type { ChatSessionData } from '../entities/ChatSessionEntity'
import { UserPreferenceEntity } from '../entities/UserPreferenceEntity'
import type { UserPreferenceData } from '../entities/UserPreferenceEntity'
import type { LLMRequest, LLMResponse, ModelConfigTemplate } from '../interfaces/IModelProvider'

// 重新导出实体类型
export { ModelConfigEntity, ChatSessionEntity, UserPreferenceEntity }
export type { ModelConfigData, TestResult, ValidationResult, ChatSessionData, UserPreferenceData, LLMRequest, LLMResponse, ModelConfigTemplate }

// 模型选择策略类型
export type ModelSelectionStrategy = 'remember_last' | 'priority' | 'manual'

// 前端状态类型（在导入实体类型之后定义）
export interface ModelManagementState {
  configs: ModelConfigEntity[]
  currentSessionModel: string | null
  userPreferences: UserPreferenceEntity | null
  isLoading: boolean
  error: string | null
  testResults: Map<string, TestResult>
}

export interface ChatState {
  sessions: ChatSessionEntity[]
  currentSessionId: string | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
}

// 组件Props类型
export interface ModelConfigCardProps {
  config: ModelConfigEntity
  onTest: (id: string) => void
  onSave: (config: ModelConfigEntity) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string) => void
  testResult?: TestResult
  isLoading?: boolean
}

export interface ModelSelectorProps {
  sessionId: string
  selectedModelId?: string
  onModelChange: (modelId: string) => void
  availableModels: ModelConfigEntity[]
  disabled?: boolean
}

export interface ChatInputProps {
  onSendMessage: (message: string) => void
  disabled?: boolean
  placeholder?: string
  maxLength?: number
}

// 表单类型
export interface ModelConfigFormData {
  name: string
  provider: ModelProvider
  model: string
  apiKey: string
  baseURL: string
  priority: number
  isEnabled: boolean
}

export interface UserPreferenceFormData {
  defaultModelId?: string
  modelSelectionStrategy: ModelSelectionStrategy
  autoSwitchOnFailure: boolean
}

// 错误类型
export class ModelConfigError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'ModelConfigError'
  }
}

export class ModelProviderError extends Error {
  constructor(message: string, public provider?: string) {
    super(message)
    this.name = 'ModelProviderError'
  }
}

export class ModelSelectionError extends Error {
  constructor(message: string, public sessionId?: string) {
    super(message)
    this.name = 'ModelSelectionError'
  }
}

// 工具函数类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// 兼容旧版本的类型（保持向后兼容）
export interface LLMConfig {
  provider: 'openai' | 'claude' | 'local'
  apiKey: string
  baseURL?: string
  model: string
  temperature?: number
  maxTokens?: number
}

export interface AppConfig {
  llm: LLMConfig
  ui: {
    theme: 'light' | 'dark' | 'auto'
    language: 'zh' | 'en'
  }
  chat: {
    maxHistoryLength: number
    autoSave: boolean
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
  selectedModelId?: string
}

// 🔥 新增：增强的会话类型，包含完整的模型配置
export interface EnhancedChatSession extends ChatSession {
  selectedModelConfig?: ModelConfigEntity  // 完整的模型配置对象
  modelDisplayName?: string               // 模型显示名称
}

export interface AppState {
  config: AppConfig
  currentSession: ChatSession | null
  sessions: ChatSession[]
  isLoading: boolean
  error: string | null
}

// 别名保持兼容性
export type APIResponse<T = any> = ApiResponse<T>
