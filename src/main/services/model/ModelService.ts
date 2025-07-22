import { ModelConfigEntity, ModelConfigData } from '../../../shared/entities/ModelConfigEntity'
import { LocalStorageService } from '../core/LocalStorageService'

/**
 * 简化的模型管理服务 - 直接使用LocalStorageService
 * 用于替代复杂的Repository模式，提供基础的CRUD操作
 */
export class ModelService {
  private storageService: LocalStorageService
  private configsCache: ModelConfigEntity[] | null = null

  constructor() {
    this.storageService = new LocalStorageService()
  }

  /**
   * 获取所有模型配置
   */
  async getAllConfigs(): Promise<ModelConfigEntity[]> {
    if (this.configsCache) {
      return this.configsCache
    }

    try {
      const configsData = await this.storageService.get<ModelConfigData[]>('model_configs', [])
      // console.log('加载配置数据:', JSON.stringify(configsData, null, 2))
      this.configsCache = configsData.map((data: ModelConfigData) => new ModelConfigEntity(data))
      return this.configsCache || []
    } catch (error) {
      console.error('获取模型配置失败:', error)
      return []
    }
  }

  /**
   * 根据ID获取模型配置
   */
  async getConfigById(id: string): Promise<ModelConfigEntity | null> {
    const configs = await this.getAllConfigs()
    return configs.find(config => config.id === id) || null
  }

  /**
   * 保存模型配置
   */
  async saveConfig(config: ModelConfigEntity): Promise<void> {
    try {
      const configs = await this.getAllConfigs()
      const existingIndex = configs.findIndex(c => c.id === config.id)
      
      if (existingIndex >= 0) {
        configs[existingIndex] = config
      } else {
        configs.push(config)
      }

      await this.saveAllConfigs(configs)
      this.configsCache = configs
    } catch (error) {
      console.error('保存模型配置失败:', error)
      throw error
    }
  }

  /**
   * 更新模型配置
   */
  async updateConfig(config: ModelConfigEntity): Promise<void> {
    return this.saveConfig(config)
  }

  /**
   * 删除模型配置
   */
  async deleteConfig(id: string): Promise<void> {
    try {
      const configs = await this.getAllConfigs()
      const filteredConfigs = configs.filter(config => config.id !== id)
      
      await this.saveAllConfigs(filteredConfigs)
      this.configsCache = filteredConfigs
    } catch (error) {
      console.error('删除模型配置失败:', error)
      throw error
    }
  }

  /**
   * 创建新的模型配置
   */
  async createConfig(configData: Omit<ModelConfigData, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<ModelConfigEntity> {
    try {
      const newConfig = ModelConfigEntity.create(configData)
      await this.saveConfig(newConfig)
      return newConfig
    } catch (error) {
      console.error('创建模型配置失败:', error)
      throw error
    }
  }

  /**
   * 获取启用的模型配置
   */
  async getEnabledConfigs(): Promise<ModelConfigEntity[]> {
    const configs = await this.getAllConfigs()
    return configs.filter(config => config.isEnabled)
  }

  /**
   * 获取可用的模型配置
   */
  async getAvailableConfigs(): Promise<ModelConfigEntity[]> {
    const configs = await this.getAllConfigs()
    return configs.filter(config => config.isEnabled && config.status === 'available')
  }

  /**
   * 切换配置启用状态
   */
  async toggleConfigEnabled(id: string): Promise<void> {
    try {
      const config = await this.getConfigById(id)
      if (!config) {
        throw new Error(`配置不存在: ${id}`)
      }

      config.isEnabled = !config.isEnabled
      config.updatedAt = new Date()
      
      await this.saveConfig(config)
    } catch (error) {
      console.error('切换配置状态失败:', error)
      throw error
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.configsCache = null
  }

  /**
   * 初始化默认配置（已禁用 - 保持首次安装空白状态）
   */
  async initializeDefaultConfigs(): Promise<void> {
    // 不再自动创建默认配置，让用户手动添加
    console.log('✅ [ModelService] 跳过默认配置初始化，保持空白状态')
  }

  /**
   * 保存所有配置到存储
   */
  private async saveAllConfigs(configs: ModelConfigEntity[]): Promise<void> {
    const configsData = configs.map(config => config.toData())
    // console.log('保存配置数据:', JSON.stringify(configsData, null, 2))
    await this.storageService.set('model_configs', configsData)
  }
}
