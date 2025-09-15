// Token Calculator - Main entry point
// 基于策略模式的多厂商Token计算器

// 导出核心类
export { TokenCalculator } from './calculator'
export { CostCalculator } from './cost'

// 导出策略类
export { OpenAITokenizer } from './strategies/openai'
export { AnthropicTokenizer } from './strategies/anthropic'
export { GenericTokenizer } from './strategies/generic'
export { BaseTokenizerStrategy } from './strategies/base'

// 导出类型
export {
  Provider,
  TokenUsage,
  CostEstimate,
  ModelPricing,
  TokenizeOptions,
  BatchTokenResult,
  ModelInfo,
  TokenizerStrategy
} from './types'

import { TokenCalculator } from './calculator'
import { CostCalculator } from './cost'

// 创建默认实例
const defaultCalculator = new TokenCalculator()
const defaultCostCalculator = new CostCalculator(defaultCalculator)

// 便捷函数 - 直接导出以便快速使用
export function countTokens(text: string, provider?: string, model?: string): number {
  return defaultCalculator.count(text, provider, model)
}

export function countGPT4(text: string): number {
  return defaultCalculator.countGPT4(text)
}

export function countGPT35(text: string): number {
  return defaultCalculator.countGPT35(text)
}

export function countClaude(text: string, model?: string): number {
  return defaultCalculator.countClaude(text, model)
}

export function estimateCost(
  inputText: string,
  outputTokens: number = 0,
  model: string,
  provider?: string
) {
  return defaultCostCalculator.estimateCostFromText(inputText, outputTokens, model, provider)
}

export function compareProviders(text: string, model?: string) {
  return defaultCalculator.compare(text, model)
}

export function batchCount(texts: string[], provider?: string, model?: string) {
  return defaultCalculator.batchCount(texts, provider, model)
}

export function getMostEconomical(
  inputText: string,
  outputTokens: number = 0,
  models?: string[]
) {
  return defaultCostCalculator.getMostEconomical(inputText, outputTokens, models)
}

// 健康检查
export function healthCheck() {
  return defaultCalculator.healthCheck()
}

// 获取支持的模型
export function getSupportedModels(provider?: string) {
  return defaultCalculator.getSupportedModels(provider)
}

// 获取可用的提供者
export function getAvailableProviders() {
  return defaultCalculator.getAvailableProviders()
}

// 默认导出主类
export default TokenCalculator