import { LangChainLLMService } from '../../../shared/langchain/LangChainLLMService'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { ProviderConfigEntity } from '../../../shared/entities/ProviderConfigEntity'
import { LLMRequest, LLMResponse } from '../../../shared/interfaces/IModelProvider'
import { ModelService } from '../model/ModelService'
import { MCPIntegrationService } from '../mcp/index.js'
// MCPToolService已删除，功能直接集成到MCPIntegrationService中
// 移除ConversationManager依赖 - 统一使用SmartLayeredPromptSystem
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
    this.langChainService = new LangChainLLMService(undefined, this.mcpService, undefined)
    // mcpToolService功能已整合到mcpService中
    
    // 初始化DeeChat专属提示词系统
    this.initializePromptSystem()
  }

  /**
   * 初始化智能分层提示词系统
   */
  private async initializePromptSystem(): Promise<void> {
    // 智能分层提示词系统已在LangChainLLMService构造函数中初始化
    log.info('✅ [LLM服务] 智能分层提示词系统已就绪')
  }


  // ==================== 智能分层提示词系统（自动处理角色和上下文） ====================

  /**
   * 获取当前系统提示词（调试用）
   * 注意：智能分层系统会自动管理提示词，这里返回基础提示词用于调试
   */
  async getCurrentSystemPrompt(): Promise<string> {
    return 'DeeChat智能AI助手 - 使用智能分层提示词系统，支持角色保持、历史压缩和上下文管理。';
  }



  /**
   * 使用临时配置发送消息（支持模型配置和提供商配置）
   * @param request LLM请求对象
   * @param config 配置实体
   */
  async sendMessageWithConfig(request: LLMRequest, config: ModelConfigEntity | ProviderConfigEntity): Promise<LLMResponse> {
    try {
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
      const langchainResponse = await this.langChainService.sendMessageWithConfig(
        request.message,
        modelConfig,
        request.systemPrompt
      )

      // 检查是否有工具执行信息
      if (langchainResponse.toolExecutions && langchainResponse.toolExecutions.length > 0) {
        log.info(`🔧 [工具执行] 检测到 ${langchainResponse.toolExecutions.length} 个工具调用记录`)
      }

      return {
        content: langchainResponse.content,
        model: langchainResponse.model,
        toolExecutions: langchainResponse.toolExecutions, // 🔧 包含工具执行信息
        usage: langchainResponse.usage || {
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

  // 🗑️ [已删除] sendMessage方法 - 统一使用streamMessage

  /**
   * 🌊 流式发送消息（使用LangChain真实流式API）
   * @param request LLM请求对象
   * @param configId 模型配置ID
   * @param onChunk 处理每个chunk的回调函数
   */
  async streamMessage(
    request: LLMRequest,
    configId: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    // 🔥 添加详细的参数日志
    console.log('🔧 [LLMService.streamMessage] 接收到的参数:');
    console.log('🔧 [LLMService.streamMessage]   - request.message:', request.message?.slice(0, 50));
    console.log('🔧 [LLMService.streamMessage]   - request.activeRole:', request.activeRole);
    console.log('🔧 [LLMService.streamMessage]   - request.sessionId:', request.sessionId);
    console.log('🔧 [LLMService.streamMessage]   - configId:', configId);
    try {
      // 🔄 使用与sendMessage相同的配置获取逻辑（支持降级到内置配置）
      let config: ModelConfigEntity | null = null

      // 先尝试查找用户配置的模型
      const allConfigs = await this.modelManagementService.getAllConfigs()
      const enabledConfigs = allConfigs.filter(c => c.isEnabled)
      
      // 查找支持该模型的配置
      const foundConfig = enabledConfigs.find(c => {
        // 检查配置的默认模型
        if (c.model === configId) return true
        // 检查配置的启用模型列表
        if (c.enabledModels && c.enabledModels.includes(configId)) return true
        return false
      })
      
      if (foundConfig) {
        config = foundConfig
      }
      
      // 如果没有找到用户配置，使用内置的 ChatAnywhere 配置
      if (!config) {
        log.info(`🔧 [流式-内置配置] 使用ChatAnywhere默认配置服务模型: ${configId}`)
        
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
        
        const detectedProvider = detectProviderByModel(configId)
        log.info(`🔍 [流式-模型识别] ${configId} -> provider: ${detectedProvider}`)
        
        // 创建内置默认配置
        const DEFAULT_CONFIG = {
          id: 'chatanywhere-default-stream',
          name: 'ChatAnywhere (流式内置)',
          provider: detectedProvider, // 🎯 使用智能识别的provider
          model: configId, // 使用请求的模型
          apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
          baseURL: 'https://api.chatanywhere.tech/v1/',
          isEnabled: true,
          priority: 10,
          enabledModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-sonnet-4-20250514', 'kimi-k2-0711-preview', 'kimi-latest', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
          status: 'available' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        config = new ModelConfigEntity(DEFAULT_CONFIG)
      }

      log.info(`🌊 [LLM服务] 开始流式消息发送 - 配置: ${config.name}, 模型: ${config.model}`)

      // 🌊 使用LangChainLLMService的真实流式方法
      // 🔥 调试：验证传递给LangChain的参数
      console.log('🚀 [LLMService->LangChain] 调用参数:');
      console.log('🚀 [LLMService->LangChain]   - message:', request.message);
      console.log('🚀 [LLMService->LangChain]   - configId:', configId);
      console.log('🚀 [LLMService->LangChain]   - sessionId:', request.sessionId);
      console.log('🚀 [LLMService->LangChain]   - activeRole:', request.activeRole, '类型:', typeof request.activeRole);
      console.log('🚀 [LLMService->LangChain]   - systemPrompt:', request.systemPrompt ? '有' : '无');
      
      const streamResult = await this.langChainService.streamMessage(
        request.message,
        configId,
        (update) => {
          // 转换StreamUpdate为简单的chunk回调
          if (update.type === 'generating' && update.partialContent && onChunk) {
            // 只在内容更新时调用onChunk
            onChunk(update.partialContent)
          }
        },
        request.sessionId,
        request.activeRole,
        request.systemPrompt,
        undefined, // uiContext
        [] // chatHistory - 这里可以从sessionId获取历史记录
      )

      log.info(`🌊 [LLM服务] 流式消息发送完成 - 内容长度: ${streamResult.length}`)
      return streamResult

    } catch (error) {
      log.error('🌊 [LLM服务] 流式调用失败:', error)
      
      // 🔄 流式方法已修复，不再需要降级机制
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

      // 简单的连接测试
      const testResponse = await this.sendMessageWithConfig({
        message: "测试连接",
        temperature: 0.7,
        maxTokens: 10
      }, config)
      
      // 更新测试结果
      const testResult = { success: true, response: testResponse.content, latency: 0 };
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

      // 批量处理消息 - 使用streamMessage替代
      const responses = await Promise.all(
        requests.map(async req => {
          return await this.streamMessage(req, configId)
        })
      )
      
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
  clearCache(): void {
    this.langChainService.clearCache()
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
      // 🔥 提取角色信息
      const currentRole = legacyConfig.currentRole
      
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

      // 🔥 使用智能分层架构 - 直接调用LangChain服务，传递角色信息
      const sessionId = 'legacy_session'
      const activeRole = currentRole ? currentRole.id : undefined
      
      const langchainResponse = await this.langChainService.sendMessageWithConfig(
        message,
        matchingConfig,
        sessionId,
        activeRole
      )
      
      // 检查是否有工具执行信息
      if (langchainResponse.toolExecutions && langchainResponse.toolExecutions.length > 0) {
        log.info(`🔧 [工具执行] 检测到 ${langchainResponse.toolExecutions.length} 个工具调用记录`)
      }
      
      // 转换为旧格式
      return {
        content: langchainResponse.content,
        model: langchainResponse.model,
        toolExecutions: langchainResponse.toolExecutions, // 🔧 包含工具执行信息
        usage: langchainResponse.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
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

  // 🗑️ [已删除] sendMessageWithMCPTools方法 - 统一使用streamMessage（已内置MCP工具支持）

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


}
