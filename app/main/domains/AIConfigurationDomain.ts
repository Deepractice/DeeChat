/**
 * AIConfigurationDomain - AI配置领域服务
 * 
 * 核心职责：
 * - 管理AI配置的生命周期（创建、查询、更新、删除）
 * - 处理AI模型的发现和偏好设置
 * - 提供AI配置的业务规则验证
 * - 管理AI配置相关的用户偏好设置
 * 
 * 架构特点：
 * - 采用DDD充血模型，包含完整的业务逻辑
 * - 基于@deepracticex/ai-config包进行底层存储管理
 * - 支持多种AI Provider配置（OpenAI、Claude、自定义等）
 * - 统一数据库存储，确保配置数据一致性
 * - 提供完整的模型偏好管理功能
 */

import { Service } from 'typedi'
import { DatabaseConfig } from '../config/database.config.js'
import { BetterSQLite3Adapter } from '@deepracticex/database-adapter'
import {
  AIConfigManager,
  CreateAIConfigInput,
  UpdateAIConfigInput,
  AIConfig
} from '@deepracticex/ai-config'

// 模型分类枚举
enum ModelCategory {
  GPT_SERIES = 'GPT系列',
  CLAUDE_SERIES = 'Claude系列', 
  OPEN_SOURCE = '开源模型',
  VISION_MODELS = '视觉模型',
  OTHER = '其他模型'
}

// 原始API返回的模型数据（任意格式）
interface RawModelData {
  [key: string]: any
}

// 统一的模型信息接口（前端使用）
interface EnhancedModelInfo {
  id: string                    // 模型ID
  name: string                  // 显示名称（如果没有name则使用id）
  category: ModelCategory       // 自动分类
  description: string           // 描述（如果没有则生成默认描述）
  context_length: number        // 上下文长度（默认4096）
  capabilities: {
    vision: boolean            // 是否支持视觉（基于名称推断）
    function_calling: boolean  // 是否支持函数调用（基于元数据或名称推断）
    audio: boolean             // 是否支持音频（基于名称推断）
    max_tokens: number         // 最大token数（等于context_length）
  }
  pricing: {
    input: number              // 输入价格（默认0表示未知）
    output: number             // 输出价格（默认0表示未知）
    image?: number             // 图像价格（支持视觉时显示）
  }
  provider: string              // 提供商名称
  created: number               // 创建时间（使用实际值或当前时间）
  // 元数据用于调试和扩展
  metadata?: {
    source: string             // 供应商标识，来自配置名称
    api_format: 'rich' | 'simple' | 'unknown'  // 数据格式类型
    original_data: any         // 保留原始数据以供调试
  }
}

// 分类后的模型数据结构
interface CategorizedModels {
  [key: string]: EnhancedModelInfo[]  // 以分类名为key
}

// API响应接口 (原始格式，用于类型引用)
interface ModelListResponse {
  success: boolean
  data: {
    models: EnhancedModelInfo[]
    categorized: CategorizedModels
    total: number
    provider: string
  } | null
  error?: string
}

// 直接返回的数据接口 (IPC会自动包装)
interface ModelListData {
  models: EnhancedModelInfo[]
  categorized: CategorizedModels
  total: number
  provider: string
}

// ==================== 工具函数 ====================

/**
 * 根据模型名称判断分类
 */
function categorizeModel(modelId: string): ModelCategory {
  const modelLower = modelId.toLowerCase()
  
  // GPT系列
  if (modelLower.includes('gpt') || modelLower.includes('chatgpt') || modelLower.includes('o1')) {
    return ModelCategory.GPT_SERIES
  }
  
  // Claude系列
  if (modelLower.includes('claude')) {
    return ModelCategory.CLAUDE_SERIES
  }
  
  // 视觉模型
  if (modelLower.includes('vision') || 
      modelLower.includes('gpt-4v') || 
      modelLower.includes('claude-3') ||
      modelLower.includes('gemini-pro-vision') ||
      modelLower.includes('llava')) {
    return ModelCategory.VISION_MODELS
  }
  
  // 开源模型
  if (modelLower.includes('qwen') || 
      modelLower.includes('llama') || 
      modelLower.includes('mixtral') || 
      modelLower.includes('gemma') || 
      modelLower.includes('deepseek') || 
      modelLower.includes('yi') || 
      modelLower.includes('baichuan') ||
      modelLower.includes('chatglm') ||
      modelLower.includes('internlm') ||
      modelLower.includes('vicuna') ||
      modelLower.includes('alpaca')) {
    return ModelCategory.OPEN_SOURCE
  }
  
  return ModelCategory.OTHER
}

