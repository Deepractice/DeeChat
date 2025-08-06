import { LangChainLLMService } from '../../../shared/langchain/LangChainLLMService'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { ProviderConfigEntity } from '../../../shared/entities/ProviderConfigEntity'
import { LLMRequest, LLMResponse } from '../../../shared/interfaces/IModelProvider'
import { ModelService } from '../model/ModelService'
import { MCPIntegrationService } from '../mcp/index.js'
// MCPToolService已删除，功能直接集成到MCPIntegrationService中
import { silentSystemRoleManager } from '../core/SilentSystemRoleManager.js'
import { FileService } from '../FileService.js'
import { conversationManager } from '../../../shared/services/ConversationManager'
import { ChatMessage } from '../../../shared/types'
import { llmPromptIntegration } from '../../../shared/prompts/LLMServiceIntegration'
import { DeeChatFeature } from '../../../shared/prompts/FeatureContextProvider'
import log from 'electron-log'

/**
 * LLM服务
 * 基于LangChain框架的统一LLM服务接口，替代UnifiedLLMService
 */
export class LLMService {
  private langChainService: LangChainLLMService
  private modelManagementService: ModelService
  private mcpService: MCPIntegrationService
  // mcpToolService功能已整合到mcpService中

  constructor() {
    this.modelManagementService = new ModelService()
    this.mcpService = MCPIntegrationService.getInstance()
    // 将MCP服务注入到LangChainLLMService
    this.langChainService = new LangChainLLMService(undefined, this.modelManagementService, this.mcpService)
    // mcpToolService功能已整合到mcpService中
    
    // 初始化DeeChat专属提示词系统
    this.initializePromptSystem()
  }

  /**
   * 初始化DeeChat专属提示词系统
   */
  private async initializePromptSystem(): Promise<void> {
    try {
      await llmPromptIntegration.initializeLLMServicePrompts()
      log.info('✅ [LLM服务] DeeChat提示词系统初始化完成')
    } catch (error) {
      log.warn('⚠️ [LLM服务] DeeChat提示词系统初始化失败，将使用基础提示词:', error)
    }
  }

  /**
   * 获取LangChain服务的系统提示词提供器
   */
  getSystemPromptProvider() {
    return this.langChainService.getSystemPromptProvider()
  }

  // ==================== DeeChat专属提示词上下文管理 ====================

  /**
   * 设置功能上下文（用于不同UI模块）
   * @param feature 功能模块
   * @param data 额外数据
   */
  async setFeatureContext(feature: DeeChatFeature, _data?: Record<string, any>): Promise<void> {
    try {
      await llmPromptIntegration.setupLLMContext({
        feature,
        mcpTools: await this.getAvailableMCPToolNames()
      })
      log.info(`🎯 [提示词上下文] 功能上下文设置为: ${feature}`)
    } catch (error) {
      log.error('❌ [提示词上下文] 设置功能上下文失败:', error)
    }
  }

  /**
   * 设置PromptX角色
   * @param role 角色名称
   * @param description 角色描述
   * @param capabilities 角色能力
   */
  async setPromptXRole(role: string, description?: string, capabilities?: string[]): Promise<void> {
    try {
      await llmPromptIntegration.setupLLMContext({
        promptxRole: role,
        roleDescription: description,
        roleCapabilities: capabilities,
        mcpTools: await this.getAvailableMCPToolNames()
      })
      log.info(`🎭 [提示词上下文] PromptX角色设置为: ${role}`)
    } catch (error) {
      log.error('❌ [提示词上下文] 设置PromptX角色失败:', error)
    }
  }

  /**
   * 设置聊天模式上下文
   */
  async setupChatContext(): Promise<void> {
    try {
      await llmPromptIntegration.setupLLMContext({
        feature: 'chat',
        mcpTools: await this.getAvailableMCPToolNames()
      })
      log.info('💬 [提示词上下文] 聊天模式上下文已设置')
    } catch (error) {
      log.error('❌ [提示词上下文] 设置聊天模式上下文失败:', error)
    }
  }

  /**
   * 设置文件管理模式上下文
   */
  async setupFileManagerContext(): Promise<void> {
    try {
      await llmPromptIntegration.setupLLMContext({
        feature: 'file-manager',
        mcpTools: await this.getAvailableMCPToolNames()
      })
      log.info('📁 [提示词上下文] 文件管理模式上下文已设置')
    } catch (error) {
      log.error('❌ [提示词上下文] 设置文件管理模式上下文失败:', error)
    }
  }

