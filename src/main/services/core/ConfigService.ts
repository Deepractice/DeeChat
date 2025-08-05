import { AppConfig } from '../../../shared/types/index'
import { ServiceManager } from '../../core/ServiceManager'
import { SqliteConfigRepository } from '../../repositories/SqliteConfigRepository'
import { ConfigEntity } from '../../../shared/entities/ConfigEntity'

/**
 * 配置服务 - 使用SQLite数据库存储
 * 
 * 重构要点：
 * 1. 从JSON文件存储迁移到SQLite数据库
 * 2. 通过ServiceManager获取数据库服务
 * 3. 使用仓储模式进行数据操作
 * 4. 保持原有API接口不变，确保兼容性
 */
export class ConfigService {
  private repository: SqliteConfigRepository | null = null
  private initialized = false
  private configCache: AppConfig | null = null

  constructor() {
    console.log('🔧 [ConfigService] 使用SQLite数据库存储初始化')
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
        console.log('🔄 [ConfigService] 等待数据库服务初始化...')
        await serviceManager.initialize()
      }

      // 获取数据库管理器
      const databaseManager = serviceManager.getDatabaseManager()
      const databaseService = databaseManager.getDatabaseService()

      // 创建仓储实例
      this.repository = new SqliteConfigRepository(databaseService)
      await this.repository.initialize()

      this.initialized = true
      console.log('✅ [ConfigService] SQLite数据库连接初始化完成')
    } catch (error) {
      console.error('❌ [ConfigService] 数据库初始化失败:', error)
      throw error
    }
  }

  async getConfig(): Promise<AppConfig | null> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 先检查缓存
      if (this.configCache) {
        return this.configCache
      }

      // 从SQLite获取应用配置
      const configEntity = await this.repository.findByKey('app_config')
      
      if (!configEntity) {
        console.log('🔍 [ConfigService] 未找到应用配置，返回null')
        return null
      }

      // 解析并缓存配置
      this.configCache = configEntity.toAppConfig()
      return this.configCache
    } catch (error) {
      console.error('❌ [ConfigService] 获取配置失败:', error)
      return null
    }
  }

  async setConfig(config: AppConfig): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 检查是否已存在配置
      const existingEntity = await this.repository.findByKey('app_config')
      
      let configEntity: ConfigEntity
      
      if (existingEntity) {
        // 更新现有配置
        existingEntity.setValue(config)
        configEntity = existingEntity
      } else {
        // 创建新配置
        configEntity = ConfigEntity.fromAppConfig(config)
      }

      // 保存到SQLite
      await this.repository.save(configEntity)
      
      // 更新缓存
      this.configCache = config
      
      console.log('✅ [ConfigService] 应用配置保存成功')
    } catch (error) {
      console.error('❌ [ConfigService] 保存配置失败:', error)
      throw error
    }
  }

  async resetConfig(): Promise<void> {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      // 从SQLite删除配置
      const deleted = await this.repository.deleteByKey('app_config')
      
      if (deleted) {
        console.log('✅ [ConfigService] 应用配置重置成功')
      } else {
        console.log('🔍 [ConfigService] 没有找到要重置的配置')
      }
      
      // 清空缓存
      this.configCache = null
    } catch (error) {
      console.error('❌ [ConfigService] 重置配置失败:', error)
      throw error
    }
  }

  /**
   * 获取默认配置
   */
  async getDefaultConfig(): Promise<AppConfig> {
    const defaultEntity = ConfigEntity.createDefaultAppConfig()
    return defaultEntity.toAppConfig()!
  }

  /**
   * 确保配置存在，如果不存在则创建默认配置
   */
  async ensureConfigExists(): Promise<AppConfig> {
    let config = await this.getConfig()
    
    if (!config) {
      config = await this.getDefaultConfig()
      await this.setConfig(config)
      console.log('✅ [ConfigService] 已创建默认配置')
    }
    
    return config
  }

  /**
   * 更新配置的特定字段
   */
  async updateConfigField(path: string, value: any): Promise<void> {
    const config = await this.ensureConfigExists()
    
    // 简单的路径解析和更新（支持如 'llm.apiKey' 的路径）
    const pathParts = path.split('.')
    let target: any = config
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!target[pathParts[i]]) {
        target[pathParts[i]] = {}
      }
      target = target[pathParts[i]]
    }
    
    target[pathParts[pathParts.length - 1]] = value
    
    await this.setConfig(config)
    console.log(`✅ [ConfigService] 配置字段已更新: ${path}`)
  }

  /**
   * 获取配置的特定字段
   */
  async getConfigField(path: string): Promise<any> {
    const config = await this.getConfig()
    
    if (!config) {
      return undefined
    }
    
    const pathParts = path.split('.')
    let target: any = config
    
    for (const part of pathParts) {
      if (target && typeof target === 'object' && part in target) {
        target = target[part]
      } else {
        return undefined
      }
    }
    
    return target
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.configCache = null
  }

  /**
   * 获取配置统计信息
   */
  async getConfigStats() {
    try {
      await this.ensureInitialized()
      
      if (!this.repository) {
        throw new Error('数据库仓储未初始化')
      }

      return await this.repository.getStats()
    } catch (error) {
      console.error('❌ [ConfigService] 获取配置统计失败:', error)
      return {
        total: 0,
        lastUpdated: null
      }
    }
  }
}
