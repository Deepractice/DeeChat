/**
 * 模型管理服务
 *
 * 职责：
 * - 获取AI Provider的可用模型列表
 * - 模型数据增强和分类处理
 * - 管理用户的模型偏好设置
 */

import { AIConfigManager } from '@deepracticex/ai-config'
import {
  RawModelData,
  EnhancedModelInfo,
  ModelListData
} from '../types/AIConfigTypes.js'
import {
  enhanceModelInfo,
  categorizeModels
} from '../utils/ModelEnhancer.js'

export class ModelService {
  constructor(private aiConfigManager: AIConfigManager) {}

  /**
   * 获取指定AI配置的可用模型列表（增强版）
   *
   * 通过调用AI Provider的API来动态获取可用模型，并进行分类和增强：
   * 1. 根据配置名查找AI配置
   * 2. 验证配置包含必要的连接信息
   * 3. 调用Provider的/models接口
   * 4. 增强模型数据（分类、能力标注等）
   * 5. 返回结构化的模型数据
   *
   * @param configName AI配置名称
   * @returns 增强的结构化模型数据
   * @throws {Error} 配置不存在、连接失败或API调用出错
   */
  async getAvailableModels(configName: string): Promise<ModelListData> {
    try {
      // 1. 查找指定名称的AI配置
      const config = await this.aiConfigManager.configs.findByName(configName)
      if (!config) {
        throw new Error(`Configuration ${configName} not found`)
      }

      const { base_url, api_key } = config

      // 2. 验证配置完整性：确保有必要的连接信息
      if (!base_url || !api_key) {
        throw new Error(`Configuration ${configName} missing base_url or api_key`)
      }

      // 3. 调用AI Provider的模型列表API
      const response = await fetch(`${base_url}/models`, {
        headers: {
          'Authorization': `Bearer ${api_key}`,
          'Content-Type': 'application/json'
        }
      })

      // 4. 检查API响应状态
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`)
      }

      const rawModelsData: any = await response.json()
      const rawModels: RawModelData[] = rawModelsData?.data || rawModelsData || []

      // 5. 增强模型数据 - 添加分类、能力标注等信息
      const enhancedModels: EnhancedModelInfo[] = rawModels.map((model: any) =>
        enhanceModelInfo(model, configName)
      )

      // 6. 按分类组织模型
      const categorizedModels = categorizeModels(enhancedModels)

      // 🔍 直接返回数据对象，IPC注册器会自动包装成 {success: true, data: ...}
      const responseData = {
        models: enhancedModels,
        categorized: categorizedModels,
        total: enhancedModels.length,
        provider: configName
      }

      console.log(`✅ 获取到 ${configName} 的可用模型: ${enhancedModels.length} 个模型，已分类`)
      console.log('🔍 返回给前端的数据结构概要:')
      console.log('  - models长度:', responseData.models?.length)
      console.log('  - total:', responseData.total)
      console.log('  - 第一个模型ID:', responseData.models?.[0]?.id)
      console.log('  - 第一个模型分类:', responseData.models?.[0]?.category)
      console.log('📦 注意：IPC注册器会自动包装为 {success: true, data: responseData}')

      return responseData
    } catch (error: any) {
      console.error('❌ 获取模型列表失败:', error)
      // 💥 直接抛出异常，让IPC注册器统一包装为 {success: false, error: ...}
      throw error
    }
  }

  /**
   * 设置指定AI配置的首选模型
   *
   * 将用户的模型偏好保存到偏好设置系统中，
   * 便于后续对话时自动选择用户喜欢的模型
   *
   * @param configName AI配置名称
   * @param model 首选的模型名称
   * @throws {Error} 设置过程出错
   */
  async setModelPreference(configName: string, model: string): Promise<void> {
    try {
      // 构建偏好设置的键名，使用配置名作为后缀确保唯一性
      const key = `preferred_model_${configName}`

      // 保存到偏好设置系统，归类为ai_models类别
      await this.aiConfigManager.preferences.set({
        key,
        value: model,
        category: 'ai_models',
        description: `用户偏好的 ${configName} 模型`
      })

      console.log(`✅ 模型偏好设置成功: ${configName} -> ${model}`)
    } catch (error: any) {
      console.error('❌ 设置模型偏好失败:', error)
      throw error
    }
  }

  /**
   * 获取指定AI配置的首选模型
   *
   * @param configName AI配置名称
   * @returns 首选模型名称，未设置时返回null
   * @throws {Error} 获取过程出错
   */
  async getModelPreference(configName: string): Promise<string | null> {
    try {
      const key = `preferred_model_${configName}`

      const preference = await this.aiConfigManager.preferences.get<string>(key)
      console.log(`✅ 获取模型偏好: ${configName} -> ${preference || '未设置'}`)

      return preference
    } catch (error: any) {
      console.error('❌ 获取模型偏好失败:', error)
      throw error
    }
  }

  /**
   * 获取所有AI配置的模型偏好设置
   *
   * 遍历所有ai_models类别的偏好设置，
   * 提取出各个配置对应的首选模型
   *
   * @returns 配置名到首选模型的映射对象
   * @throws {Error} 获取过程出错
   */
  async getAllModelPreferences(): Promise<Record<string, string>> {
    try {
      // 获取所有ai_models类别的偏好设置
      const preferences = await this.aiConfigManager.preferences.getAll({ category: 'ai_models' })

      const result: Record<string, string> = {}
      preferences.forEach((pref: any) => {
        // 筛选出模型偏好设置（键名以preferred_model_开头）
        if (pref.key.startsWith('preferred_model_')) {
          // 从键名中提取配置名称
          const configName = pref.key.replace('preferred_model_', '')
          result[configName] = pref.value as string
        }
      })

      console.log(`✅ 获取所有模型偏好:`, Object.keys(result).length, '个配置')
      return result
    } catch (error: any) {
      console.error('❌ 获取所有模型偏好失败:', error)
      throw error
    }
  }
}