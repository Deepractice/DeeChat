/**
 * AI配置领域IPC适配器
 *
 * 职责：
 * - 为前端暴露AI配置相关的IPC接口
 * - 处理IPC请求和响应格式转换
 * - 协调各个服务的调用
 */

import { ConfigurationService } from '../services/ConfigurationService.js'
import { ModelService } from '../services/ModelService.js'
import {
  CreateAIConfigInput,
  UpdateAIConfigInput,
  AIConfig
} from '@deepracticex/ai-config'
import { ModelListData } from '../types/AIConfigTypes.js'

export class IPCAdapter {
  constructor(
    private configurationService: ConfigurationService,
    private modelService: ModelService
  ) {}

  /**
   * 暴露给IPC的接口映射
   */
  exposeToIPC(): Record<string, Function> {
    return {
      // ============ 核心配置管理 ============
      'ai-config:create': this.createConfiguration.bind(this),
      'ai-config:getAll': this.getAllConfigurations.bind(this),
      'ai-config:get': this.getConfiguration.bind(this),
      'ai-config:update': this.updateConfiguration.bind(this),
      'ai-config:delete': this.deleteConfiguration.bind(this),

      // ============ 模型相关管理 ============
      'ai-config:getModels': this.getAvailableModels.bind(this),
      'ai-config:setModelPreference': this.setModelPreference.bind(this),
      'ai-config:getModelPreference': this.getModelPreference.bind(this),
      'ai-config:getAllModelPreferences': this.getAllModelPreferences.bind(this)
    }
  }

  // ============ 配置管理接口 ============

  /**
   * 创建新的AI配置
   */
  private async createConfiguration(input: CreateAIConfigInput): Promise<AIConfig> {
    console.log('📨 IPC请求: ai-config:create', input)

    try {
      const result = await this.configurationService.createConfiguration(input)
      console.log('✅ IPC响应: ai-config:create')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:create', error)
      throw error
    }
  }

  /**
   * 获取所有AI配置
   */
  private async getAllConfigurations(): Promise<AIConfig[]> {
    console.log('📨 IPC请求: ai-config:getAll')

    try {
      const result = await this.configurationService.getAllConfigurations()
      console.log('✅ IPC响应: ai-config:getAll')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:getAll', error)
      throw error
    }
  }

  /**
   * 获取指定AI配置
   */
  private async getConfiguration(nameOrId?: string | number): Promise<AIConfig | null> {
    console.log('📨 IPC请求: ai-config:get', nameOrId)

    try {
      const result = await this.configurationService.getConfiguration(nameOrId)
      console.log('✅ IPC响应: ai-config:get')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:get', error)
      throw error
    }
  }

  /**
   * 更新AI配置
   */
  private async updateConfiguration(id: number, input: UpdateAIConfigInput): Promise<AIConfig> {
    console.log('📨 IPC请求: ai-config:update', { id, input })

    try {
      const result = await this.configurationService.updateConfiguration(id, input)
      console.log('✅ IPC响应: ai-config:update')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:update', error)
      throw error
    }
  }

  /**
   * 删除AI配置
   */
  private async deleteConfiguration(nameOrId: string | number): Promise<void> {
    console.log('📨 IPC请求: ai-config:delete', nameOrId)

    try {
      await this.configurationService.removeConfiguration(nameOrId)
      console.log('✅ IPC响应: ai-config:delete')
    } catch (error) {
      console.error('❌ IPC错误: ai-config:delete', error)
      throw error
    }
  }

  // ============ 模型管理接口 ============

  /**
   * 获取可用模型列表
   */
  private async getAvailableModels(configName: string): Promise<ModelListData> {
    console.log('📨 IPC请求: ai-config:getModels', configName)

    try {
      const result = await this.modelService.getAvailableModels(configName)
      console.log('✅ IPC响应: ai-config:getModels')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:getModels', error)
      throw error
    }
  }

  /**
   * 设置模型偏好
   */
  private async setModelPreference(configName: string, model: string): Promise<void> {
    console.log('📨 IPC请求: ai-config:setModelPreference', { configName, model })

    try {
      await this.modelService.setModelPreference(configName, model)
      console.log('✅ IPC响应: ai-config:setModelPreference')
    } catch (error) {
      console.error('❌ IPC错误: ai-config:setModelPreference', error)
      throw error
    }
  }

  /**
   * 获取模型偏好
   */
  private async getModelPreference(configName: string): Promise<string | null> {
    console.log('📨 IPC请求: ai-config:getModelPreference', configName)

    try {
      const result = await this.modelService.getModelPreference(configName)
      console.log('✅ IPC响应: ai-config:getModelPreference')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:getModelPreference', error)
      throw error
    }
  }

  /**
   * 获取所有模型偏好
   */
  private async getAllModelPreferences(): Promise<Record<string, string>> {
    console.log('📨 IPC请求: ai-config:getAllModelPreferences')

    try {
      const result = await this.modelService.getAllModelPreferences()
      console.log('✅ IPC响应: ai-config:getAllModelPreferences')
      return result
    } catch (error) {
      console.error('❌ IPC错误: ai-config:getAllModelPreferences', error)
      throw error
    }
  }
}