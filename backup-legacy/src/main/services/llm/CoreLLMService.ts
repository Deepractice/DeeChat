import { LLMRequest, LLMResponse } from '../../../shared/interfaces/IModelProvider'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { IConfigManager } from './managers/IConfigManager'
import { IModelManager } from './managers/IModelManager'
import { IPromptBuilder, PromptContext } from './managers/IPromptBuilder'
import { StreamProcessor } from '../streaming/StreamProcessor'
import { StreamChunk, ProcessOptions } from '../../../shared/streaming/StreamTypes'
import { MCPClient } from '../mcp/client/MCPClient'
import log from 'electron-log'

/**
 * CoreLLMService
 * 
 * 统一的底层LLM服务，采用清晰的模块化架构
 * 
 * 设计原则：
 * - 单一职责：每个管理器只负责特定功能
 * - 依赖注入：通过接口实现松耦合
 * - 模块化：功能清晰分离，易于测试和维护
 * - 可扩展：通过接口实现，便于功能扩展
 * 
 * 架构分层：
 * CoreLLMService (协调层)
 * ├── ConfigManager (配置层)
 * ├── ModelManager (模型层)
 * ├── PromptBuilder (提示词层)
 * ├── ToolIntegrator (工具层) - 已简化
 * └── StreamProcessor (执行层)
 */
export class CoreLLMService {
  private configManager: IConfigManager
  private modelManager: IModelManager
  private streamProcessor: StreamProcessor
  private promptBuilder: IPromptBuilder
  private mcpClient: MCPClient

  /**
   * 构造函数 - 依赖注入
   * @param configManager 配置管理器
   * @param modelManager 模型管理器
   * @param streamProcessor 流式处理器
   * @param promptBuilder 提示词构建器
   * @param mcpClient MCP客户端
   */
  constructor(
    configManager: IConfigManager,
    modelManager: IModelManager,
    streamProcessor: StreamProcessor,
    promptBuilder: IPromptBuilder,
    mcpClient: MCPClient
  ) {
    this.configManager = configManager
    this.modelManager = modelManager
    this.streamProcessor = streamProcessor
    this.promptBuilder = promptBuilder
    this.mcpClient = mcpClient

    log.info('✅ [CoreLLMService] 核心LLM服务初始化完成 - 集成MCP工具调用')
  }

  /**
   * 主要服务接口：流式消息处理（已更新支持StreamChunk）
   * 
   * @param request LLM请求
   * @param configId 配置ID
   * @param onChunk 统一流式回调函数
   * @param onStringChunk 向后兼容的字符串回调函数
   * @returns 完整的AI响应
   */
  async streamMessage(
    request: LLMRequest,
    configId: string,
    onChunk?: (chunk: StreamChunk) => void,
    onStringChunk?: (chunk: string) => void
  ): Promise<string> {
    const startTime = Date.now()
    log.info(`🚀 [CoreLLMService] 开始处理流式消息 - 配置: ${configId}, 会话: ${request.sessionId}`)

    try {
      // 1. 获取配置
      const config = await this.configManager.getConfig(configId)
      log.debug(`🔧 [CoreLLMService] 配置获取完成: ${config.name} (${config.provider})`)

      // 2. 获取模型实例
      const model = await this.modelManager.createModel(config)
      log.debug(`🤖 [CoreLLMService] 模型实例创建完成: ${config.model}`)

      // 3. 获取可用工具（重新实现）
      const tools = await this.getAvailableTools()
      log.debug(`🔧 [CoreLLMService] 工具获取完成: ${tools.length} 个工具`)
      
      // 🔍 [调试] 详细输出获取到的工具信息
      console.log(`🔍 [CoreLLM-DEBUG] 获取到 ${tools.length} 个工具:`, tools.map(t => t.name));
      tools.forEach((tool, index) => {
        console.log(`🔍 [CoreLLM-DEBUG] 工具${index + 1}: ${tool.name}`);
        console.log(`  - serverId: ${tool.serverId}`);
        console.log(`  - inputSchema存在: ${!!tool.inputSchema}`);
        console.log(`  - required字段: ${tool.inputSchema?.required || []}`);
      });

      // 4. 获取PromptX角色内容
      let roleContent = ''
      try {
        if (request.activeRole) {
          // 调用PromptX获取角色内容
          roleContent = await this.mcpClient.callTool('promptx-builtin', 'action', { role: request.activeRole })
          log.info(`🎭 [CoreLLMService] PromptX角色获取完成: ${request.activeRole}, 内容长度: ${roleContent.length}`)
        } else {
          // 使用默认角色
          roleContent = await this.mcpClient.callTool('promptx-builtin', 'action', { role: 'deechat-assistant' })
          log.info(`🎭 [CoreLLMService] 使用默认PromptX角色: deechat-assistant`)
        }
      } catch (error) {
        log.error(`❌ [CoreLLMService] PromptX角色获取失败:`, error)
        // 使用简化的默认身份
        roleContent = '我是您的智能AI助手，专注于理解和满足您的需求。'
      }

      // 5. 构建提示词上下文
      const promptContext: PromptContext = {
        request,
        config,
        tools,
        chatHistory: [],
        uiContext: {
          selectedRole: request.activeRole,
          roleActivationRequest: !!request.activeRole,
        },
        conversationContext: {
          sessionId: request.sessionId || `session_${Date.now()}`,
          modelId: config.model,
          roleId: request.activeRole,
          timestamp: new Date(),
          metadata: {}
        }
      }

      // 6. 使用新的统一架构构建消息
      const buildResult = await this.promptBuilder.buildFromRole(roleContent, promptContext)
      log.debug(`📝 [CoreLLMService] 提示词构建完成: ${buildResult.messages.length} 条消息`)

      // 7. 绑定工具到模型（重新实现）
      const modelWithTools = await this.bindToolsToModel(model, tools)

      // 8. 执行新的流式处理
      const processOptions: ProcessOptions = {
        sessionId: request.sessionId || `session_${Date.now()}`,
        onChunk,
        signal: undefined
      }

      const response = await this.streamProcessor.process(
        modelWithTools,
        buildResult.messages,
        processOptions
      )

      const duration = Date.now() - startTime
      log.info(`✅ [CoreLLMService] 流式处理完成 - 耗时: ${duration}ms, 响应长度: ${response.length}`)

      return response

    } catch (error) {
      const duration = Date.now() - startTime
      log.error(`❌ [CoreLLMService] 流式处理失败 - 耗时: ${duration}ms`, error)
      throw error
    }
  }

