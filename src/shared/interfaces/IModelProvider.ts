import { ModelConfigEntity, TestResult } from '../entities/ModelConfigEntity'
import { ToolExecution } from '../types'

export interface LLMResponse {
  content: string
  model: string
  toolExecutions?: ToolExecution[]  // 新增：工具执行记录
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  finishReason?: string
  contextInfo?: {  // 新增：上下文管理信息
    originalMessageCount: number
    finalMessageCount: number
    tokenStats: {
      currentTokens: number
      maxTokens: number
      utilizationRate: number
      status: 'optimal' | 'near_limit' | 'compressed'
    }
    compressionApplied: boolean
    removedCount: number
  }
}

export interface LLMRequest {
  message: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  attachmentIds?: string[]  // 附件ID列表
}

// LLM提供商接口
export interface IModelProvider {
  readonly name: string
  readonly config: ModelConfigEntity
  
  // 发送消息
  sendMessage(request: LLMRequest): Promise<LLMResponse>
  
  // 测试连接
  testConnection(): Promise<TestResult>
  
  // 验证配置
  validateConfig(): boolean
  
  // 获取支持的模型列表
  getSupportedModels(): string[]
  
  // 获取模型信息
  getModelInfo(model: string): ModelInfo | null
}

export interface ModelInfo {
  name: string
  description: string
  contextLength: number
  inputCostPer1K?: number
  outputCostPer1K?: number
  supportsFunctions?: boolean
  supportsVision?: boolean
}

// 提供商工厂接口
export interface IModelProviderFactory {
  readonly providerName: string
  
  // 创建提供商实例
  createProvider(config: ModelConfigEntity): IModelProvider
  
  // 获取支持的模型列表
  getSupportedModels(): string[]
  
  // 验证配置格式
  validateConfig(config: ModelConfigEntity): boolean
  
  // 获取默认配置
  getDefaultConfig(): Partial<ModelConfigEntity>
  
  // 获取配置模板
  getConfigTemplate(): ModelConfigTemplate
}

export interface ModelConfigTemplate {
  name: string
  provider: string
  baseURL: string
  supportedModels: string[]
  requiredFields: string[]
  optionalFields: string[]
  validation: {
    apiKeyPattern?: RegExp
    baseURLPattern?: RegExp
  }
  // 支持自定义配置
  isCustom?: boolean
  customEndpoint?: string
  customHeaders?: Record<string, string>
}
