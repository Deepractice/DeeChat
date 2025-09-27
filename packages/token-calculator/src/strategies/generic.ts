import { BaseTokenizerStrategy } from './base'
import { Provider, ModelInfo } from '../types'

export class GenericTokenizer extends BaseTokenizerStrategy {
  constructor() {
    super(Provider.GENERIC)
  }

  protected initializeModels(): void {
    // 通用模型配置 - 用于未知模型的fallback
    this.modelConfig.set('generic', {
      provider: Provider.GENERIC,
      modelName: 'generic',
      maxTokens: 4096, // 保守估计
      pricing: {
        inputPrice: 0.01,  // 平均价格
        outputPrice: 0.02,
        currency: 'USD'
      }
    })
  }

  count(text: string, model = 'generic'): number {
    const preprocessed = this.preprocessText(text)
    return this.estimateTokens(preprocessed)
  }

  // 不支持编码/解码
  encode(text: string, model?: string): number[] {
    throw new Error('Generic tokenizer does not support token encoding - only approximate token counting is available')
  }

  decode(tokens: number[], model?: string): string {
    throw new Error('Generic tokenizer does not support token decoding - only approximate token counting is available')
  }

  // 核心估算算法
  private estimateTokens(text: string): number {
    if (!text || text.length === 0) {
      return 0
    }

    // 分析文本组成
    const analysis = this.analyzeText(text)
    
    // 基于不同字符类型的token估算
    let tokenCount = 0
    
    // 中文字符：平均 1.8-2.2 字符/token
    tokenCount += Math.ceil(analysis.chineseChars / 2)
    
    // 日韩字符：类似中文
    tokenCount += Math.ceil(analysis.cjkChars / 2)
    
    // 英文单词：平均 3.5-4.5 字符/token
    tokenCount += Math.ceil(analysis.englishWords * 0.75) // 假设平均单词长度4字符
    
    // 数字：通常每个数字或数字组是1个token
    tokenCount += analysis.numbers
    
    // 标点符号：大部分是单独的token
    tokenCount += Math.ceil(analysis.punctuation * 0.8)
    
    // 特殊字符和emoji：通常是单独的token
    tokenCount += analysis.specialChars
    tokenCount += analysis.emojis
    
    // 空格处理：连续空格算作1个token
    tokenCount += analysis.whitespaceGroups
    
    return Math.max(1, tokenCount) // 至少1个token
  }

  // 文本分析辅助方法
  private analyzeText(text: string): TextAnalysis {
    const analysis: TextAnalysis = {
      chineseChars: 0,
      cjkChars: 0,
      englishWords: 0,
      numbers: 0,
      punctuation: 0,
      specialChars: 0,
      emojis: 0,
      whitespaceGroups: 0
    }

    // 中文字符 (包括中文标点)
    analysis.chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    
    // 其他CJK字符 (日文、韩文等)
    analysis.cjkChars = (text.match(/[\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || []).length
    
    // 英文单词 (连续的字母组合)
    analysis.englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    
    // 数字组 (连续的数字)
    analysis.numbers = (text.match(/\d+/g) || []).length
    
    // 标点符号
    analysis.punctuation = (text.match(/[.,!?;:'"()\[\]{}\-_]/g) || []).length
    
    // Emoji
    analysis.emojis = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length
    
    // 连续空白字符组
    analysis.whitespaceGroups = (text.match(/\s+/g) || []).length
    
    // 其他特殊字符
    const totalMeasured = analysis.chineseChars + analysis.cjkChars + 
      (text.match(/[a-zA-Z\d\s.,!?;:'"()\[\]{}\-_]/g) || []).length + analysis.emojis
    analysis.specialChars = Math.max(0, text.length - totalMeasured)

    return analysis
  }

  // 获取详细的token估算信息
  getDetailedEstimate(text: string): DetailedEstimate {
    const preprocessed = this.preprocessText(text)
    const analysis = this.analyzeText(preprocessed)
    const tokenCount = this.estimateTokens(preprocessed)
    
    return {
      totalTokens: tokenCount,
      analysis,
      confidence: this.calculateConfidence(analysis),
      note: 'This is an approximate token count. For accurate counts, use the specific provider\'s tokenizer.'
    }
  }

  // 计算估算的置信度
  private calculateConfidence(analysis: TextAnalysis): number {
    let confidence = 0.8 // 基础置信度
    
    // 英文为主的文本置信度较高
    const totalChars = analysis.chineseChars + analysis.cjkChars + analysis.englishWords * 4
    if (totalChars > 0) {
      const englishRatio = (analysis.englishWords * 4) / totalChars
      confidence += englishRatio * 0.1 // 英文比例越高，置信度越高
    }
    
    // 特殊字符过多会降低置信度
    if (analysis.specialChars > totalChars * 0.2) {
      confidence -= 0.2
    }
    
    return Math.max(0.5, Math.min(0.95, confidence))
  }
}

// 辅助类型
interface TextAnalysis {
  chineseChars: number
  cjkChars: number
  englishWords: number
  numbers: number
  punctuation: number
  specialChars: number
  emojis: number
  whitespaceGroups: number
}

interface DetailedEstimate {
  totalTokens: number
  analysis: TextAnalysis
  confidence: number
  note: string
}