/**
 * 智能检测API数据格式类型
 */
function detectApiFormat(rawModel: RawModelData): 'rich' | 'simple' | 'unknown' {
  if (rawModel.pricing && rawModel.architecture && rawModel.context_length) {
    return 'rich'  // OpenRouter类型：丰富的元数据
  }
  if (rawModel.object === 'model' && rawModel.created && !rawModel.pricing) {
    return 'simple'  // Sophnet类型：极简数据
  }
  return 'unknown'
}

/**
 * 增强模型信息 - 统一处理各种格式的原始数据
 */
function enhanceModelInfo(rawModel: RawModelData, provider: string): EnhancedModelInfo {
  const apiFormat = detectApiFormat(rawModel)
  const modelId = rawModel.id || 'unknown'
  const modelName = rawModel.name || modelId
  
  // 智能推断能力
  const visionCapability = checkVisionCapability(modelId) || 
    rawModel.architecture?.input_modalities?.includes('image') || false
  const audioCapability = rawModel.architecture?.input_modalities?.includes('audio') || false
  const functionCalling = rawModel.supported_parameters?.includes('tools') || 
    rawModel.supported_parameters?.includes('function_call') || false
  
  // 智能处理定价信息
  const pricing = {
    input: 0,
    output: 0,
    image: undefined as number | undefined
  }
  
  if (rawModel.pricing) {
    pricing.input = parseFloat(rawModel.pricing.prompt || '0') * 1000  // 转换为每1K tokens
    pricing.output = parseFloat(rawModel.pricing.completion || '0') * 1000
    if (rawModel.pricing.image && visionCapability) {
      pricing.image = parseFloat(rawModel.pricing.image) * 1000
    }
  }
  
  // 上下文长度推断
  const contextLength = rawModel.context_length || 
    rawModel.top_provider?.context_length || 
    4096  // 默认值
  
  // 生成默认描述
  const defaultDescription = rawModel.description || 
    `${modelName} - AI模型，支持文本处理${visionCapability ? '和图像理解' : ''}${audioCapability ? '和音频处理' : ''}`
  
  return {
    id: modelId,
    name: modelName,
    category: categorizeModel(modelId),
    description: defaultDescription,
    context_length: contextLength,
    capabilities: {
      vision: visionCapability,
      function_calling: functionCalling,
      audio: audioCapability,
      max_tokens: contextLength
    },
    pricing,
    provider,
    created: rawModel.created || Date.now(),
    metadata: {
      source: provider,
      api_format: apiFormat,
      original_data: rawModel
    }
  }
}

/**
 * 检查模型是否支持视觉功能
 */
function checkVisionCapability(modelId: string): boolean {
  const visionKeywords = ['vision', 'gpt-4v', 'claude-3', 'gemini-pro-vision', 'llava']
  return visionKeywords.some(keyword => modelId.toLowerCase().includes(keyword))
}

/**
 * 将模型列表按分类组织
 */
function categorizeModels(models: EnhancedModelInfo[]): CategorizedModels {
  const categorized: CategorizedModels = {}
  
  // 初始化所有分类
  Object.values(ModelCategory).forEach(category => {
    categorized[category] = []
  })
  
  // 分类模型
  models.forEach(model => {
    categorized[model.category].push(model)
  })
  
  // 按名称排序每个分类中的模型
  Object.keys(categorized).forEach(category => {
    categorized[category].sort((a, b) => a.name.localeCompare(b.name))
  })
  
  return categorized
}

// ==================== 领域服务实现 ====================

/**
 * AIConfigurationDomain类 - 充血模型实现
 * 
 * 这是AI配置领域的核心服务类，采用充血模型设计：
 * - 包含完整的AI配置业务逻辑，而非仅仅作为数据载体
 * - 负责协调底层ai-config包与上层业务需求
 * - 实现复杂的业务流程（配置验证、模型发现、偏好管理等）
 * - 提供统一的AI配置管理接口
 */
@Service()
export class AIConfigurationDomain {
  // ============ 私有字段 ============

  /** 初始化状态标志，防止重复初始化 */
  private initialized = false

  /** AI配置管理器实例 */
  private aiConfigManager: AIConfigManager | null = null
  
