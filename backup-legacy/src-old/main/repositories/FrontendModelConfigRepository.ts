import { IModelConfigRepository } from '../../shared/interfaces/IRepository'
import { ModelConfigEntity } from '../../shared/entities/ModelConfigEntity'
import { LocalStorageService } from '../services/core/LocalStorageService'

export class FrontendModelConfigRepository implements IModelConfigRepository {
  private configs: ModelConfigEntity[] = []
  private initialized = false

  constructor(private storageService: LocalStorageService) {}

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.configs = await this.storageService.loadModelConfigs()
      this.initialized = true
      console.log(`已加载 ${this.configs.length} 个模型配置`)
    } catch (error) {
      console.error('初始化模型配置仓储失败:', error)
      this.configs = []
      this.initialized = true
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('仓储未初始化，请先调用 initialize()')
    }
  }

  async findAll(): Promise<ModelConfigEntity[]> {
    this.ensureInitialized()
    return [...this.configs]
  }

  async findById(id: string): Promise<ModelConfigEntity | null> {
    this.ensureInitialized()
    return this.configs.find(c => c.id === id) || null
  }

  async findByProvider(provider: string): Promise<ModelConfigEntity[]> {
    this.ensureInitialized()
    return this.configs.filter(c => c.provider === provider)
  }

  async findEnabled(): Promise<ModelConfigEntity[]> {
    this.ensureInitialized()
    return this.configs.filter(c => c.isEnabled)
  }

  async findByStatus(status: string): Promise<ModelConfigEntity[]> {
    this.ensureInitialized()
    return this.configs.filter(c => c.status === status)
  }

  async save(config: ModelConfigEntity): Promise<void> {
    this.ensureInitialized()
    
    const index = this.configs.findIndex(c => c.id === config.id)
    if (index >= 0) {
      // 更新现有配置
      this.configs[index] = config
    } else {
      // 添加新配置
      this.configs.push(config)
    }

    // 持久化到本地文件
    await this.storageService.saveModelConfigs(this.configs)
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized()
    
    const initialLength = this.configs.length
    this.configs = this.configs.filter(c => c.id !== id)
    
    // 只有在实际删除了配置时才持久化
    if (this.configs.length < initialLength) {
      await this.storageService.saveModelConfigs(this.configs)
    }
  }

  async updateStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    this.ensureInitialized()
    
    const config = this.configs.find(c => c.id === id)
    if (config) {
      config.updateStatus(status as any, errorMessage)
      await this.storageService.saveModelConfigs(this.configs)
    }
  }

  async saveAll(configs: ModelConfigEntity[]): Promise<void> {
    this.ensureInitialized()
    
    this.configs = [...configs]
    await this.storageService.saveModelConfigs(this.configs)
  }

  async deleteAll(): Promise<void> {
    this.ensureInitialized()
    
    this.configs = []
    await this.storageService.saveModelConfigs(this.configs)
  }

  // 额外的便利方法
  async findAvailable(): Promise<ModelConfigEntity[]> {
    return this.findByStatus('available')
  }

  async findByProviderAndEnabled(provider: string): Promise<ModelConfigEntity[]> {
    this.ensureInitialized()
    return this.configs.filter(c => c.provider === provider && c.isEnabled)
  }

  async getProviderStats(): Promise<Map<string, { total: number; enabled: number; available: number }>> {
    this.ensureInitialized()
    
    const stats = new Map<string, { total: number; enabled: number; available: number }>()
    
    for (const config of this.configs) {
      if (!stats.has(config.provider)) {
        stats.set(config.provider, { total: 0, enabled: 0, available: 0 })
      }
      
      const providerStats = stats.get(config.provider)!
      providerStats.total++
      
      if (config.isEnabled) {
        providerStats.enabled++
      }
      
      if (config.status === 'available') {
        providerStats.available++
      }
    }
    
    return stats
  }

  async updatePriority(id: string, priority: number): Promise<void> {
    this.ensureInitialized()
    
    const config = this.configs.find(c => c.id === id)
    if (config) {
      config.priority = priority
      config.updatedAt = new Date()
      await this.storageService.saveModelConfigs(this.configs)
    }
  }

  async toggleEnabled(id: string): Promise<boolean> {
    this.ensureInitialized()
    
    const config = this.configs.find(c => c.id === id)
    if (config) {
      config.isEnabled = !config.isEnabled
      config.updatedAt = new Date()
      await this.storageService.saveModelConfigs(this.configs)
      return config.isEnabled
    }
    
    return false
  }
}
