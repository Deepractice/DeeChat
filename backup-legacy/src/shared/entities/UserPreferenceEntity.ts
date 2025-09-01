export interface UserPreferenceData {
  lastSelectedModelId?: string
  defaultModelId?: string
  modelSelectionStrategy: 'remember_last' | 'priority' | 'manual'
  autoSwitchOnFailure: boolean
  updatedAt: string
}

export class UserPreferenceEntity {
  public lastSelectedModelId?: string
  public defaultModelId?: string
  public modelSelectionStrategy: 'remember_last' | 'priority' | 'manual'
  public autoSwitchOnFailure: boolean
  public updatedAt: Date

  constructor(data: UserPreferenceData) {
    this.lastSelectedModelId = data.lastSelectedModelId
    this.defaultModelId = data.defaultModelId
    this.modelSelectionStrategy = data.modelSelectionStrategy
    this.autoSwitchOnFailure = data.autoSwitchOnFailure
    this.updatedAt = new Date(data.updatedAt)
  }

  // 更新最后选择的模型
  updateLastSelected(modelId: string): void {
    this.lastSelectedModelId = modelId
    this.updatedAt = new Date()
  }

  // 设置默认模型
  setDefaultModel(modelId: string): void {
    this.defaultModelId = modelId
    this.updatedAt = new Date()
  }

  // 获取默认模型ID
  getDefaultModelId(): string | undefined {
    return this.defaultModelId || this.lastSelectedModelId
  }

  // 设置模型选择策略
  setSelectionStrategy(strategy: 'remember_last' | 'priority' | 'manual'): void {
    this.modelSelectionStrategy = strategy
    this.updatedAt = new Date()
  }

  // 设置故障自动切换
  setAutoSwitchOnFailure(enabled: boolean): void {
    this.autoSwitchOnFailure = enabled
    this.updatedAt = new Date()
  }

  // 转换为数据对象
  toData(): UserPreferenceData {
    return {
      lastSelectedModelId: this.lastSelectedModelId,
      defaultModelId: this.defaultModelId,
      modelSelectionStrategy: this.modelSelectionStrategy,
      autoSwitchOnFailure: this.autoSwitchOnFailure,
      updatedAt: this.updatedAt.toISOString()
    }
  }

  // 创建默认偏好设置
  static createDefault(): UserPreferenceEntity {
    return new UserPreferenceEntity({
      modelSelectionStrategy: 'remember_last',
      autoSwitchOnFailure: true,
      updatedAt: new Date().toISOString()
    })
  }

  // 克隆实体
  clone(): UserPreferenceEntity {
    return new UserPreferenceEntity(this.toData())
  }
}
