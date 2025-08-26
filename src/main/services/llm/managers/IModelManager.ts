import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { ModelConfigEntity } from '../../../../shared/entities/ModelConfigEntity'

/**
 * 模型管理器接口
 * 负责所有与模型实例管理相关的逻辑
 */
export interface IModelManager {
  /**
   * 创建模型实例
   * @param config 模型配置
   * @returns 模型实例
   */
  createModel(config: ModelConfigEntity): Promise<BaseChatModel>

  /**
   * 缓存模型实例
   * @param key 缓存键
   * @param model 模型实例
   */
  cacheModel(key: string, model: BaseChatModel): void

  /**
   * 从缓存获取模型实例
   * @param key 缓存键
   * @returns 缓存的模型实例或null
   */
  getFromCache(key: string): BaseChatModel | null

  /**
   * 生成模型缓存键
   * @param config 模型配置
   * @returns 缓存键
   */
  generateCacheKey(config: ModelConfigEntity): string

  /**
   * 清理模型缓存
   */
  clearCache(): void

  /**
   * 获取缓存状态
   * @returns 缓存状态信息
   */
  getCacheStats(): {
    size: number
    keys: string[]
  }

  /**
   * 测试模型连接
   * @param config 模型配置
   * @returns 测试结果
   */
  testModel(config: ModelConfigEntity): Promise<{ success: boolean; error?: string }>

  /**
   * 获取模型支持的功能列表
   * @param config 模型配置
   * @returns 支持的功能列表
   */
  getModelCapabilities(config: ModelConfigEntity): Promise<string[]>
}