  /**
   * 批量消息处理
   * 
   * @param requests 请求列表
   * @param configId 配置ID
   * @returns 响应列表
   */
  async batchMessages(requests: LLMRequest[], configId: string): Promise<LLMResponse[]> {
    log.info(`🔄 [CoreLLMService] 开始批量处理 - ${requests.length} 个请求`)

    const results: LLMResponse[] = []

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      try {
        const content = await this.streamMessage(request, configId)
        results.push({
          content,
          model: configId,
          finishReason: 'stop'
        })
        log.debug(`✅ [CoreLLMService] 批量处理进度: ${i + 1}/${requests.length}`)
      } catch (error) {
        results.push({
          content: '',
          model: configId,
          finishReason: 'error'
        })
        log.error(`❌ [CoreLLMService] 批量处理失败: ${i + 1}/${requests.length}`, error)
      }
    }

    log.info(`🔄 [CoreLLMService] 批量处理完成 - 成功: ${results.filter(r => r.finishReason !== 'error').length}/${requests.length}`)
    return results
  }

  /**
   * 测试Provider连接
   * 
   * @param configId 配置ID
   * @returns 测试结果
   */
  async testProvider(configId: string): Promise<{ success: boolean; error?: string }> {
    log.info(`🔍 [CoreLLMService] 开始测试Provider: ${configId}`)

    try {
      // 1. 获取配置
      const config = await this.configManager.getConfig(configId)
      
      // 2. 使用ModelManager进行测试
      const result = await this.modelManager.testModel(config)
      
      if (result.success) {
        log.info(`✅ [CoreLLMService] Provider测试成功: ${configId}`)
      } else {
        log.warn(`⚠️ [CoreLLMService] Provider测试失败: ${configId} - ${result.error}`)
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      log.error(`❌ [CoreLLMService] Provider测试异常: ${configId}`, error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * 获取可用模型列表
   * 
   * @param config 模型配置
   * @returns 模型列表
   */
  async getAvailableModels(config: ModelConfigEntity): Promise<string[]> {
    log.info(`📋 [CoreLLMService] 获取可用模型列表: ${config.provider}`)

    try {
      const models = await this.modelManager.getModelCapabilities(config)
      log.info(`📋 [CoreLLMService] 获取到 ${models.length} 个可用模型`)
      return models
    } catch (error) {
      log.error(`❌ [CoreLLMService] 获取模型列表失败`, error)
      return []
    }
  }

  /**
   * 获取当前系统提示词（调试用）
   * 
   * @returns 系统提示词
   */
  async getCurrentSystemPrompt(): Promise<string> {
    return 'DeeChat CoreLLMService - 统一底层LLM服务，支持角色保持、历史压缩、工具集成和上下文管理'
  }

  /**
   * 兼容性方法：支持旧的sendMessageLegacy接口
   */
  async sendMessageLegacy(message: string, config: any): Promise<any> {
    log.info('🔄 [CoreLLMService] sendMessageLegacy兼容性调用')
    
    try {
      // 转换为LLMRequest格式
      const request: LLMRequest = {
        message,
        sessionId: config.sessionId || `legacy_${Date.now()}`,
        activeRole: config.currentRole?.id,
        systemPrompt: config.systemPrompt
      }

      const configId = config.configId || 'default'
      
      const response = await this.streamMessage(request, configId)
      return { content: response }
    } catch (error) {
      log.error('❌ [CoreLLMService] sendMessageLegacy失败:', error)
      throw error
    }
  }

  /**
   * 清理所有缓存
   */
  clearCache(): void {
    log.info('🧹 [CoreLLMService] 开始清理缓存')
    
    this.configManager.clearCache()
    this.modelManager.clearCache()
    this.promptBuilder.clearCache()
    
    log.info('🧹 [CoreLLMService] 缓存清理完成')
  }

  /**
   * 获取服务状态
   * 
   * @returns 服务状态信息
   */
  getStatus(): {
    isReady: boolean
    configCacheSize: number
    modelCacheSize: number
    promptStats: any
    toolStats: any
  } {
    const modelCache = this.modelManager.getCacheStats()
    const promptStats = this.promptBuilder.getStats()
    // const toolStats = this.toolIntegrator.getToolUsageStats() // 已删除
    const toolStats = { totalCalls: 0, successRate: 0, averageDuration: 0, topTools: [] }

    return {
      isReady: true,
      configCacheSize: 0,
      modelCacheSize: modelCache.size,
      promptStats,
      toolStats
    }
  }

  /**
   * 中断处理
   * 
   * @param sessionId 会话ID
   */
  interrupt(sessionId: string): void {
    log.info(`⏹️ [CoreLLMService] 中断处理: ${sessionId}`)
    this.streamProcessor.interrupt(sessionId)
  }

  /**
   * 获取处理状态
   * 
   * @param sessionId 会话ID
   * @returns 处理状态
   */
  getProcessingStatus(sessionId: string): {
    isProcessing: boolean
    startTime?: Date
    progress?: number
  } {
    return this.streamProcessor.getStatus(sessionId)
  }

  // ensureStreamProcessorHasToolIntegrator 方法已删除，工具集成已简化

  /**
   * 清理资源
   */
  cleanup(): void {
    log.info('🧹 [CoreLLMService] 开始清理资源')
    
    this.clearCache()
    this.streamProcessor.cleanup()
    
    log.info('🧹 [CoreLLMService] 资源清理完成')
  }

  /**
   * 获取可用工具列表
   * @private
   */
  private async getAvailableTools(): Promise<any[]> {
    try {
      // 🔥 修复：从MCP客户端获取已连接的服务器列表
      const connectedServerIds = this.mcpClient.getConnectedServers()
      log.info(`🔍 [CoreLLMService-DEBUG] 发现 ${connectedServerIds.length} 个已连接的MCP服务器: ${connectedServerIds.join(', ')}`)
      
      const allTools: any[] = []

      for (const serverId of connectedServerIds) {
        try {
          log.info(`📡 [CoreLLMService-DEBUG] 正在从服务器 ${serverId} 获取工具列表...`)
          const tools = await this.mcpClient.listTools(serverId)
          log.info(`📡 [CoreLLMService-DEBUG] 从服务器 ${serverId} 获取到 ${tools.length} 个原始工具`)
          
          const convertedTools = tools.map(tool => ({
            name: `${serverId}__${tool.name}`, // 添加服务器前缀避免冲突
            description: tool.description,
            inputSchema: tool.inputSchema,
            serverId: serverId,
            originalName: tool.name
          }))
          allTools.push(...convertedTools)
          log.info(`📄 [CoreLLMService-DEBUG] 从服务器 ${serverId} 转换后得到 ${convertedTools.length} 个工具`)
        } catch (error) {
          log.error(`❌ [CoreLLMService-DEBUG] 获取服务器 ${serverId} 的工具失败:`, error)
        }
      }

      log.info(`🛠️ [CoreLLMService-DEBUG] 总共获取 ${allTools.length} 个可用工具`)
      return allTools
    } catch (error) {
      log.error(`❌ [CoreLLMService-DEBUG] 获取工具列表失败:`, error)
      return []
    }
  }

  /**
   * 绑定工具到模型
   * @private
   */
  private async bindToolsToModel(model: any, tools: any[]): Promise<any> {
    if (tools.length === 0) {
      log.debug(`🔧 [CoreLLMService] 无工具需要绑定`)
      return model
    }

    try {
      // 🚨 使用MCPToolConverter正确转换工具，确保schema格式正确
      const { MCPToolConverter } = await import('../../../shared/langchain/MCPToolConverter')
      const mcpService = {
        getAllTools: async () => {
          // 将内部工具格式转换为MCPTool格式
          return tools.map(tool => ({
            name: tool.originalName,
            description: tool.description,
            inputSchema: tool.inputSchema,
            serverId: tool.serverId,
            serverName: tool.serverId
          }))
        },
        callTool: async (request: any) => {
          const response = await this.mcpClient.callTool(request.serverId, request.toolName, request.arguments)
          return {
            success: true,
            result: response
          }
        }
      }

      const mcpToolConverter = new MCPToolConverter(mcpService)

      // 转换MCP工具为LangChain标准格式
      const langchainTools = await mcpToolConverter.convertAllMCPTools()
      
      log.info(`🔧 [CoreLLMService] MCPToolConverter转换完成: ${langchainTools.length} 个工具`)
      
      // 🚨 调试：查看转换后的工具信息
      if (langchainTools.length > 0) {
        log.info(`🔍 [CoreLLMService] 转换后的工具列表:`)
        console.log(`🔍 [CoreLLMService-DEBUG] 开始分析 ${langchainTools.length} 个LangChain工具:`);
        
        langchainTools.forEach((tool, index) => {
          log.info(`🔍 [CoreLLMService] 工具 ${index + 1}: ${tool.name}`)
          log.info(`🔍 [CoreLLMService] - 描述: ${tool.description || '无描述'}`)
          log.info(`🔍 [CoreLLMService] - schema存在: ${!!tool.schema}`)
          
          console.log(`🔍 [CoreLLMService-DEBUG] 工具 ${index + 1}:`);
          console.log(`🔍 [CoreLLMService-DEBUG] - 名称: ${tool.name}`);
          console.log(`🔍 [CoreLLMService-DEBUG] - 描述: ${tool.description || '无描述'}`);
          console.log(`🔍 [CoreLLMService-DEBUG] - schema存在: ${!!tool.schema}`);
          
          if (tool.schema) {
            try {
              // 尝试获取schema的详细信息
              const schemaInfo = typeof tool.schema._def === 'object' ? 
                JSON.stringify(tool.schema._def, null, 2) : 'Schema结构复杂';
              console.log(`🔍 [CoreLLMService-DEBUG] - schema详情: ${schemaInfo.substring(0, 300)}...`);
            } catch (error) {
              console.log(`🔍 [CoreLLMService-DEBUG] - schema解析失败: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        })
      }

      // 🚀 尝试使用原生工具绑定方式解决参数传递问题
      if (langchainTools.length > 0) {
        log.info(`🔧 [CoreLLMService] 绑定 ${langchainTools.length} 个工具到模型`)
        
        // 🚨 尝试不同的工具绑定方式
        console.log(`🔧 [CoreLLMService-ToolBinding] 开始分析工具绑定问题`);
        
        try {
          // 方式1：直接使用bindTools (当前方式)
          const modelWithTools = model.bindTools(langchainTools);
          console.log(`✅ [CoreLLMService-ToolBinding] bindTools调用成功`);
          return modelWithTools;
        } catch (error) {
          console.error(`❌ [CoreLLMService-ToolBinding] bindTools失败:`, error);
          // 如果bindTools失败，返回原模型
          return model;
        }
      }
      
      log.info(`🔧 [CoreLLMService] 无工具需要绑定`)
      return model
    } catch (error) {
      log.error(`❌ [CoreLLMService] 工具绑定失败:`, error)
      return model
    }
  }

  /**
   * 创建统一的流式回调函数
   * @private
   */
  private createUnifiedStreamCallback(
    onChunk?: (chunk: StreamChunk) => void, 
    onStringChunk?: (chunk: string) => void,
    sessionId?: string
  ): (chunk: StreamChunk) => void {
    return (chunk: StreamChunk) => {
      // 1. 调用新的StreamChunk回调
      if (onChunk) {
        onChunk(chunk)
      }

      // 2. 向后兼容：对于文本块调用旧的字符串回调
      if (onStringChunk && chunk.type === 'text') {
        onStringChunk(chunk.content)
      }

      // 3. 记录调试信息
      if (process.env.NODE_ENV === 'development') {
        log.debug(`🌊 [CoreLLMService] StreamChunk: ${chunk.type}, Session: ${sessionId}`)
      }
    }
  }
}