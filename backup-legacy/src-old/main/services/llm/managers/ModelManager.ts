import { IModelManager } from './IModelManager'
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { ChatOpenAI } from "@langchain/openai"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { ModelConfigEntity } from '../../../../shared/entities/ModelConfigEntity'
import log from 'electron-log'

/**
 * 模型管理器实现
 * 
 * 基于原有LangChainModelFactory的逻辑重构
 * 保留所有原有功能：
 * - 多Provider支持（OpenAI, Anthropic, Google）
 * - 模型实例缓存
 * - 配置参数完整映射
 * - 连接测试功能
 */
export class ModelManager implements IModelManager {
  private modelCache = new Map<string, BaseChatModel>()
  
  // 统计信息
  private stats = {
    totalCreated: 0,
    cacheHits: 0,
    cacheMisses: 0,
    testCount: 0,
    successCount: 0
  }

  constructor() {
    log.info('✅ [ModelManager] 模型管理器初始化完成')
  }

  /**
   * 创建模型实例 - 完全基于原有LangChainModelFactory逻辑
   */
  async createModel(config: ModelConfigEntity): Promise<BaseChatModel> {
    const cacheKey = this.generateCacheKey(config)
    log.debug(`🔍 [ModelManager] 创建模型: ${config.provider}/${config.model}`)

    // 先检查缓存
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      this.stats.cacheHits++
      log.debug(`💾 [ModelManager] 从缓存获取模型: ${cacheKey}`)
      return cached
    }

    this.stats.cacheMisses++
    
    // 根据provider创建对应的模型实例（完全保留原逻辑）
    const provider = config.provider.toLowerCase()
    log.info(`🔧 [ModelManager] 开始创建模型 - Provider: ${provider}, Model: ${config.model}, BaseURL: ${config.baseURL}`)
    
    let model: BaseChatModel

    switch (provider) {
      case 'openai':
        model = this.createOpenAIModel(config)
        break
        
      case 'claude':
      case 'anthropic':
        model = this.createAnthropicModel(config)
        break
        
      case 'gemini':
      case 'google':
        model = this.createGoogleModel(config)
        break
        
      default:
        // 对于未知provider，尝试使用OpenAI兼容格式
        log.warn(`⚠️ [ModelManager] 未知provider: ${provider}, 尝试使用OpenAI兼容格式`)
        model = this.createOpenAIModel(config)
    }

    // 缓存模型实例
    this.cacheModel(cacheKey, model)
    this.stats.totalCreated++
    
