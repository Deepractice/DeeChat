import { IConfigManager } from './IConfigManager'
import { ModelConfigEntity } from '../../../../shared/entities/ModelConfigEntity'
import { ModelService } from '../../model/ModelService'
import log from 'electron-log'

/**
 * 配置管理器实现
 * 
 * 基于原有LLMService的配置逻辑重构
 * 保留所有原有功能：
 * - 用户配置优先
 * - 内置ChatAnywhere默认配置
 * - 智能Provider检测
 * - 配置缓存机制
 */
export class ConfigManager implements IConfigManager {
  private modelService: ModelService
  private configCache = new Map<string, ModelConfigEntity>()

  /**
   * 内置默认配置 - 完全保留原有逻辑
   */
  private readonly DEFAULT_CONFIG_TEMPLATE = {
    id: 'chatanywhere-default',
    name: 'ChatAnywhere (内置)',
    apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
    baseURL: 'https://api.chatanywhere.tech/v1',
    isEnabled: true,
    priority: 10,
    status: 'available' as const,
    // 保留原有的完整模型列表
    enabledModels: [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo',
      'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229', 'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307', 'claude-sonnet-4-20250514',
      'kimi-k2-0711-preview', 'kimi-latest',
      'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'
    ]
  }

  constructor() {
    this.modelService = new ModelService()
    log.info('✅ [ConfigManager] 配置管理器初始化完成')
  }

  /**
   * 获取配置 - 完全基于原有LLMService逻辑
   * 
   * 逻辑流程：
   * 1. 先检查缓存
   * 2. 查找用户配置的模型
   * 3. 如果没有找到，使用内置ChatAnywhere配置
   */
  async getConfig(configId: string): Promise<ModelConfigEntity> {
    log.debug(`🔍 [ConfigManager] 获取配置: ${configId}`)

    // 1. 先检查缓存
    const cached = this.getFromCache(configId)
    if (cached) {
      log.debug(`💾 [ConfigManager] 从缓存获取配置: ${configId}`)
      return cached
    }

    try {
      // 2. 尝试查找用户配置的模型（完全保留原逻辑）
      const allConfigs = await this.modelService.getAllConfigs()
      const enabledConfigs = allConfigs.filter(c => c.isEnabled)
      
      // 查找支持该模型的配置（完全保留原逻辑）
      const foundConfig = enabledConfigs.find(c => {
        // 检查配置的默认模型
        if (c.model === configId) return true
        // 检查配置的启用模型列表
        if (c.enabledModels && c.enabledModels.includes(configId)) return true
        return false
      })
      
      if (foundConfig) {
        log.info(`👤 [ConfigManager] 使用用户配置: ${foundConfig.name} -> ${configId}`)
        this.cacheConfig(configId, foundConfig)
        return foundConfig
      }

    } catch (error) {
      log.warn(`⚠️ [ConfigManager] 获取用户配置失败: ${error}`)
    }

    // 3. 如果没有找到用户配置，使用内置ChatAnywhere配置（完全保留原逻辑）
    log.info(`🔧 [ConfigManager] 使用ChatAnywhere默认配置服务模型: ${configId}`)
    
    const defaultConfig = this.createDefaultConfig(configId)
    this.cacheConfig(configId, defaultConfig)
    
    return defaultConfig
  }

  /**
   * 智能检测Provider - 完全保留原有逻辑
   */
  detectProvider(modelName: string): string {
    if (modelName.includes('claude') || modelName.includes('anthropic')) {
      return 'claude'
    } else if (modelName.includes('gpt') || modelName.includes('openai')) {
      return 'openai'
    } else if (modelName.includes('gemini') || modelName.includes('google')) {
      return 'google'
    }
    // 默认使用openai（兼容大多数API）
    return 'openai'
  }

  /**
   * 创建内置默认配置 - 完全保留原有逻辑
   */
  createDefaultConfig(configId: string): ModelConfigEntity {
    const detectedProvider = this.detectProvider(configId)
    log.info(`🔍 [ConfigManager] 模型识别: ${configId} -> provider: ${detectedProvider}`)
    
    // 创建内置默认配置（完全保留原有结构）
    const defaultConfigData = {
      ...this.DEFAULT_CONFIG_TEMPLATE,
      id: `${this.DEFAULT_CONFIG_TEMPLATE.id}-${configId}`,
      name: `${this.DEFAULT_CONFIG_TEMPLATE.name} (${configId})`,
      provider: detectedProvider,
      model: configId, // 使用请求的模型
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const config = new ModelConfigEntity(defaultConfigData)
    log.debug(`🏗️ [ConfigManager] 创建默认配置: ${config.name}`)
    
    return config
  }

  /**
   * 缓存配置
   */
  cacheConfig(configId: string, config: ModelConfigEntity): void {
    this.configCache.set(configId, config)
    log.debug(`💾 [ConfigManager] 配置已缓存: ${configId}`)
  }

  /**
   * 从缓存获取配置
   */
  getFromCache(configId: string): ModelConfigEntity | null {
    return this.configCache.get(configId) || null
  }

  /**
   * 清理配置缓存
   */
  clearCache(): void {
    const size = this.configCache.size
    this.configCache.clear()
    log.info(`🧹 [ConfigManager] 配置缓存已清理: ${size} 项`)
  }

  /**
   * 获取所有已启用的配置
   */
  async getAllEnabledConfigs(): Promise<ModelConfigEntity[]> {
    try {
      const allConfigs = await this.modelService.getAllConfigs()
      const enabledConfigs = allConfigs.filter(c => c.isEnabled)
      log.info(`📋 [ConfigManager] 获取到 ${enabledConfigs.length} 个已启用配置`)
      return enabledConfigs
    } catch (error) {
      log.error(`❌ [ConfigManager] 获取已启用配置失败:`, error)
      return []
    }
  }

  /**
   * 获取配置缓存统计
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys())
    }
  }

  /**
   * 验证配置是否有效
   */
  validateConfig(config: ModelConfigEntity): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!config.apiKey) {
      errors.push('API Key不能为空')
    }

    if (!config.baseURL) {
      errors.push('Base URL不能为空')
    }

    if (!config.model) {
      errors.push('模型名称不能为空')
    }

    if (!config.provider) {
      errors.push('Provider不能为空')
    }

    const valid = errors.length === 0
    
    if (!valid) {
      log.warn(`⚠️ [ConfigManager] 配置验证失败: ${config.id}`, errors)
    }

    return { valid, errors }
  }

  /**
   * 获取支持的Provider列表
   */
  getSupportedProviders(): string[] {
    return ['openai', 'claude', 'anthropic', 'google', 'gemini']
  }

  /**
   * 检查配置是否支持指定模型
   */
  supportsModel(config: ModelConfigEntity, modelName: string): boolean {
    // 检查配置的默认模型
    if (config.model === modelName) return true
    
    // 检查配置的启用模型列表
    if (config.enabledModels && config.enabledModels.includes(modelName)) return true
    
    return false
  }
}