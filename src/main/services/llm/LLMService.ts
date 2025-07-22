import { LangChainLLMService } from '../../../shared/langchain/LangChainLLMService'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { ProviderConfigEntity } from '../../../shared/entities/ProviderConfigEntity'
import { LLMRequest, LLMResponse } from '../../../shared/interfaces/IModelProvider'
import { ModelService } from '../model/ModelService'
import { MCPIntegrationService } from '../mcp/MCPIntegrationService.js'
import { MCPToolService } from '../mcp/MCPToolService.js'

/**
 * LLM服务
 * 基于LangChain框架的统一LLM服务接口，替代UnifiedLLMService
 */
export class LLMService {
  private langChainService: LangChainLLMService
  private modelManagementService: ModelService
  private mcpService: MCPIntegrationService
  private mcpToolService: MCPToolService

  constructor() {
    this.langChainService = new LangChainLLMService()
    this.modelManagementService = new ModelService()
    this.mcpService = MCPIntegrationService.getInstance()
    this.mcpToolService = new MCPToolService(this.mcpService)
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
   * 发送消息到AI模型（使用LangChain）
   * @param request LLM请求对象
   * @param modelId 模型ID（可以是纯配置ID或组合ID：configId-modelName）
   */
  async sendMessage(request: LLMRequest, modelId: string): Promise<LLMResponse> {
    // 解析模型ID，支持组合ID格式：configId-modelName
    let configId: string
    let specificModel: string | undefined

    // UUID格式：xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12字符，用-分隔成5部分)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    const uuidMatch = modelId.match(uuidPattern)

    if (uuidMatch) {
      const uuid = uuidMatch[0]
      const remaining = modelId.substring(uuid.length)

      if (remaining.startsWith('-')) {
        // 组合ID格式：configId-modelName
        configId = uuid
        specificModel = remaining.substring(1) // 去掉开头的-
      } else {
        // 纯UUID
        configId = uuid
      }
    } else {
      // 不是UUID格式，直接使用
      configId = modelId
    }

    console.log(`解析模型ID: ${modelId} -> 配置ID: ${configId}, 指定模型: ${specificModel}`)

    try {
      // 获取模型配置
      let config = await this.modelManagementService.getConfigById(configId)
      
      // 🔥 兜底策略：如果配置ID不存在，可能是旧版本保存的模型名称，尝试查找支持该模型的配置
      if (!config && !uuidMatch) {
        console.log(`🔍 [兜底] configId "${configId}" 不是UUID格式，尝试查找支持模型的配置...`)
        
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
          console.log(`✅ [兜底] 找到支持模型 "${configId}" 的配置: ${config.name} (${config.id})`)
          // 使用原始的configId作为specificModel
          specificModel = configId
        }
      }
      
      if (!config) {
        throw new Error(`模型配置不存在: ${configId}`)
      }

      if (!config.isEnabled) {
        throw new Error(`模型配置已禁用: ${config.name}`)
      }

      // 如果指定了特定模型，使用sendMessageWithConfig方法
      let content: string
      if (specificModel) {
        // 创建一个临时配置副本，使用指定的模型
        const tempConfig = new ModelConfigEntity({
          ...config.toData(),
          model: specificModel
        })
        console.log(`使用指定模型: ${specificModel}`)

        // 直接使用临时配置发送消息
        content = await this.langChainService.sendMessageWithConfig(
          request.message,
          tempConfig,
          request.systemPrompt
        )
      } else {
        // 使用默认配置发送消息
        this.langChainService.setConfig(configId, config)
        content = await this.langChainService.sendMessage(
          request.message,
          configId,
          request.systemPrompt
        )
      }
      
      // 构造响应对象
      const response: LLMResponse = {
        content,
        model: config.model,
        usage: undefined, // LangChain可能不提供详细的usage信息
        finishReason: 'stop'
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
      try {
        const errorConfig = await this.modelManagementService.getConfigById(configId)
        if (errorConfig) {
          errorConfig.updateStatus('error', error instanceof Error ? error.message : '未知错误')
          await this.modelManagementService.updateConfig(errorConfig)
        }
      } catch (updateError) {
        console.error('更新配置状态失败:', updateError)
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
      return await this.mcpToolService.getAllLangChainTools()
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
      return await this.mcpToolService.searchLangChainTools(query)
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
      return await this.mcpToolService.getToolUsageStats()
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
      await this.mcpToolService.refreshTools()
    } catch (error) {
      console.error('刷新MCP工具失败:', error)
    }
  }

  /**
   * 使用MCP工具增强的消息发送
   * @param request LLM请求对象
   * @param configId 模型配置ID
   * @param enableMCPTools 是否启用MCP工具
   */
  async sendMessageWithMCPTools(
    request: LLMRequest,
    configId: string,
    enableMCPTools: boolean = false
  ): Promise<LLMResponse> {
    try {
      if (!enableMCPTools) {
        // 不使用MCP工具，直接调用原有方法
        return await this.sendMessage(request, configId)
      }

      // 获取可用的MCP工具
      const mcpTools = await this.getMCPTools()
      console.log(`[LangChain Integration] 获取到 ${mcpTools.length} 个MCP工具`)

      if (mcpTools.length === 0) {
        // 没有可用工具，使用普通模式
        return await this.sendMessage(request, configId)
      }

      // 构建工具描述的系统提示词
      const toolDescriptions = mcpTools.map(tool => {
        return `- ${tool.name}: ${tool.description}`
      }).join('\n')

      const systemPrompt = `你是一个智能助手，可以使用以下工具来帮助用户：

可用工具：
${toolDescriptions}

使用工具的格式：
当你需要使用工具时，请按以下格式回复：
[TOOL_CALL]
工具名称: tool_name
参数: {"param1": "value1", "param2": "value2"}
[/TOOL_CALL]

如果不需要使用工具，请直接回复用户的问题。

${request.systemPrompt || ''}`

      // 使用增强的系统提示词发送消息
      const enhancedRequest = {
        ...request,
        systemPrompt
      }

      const response = await this.sendMessage(enhancedRequest, configId)

      // 检查响应中是否包含工具调用
      const toolCallMatch = response.content.match(/\[TOOL_CALL\]([\s\S]*?)\[\/TOOL_CALL\]/g)

      // 初始化工具调用记录数组
      const toolExecutions: Array<{
        id: string
        toolName: string
        params: any
        result?: any
        error?: string
        duration?: number
        timestamp: number
      }> = []

      if (toolCallMatch) {
        console.log(`[LangChain Integration] 检测到 ${toolCallMatch.length} 个工具调用`)

        // 处理工具调用
        let finalContent = response.content

        for (const toolCall of toolCallMatch) {
          const executionId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const startTime = Date.now()

          try {
            // 解析工具调用
            const toolNameMatch = toolCall.match(/工具名称:\s*([^\n]+)/)
            const paramsMatch = toolCall.match(/参数:\s*({[\s\S]*?})/)

            if (toolNameMatch && paramsMatch) {
              const toolName = toolNameMatch[1].trim()
              const params = JSON.parse(paramsMatch[1])

              console.log(`[LangChain Integration] 调用工具: ${toolName}`, params)

              // 查找对应的MCP工具
              const mcpTool = mcpTools.find(tool => tool.name.includes(toolName))
              if (mcpTool) {
                // 调用MCP工具
                const toolResult = await mcpTool._call(JSON.stringify(params))
                const duration = Date.now() - startTime
                console.log(`[LangChain Integration] 工具执行结果:`, toolResult)

                // 记录工具执行信息
                toolExecutions.push({
                  id: executionId,
                  toolName,
                  params,
                  result: toolResult,
                  duration,
                  timestamp: startTime
                })

                // 从AI回复中移除工具调用标记，保持回复内容的纯净
                finalContent = finalContent.replace(toolCall, '')
              }
            }
          } catch (error) {
            const duration = Date.now() - startTime
            console.error(`[LangChain Integration] 工具调用失败:`, error)

            // 记录工具执行错误
            toolExecutions.push({
              id: executionId,
              toolName: toolCallMatch[0]?.match(/工具名称:\s*([^\n]+)/)?.[1]?.trim() || 'unknown',
              params: {},
              error: error instanceof Error ? error.message : '未知错误',
              duration,
              timestamp: startTime
            })

            // 从AI回复中移除工具调用标记
            finalContent = finalContent.replace(toolCall, '')
          }
        }

        // 清理多余的空行
        response.content = finalContent.replace(/\n{3,}/g, '\n\n').trim()
      }

      // 返回增强的响应对象，包含工具执行记录
      return {
        ...response,
        toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined
      }

    } catch (error) {
      console.error('MCP工具增强消息发送失败:', error)
      // 降级到普通模式
      return await this.sendMessage(request, configId)
    }
  }

  /**
   * 清理MCP资源
   */
  async cleanupMCP(): Promise<void> {
    try {
      await this.mcpService.cleanup()
      this.mcpToolService.clearCache()
    } catch (error) {
      console.error('清理MCP资源失败:', error)
    }
  }
}
