import { LLMConfig } from '../../shared/types/index'
import { LangChainLLMService } from '../../shared/langchain/LangChainLLMService'
import { ModelConfigEntity } from '../../shared/entities/ModelConfigEntity'

export class LLMService {
  private langChainService: LangChainLLMService

  constructor() {
    this.langChainService = new LangChainLLMService()
  }

  async sendMessage(message: string, config: LLMConfig) {
    try {
      console.log('🔗 使用LangChain服务处理请求')
      return await this.sendMessageWithLangChain(message, config)
    } catch (error) {
      console.error('LLM API调用失败:', error)
      throw error
    }
  }

  /**
   * 使用LangChain服务发送消息
   */
  private async sendMessageWithLangChain(message: string, config: LLMConfig): Promise<any> {
    // 将LLMConfig转换为ModelConfigEntity
    const modelConfig = this.convertToModelConfig(config)

    // 使用LangChain服务的临时配置方法
    const response = await this.langChainService.sendMessageWithConfig(
      message,
      modelConfig,
      undefined // 暂时不使用系统提示词
    )

    return {
      content: response,
      usage: { total_tokens: 0 }, // LangChain暂时不提供token统计
      model: config.model
    }
  }



  /**
   * 将LLMConfig转换为ModelConfigEntity
   */
  private convertToModelConfig(config: LLMConfig): ModelConfigEntity {
    return ModelConfigEntity.create({
      name: `${config.provider}-${config.model}`,
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      baseURL: config.baseURL || this.getDefaultBaseURL(config.provider),
      isEnabled: true,
      priority: 5
    })
  }

  /**
   * 获取提供商的默认BaseURL
   */
  private getDefaultBaseURL(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'https://api.openai.com/v1'
      case 'claude':
        return 'https://api.anthropic.com'
      case 'gemini':
        return 'https://generativelanguage.googleapis.com'
      default:
        return ''
    }
  }


}