  // ============ 配置管理器访问方法 ============

  /**
   * 获取AI配置管理器实例
   * 确保管理器已正确初始化
   */
  private getConfigManager(): AIConfigManager {
    if (!this.aiConfigManager) {
      throw new Error('AIConfigManager未初始化，请先调用initialize方法')
    }
    return this.aiConfigManager
  }

  // ============ 领域初始化 ============
  
  /**
   * 初始化AI配置领域服务
   * 
   * 执行必要的初始化步骤：
   * 1. 获取标准化的数据库路径配置
   * 2. 执行数据迁移（如果需要）
   * 3. 初始化底层ai-config包
   * 4. 建立数据库连接和表结构
   * 5. 设置初始化状态标志
   * 
   * @throws {Error} 初始化失败时抛出错误
   */
  async initialize(): Promise<void> {
    // 防止重复初始化
    if (this.initialized) return

    try {
      console.log('🔧 初始化AI配置领域...')
      
      // 1. 获取数据库配置管理器
      const dbConfig = DatabaseConfig.getInstance()
      const dbPath = dbConfig.getDatabasePath()
      
      console.log(`🗄️ 使用数据库路径: ${dbPath}`)
      
      // 2. 尝试从旧路径迁移数据
      if (!dbConfig.databaseExists()) {
        console.log('📦 检测到首次启动或需要数据迁移...')
        const migrationResult = await dbConfig.autoMigrateFromCommonPaths()
        
        if (migrationResult.successful.length > 0) {
          console.log(`✅ 数据迁移完成，来源: ${migrationResult.successful[0]}`)
        } else {
          console.log('📝 未找到旧数据，将创建新数据库')
        }
      }
      
      // 3. 创建数据库适配器
      const adapter = new BetterSQLite3Adapter(dbPath)
      await adapter.connect()

      // 4. 创建AI配置管理器实例
      this.aiConfigManager = new AIConfigManager({ database: adapter })
      await this.aiConfigManager.initialize()
      
      this.initialized = true
      console.log('✅ AI配置领域初始化完成')
      
      // 5. 显示数据库状态信息
      const stats = dbConfig.getDatabaseStats()
      if (stats) {
        console.log(`📊 数据库状态: ${Math.round(stats.size / 1024)}KB, 修改时间: ${stats.mtime.toISOString()}`)
      }
      
    } catch (error: any) {
      console.error('❌ AI配置领域初始化失败:', error)
      throw error  // 重新抛出错误，让上层处理
    }
  }

  // ============ 核心业务方法 ============
  
  /**
   * 创建新的用户AI配置
   * 
   * 业务流程：
   * 1. 确保系统已初始化
   * 2. 验证用户输入的合法性
   * 3. 检查配置名称是否重复
   * 4. 调用底层API创建配置
   * 5. 记录操作日志
   * 
   * @param input 创建AI配置的输入参数
   * @returns 创建成功的AI配置对象
   * @throws {Error} 验证失败、重复配置或创建过程出错
   */
  async createUserAIConfiguration(input: CreateAIConfigInput): Promise<AIConfig> {
    await this.ensureInitialized()

    try {
      // 1. 业务规则验证：确保输入参数符合业务要求
      this.validateConfigurationInput(input)

      // 2. 业务规则验证：检查配置名称唯一性
      await this.checkDuplicateConfiguration(input.name)

      // 3. 委托给AI配置管理器创建配置
      const result = await this.getConfigManager().configs.create(input)

      console.log(`✅ 用户AI配置创建成功: ${input.name}`)
      return result
    } catch (error: any) {
      console.error('❌ 创建AI配置失败:', error)
      throw error
    }
  }

  /**
   * 获取所有用户AI配置列表
   * 
   * @returns AI配置对象数组
   */
  async getUserAIConfigurations(): Promise<AIConfig[]> {
    await this.ensureInitialized()
    return await this.getConfigManager().configs.findAll()
  }