  /**
   * 设置资源管理模式上下文
   */
  async setupResourcesContext(): Promise<void> {
    try {
      await llmPromptIntegration.setupLLMContext({
        feature: 'resources',
        mcpTools: await this.getAvailableMCPToolNames()
      })
      log.info('📚 [提示词上下文] 资源管理模式上下文已设置')
    } catch (error) {
      log.error('❌ [提示词上下文] 设置资源管理模式上下文失败:', error)
    }
  }

  /**
   * 清理提示词上下文
   */
  cleanupPromptContext(): void {
    try {
      llmPromptIntegration.cleanupLLMContext()
      log.info('🧹 [提示词上下文] 上下文已清理')
    } catch (error) {
      log.error('❌ [提示词上下文] 清理上下文失败:', error)
    }
  }

  /**
   * 获取当前系统提示词（调试用）
   */
  async getCurrentSystemPrompt(): Promise<string> {
    try {
      return await llmPromptIntegration.getCurrentLLMSystemPrompt()
    } catch (error) {
      log.error('❌ [提示词上下文] 获取系统提示词失败:', error)
      return this.langChainService.getSystemPromptProvider().buildSystemPrompt()
    }
  }

  /**
   * 获取可用的MCP工具名称列表（内部辅助方法）
   */
  private async getAvailableMCPToolNames(): Promise<string[]> {
    try {
      const tools = await this.mcpService.getAllTools()
      return tools.map(tool => tool.name)
    } catch (error) {
      log.warn('⚠️ [提示词上下文] 获取MCP工具名称失败:', error)
      return []
    }
  }


