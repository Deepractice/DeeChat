import { IUserPreferenceRepository } from '../../shared/interfaces/IRepository'
import { UserPreferenceEntity } from '../../shared/entities/UserPreferenceEntity'
import { LocalStorageService } from '../services/core/LocalStorageService'

export class FrontendUserPreferenceRepository implements IUserPreferenceRepository {
  private preferences: UserPreferenceEntity | null = null
  private initialized = false

  constructor(private storageService: LocalStorageService) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      this.preferences = await this.storageService.loadUserPreferences()
      this.initialized = true
      console.log('已加载用户偏好设置')
    } catch (error) {
      console.error('初始化用户偏好仓储失败:', error)
      this.preferences = UserPreferenceEntity.createDefault()
      this.initialized = true
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('仓储未初始化，请先调用 initialize()')
    }
  }

  async get(): Promise<UserPreferenceEntity> {
    // 如果未初始化，先自动初始化
    if (!this.initialized) {
      await this.initialize()
    }
    
    if (!this.preferences) {
      this.preferences = UserPreferenceEntity.createDefault()
      await this.save(this.preferences)
    }
    
    return this.preferences
  }

  async save(preferences: UserPreferenceEntity): Promise<void> {
    // 如果未初始化，先自动初始化
    if (!this.initialized) {
      await this.initialize()
    }
    
    this.preferences = preferences
    await this.storageService.saveUserPreferences(preferences)
  }

  async updateLastSelected(modelId: string): Promise<void> {
    this.ensureInitialized()
    
    const preferences = await this.get()
    preferences.updateLastSelected(modelId)
    await this.save(preferences)
  }

  async setDefaultModel(modelId: string): Promise<void> {
    this.ensureInitialized()
    
    const preferences = await this.get()
    preferences.setDefaultModel(modelId)
    await this.save(preferences)
  }

  // 额外的便利方法
  async setSelectionStrategy(strategy: 'remember_last' | 'priority' | 'manual'): Promise<void> {
    this.ensureInitialized()
    
    const preferences = await this.get()
    preferences.setSelectionStrategy(strategy)
    await this.save(preferences)
  }

  async setAutoSwitchOnFailure(enabled: boolean): Promise<void> {
    this.ensureInitialized()
    
    const preferences = await this.get()
    preferences.setAutoSwitchOnFailure(enabled)
    await this.save(preferences)
  }

  async getLastSelectedModelId(): Promise<string | undefined> {
    const preferences = await this.get()
    return preferences.lastSelectedModelId
  }

  async getDefaultModelId(): Promise<string | undefined> {
    const preferences = await this.get()
    return preferences.getDefaultModelId()
  }

  async getSelectionStrategy(): Promise<'remember_last' | 'priority' | 'manual'> {
    const preferences = await this.get()
    return preferences.modelSelectionStrategy
  }

  async isAutoSwitchOnFailureEnabled(): Promise<boolean> {
    const preferences = await this.get()
    return preferences.autoSwitchOnFailure
  }

  async reset(): Promise<void> {
    this.ensureInitialized()
    
    this.preferences = UserPreferenceEntity.createDefault()
    await this.save(this.preferences)
  }
}