  /**
   * 更新用户AI配置
   * 
   * 业务流程：
   * 1. 确保系统已初始化
   * 2. 验证配置ID是否存在
   * 3. 如果更新配置名称，检查新名称是否重复
   * 4. 调用底层API更新配置
   * 5. 记录操作日志
   * 
   * @param id 配置ID
   * @param input 更新AI配置的输入参数
   * @returns 更新后的AI配置对象
   * @throws {Error} 配置不存在、验证失败或更新过程出错
   */
  async updateUserAIConfiguration(id: number, input: UpdateAIConfigInput): Promise<AIConfig> {
    await this.ensureInitialized()

    try {
      // 1. 业务规则验证：检查配置是否存在
      const existingConfig = await this.getConfigManager().configs.findById(id)
      if (!existingConfig) {
        throw new Error(`配置ID ${id} 不存在`)
      }

      // 2. 业务规则验证：如果要更新名称，检查新名称是否重复
      if (input.name && input.name !== existingConfig.name) {
        const duplicateConfig = await this.getConfigManager().configs.findByName(input.name)
        if (duplicateConfig && duplicateConfig.id !== id) {
          throw new Error(`配置名称 "${input.name}" 已存在`)
        }
      }

      // 3. 委托给AI配置管理器更新配置
      const result = await this.getConfigManager().configs.update(id, input)

      console.log(`✅ 用户AI配置更新成功: ID ${id} (${input.name || existingConfig.name})`)
      return result
    } catch (error: any) {
      console.error('❌ 更新AI配置失败:', error)
      throw error
    }
  }

  /**
   * 删除用户AI配置
   * 
   * 业务流程：
   * 1. 验证配置是否可以删除（如不能删除默认配置）
   * 2. 根据参数类型选择合适的删除方式
   * 3. 执行删除操作并记录日志
   * 
   * @param nameOrId 配置名称或ID
   * @throws {Error} 配置不存在、不允许删除或删除过程出错
   */
  async removeUserAIConfiguration(nameOrId: string | number): Promise<void> {
    await this.ensureInitialized()
    
    try {
      // 1. 业务规则验证：检查是否允许删除此配置
      await this.validateConfigurationDeletion(nameOrId)
      
      // 2. 根据参数类型执行不同的删除逻辑
      const manager = this.getConfigManager()
      if (typeof nameOrId === 'number') {
        // 按ID删除
        await manager.configs.delete(nameOrId)
      } else {
        // 按名称删除：先查找配置，再删除
        const config = await manager.configs.findByName(nameOrId)
        if (config) {
          await manager.configs.delete(config.id)
        } else {
          throw new Error(`配置 "${nameOrId}" 不存在`)
        }
      }
      
      console.log(`✅ AI配置删除成功: ${nameOrId}`)
    } catch (error: any) {
      console.error('❌ 删除AI配置失败:', error)
      throw error
    }
  }

  /**
   * 获取指定的用户AI配置
   * 
   * 支持三种获取方式：
   * - 不传参数：返回默认配置
   * - 传入数字：按ID查找
   * - 传入字符串：按名称查找
   * 
   * @param nameOrId 可选的配置名称或ID
   * @returns AI配置对象，不存在时返回null
   * @throws {Error} 查询过程出错
   */
  async getUserConfiguration(nameOrId?: string | number): Promise<AIConfig | null> {
    await this.ensureInitialized()
    
    try {
      const manager = this.getConfigManager()
      if (!nameOrId) {
        // 获取系统默认配置
        return await manager.configs.findDefault()
      } else if (typeof nameOrId === 'number') {
        // 根据数字ID获取配置
        return await manager.configs.findById(nameOrId)
      } else {
        // 根据字符串名称获取配置
        return await manager.configs.findByName(nameOrId)
      }
    } catch (error: any) {
      console.error('❌ 获取AI配置失败:', error)
      throw error
    }
  }

  // ============ 模型管理方法 ============
  
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
    await this.ensureInitialized()
    
