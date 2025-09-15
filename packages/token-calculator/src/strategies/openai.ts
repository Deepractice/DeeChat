import { encode, decode, countTokens } from 'gpt-tokenizer'
import { BaseTokenizerStrategy } from './base'
import { Provider, ModelInfo } from '../types'

export class OpenAITokenizer extends BaseTokenizerStrategy {
  constructor() {
    super(Provider.OPENAI)
  }

  protected initializeModels(): void {
    // 定义支持的OpenAI模型及其配置
    this.modelConfig.set('gpt-4', {
      provider: Provider.OPENAI,
      modelName: 'gpt-4',
      maxTokens: 8192,
      pricing: {
        inputPrice: 0.03,   // $0.03 per 1K tokens
        outputPrice: 0.06,  // $0.06 per 1K tokens
        currency: 'USD'
      }
    })

    this.modelConfig.set('gpt-4-turbo', {
      provider: Provider.OPENAI,
      modelName: 'gpt-4-turbo',
      maxTokens: 128000,
      pricing: {
        inputPrice: 0.01,
        outputPrice: 0.03,
        currency: 'USD'
      }
    })

    this.modelConfig.set('gpt-4o', {
      provider: Provider.OPENAI,
      modelName: 'gpt-4o',
      maxTokens: 128000,
      pricing: {
        inputPrice: 0.005,
        outputPrice: 0.015,
        currency: 'USD'
      }
    })

    this.modelConfig.set('gpt-3.5-turbo', {
      provider: Provider.OPENAI,
      modelName: 'gpt-3.5-turbo',
      maxTokens: 16384,
      pricing: {
        inputPrice: 0.001,
        outputPrice: 0.002,
        currency: 'USD'
      }
    })

    this.modelConfig.set('text-davinci-003', {
      provider: Provider.OPENAI,
      modelName: 'text-davinci-003',
      maxTokens: 4097,
      pricing: {
        inputPrice: 0.02,
        outputPrice: 0.02,
        currency: 'USD'
      }
    })
  }

  count(text: string, model = 'gpt-4'): number {
    try {
      const preprocessed = this.preprocessText(text)
      this.validateModel(model)
      
      // 使用gpt-tokenizer库直接计算tokens
      return countTokens(preprocessed)
    } catch (error) {
      console.warn(`Failed to count tokens for model ${model}:`, error)
      // 降级到通用计算方法
      return this.fallbackCount(text)
    }
  }

  encode(text: string, model = 'gpt-4'): number[] {
    try {
      const preprocessed = this.preprocessText(text)
      this.validateModel(model)
      return encode(preprocessed)
    } catch (error) {
      console.error(`Failed to encode text for model ${model}:`, error)
      throw new Error(`Token encoding failed: ${error}`)
    }
  }

  decode(tokens: number[], model = 'gpt-4'): string {
    try {
      this.validateModel(model)
      return decode(tokens)
    } catch (error) {
      console.error(`Failed to decode tokens for model ${model}:`, error)
      throw new Error(`Token decoding failed: ${error}`)
    }
  }

  // 降级计算方法（当gpt-tokenizer失败时）
  private fallbackCount(text: string): number {
    // 简单的字符数估算：英文平均4字符/token，中文平均2字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const otherChars = text.length - chineseChars
    
    return Math.ceil(otherChars / 4 + chineseChars / 2)
  }

  // 检查模型是否支持编码
  supportsEncoding(model: string): boolean {
    try {
      // 尝试编码一个简单的测试文本
      countTokens('test')
      return true
    } catch {
      return false
    }
  }
}