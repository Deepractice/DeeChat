import { ModelConfigEntity, ModelConfigData } from '../../../shared/entities/ModelConfigEntity'
import { IModelConfigService } from '../../../shared/interfaces/IModelProvider'
import { ServiceManager } from '../../core/ServiceManager'
import { SqliteModelConfigRepository } from '../../repositories/SqliteModelConfigRepository'

/**
 * 模型管理服务 - 使用SQLite数据库存储
 * 
 * 重构要点：
 * 1. 从LocalStorageService迁移到SQLite数据库
 * 2. 通过ServiceManager获取数据库服务
 * 3. 使用仓储模式进行数据操作
 * 4. 保持原有API接口不变，确保兼容性
 */
export class ModelService implements IModelConfigService {
  private repository: SqliteModelConfigRepository | null = null
  private initialized = false
  private configsCache: ModelConfigEntity[] | null = null

  constructor() {
    console.log('🔧 [ModelService] 使用SQLite数据库存储初始化')
  }

  /**
   * 延迟初始化数据库连接
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.repository) {
      return
    }

    try {
      // 获取ServiceManager实例
      const serviceManager = ServiceManager.getInstance()
      
      // 确保ServiceManager已初始化
      if (!serviceManager.getAllServiceStatuses().some(s => s.name === 'infrastructure' && s.status === 'ready')) {
        console.log('🔄 [ModelService] 等待数据库服务初始化...')
        await serviceManager.initialize()
      }

      // 获取数据库管理器
      const databaseManager = serviceManager.getDatabaseManager()
      const databaseService = databaseManager.getDatabaseService()

      // 创建仓储实例
      this.repository = new SqliteModelConfigRepository(databaseService)
      await this.repository.initialize()

      this.initialized = true
      console.log('✅ [ModelService] SQLite数据库连接初始化完成')
    } catch (error) {
      console.error('❌ [ModelService] 数据库初始化失败:', error)
      throw error
    }
  }

  /**
   * 获取所有模型配置
   */
  async getAllConfigs(): Promise<ModelConfigEntity[]> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 先检查缓存
      if (this.configsCache) {
        return this.configsCache
      }

      // 从SQLite获取所有配置
      const configs = await this.repository.findAll()
      
      // 缓存结果
      this.configsCache = configs
      return configs
    } catch (error) {
      console.error('❌ [ModelService] 获取模型配置失败:', error)
      return []
    }
  }

  /**
   * 根据ID获取模型配置
   */
  async getConfigById(id: string): Promise<ModelConfigEntity | null> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      return await this.repository.findById(id)
    } catch (error) {
      console.error('❌ [ModelService] 根据ID获取配置失败:', error)
      return null
    }
  }

  /**
   * 保存模型配置
   */
  async saveConfig(config: ModelConfigEntity): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 保存到SQLite
      await this.repository.save(config)
      
      // 清空缓存以强制重新加载
      this.configsCache = null
      
      console.log(`✅ [ModelService] 模型配置保存成功: ${config.name}`)
    } catch (error) {
      console.error('❌ [ModelService] 保存模型配置失败:', error)
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
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 从SQLite删除配置
      const deleted = await this.repository.delete(id)
      
      if (deleted) {
        // 清空缓存以强制重新加载
        this.configsCache = null
        console.log(`✅ [ModelService] 模型配置删除成功: ${id}`)
      }
    } catch (error) {
      console.error('❌ [ModelService] 删除模型配置失败:', error)
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
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      return await this.repository.findEnabled()
    } catch (error) {
      console.error('❌ [ModelService] 获取启用配置失败:', error)
      return []
    }
  }

  /**
   * 获取可用的模型配置
   */
  async getAvailableConfigs(): Promise<ModelConfigEntity[]> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      return await this.repository.findAvailable()
    } catch (error) {
      console.error('❌ [ModelService] 获取可用配置失败:', error)
      return []
    }
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
   * 获取模型配置统计信息
   */
  async getModelStats() {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      return await this.repository.getStats()
    } catch (error) {
      console.error('❌ [ModelService] 获取模型统计失败:', error)
      return {
        total: 0,
        enabled: 0,
        available: 0
      }
    }
  }
}