    try {
      // 1. 查找指定名称的AI配置
      const config = await this.getConfigManager().configs.findByName(configName)
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
    await this.ensureInitialized()
    
    try {
      // 构建偏好设置的键名，使用配置名作为后缀确保唯一性
      const key = `preferred_model_${configName}`
      
      // 保存到偏好设置系统，归类为ai_models类别
      await this.getConfigManager().preferences.set({
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
    await this.ensureInitialized()
    
    try {
      const key = `preferred_model_${configName}`

      const preference = await this.getConfigManager().preferences.get<string>(key)
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
    await this.ensureInitialized()
    
    try {
      const manager = this.getConfigManager()
      // 获取所有ai_models类别的偏好设置
      const preferences = await manager.preferences.getAll({ category: 'ai_models' })
      
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

  // ============ 私有辅助方法 ============
  
  /**
   * 验证配置输入参数
   * 
   * 提供业务层面的验证规则，补充底层包的基础验证
   * （底层ai-config包已包含zod验证，此处主要关注业务规则）
   * 
   * @param input 配置输入参数
   * @throws {Error} 验证失败时抛出错误
   * @private
   */
  private validateConfigurationInput(input: CreateAIConfigInput): void {
    // 业务规则：配置名称长度限制
    if (input.name.length > 100) {
      throw new Error('配置名称不能超过100个字符')
    }
    // 注意：底层ai-config包已经包含完整的zod验证
    // 这里只需要添加特定的业务层面验证规则
  }

  /**
   * 检查配置名称是否重复
   * 
   * @param name 配置名称
   * @throws {Error} 配置名称已存在时抛出错误
   * @private
   */
  private async checkDuplicateConfiguration(name: string): Promise<void> {
    try {
      const existing = await this.getConfigManager().configs.findByName(name)
      if (existing) {
        throw new Error(`配置 "${name}" 已存在`)
      }
    } catch (error: any) {
      // 如果是重复性错误，需要向上抛出给调用方
      if (error.message.includes('已存在')) {
        throw error
      }
      // 其他错误（如配置不存在）是正常情况，忽略处理
    }
  }

  /**
   * 验证配置是否可以删除
   * 
   * 实施删除业务规则：
   * - 配置必须存在
   * - 不能删除默认配置
   * 
   * @param nameOrId 配置名称或ID
   * @throws {Error} 配置不存在或不允许删除时抛出错误
   * @private
   */
  private async validateConfigurationDeletion(nameOrId: string | number): Promise<void> {
    let config: AIConfig | null = null
    
    // 根据参数类型选择查找方式
    const manager = this.getConfigManager()
    if (typeof nameOrId === 'number') {
      config = await manager.configs.findById(nameOrId)
    } else {
      config = await manager.configs.findByName(nameOrId)
    }
    
    // 业务规则：配置必须存在
    if (!config) {
      throw new Error(`配置 "${nameOrId}" 不存在`)
    }
    
    // 业务规则：不允许删除默认配置
    if (config.is_default) {
      throw new Error('不能删除默认配置，请先设置其他配置为默认')
    }
  }

  /**
   * 确保领域服务已初始化
   * 
   * 在执行任何业务操作前调用此方法，
   * 如果未初始化则自动执行初始化
   * 
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  // ============ IPC接口暴露 ============
  
  /**
   * 暴露AI配置领域的IPC接口
   * 
   * 将领域服务的方法暴露给IPC层，供渲染进程调用
   * 使用bind确保方法调用时的this上下文正确
   * 
   * IPC方法分类：
   * - 核心配置管理: 创建、获取、删除AI配置
   * - 模型管理: 获取可用模型、管理模型偏好设置
   * 
   * @returns IPC方法映射表，键为IPC通道名，值为绑定的方法
   */
  exposeToIPC(): Record<string, Function> {
    console.log('🔧 AIConfigurationDomain 注册IPC接口...')
    
    const ipcHandlers = {
      // ============ 核心配置管理 ============
      'ai-config:create': this.createUserAIConfiguration.bind(this),     // 创建新的AI配置
      'ai-config:getAll': this.getUserAIConfigurations.bind(this),       // 获取所有AI配置列表
      'ai-config:get': this.getUserConfiguration.bind(this),             // 获取指定AI配置
      'ai-config:update': this.updateUserAIConfiguration.bind(this),     // 更新指定AI配置
      'ai-config:delete': this.removeUserAIConfiguration.bind(this),     // 删除指定AI配置
      
      // ============ 模型相关管理 ============
      'ai-config:getModels': this.getAvailableModels.bind(this),         // 获取指定配置的可用模型列表
      'ai-config:setModelPreference': this.setModelPreference.bind(this), // 设置配置的首选模型
      'ai-config:getModelPreference': this.getModelPreference.bind(this), // 获取配置的首选模型
      'ai-config:getAllModelPreferences': this.getAllModelPreferences.bind(this) // 获取所有配置的模型偏好
    }
    
    console.log(`✅ AIConfigurationDomain IPC接口注册完成: ${Object.keys(ipcHandlers).length}个方法`)
    console.log('📋 注册的IPC方法:', Object.keys(ipcHandlers).join(', '))
    
    return ipcHandlers
  }
}