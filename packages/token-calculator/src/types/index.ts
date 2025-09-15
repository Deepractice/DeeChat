// 核心类型定义

// 支持的AI厂商
export enum Provider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GENERIC = 'generic'
}

// Token使用统计
export interface TokenUsage {
  inputTokens: number
  outputTokens?: number
  totalTokens: number
}

// 成本估算结果
export interface CostEstimate {
  inputCost: number
  outputCost: number
  totalCost: number
  currency: string
}

// 模型定价信息
export interface ModelPricing {
  inputPrice: number  // 每1K tokens价格
  outputPrice: number // 每1K tokens价格
  currency: string
}

// Token计算选项
export interface TokenizeOptions {
  includeSpecialTokens?: boolean
  truncate?: boolean
  maxTokens?: number
}

// 批处理结果
export interface BatchTokenResult {
  text: string
  tokens: number
  index: number
  error?: string
}

// 模型信息
export interface ModelInfo {
  provider: Provider
  modelName: string
  maxTokens: number
  pricing?: ModelPricing
}

// 策略接口 - 所有tokenizer必须实现
export interface TokenizerStrategy {
  // 核心功能
  count(text: string, model?: string): number
  
  // 高级功能（可选实现）
  encode?(text: string, model?: string): number[]
  decode?(tokens: number[], model?: string): string
  
  // 元信息
  getSupportedModels(): string[]
  getProviderName(): Provider
}