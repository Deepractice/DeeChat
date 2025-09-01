import { ModelConfigEntity } from '../entities/ModelConfigEntity'
import { UserPreferenceEntity } from '../entities/UserPreferenceEntity'

// 模型选择策略接口
export interface IModelSelectionStrategy {
  readonly name: string

  // 为指定会话选择模型（异步方法）
  selectModel(
    sessionId: string,
    availableModels: ModelConfigEntity[],
    userPreference: UserPreferenceEntity,
    currentSessionModel?: string
  ): Promise<ModelConfigEntity | null>

  // 获取策略描述
  getDescription(): string
}

// 模型选择上下文
export interface ModelSelectionContext {
  sessionId: string
  availableModels: ModelConfigEntity[]
  userPreference: UserPreferenceEntity
  currentSessionModel?: string
  lastUsedModel?: string
  failedModels?: string[]
}

// 模型选择结果
export interface ModelSelectionResult {
  selectedModel: ModelConfigEntity | null
  reason: string
  fallbackUsed: boolean
}
