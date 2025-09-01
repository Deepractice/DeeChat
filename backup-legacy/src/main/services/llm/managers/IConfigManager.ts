import { ModelConfigEntity } from '../../../../shared/entities/ModelConfigEntity'

/**
 * 配置管理器接口
 * 负责所有与模型配置相关的逻辑
 */
export interface IConfigManager {
  /**
   * 获取模型配置
   * @param configId 配置ID或模型名称
   * @returns 模型配置实体
   */
  getConfig(configId: string): Promise<ModelConfigEntity>

  /**
   * 根据模型名称智能检测Provider
   * @param modelName 模型名称
   * @returns provider类型
   */
  detectProvider(modelName: string): string

  /**
   * 创建内置默认配置
   * @param configId 配置ID
   * @returns 默认配置
   */
  createDefaultConfig(configId: string): ModelConfigEntity

  /**
   * 缓存配置
   * @param configId 配置ID
   * @param config 配置实体
   */
  cacheConfig(configId: string, config: ModelConfigEntity): void

  /**
   * 从缓存获取配置
   * @param configId 配置ID
   * @returns 缓存的配置或null
   */
  getFromCache(configId: string): ModelConfigEntity | null

  /**
   * 清理配置缓存
   */
  clearCache(): void

  /**
   * 获取所有已启用的配置
   * @returns 已启用的配置列表
   */
  getAllEnabledConfigs(): Promise<ModelConfigEntity[]>
}