  /**
   * 使用临时配置发送消息（支持模型配置和提供商配置）
   * @param request LLM请求对象
   * @param config 配置实体
   */
  async sendMessageWithConfig(request: LLMRequest, config: ModelConfigEntity | ProviderConfigEntity): Promise<LLMResponse> {
    try {
      // 🤖 静默确保系统角色激活
      await this.ensureSystemRoleActive()

      let modelConfig: ModelConfigEntity;

      if (config instanceof ProviderConfigEntity) {
        // 为ProviderConfigEntity选择默认模型进行测试
        const defaultModels = config.getDefaultModels();
        const defaultModel = defaultModels[0] || 'default';

        modelConfig = new ModelConfigEntity({
          id: `${config.id}-test`,
          name: `${config.name}-test`,
          provider: config.provider,
          model: defaultModel,
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          isEnabled: config.isEnabled,
          priority: config.priority,
          status: 'untested',
          createdAt: config.createdAt instanceof Date ? config.createdAt.toISOString() : config.createdAt,
          updatedAt: config.updatedAt instanceof Date ? config.updatedAt.toISOString() : config.updatedAt
        });
      } else {
        modelConfig = config;
      }

      // 直接使用LangChain服务
      const response = await this.langChainService.sendMessageWithConfig(
        request.message,
        modelConfig,
        request.systemPrompt
      )

      return {
        content: response,
        model: modelConfig.model,
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }, // LangChain暂时不提供token统计
        finishReason: 'stop'
      }
    } catch (error) {
      console.error('LangChain临时配置调用失败:', error)
      throw error
    }
  }

  /**
   * 发送消息到AI模型（使用LangChain，支持消息历史）
   * @param request LLM请求对象
   * @param modelId 模型ID（新方案：直接就是模型名称，如 gpt-4o-mini）
   * @param chatHistory 可选的聊天历史
   */
  async sendMessage(request: LLMRequest, modelId: string, chatHistory?: ChatMessage[]): Promise<LLMResponse> {
    // 🤖 静默确保系统角色激活
    await this.ensureSystemRoleActive()

    log.info(`🔍 [模型解析] 输入模型ID: ${modelId}`)
    
    // 新方案：modelId 直接就是模型名称
    let config: ModelConfigEntity | null = null

    try {
      // 新方案：先尝试查找用户配置的模型
      const allConfigs = await this.modelManagementService.getAllConfigs()
      const enabledConfigs = allConfigs.filter(c => c.isEnabled)
      
      // 查找支持该模型的配置
      const foundConfig = enabledConfigs.find(c => {
        // 检查配置的默认模型
        if (c.model === modelId) return true
        // 检查配置的启用模型列表
        if (c.enabledModels && c.enabledModels.includes(modelId)) return true
        return false
      })
      
      if (foundConfig) {
        config = foundConfig
      }
      
      // 如果没有找到用户配置，使用内置的 ChatAnywhere 配置
      if (!config) {
        log.info(`🔧 [内置配置] 使用ChatAnywhere默认配置服务模型: ${modelId}`)
        
        // 🎯 根据模型名称智能识别provider
        const detectProviderByModel = (model: string): string => {
          if (model.includes('claude') || model.includes('anthropic')) {
            return 'claude'
          } else if (model.includes('gpt') || model.includes('openai')) {
            return 'openai'
          } else if (model.includes('gemini') || model.includes('google')) {
            return 'google'
          }
          // 默认使用openai（兼容大多数API）
          return 'openai'
        }
        
        const detectedProvider = detectProviderByModel(modelId)
        log.info(`🔍 [模型识别] ${modelId} -> provider: ${detectedProvider}`)
        
        // 创建内置默认配置
        const DEFAULT_CONFIG = {
          id: 'chatanywhere-default',
          name: 'ChatAnywhere (内置)',
          provider: detectedProvider, // 🎯 使用智能识别的provider
          model: modelId, // 使用请求的模型
          apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
          baseURL: 'https://api.chatanywhere.tech/v1/',
          isEnabled: true,
          priority: 10,
          enabledModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-sonnet-4-20250514'],
          status: 'available' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        config = new ModelConfigEntity(DEFAULT_CONFIG)
      }
      
      if (!config) {
        throw new Error(`找不到支持模型 ${modelId} 的配置`)
      }

      if (!config.isEnabled) {
        throw new Error(`模型配置已禁用: ${config.name}`)
      }

      // 处理附件内容
      let enhancedMessage = request.message
      if (request.attachmentIds && request.attachmentIds.length > 0) {
        console.log(`🔗 [附件处理] 处理 ${request.attachmentIds.length} 个附件`)
        
        // 创建FileService实例来处理附件
        const fileService = new FileService()
        await fileService.initialize()
        if (fileService) {
          const attachmentContents: string[] = []
          
          for (const attachmentId of request.attachmentIds) {
            try {
              const attachmentContent = await fileService.getAttachmentContent(attachmentId)
              attachmentContents.push(attachmentContent)
              console.log(`✅ [附件处理] 附件 ${attachmentId} 内容获取成功`)
            } catch (error) {
              console.error(`❌ [附件处理] 获取附件 ${attachmentId} 内容失败:`, error)
              attachmentContents.push(`[附件读取失败: ${attachmentId}]`)
            }
          }
          
          // 将附件内容添加到消息中
          if (attachmentContents.length > 0) {
            enhancedMessage = `${request.message}\n\n附件内容:\n${attachmentContents.join('\n\n---\n\n')}`
            console.log(`🔗 [附件处理] 消息已增强，包含 ${attachmentContents.length} 个附件`)
          }
        } else {
          console.warn(`⚠️ [附件处理] FileService 未找到，跳过附件处理`)
        }
      }

      // 🆕 使用ConversationManager准备上下文
      let content: string
      let contextInfo: any = undefined

      if (chatHistory && chatHistory.length > 0) {
        log.info(`📚 [消息历史] 包含 ${chatHistory.length} 条历史消息，使用上下文管理`)
        
        // 使用ConversationManager准备对话上下文
        const contextResult = await conversationManager.prepareConversationContext(
          chatHistory,
          enhancedMessage,
          config.model,
          request.systemPrompt
        )

        // 使用LangChain的sendConversation方法处理多轮对话
        content = await this.langChainService.sendConversation(
          contextResult.messages,
          config.id || 'temp-config'
        )
        
        contextInfo = contextResult.contextInfo
        log.info(`📊 [上下文管理] Token使用率: ${(contextInfo.tokenStats.utilizationRate * 100).toFixed(1)}%`)
        
      } else {
        log.info(`💬 [单消息模式] 无历史消息，使用标准模式`)
        
        // 使用配置发送单条消息
        content = await this.langChainService.sendMessageWithConfig(
          enhancedMessage,
          config,
          request.systemPrompt
        )
      }

      log.info(`🎯 [最终模型使用] Provider: ${config.provider}, Model: ${config.model}, BaseURL: ${config.baseURL}`)
      
      // 构造响应对象
      const response: LLMResponse = {
        content,
        model: config.model,
        usage: undefined, // LangChain可能不提供详细的usage信息
        finishReason: 'stop',
        ...(contextInfo && { contextInfo }) // 如果有上下文信息，包含在响应中
      }

      // 更新配置状态为可用
      if (config.status !== 'available') {
        config.updateStatus('available')
        await this.modelManagementService.updateConfig(config)
      }

      return response
    } catch (error) {
      console.error('LangChain服务调用失败:', error)
      
      // 更新配置状态为错误
      if (config && config.id !== 'chatanywhere-default') {
        try {
          const errorConfig = await this.modelManagementService.getConfigById(config.id)
          if (errorConfig) {
            errorConfig.updateStatus('error', error instanceof Error ? error.message : '未知错误')
            await this.modelManagementService.updateConfig(errorConfig)
          }
        } catch (updateError) {
          console.error('更新配置状态失败:', updateError)
        }
      }
      
      throw error
    }
  }

  /**
   * 流式发送消息（使用LangChain）
   * @param request LLM请求对象
   * @param configId 模型配置ID
   * @param onChunk 处理每个chunk的回调函数
   */
  async streamMessage(
    request: LLMRequest,
    configId: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      const config = await this.modelManagementService.getConfigById(configId)
      if (!config) {
        throw new Error(`模型配置不存在: ${configId}`)
      }

      if (!config.isEnabled) {
        throw new Error(`模型配置已禁用: ${config.name}`)
      }

      // 设置配置到LangChain服务
      this.langChainService.setConfig(configId, config)
      
      // 使用LangChain流式发送消息
      const fullResponse = await this.langChainService.streamMessage(
        request.message,
        configId,
        request.systemPrompt,
        onChunk
      )

      return fullResponse
    } catch (error) {
      console.error('LangChain流式调用失败:', error)
      throw error
    }
  }

  /**
   * 测试模型配置连接（使用LangChain）
   * @param configId 模型配置ID
   */
  async testProvider(configId: string) {
    try {
      const config = await this.modelManagementService.getConfigById(configId)
      if (!config) {
        throw new Error(`模型配置不存在: ${configId}`)
      }

      // 设置配置到LangChain服务
      this.langChainService.setConfig(configId, config)
      
      // 使用LangChain测试模型
      const testResult = await this.langChainService.testModel(configId)
      
      // 更新测试结果
      config.updateTestResult(testResult)
      await this.modelManagementService.updateConfig(config)
      
      return testResult
    } catch (error) {
      console.error('LangChain测试失败:', error)
      throw error
    }
  }

  /**
   * 批量处理消息（使用LangChain）
   * @param requests 批量请求
   * @param configId 模型配置ID
   */
  async batchMessages(
    requests: Array<{
      message: string;
      systemPrompt?: string;
    }>,
    configId: string
  ): Promise<string[]> {
    try {
      const config = await this.modelManagementService.getConfigById(configId)
      if (!config) {
        throw new Error(`模型配置不存在: ${configId}`)
      }

      if (!config.isEnabled) {
        throw new Error(`模型配置已禁用: ${config.name}`)
      }

      // 设置配置到LangChain服务
      this.langChainService.setConfig(configId, config)
      
      // 使用LangChain批量处理
      const responses = await this.langChainService.batchMessages(requests, configId)
      
      return responses
    } catch (error) {
      console.error('LangChain批量处理失败:', error)
      throw error
    }
  }

  /**
   * 清除LangChain缓存
   * @param configId 可选的配置ID，不提供则清除所有缓存
   */
  clearCache(configId?: string): void {
    this.langChainService.clearCache(configId)
  }

  /**
   * 获取所有可用的模型配置
   */
  async getAvailableConfigs(): Promise<ModelConfigEntity[]> {
    const allConfigs = await this.modelManagementService.getAllConfigs()
    return allConfigs.filter(config => config.isEnabled && config.status === 'available')
  }

  /**
   * 兼容旧版本的sendMessage接口
   * @deprecated 使用新的sendMessage(request, configId)方法
   */
  async sendMessageLegacy(message: string, legacyConfig: any): Promise<any> {
    try {
      // 尝试找到匹配的配置
      const allConfigs = await this.modelManagementService.getAllConfigs()
      const matchingConfig = allConfigs.find(config => 
        config.provider === legacyConfig.provider && 
        config.model === legacyConfig.model &&
        config.isEnabled
      )

      if (!matchingConfig) {
        // 如果没有找到匹配的配置，创建临时配置
        const tempConfig = ModelConfigEntity.create({
          name: `temp-${legacyConfig.provider}-${legacyConfig.model}`,
          provider: legacyConfig.provider,
          model: legacyConfig.model,
          apiKey: legacyConfig.apiKey,
          baseURL: legacyConfig.baseURL || this.getDefaultBaseURL(legacyConfig.provider),
          isEnabled: true,
          priority: 1
        })

        const request: LLMRequest = {
          message,
          temperature: legacyConfig.temperature,
          maxTokens: legacyConfig.maxTokens
        }

        const response = await this.sendMessageWithConfig(request, tempConfig)

        return {
          content: response.content,
          model: response.model,
          usage: response.usage
        }
      }

      // 使用LangChain架构
      const request: LLMRequest = {
        message,
        temperature: legacyConfig.temperature,
        maxTokens: legacyConfig.maxTokens
      }

      const response = await this.sendMessage(request, matchingConfig.id)
      
      // 转换为旧格式
      return {
        content: response.content,
        model: response.model,
        usage: response.usage
      }
    } catch (error) {
      console.error('LangChain兼容模式调用失败:', error)
      throw error
    }
  }

  /**
   * 获取提供商的可用模型列表
   * @param config 模型配置（用于获取API密钥等信息）
   * @returns 可用模型列表
   */
  async getAvailableModels(config: ModelConfigEntity): Promise<string[]> {
    return await this.langChainService.getAvailableModels(config)
  }

  /**
   * 获取提供商的默认BaseURL
   * @param provider 提供商名称
   * @returns 默认BaseURL
   */
  private getDefaultBaseURL(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'https://api.openai.com/v1'
      case 'claude':
      case 'anthropic':
        return 'https://api.anthropic.com'
      case 'gemini':
      case 'google':
        return 'https://generativelanguage.googleapis.com'
      default:
        return ''
    }
  }

  /**
   * 获取所有模型配置
   * @returns 模型配置列表
   */
  async getAllConfigs(): Promise<ModelConfigEntity[]> {
    return await this.modelManagementService.getAllConfigs()
  }

  /**
   * 保存配置（支持模型配置和提供商配置）
   * @param config 配置实体
   */
  async saveConfig(config: ModelConfigEntity | ProviderConfigEntity): Promise<void> {
    if (config instanceof ProviderConfigEntity) {
      // 将ProviderConfigEntity转换为ModelConfigEntity格式保存
      const modelConfig = new ModelConfigEntity({
        id: config.id,
        name: config.name,
        provider: config.provider,
        model: 'default', // 提供商配置使用default作为模型标识
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        isEnabled: config.isEnabled,
        priority: config.priority,
        status: 'untested' as const,
        createdAt: config.createdAt instanceof Date ? config.createdAt.toISOString() : config.createdAt,
        updatedAt: config.updatedAt instanceof Date ? config.updatedAt.toISOString() : config.updatedAt,
        availableModels: config.availableModels || [],
        enabledModels: config.enabledModels || []
      })
      await this.modelManagementService.saveConfig(modelConfig)
    } else {
      await this.modelManagementService.saveConfig(config)
    }
  }

  /**
   * 删除模型配置
   * @param configId 配置ID
   */
  async deleteConfig(configId: string): Promise<void> {
    await this.modelManagementService.deleteConfig(configId)
  }

  /**
   * 测试配置（支持模型配置和提供商配置）
   * @param config 配置实体
   * @returns 测试结果
   */
  async testConfig(config: ModelConfigEntity | ProviderConfigEntity): Promise<any> {
    try {
      const testRequest: LLMRequest = {
        message: 'Hello! Please respond with just "OK" to confirm the connection.',
        maxTokens: 10
      }

      const startTime = Date.now()
      const response = await this.sendMessageWithConfig(testRequest, config)
      const responseTime = Date.now() - startTime

      return {
        success: true,
        responseTime,
        response: response.content
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  /**
   * 获取默认可用的模型配置
   * @returns 优先级最高的可用模型配置
   */
  async getDefaultConfig(): Promise<ModelConfigEntity | null> {
    const availableConfigs = await this.modelManagementService.getAvailableConfigs()
    if (availableConfigs.length === 0) {
      return null
    }

    // 按优先级排序，返回最高优先级的配置
    availableConfigs.sort((a, b) => b.priority - a.priority)
    return availableConfigs[0]
  }

  /**
   * 使用默认配置发送消息
   * @param request LLM请求对象
   * @returns LLM响应
   */
  async sendMessageWithDefault(request: LLMRequest): Promise<LLMResponse> {
    const defaultConfig = await this.getDefaultConfig()
    if (!defaultConfig) {
      throw new Error('没有可用的模型配置，请先配置至少一个LLM提供商')
    }

    return await this.sendMessageWithConfig(request, defaultConfig)
  }

  /**
   * 刷新指定提供商的模型列表
   * @param configId 配置ID
   * @returns 更新后的模型列表
   */
  async refreshProviderModels(configId: string): Promise<string[]> {
    const config = await this.modelManagementService.getConfigById(configId)
    if (!config) {
      throw new Error(`配置不存在: ${configId}`)
    }

    try {
      // 获取最新的模型列表
      const models = await this.getAvailableModels(config)

      // 这里可以选择是否更新配置中的模型信息
      // 目前ModelConfigEntity主要存储单个模型，如果需要存储模型列表，需要扩展实体

      return models
    } catch (error) {
      console.warn(`刷新 ${config.provider} 模型列表失败:`, error)
      throw error
    }
  }

  /**
   * 批量测试所有启用的配置
   * @returns 测试结果数组
   */
  async testAllEnabledConfigs(): Promise<Array<{configId: string; name: string; result: any}>> {
    const enabledConfigs = await this.modelManagementService.getEnabledConfigs()
    const results = []

    for (const config of enabledConfigs) {
      try {
        const result = await this.testConfig(config)
        results.push({
          configId: config.id,
          name: config.name,
          result
        })
      } catch (error) {
        results.push({
          configId: config.id,
          name: config.name,
          result: {
            success: false,
            error: error instanceof Error ? error.message : '测试失败'
          }
        })
      }
    }

    return results
  }

  /**
   * 获取提供商统计信息
   * @returns 提供商统计
   */
  async getProviderStats(): Promise<{
    total: number;
    enabled: number;
    available: number;
    byProvider: Record<string, number>;
  }> {
    const allConfigs = await this.getAllConfigs()
    const enabledConfigs = await this.modelManagementService.getEnabledConfigs()
    const availableConfigs = await this.modelManagementService.getAvailableConfigs()

    const byProvider: Record<string, number> = {}
    allConfigs.forEach(config => {
      byProvider[config.provider] = (byProvider[config.provider] || 0) + 1
    })

    return {
      total: allConfigs.length,
      enabled: enabledConfigs.length,
      available: availableConfigs.length,
      byProvider
    }
  }

  // ==================== MCP工具集成方法 ====================

  /**
   * 获取MCP服务实例
   */
  getMCPService(): MCPIntegrationService {
    return this.mcpService
  }

  /**
   * 获取所有可用的MCP LangChain工具
   */
  async getMCPTools(): Promise<any[]> {
    try {
      const tools = await this.mcpService.getAllTools()
      // 转换为LangChain工具格式（简化实现）
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        schema: tool.inputSchema,
        serverId: tool.serverId, // 保留serverId用于后续调用
        serverName: tool.serverName, // 保留serverName用于调试
        func: async (args: any) => {
          const response = await this.mcpService.callTool({
            serverId: tool.serverId,
            toolName: tool.name,
            arguments: args
          })
          return response.success ? response.result : response.error
        }
      }))
    } catch (error) {
      console.error('获取MCP工具失败:', error)
      return []
    }
  }

  /**
   * 搜索MCP工具
   */
  async searchMCPTools(query: string): Promise<any[]> {
    try {
      const tools = await this.mcpService.searchTools(query)
      // 转换为LangChain工具格式
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        schema: tool.inputSchema,
        func: async (args: any) => {
          const response = await this.mcpService.callTool({
            serverId: tool.serverId,
            toolName: tool.name,
            arguments: args
          })
          return response.success ? response.result : response.error
        }
      }))
    } catch (error) {
      console.error('搜索MCP工具失败:', error)
      return []
    }
  }

  /**
   * 获取MCP工具使用统计
   */
  async getMCPToolStats(): Promise<any> {
    try {
      return await this.mcpService.getToolUsageStats()
    } catch (error) {
      console.error('获取MCP工具统计失败:', error)
      return {
        totalTools: 0,
        availableTools: 0,
        toolsByServer: {},
        usageStats: {}
      }
    }
  }

  /**
   * 刷新MCP工具缓存
   */
  async refreshMCPTools(): Promise<void> {
    try {
      // 重新发现所有服务器工具
      const servers = await this.mcpService.getAllServers()
      for (const server of servers) {
        if (server.isEnabled) {
          try {
            await this.mcpService.discoverServerTools(server.id)
          } catch (error) {
            console.warn(`刷新服务器工具失败: ${server.name}`, error)
          }
        }
      }
    } catch (error) {
      console.error('刷新MCP工具失败:', error)
    }
  }

  /**
   * 使用MCP工具增强的消息发送（使用LangChain标准工具调用）
   * @param request LLM请求对象
   * @param configId 模型配置ID
   * @param enableMCPTools 是否启用MCP工具
   * @param chatHistory 可选的聊天历史
   */
  async sendMessageWithMCPTools(
    request: LLMRequest,
    configId: string,
    enableMCPTools: boolean = false,
    chatHistory?: ChatMessage[]
  ): Promise<LLMResponse> {
    try {
      // 🤖 静默确保系统角色激活
      await this.ensureSystemRoleActive()

      if (!enableMCPTools) {
        // 不使用MCP工具，直接调用原有方法
        return await this.sendMessage(request, configId, chatHistory)
      }

      log.info(`🔧 [LangChain标准工具调用] 启用MCP工具集成，配置ID: ${configId}`)

      // 🎯 复用sendMessage的智能配置逻辑，支持模型名称和配置ID
      log.info(`🔍 [模型解析] 输入配置ID/模型名: ${configId}`)
      
      let config: ModelConfigEntity | null = null

      try {
        // 首先尝试作为配置ID查找
        config = await this.modelManagementService.getConfigById(configId)
        
        if (!config) {
          // 如果没找到，复用sendMessage的智能配置逻辑
          log.info(`🔧 [智能配置] 配置ID不存在，尝试作为模型名称: ${configId}`)
          
          const allConfigs = await this.modelManagementService.getAllConfigs()
          const enabledConfigs = allConfigs.filter(c => c.isEnabled)
          
          // 查找支持该模型的配置
          const foundConfig = enabledConfigs.find(c => {
            if (c.model === configId) return true
            if (c.enabledModels && c.enabledModels.includes(configId)) return true
            return false
          })
          
          if (foundConfig) {
            // 🔧 重要修复：使用找到的配置，但替换model为用户实际选择的模型
            config = Object.assign(foundConfig, { model: configId })
            // 直接修改现有对象的model字段，避免复杂的类型转换
            log.info(`✅ [智能配置] 找到支持模型的配置: ${foundConfig.name}，使用模型: ${configId}`)
          } else {
            // 使用内置ChatAnywhere配置，复用sendMessage逻辑
            log.info(`🔧 [内置配置] 使用ChatAnywhere默认配置服务模型: ${configId}`)
            
            // 🔧 ChatAnywhere使用OpenAI兼容接口，所有模型都应该使用'openai' provider
            // 即使是Claude模型也通过OpenAI格式调用ChatAnywhere
            const detectedProvider = 'openai'
            log.info(`🔍 [模型识别] ${configId} -> provider: ${detectedProvider}`)
            
            const DEFAULT_CONFIG = {
              id: 'chatanywhere-mcp-default',
              name: 'ChatAnywhere (MCP内置)',
              provider: 'openai', // 🔧 强制使用'openai' - ChatAnywhere使用OpenAI兼容接口
              model: configId,
              apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
              baseURL: 'https://api.chatanywhere.tech/v1/',
              isEnabled: true,
              priority: 10,
              enabledModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-sonnet-4-20250514'],
              status: 'available' as const,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            
            config = new ModelConfigEntity(DEFAULT_CONFIG)
            log.info(`✅ [内置配置] 创建默认配置: ${detectedProvider}/${configId}`)
          }
        }
        
        if (!config) {
          throw new Error(`找不到支持模型 ${configId} 的配置`)
        }

        if (!config.isEnabled) {
          throw new Error(`模型配置已禁用: ${config.name}`)
        }
      } catch (error) {
        log.error(`❌ [配置解析] 配置获取失败: ${configId}`, error)
        throw error
      }

      // 处理附件内容（如果有）
      let enhancedMessage = request.message
      if (request.attachmentIds && request.attachmentIds.length > 0) {
        console.log(`🔗 [附件处理] 处理 ${request.attachmentIds.length} 个附件`)
        
        const fileService = new FileService()
        await fileService.initialize()
        if (fileService) {
          const attachmentContents: string[] = []
          
          for (const attachmentId of request.attachmentIds) {
            try {
              const attachmentContent = await fileService.getAttachmentContent(attachmentId)
              attachmentContents.push(attachmentContent)
              console.log(`✅ [附件处理] 附件 ${attachmentId} 内容获取成功`)
            } catch (error) {
              console.error(`❌ [附件处理] 获取附件 ${attachmentId} 内容失败:`, error)
              attachmentContents.push(`[附件读取失败: ${attachmentId}]`)
            }
          }
          
          if (attachmentContents.length > 0) {
            enhancedMessage = `${request.message}\n\n附件内容:\n${attachmentContents.join('\n\n---\n\n')}`
            console.log(`🔗 [附件处理] 消息已增强，包含 ${attachmentContents.length} 个附件`)
          }
        }
      }

      // 🆕 使用LangChain标准工具调用
      const langchainResponse = await this.langChainService.sendMessageWithMCPTools(
        enhancedMessage,
        config,
        request.systemPrompt,
        true // 启用MCP工具
      )

      log.info(`📊 [LangChain标准工具调用] 响应生成完成，包含工具调用: ${langchainResponse.hasToolCalls}`)

      // 构造标准LLMResponse格式
      const response: LLMResponse = {
        content: langchainResponse.content,
        model: config.model,
        usage: undefined, // LangChain可能不提供详细的usage信息
        finishReason: 'stop'
      }

      // 如果有工具调用，添加工具执行记录
      if (langchainResponse.hasToolCalls && langchainResponse.toolCalls) {
        const toolExecutions = langchainResponse.toolCalls.map((toolCall: any, index: number) => ({
          id: toolCall.id || `tool_${Date.now()}_${index}`,
          toolName: toolCall.name,
          serverId: 'langchain-managed', // LangChain管理的工具调用
          serverName: 'LangChain Standard Tools',
          params: toolCall.args,
          result: toolCall.result || '工具执行完成但无结果返回', // 🔧 使用真实的工具执行结果
          success: true,
          error: undefined,
          duration: 0, // LangChain不提供执行时间
          timestamp: Date.now()
        }))

        response.toolExecutions = toolExecutions
        log.info(`📊 [LangChain标准工具调用] 记录了 ${toolExecutions.length} 个工具执行，结果长度: ${toolExecutions.map(t => (t.result as string).length).join(', ')}`)
      }

      // 更新配置状态为可用
      if (config.status !== 'available') {
        config.updateStatus('available')
        await this.modelManagementService.updateConfig(config)
      }

      return response

    } catch (error) {
      console.error('❌ [LangChain标准工具调用] MCP工具增强消息发送失败:', error)
      
      // 降级到普通模式
      return await this.sendMessage(request, configId, chatHistory)
    }
  }

  /**
   * 清理MCP资源
   */
  async cleanupMCP(): Promise<void> {
    try {
      await this.mcpService.cleanup()
      // 清理功能已整合到cleanup中
    } catch (error) {
      console.error('清理MCP资源失败:', error)
    }
  }


  /**
   * 🤖 静默确保系统角色激活
   * 每次AI对话前调用，保证系统角色始终可用
   */
  private async ensureSystemRoleActive(): Promise<void> {
    try {
      const isActive = await silentSystemRoleManager.ensureSystemRoleActive()
      if (!isActive) {
        console.warn('⚠️ [LLM服务] 系统角色激活失败，继续正常对话流程')
      }
    } catch (error) {
      console.error('❌ [LLM服务] 确保系统角色激活时出错:', error)
      // 不抛出错误，避免影响正常对话
    }
  }
}
