import { Provider, TokenizerStrategy, TokenUsage, BatchTokenResult } from './types'
import { OpenAITokenizer } from './strategies/openai'
import { AnthropicTokenizer } from './strategies/anthropic'
import { GenericTokenizer } from './strategies/generic'

export class TokenCalculator {
  private strategies: Map<Provider, TokenizerStrategy> = new Map()
  private currentStrategy: TokenizerStrategy

  constructor() {
    this.initializeStrategies()
    // 默认使用OpenAI策略
    this.currentStrategy = this.strategies.get(Provider.OPENAI)!
  }

  private initializeStrategies(): void {
    try {
      this.strategies.set(Provider.OPENAI, new OpenAITokenizer())
    } catch (error) {
      console.warn('Failed to initialize OpenAI tokenizer:', error)
    }

    try {
      this.strategies.set(Provider.ANTHROPIC, new AnthropicTokenizer())
    } catch (error) {
      console.warn('Failed to initialize Anthropic tokenizer:', error)
    }

    // 通用策略总是可用
    this.strategies.set(Provider.GENERIC, new GenericTokenizer())
  }

  // 核心API：计算token数量
  count(text: string, provider?: Provider | string, model?: string): number {
    const strategy = this.getStrategy(provider)
    return strategy.count(text, model)
  }

  // 批量计算
  batchCount(texts: string[], provider?: Provider | string, model?: string): BatchTokenResult[] {
    const strategy = this.getStrategy(provider)
    
    return texts.map((text, index) => {
      try {
        const tokens = strategy.count(text, model)
        return {
          text,
          tokens,
          index
        }
      } catch (error) {
        return {
          text,
          tokens: 0,
          index,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })
  }

  // 便捷方法：GPT-4
  countGPT4(text: string): number {
    return this.count(text, Provider.OPENAI, 'gpt-4')
  }

  // 便捷方法：GPT-3.5
  countGPT35(text: string): number {
    return this.count(text, Provider.OPENAI, 'gpt-3.5-turbo')
  }

  // 便捷方法：Claude
  countClaude(text: string, model = 'claude-3-sonnet'): number {
    return this.count(text, Provider.ANTHROPIC, model)
  }

  // 高级API：编码（如果支持）
  encode(text: string, provider?: Provider | string, model?: string): number[] {
    const strategy = this.getStrategy(provider)
    
    if (!strategy.encode) {
      throw new Error(`Provider ${strategy.getProviderName()} does not support token encoding`)
    }
    
    return strategy.encode(text, model)
  }

  // 高级API：解码（如果支持）
  decode(tokens: number[], provider?: Provider | string, model?: string): string {
    const strategy = this.getStrategy(provider)
    
    if (!strategy.decode) {
      throw new Error(`Provider ${strategy.getProviderName()} does not support token decoding`)
    }
    
    return strategy.decode(tokens, model)
  }

  // 获取支持的模型列表
  getSupportedModels(provider?: Provider | string): string[] {
    const strategy = this.getStrategy(provider)
    return strategy.getSupportedModels()
  }

  // 获取所有可用的提供者
  getAvailableProviders(): Provider[] {
    return Array.from(this.strategies.keys())
  }

  // 检查提供者是否可用
  isProviderAvailable(provider: Provider | string): boolean {
    const providerEnum = this.normalizeProvider(provider)
    return this.strategies.has(providerEnum)
  }

  // 自动检测最佳策略（基于模型名）
  autoDetectProvider(model: string): Provider {
    if (model.startsWith('gpt') || model.includes('davinci') || model.includes('openai')) {
      return Provider.OPENAI
    }
    
    if (model.startsWith('claude') || model.includes('anthropic')) {
      return Provider.ANTHROPIC
    }
    
    // 默认使用通用策略
    return Provider.GENERIC
  }

  // 智能计算：自动选择提供者
  smartCount(text: string, model: string): number {
    const provider = this.autoDetectProvider(model)
    return this.count(text, provider, model)
  }

  // 比较不同提供者的结果
  compare(text: string, model?: string): { [key in Provider]?: number } {
    const results: { [key in Provider]?: number } = {}
    
    for (const [provider, strategy] of this.strategies) {
      try {
        results[provider] = strategy.count(text, model)
      } catch (error) {
        console.warn(`Failed to count tokens with ${provider}:`, error)
      }
    }
    
    return results
  }

  // 获取策略实例
  private getStrategy(provider?: Provider | string): TokenizerStrategy {
    if (!provider) {
      return this.currentStrategy
    }

    const providerEnum = this.normalizeProvider(provider)
    const strategy = this.strategies.get(providerEnum)
    
    if (!strategy) {
      console.warn(`Provider ${provider} not available, falling back to generic`)
      return this.strategies.get(Provider.GENERIC)!
    }
    
    return strategy
  }

  // 标准化提供者名称
  private normalizeProvider(provider: Provider | string): Provider {
    if (typeof provider === 'string') {
      const normalized = provider.toLowerCase()
      switch (normalized) {
        case 'openai':
        case 'gpt':
          return Provider.OPENAI
        case 'anthropic':
        case 'claude':
          return Provider.ANTHROPIC
        case 'generic':
        case 'fallback':
          return Provider.GENERIC
        default:
          console.warn(`Unknown provider: ${provider}, using generic`)
          return Provider.GENERIC
      }
    }
    return provider
  }

  // 设置默认策略
  setDefaultProvider(provider: Provider | string): void {
    const strategy = this.getStrategy(provider)
    this.currentStrategy = strategy
  }

  // 健康检查
  healthCheck(): { [key in Provider]?: { available: boolean; error?: string } } {
    const health: { [key in Provider]?: { available: boolean; error?: string } } = {}
    
    for (const [provider, strategy] of this.strategies) {
      try {
        // 简单的测试
        strategy.count('test')
        health[provider] = { available: true }
      } catch (error) {
        health[provider] = { 
          available: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
    
    return health
  }
}