    log.info(`🤖 [ModelManager] 模型创建成功: ${config.provider}/${config.model}`)
    return model
  }

  /**
   * 创建OpenAI模型 - 完全保留原有逻辑
   */
  private createOpenAIModel(config: ModelConfigEntity): BaseChatModel {
    log.info(`🤖 [ModelManager] 创建ChatOpenAI实例 - Model: ${config.model}, BaseURL: ${config.baseURL}`)
    
    return new ChatOpenAI({
      modelName: config.model, // LangChain 0.5.x 使用 modelName
      openAIApiKey: config.apiKey, // LangChain 0.5.x 使用 openAIApiKey
      configuration: {
        baseURL: config.baseURL || 'https://api.openai.com/v1'
      },
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000
    })
  }

  /**
   * 创建Anthropic模型 - 完全保留原有逻辑
   */
  private createAnthropicModel(config: ModelConfigEntity): BaseChatModel {
    log.info(`🧠 [ModelManager] 创建ChatAnthropic实例 - Model: ${config.model}`)
    
    return new ChatAnthropic({
      modelName: config.model,
      anthropicApiKey: config.apiKey,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
      clientOptions: {
        baseURL: config.baseURL
      }
    })
  }

  /**
   * 创建Google模型 - 完全保留原有逻辑
   */
  private createGoogleModel(config: ModelConfigEntity): BaseChatModel {
    log.info(`🌐 [ModelManager] 创建ChatGoogleGenerativeAI实例 - Model: ${config.model}`)
    
    return new ChatGoogleGenerativeAI({
      model: config.model,
      apiKey: config.apiKey,
      temperature: config.temperature || 0.7,
      maxOutputTokens: config.maxTokens || 2000
    })
  }

  /**
   * 缓存模型实例
   */
  cacheModel(key: string, model: BaseChatModel): void {
    this.modelCache.set(key, model)
    log.debug(`💾 [ModelManager] 模型已缓存: ${key}`)
  }

  /**
   * 从缓存获取模型实例
   */
  getFromCache(key: string): BaseChatModel | null {
    return this.modelCache.get(key) || null
  }

  /**
   * 生成模型缓存键
   */
  generateCacheKey(config: ModelConfigEntity): string {
    // 使用provider、model、baseURL生成唯一键
    const keyParts = [
      config.provider,
      config.model,
      config.baseURL || 'default',
      config.apiKey ? 'auth' : 'noauth' // 不直接包含apiKey，但区分是否有认证
    ]
    return keyParts.join('-')
  }

  /**
   * 清理模型缓存
   */
  clearCache(): void {
    const size = this.modelCache.size
    this.modelCache.clear()
    log.info(`🧹 [ModelManager] 模型缓存已清理: ${size} 项`)
  }

  /**
   * 获取缓存状态
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.modelCache.size,
      keys: Array.from(this.modelCache.keys())
    }
  }

  /**
   * 测试模型连接
   */
  async testModel(config: ModelConfigEntity): Promise<{ success: boolean; error?: string }> {
    this.stats.testCount++
    log.info(`🔍 [ModelManager] 开始测试模型: ${config.provider}/${config.model}`)

    try {
      // 创建模型实例（不使用缓存，确保测试真实连接）
      const model = await this.createModelForTest(config)
      
      // 发送测试消息
      const testMessage = "Hello, this is a test message. Please respond with 'OK'."
      const messages = [{ role: 'user', content: testMessage }] as any[]
      
      const response = await model.invoke(messages)
      
      this.stats.successCount++
      log.info(`✅ [ModelManager] 模型测试成功: ${config.provider}/${config.model}`)
      log.debug(`📝 [ModelManager] 测试响应: ${JSON.stringify(response).substring(0, 100)}`)
      
      return { success: true }
    } catch (error) {
      log.error(`❌ [ModelManager] 模型测试失败: ${config.provider}/${config.model}`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      }
    }
  }

  /**
   * 创建用于测试的模型实例（不使用缓存）
   */
  private async createModelForTest(config: ModelConfigEntity): Promise<BaseChatModel> {
    const provider = config.provider.toLowerCase()
    
    switch (provider) {
      case 'openai':
        return this.createOpenAIModel(config)
      case 'claude':
      case 'anthropic':
        return this.createAnthropicModel(config)
      case 'gemini':
      case 'google':
        return this.createGoogleModel(config)
      default:
        return this.createOpenAIModel(config)
    }
  }

  /**
   * 获取模型支持的功能列表
   */
  async getModelCapabilities(config: ModelConfigEntity): Promise<string[]> {
    log.info(`📋 [ModelManager] 获取模型功能列表: ${config.provider}`)

    try {
      // 🔥 实际从API获取模型列表
      if (config.baseURL && config.apiKey) {
        log.info(`🌐 [ModelManager] 从API获取模型列表: ${config.baseURL}/models`)
        
        const response = await fetch(`${config.baseURL}/models`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.data && Array.isArray(data.data)) {
            const modelIds = data.data.map((model: any) => model.id).filter(Boolean)
            log.info(`✅ [ModelManager] 从API获取到 ${modelIds.length} 个模型`)
            return modelIds
          }
        } else {
          log.warn(`⚠️ [ModelManager] API请求失败: ${response.status} ${response.statusText}`)
        }
      }
    } catch (error) {
      log.error(`❌ [ModelManager] API请求异常:`, error)
    }

    // 🔄 API请求失败时，回退到硬编码列表
    log.info(`🔄 [ModelManager] 使用硬编码模型列表作为回退`)
    switch (config.provider.toLowerCase()) {
      case 'openai':
        return [
          'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 
          'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'
        ]
        
      case 'claude':
      case 'anthropic':
        return [
          'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620',
          'claude-3-opus-20240229', 'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307', 'claude-sonnet-4-20250514'
        ]
        
      case 'google':
      case 'gemini':
        return [
          'gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro',
          'gemini-1.5-flash'
        ]
        
      default:
        // 返回通用模型列表
        return [
          'gpt-3.5-turbo', 'gpt-4', 'claude-3-haiku', 'gemini-pro'
        ]
    }
  }

  /**
   * 预热模型缓存
   */
  async warmupCache(configs: ModelConfigEntity[]): Promise<void> {
    log.info(`🔥 [ModelManager] 开始预热模型缓存: ${configs.length} 个配置`)

    const promises = configs.map(async (config) => {
      try {
        await this.createModel(config)
        log.debug(`✅ [ModelManager] 预热成功: ${config.provider}/${config.model}`)
      } catch (error) {
        log.warn(`⚠️ [ModelManager] 预热失败: ${config.provider}/${config.model}`, error)
      }
    })

    await Promise.allSettled(promises)
    log.info(`🔥 [ModelManager] 模型缓存预热完成`)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCreated: number
    cacheHits: number
    cacheMisses: number
    cacheHitRate: number
    testCount: number
    testSuccessRate: number
  } {
    const cacheHitRate = this.stats.cacheHits + this.stats.cacheMisses > 0 
      ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100 
      : 0

    const testSuccessRate = this.stats.testCount > 0 
      ? (this.stats.successCount / this.stats.testCount) * 100 
      : 0

    return {
      ...this.stats,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      testSuccessRate: Math.round(testSuccessRate * 100) / 100
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalCreated: 0,
      cacheHits: 0,
      cacheMisses: 0,
      testCount: 0,
      successCount: 0
    }
    log.info(`📊 [ModelManager] 统计信息已重置`)
  }
}