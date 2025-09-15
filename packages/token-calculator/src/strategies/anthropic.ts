import { countTokens } from '@anthropic-ai/tokenizer'
import { BaseTokenizerStrategy } from './base'
import { Provider, ModelInfo } from '../types'

export class AnthropicTokenizer extends BaseTokenizerStrategy {
  constructor() {
    super(Provider.ANTHROPIC)
  }

  protected initializeModels(): void {
    // Claude 3 系列模型配置
    this.modelConfig.set('claude-3-opus', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-3-opus',
      maxTokens: 200000,
      pricing: {
        inputPrice: 0.015,   // $15 per 1M tokens
        outputPrice: 0.075,  // $75 per 1M tokens
        currency: 'USD'
      }
    })

    this.modelConfig.set('claude-3-sonnet', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-3-sonnet',
      maxTokens: 200000,
      pricing: {
        inputPrice: 0.003,   // $3 per 1M tokens
        outputPrice: 0.015,  // $15 per 1M tokens
        currency: 'USD'
      }
    })

    this.modelConfig.set('claude-3-haiku', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-3-haiku',
      maxTokens: 200000,
      pricing: {
        inputPrice: 0.00025, // $0.25 per 1M tokens
        outputPrice: 0.00125, // $1.25 per 1M tokens
        currency: 'USD'
      }
    })

    this.modelConfig.set('claude-3-5-sonnet', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-3-5-sonnet',
      maxTokens: 200000,
      pricing: {
        inputPrice: 0.003,   // $3 per 1M tokens
        outputPrice: 0.015,  // $15 per 1M tokens
        currency: 'USD'
      }
    })

    // 旧版Claude模型（使用相同的tokenizer）
    this.modelConfig.set('claude-2.1', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-2.1',
      maxTokens: 200000,
      pricing: {
        inputPrice: 0.008,
        outputPrice: 0.024,
        currency: 'USD'
      }
    })

    this.modelConfig.set('claude-2', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-2',
      maxTokens: 100000,
      pricing: {
        inputPrice: 0.008,
        outputPrice: 0.024,
        currency: 'USD'
      }
    })

    this.modelConfig.set('claude-instant-1.2', {
      provider: Provider.ANTHROPIC,
      modelName: 'claude-instant-1.2',
      maxTokens: 100000,
      pricing: {
        inputPrice: 0.0008,
        outputPrice: 0.0024,
        currency: 'USD'
      }
    })
  }

  count(text: string, model = 'claude-3-sonnet'): number {
    try {
      const preprocessed = this.preprocessText(text)
      this.validateModel(model)
      
      // 使用Anthropic官方tokenizer
      // 注意：这个tokenizer对Claude 3模型只是近似值
      const tokens = countTokens(preprocessed)
      return tokens
    } catch (error) {
      console.warn(`Failed to count tokens for Anthropic model ${model}:`, error)
      // 降级到通用计算方法
      return this.fallbackCount(text)
    }
  }

  // Anthropic tokenizer不提供encode/decode功能
  encode(text: string, model?: string): number[] {
    throw new Error('Anthropic tokenizer does not support token encoding - only token counting is available')
  }

  decode(tokens: number[], model?: string): string {
    throw new Error('Anthropic tokenizer does not support token decoding - only token counting is available')
  }

  // 降级计算方法
  private fallbackCount(text: string): number {
    // 根据Anthropic文档的建议，使用更精确的估算
    // 英文：平均3.5字符/token，中文：平均1.8字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars
    
    return Math.ceil(otherChars / 3.5 + chineseChars / 1.8)
  }

  // 检查是否为Claude 3模型（tokenizer准确性警告）
  isClaude3Model(model: string): boolean {
    return model.includes('claude-3')
  }

  // 获取特定模型的token计数（带准确性提示）
  countWithAccuracyInfo(text: string, model = 'claude-3-sonnet'): { tokens: number; isApproximate: boolean; note?: string } {
    const tokens = this.count(text, model)
    const isApproximate = this.isClaude3Model(model)
    
    return {
      tokens,
      isApproximate,
      note: isApproximate 
        ? 'Token count is approximate for Claude 3 models. Use the usage field in API responses for accurate counts.'
        : undefined
    }
  }
}