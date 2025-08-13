import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { LangChainModelFactory } from './LangChainModelFactory';
import { ModelConfigEntity } from '../entities/ModelConfigEntity';
import { MCPToolConverter } from './MCPToolConverter';
import { SmartLayeredPromptSystem, ConversationContext, UIInjectionContext } from './SmartLayeredPromptSystem';
import { MCPToolEntity } from '../entities/MCPToolEntity';
import { ToolExecution } from '../types';
import { LLMResponse } from '../interfaces/IModelProvider';
import log from 'electron-log';


interface MCPToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: any;
}

interface MCPToolCallResponse {
  success: boolean;
  result?: any;
  error?: string;
}

// MCP服务接口（注入依赖）
interface MCPIntegrationServiceInterface {
  getAllTools(): Promise<MCPToolEntity[]>;
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;
}

/**
 * 智能分层LangChain LLM服务
 * 集成SmartLayeredPromptSystem，提供智能的上下文管理和提示词生成
 */
export class LangChainLLMService {
  private modelCache: Map<string, BaseChatModel> = new Map();
  private configCache: Map<string, ModelConfigEntity> = new Map();
  private mcpService?: MCPIntegrationServiceInterface;
  private mcpToolConverter?: MCPToolConverter;
  
  // 智能分层提示词系统
  private smartPromptSystem: SmartLayeredPromptSystem;
  
  // 会话管理
  private sessionContexts: Map<string, ConversationContext> = new Map();

  constructor(
    _configService?: any,
    mcpService?: MCPIntegrationServiceInterface,
    promptSystemConfig?: any
  ) {
    this.mcpService = mcpService;
    
    // 🔧 添加MCP服务状态调试
    if (this.mcpService) {
      log.info('✅ [LangChain构造] MCP服务已注入，类型:', typeof this.mcpService);
      this.mcpToolConverter = new MCPToolConverter(this.mcpService);
    } else {
      log.warn('⚠️ [LangChain构造] MCP服务未注入，工具调用将不可用');
    }
    
    // 初始化智能分层提示词系统
    const llmFactory = async (modelKey: string) => {
      const config = await this.getDefaultConfig(modelKey);
      return LangChainModelFactory.createChatModel(config);
    };
    
    this.smartPromptSystem = new SmartLayeredPromptSystem(promptSystemConfig, llmFactory);
    
    log.info('🎯 [LangChain服务] 智能分层LangChain LLM服务初始化完成');
  }


  /**
   * 统一的消息发送方法（支持MCP工具调用）
   * @param message 用户消息
   * @param configId 模型配置ID
   * @param sessionId 会话ID（可选）
   * @param activeRole 当前激活的角色（可选）
   * @param baseSystemPrompt 基础系统提示词（可选）
   * @param uiContext UI上下文（可选）
   * @returns 模型响应
   */
  /**
   * 从LangChain响应中提取工具调用信息
   */
  private extractToolExecutions(response: any): ToolExecution[] {
    const executions: ToolExecution[] = [];
    
    if (response.tool_calls && Array.isArray(response.tool_calls)) {
      response.tool_calls.forEach((toolCall: any, index: number) => {
        const execution: ToolExecution = {
          id: toolCall.id || `tool_${Date.now()}_${index}`,
          toolName: toolCall.name || toolCall.function?.name || 'unknown',
          serverId: 'langchain', // LangChain管理的工具
          serverName: 'LangChain',
          params: toolCall.args || toolCall.function?.arguments || {},
          result: toolCall.result || null,
          success: !toolCall.error,
          error: toolCall.error || undefined,
          duration: toolCall.duration || undefined,
          timestamp: Date.now()
        };
        executions.push(execution);
      });
    }
    
    // 检查additional_kwargs中的工具调用信息（某些模型可能使用这种格式）
    if (response.additional_kwargs?.tool_calls) {
      response.additional_kwargs.tool_calls.forEach((toolCall: any, index: number) => {
        const execution: ToolExecution = {
          id: toolCall.id || `tool_${Date.now()}_${index + 1000}`,
          toolName: toolCall.function?.name || 'unknown',
          serverId: 'langchain',
          serverName: 'LangChain', 
          params: toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {},
          result: null, // 工具调用结果通常在后续消息中
          success: true, // 假设调用成功，除非有错误信息
          timestamp: Date.now()
        };
        executions.push(execution);
      });
    }
    
    log.debug(`🔧 [工具提取] 从LangChain响应中提取到 ${executions.length} 个工具调用`);
    return executions;
  }

  async sendMessageWithMCPTools(
    message: string,
    configId: string,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext
  ): Promise<LLMResponse> {
    // 如果没有提供sessionId，生成一个临时的
    const finalSessionId = sessionId || `temp_${Date.now()}`;
    
    console.log('🔧 [统一消息发送] 方法被调用');
    console.log('🔧 [统一消息发送] mcpToolConverter存在:', !!this.mcpToolConverter);
    console.log('🔧 [统一消息发送] mcpService存在:', !!this.mcpService);

    console.log('🔧 [统一消息发送] 开始获取模型和配置');
    const modelConfig = await this.getModelConfig(configId);
    console.log('🔧 [统一消息发送] 模型和配置获取完成');

    // 构建会话上下文
    const conversationContext: ConversationContext = this.buildConversationContext(
      finalSessionId,
      modelConfig.model,
      activeRole
    );
    log.info(`🎯 [LangChain] 会话上下文已构建 - sessionId: ${finalSessionId.slice(0, 8)}, 角色: ${activeRole || '未选择'}, 模型: ${modelConfig.model}`);

    // 获取MCP工具（如果有的话）
    const mcpTools = this.mcpService ? await this.mcpService.getAllTools() : [];
    log.info(`🔧 [MCP工具] 获取到 ${mcpTools.length} 个MCP工具`);
    if (mcpTools.length > 0) {
      log.info(`🔧 [MCP工具列表] ${mcpTools.map(tool => tool.name).join(', ')}`);
    }

    // 🔧 构建UI注入上下文，传递角色选择信息
    const uiInjectionContext: UIInjectionContext = {
      selectedRole: activeRole, // 从参数传递的当前激活角色
      roleActivationRequest: !!activeRole, // 如果有角色就需要激活
      ...uiContext // 合并其他UI上下文（如果有的话）
    };

    // 使用智能分层系统构建消息 (mcpTools是MCPToolEntity[]格式)
    const promptResponse = await this.smartPromptSystem.buildMessages(
      message,
      conversationContext,
      baseSystemPrompt || '',
      mcpTools, // availableTools (MCPToolEntity[])
      uiInjectionContext
    );

    log.info(`📝 [LangChain] 智能提示词构建完成 - tokens: ${promptResponse.totalTokens}, 压缩: ${promptResponse.compressionTriggered}, 消息数: ${promptResponse.messages.length}`);

    // 决定是否使用工具绑定的模型
    let model: any;
    if (this.mcpToolConverter && mcpTools.length > 0) {
      // 有MCP工具时，使用带工具的模型
      const baseModel = await this.getModel(configId);
      model = await this.mcpToolConverter.bindToolsToModel(baseModel);
      console.log('🔧 [统一消息发送] 使用带MCP工具的模型');
    } else {
      // 没有MCP工具时，使用普通模型
      model = await this.getModel(configId);
      console.log('🔧 [统一消息发送] 使用普通模型');
    }

    // 🔥 实现完整的LangChain工具调用循环
    let messages = [...promptResponse.messages];
    
    log.info(`🚀 [第一次模型调用] 开始调用模型，消息数: ${messages.length}`);
    log.info(`🚀 [第一次模型调用] 系统提示词长度: ${messages[0] ? (messages[0].content as string).length : 0} 字符`);
    
    console.log('🚀 [DeeChat调试] 第一次模型调用开始，消息数:', messages.length);
    console.log('🚀 [DeeChat调试] 系统提示词长度:', messages[0] ? (messages[0].content as string).length : 0, '字符');
    
    let currentResponse = await model.invoke(messages);
    let finalAIResponse = currentResponse.content as string;
    let toolExecutions: any[] = [];
    
    log.info(`✅ [第一次模型调用] 完成，响应长度: ${finalAIResponse.length} 字符`);
    console.log('✅ [DeeChat调试] 第一次模型调用完成，响应长度:', finalAIResponse.length, '字符');

    // 检查是否有工具调用请求
    if (currentResponse.tool_calls && currentResponse.tool_calls.length > 0) {
      log.info(`🔧 [工具调用循环] 检测到 ${currentResponse.tool_calls.length} 个工具调用请求`);
      console.log('🔧 [DeeChat调试] 检测到工具调用请求，数量:', currentResponse.tool_calls.length);
      
      // 执行工具调用并收集结果
      const toolResults: any[] = [];
      for (const toolCall of currentResponse.tool_calls) {
        const startTime = Date.now();
        try {
          log.info(`🔧 [工具执行] 执行工具: ${toolCall.name}`);
          
          // 直接通过MCP服务调用工具
          const mcpResponse = await this.mcpService?.callTool({
            serverId: toolCall.name.startsWith('promptx_') ? 'promptx-builtin' : 'file-operations-builtin',
            toolName: toolCall.name,
            arguments: toolCall.args
          });
          
          const duration = Date.now() - startTime;
          const toolResult = mcpResponse?.success ? mcpResponse.result : 
                            (mcpResponse?.error || 'Tool execution failed');

          const execution = {
            id: toolCall.id || `tool_${Date.now()}`,
            toolName: toolCall.name,
            serverId: 'langchain',
            serverName: 'LangChain',
            params: toolCall.args,
            result: typeof toolResult === 'string' ? toolResult : 
                   (toolResult?.result || JSON.stringify(toolResult)),
            success: true,
            duration: duration,
            timestamp: Date.now()
          };
          
          toolResults.push(execution);
          toolExecutions.push(execution);
          
          log.info(`✅ [工具执行] 工具 ${toolCall.name} 执行成功`);
        } catch (error) {
          const duration = Date.now() - startTime;
          log.error(`❌ [工具执行] 工具 ${toolCall.name} 执行失败:`, error);
          
          const execution = {
            id: toolCall.id || `tool_${Date.now()}`,
            toolName: toolCall.name,
            serverId: 'langchain',
            serverName: 'LangChain',
            params: toolCall.args,
            result: null,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: duration,
            timestamp: Date.now()
          };
          
          toolExecutions.push(execution);
        }
      }

      // 🔥 检查是否有角色激活工具，如果有则进行内容注入
      log.info(`🔍 [工具调用检查] 检查 ${toolResults.length} 个工具调用结果`);
      toolResults.forEach((tool, index) => {
        log.info(`🔍 [工具详情${index}] 工具名: ${tool.toolName}, 有结果: ${!!tool.result}, 结果类型: ${typeof tool.result}`);
        if (tool.result && typeof tool.result === 'string' && tool.result.length > 100) {
          log.info(`🔍 [工具结果${index}] 结果长度: ${tool.result.length}, 前100字符: ${tool.result.substring(0, 100)}`);
        }
      });
      
      const roleActivationTool = toolResults.find(tool => tool.toolName === 'promptx_action');
      log.info(`🎭 [角色激活检测] 查找promptx_action工具: ${roleActivationTool ? '找到' : '未找到'}`);
      console.log('🎭 [DeeChat调试] 角色激活工具查找结果:', roleActivationTool ? '找到' : '未找到');
      
      if (roleActivationTool && roleActivationTool.result) {
        log.info(`🎭 [角色激活检测] 发现角色激活工具调用，开始内容重新注入流程`);
        log.info(`🎭 [角色内容长度] 角色内容大小: ${JSON.stringify(roleActivationTool.result).length} 字符`);
        console.log('🎭 [DeeChat调试] 发现角色激活工具，角色内容大小:', JSON.stringify(roleActivationTool.result).length, '字符');
        
        // 🔥 使用工具调用结果重新构建消息（关键步骤）
        const enhancedPromptResponse = await this.smartPromptSystem.buildMessagesWithToolResults(
          message,
          conversationContext,
          toolResults, // 传递实际的工具执行结果
          baseSystemPrompt || '',
          mcpTools,
          uiInjectionContext
        );
        
        log.info(`🔄 [重新注入] 角色内容已注入，重新调用模型生成真正的角色化响应`);
        log.info(`🔄 [重新注入] 增强后系统提示词长度: ${enhancedPromptResponse.messages[0] ? (enhancedPromptResponse.messages[0].content as string).length : 0} 字符`);
        
        // 🔥 第二次调用模型（这次AI具有真正的角色身份）
        log.info(`🚀 [第二次模型调用] 开始调用模型，使用角色增强上下文`);
        console.log('🚀 [DeeChat调试] 第二次模型调用开始！使用角色增强上下文');
        console.log('🚀 [DeeChat调试] 增强后系统提示词长度:', enhancedPromptResponse.messages[0] ? (enhancedPromptResponse.messages[0].content as string).length : 0, '字符');
        
        currentResponse = await model.invoke(enhancedPromptResponse.messages);
        finalAIResponse = currentResponse.content as string;
        
        log.info(`✅ [第二次模型调用] 完成，最终响应长度: ${finalAIResponse.length} 字符`);
        console.log('✅ [DeeChat调试] 第二次模型调用完成！最终响应长度:', finalAIResponse.length, '字符');
        
        // 更新会话状态
        const existingContext = this.sessionContexts.get(finalSessionId);
        if (existingContext) {
          existingContext.activeRole = roleActivationTool.params?.role || activeRole;
          existingContext.lastRoleActivationTime = new Date();
          this.sessionContexts.set(finalSessionId, existingContext);
          log.info(`✅ [会话更新] 角色激活并重新注入完成 - 角色: ${existingContext.activeRole}`);
        }
      }
    } else {
      // 没有工具调用，提取旧的工具执行信息（用于显示）
      toolExecutions = this.extractToolExecutions(currentResponse);
      log.info(`📝 [标准响应] 没有工具调用，直接返回AI响应`);
      console.log('📝 [DeeChat调试] 没有工具调用，直接返回AI响应');
    }
    
    // 如果没有角色激活工具调用，更新普通会话状态
    if (activeRole) {
      const existingContext = this.sessionContexts.get(finalSessionId);
      if (existingContext) {
        existingContext.activeRole = activeRole;
        existingContext.lastRoleActivationTime = new Date();
        this.sessionContexts.set(finalSessionId, existingContext);
        log.info(`🎭 [会话更新] 角色状态已更新: ${activeRole}`);
      }
    }


    // 构造完整的LLM响应
    const llmResponse: LLMResponse = {
      content: finalAIResponse,
      model: modelConfig.model,
      toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
      usage: currentResponse.usage_metadata ? {
        prompt_tokens: currentResponse.usage_metadata.input_tokens || 0,
        completion_tokens: currentResponse.usage_metadata.output_tokens || 0,
        total_tokens: currentResponse.usage_metadata.total_tokens || 0
      } : undefined,
      finishReason: currentResponse.response_metadata?.finish_reason,
      contextInfo: {
        originalMessageCount: 0, // 暂时设为0，需要从智能分层系统获取
        finalMessageCount: promptResponse.messages.length,
        tokenStats: {
          currentTokens: promptResponse.totalTokens,
          maxTokens: 100000, // 默认值，应该从模型配置获取
          utilizationRate: promptResponse.totalTokens / 100000,
          status: promptResponse.compressionTriggered ? 'compressed' : 
                  (promptResponse.totalTokens / 100000 > 0.8 ? 'near_limit' : 'optimal')
        },
        compressionApplied: promptResponse.compressionTriggered || false,
        removedCount: 0 // 暂时设为0，需要从智能分层系统获取
      }
    };

    // 保存AI响应（只有提供了sessionId才保存历史）
    if (sessionId) {
      this.smartPromptSystem.addAIResponse(finalSessionId, message, finalAIResponse);
    }

    return llmResponse;
  }

  // 为了向后兼容，保留sendMessage别名
  async sendMessage(
    message: string,
    configId: string,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext
  ): Promise<LLMResponse> {
    return this.sendMessageWithMCPTools(message, configId, sessionId, activeRole, baseSystemPrompt, uiContext);
  }

  /**
   * 为了向后兼容，保留sendMessageWithConfig别名（已合并到统一方法中）
   */
  async sendMessageWithConfig(
    message: string,
    config: ModelConfigEntity,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext
  ): Promise<LLMResponse> {
    // 将config对象临时存储到配置缓存中，然后使用统一方法
    const tempConfigId = `temp_${Date.now()}`;
    this.configCache.set(tempConfigId, config);
    
    try {
      return await this.sendMessageWithMCPTools(message, tempConfigId, sessionId, activeRole, baseSystemPrompt, uiContext);
    } finally {
      // 清理临时配置
      this.configCache.delete(tempConfigId);
    }
  }


  /**
   * 构建会话上下文
   */
  private buildConversationContext(
    sessionId: string,
    modelName: string,
    activeRole?: string
  ): ConversationContext {
    const existing = this.sessionContexts.get(sessionId);
    
    const context: ConversationContext = {
      sessionId,
      currentModel: modelName,
      activeRole: activeRole || existing?.activeRole,
      conversationStartTime: existing?.conversationStartTime || new Date(),
      totalRounds: existing?.totalRounds || 0,
      lastRoleActivationTime: existing?.lastRoleActivationTime,
      lastUserInput: existing?.lastUserInput,
      lastAIResponse: existing?.lastAIResponse
    };

    this.sessionContexts.set(sessionId, context);
    return context;
  }

  /**
   * 强制压缩会话历史
   */
  async compressSessionHistory(sessionId: string): Promise<void> {
    const result = await this.smartPromptSystem.forceCompressHistory(sessionId);
    if (result) {
      log.info(`🔄 [历史压缩] 会话 ${sessionId.slice(0, 8)} 压缩完成，节省 ${result.tokensSaved} tokens`);
    }
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(maxAge: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [sessionId, context] of this.sessionContexts.entries()) {
      if (context.conversationStartTime < cutoffTime) {
        this.sessionContexts.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`🧹 [会话清理] 已清理 ${cleaned} 个过期会话上下文`);
    }
  }

  /**
   * 获取模型实例
   */
  private async getModel(configId: string): Promise<BaseChatModel> {
    if (this.modelCache.has(configId)) {
      return this.modelCache.get(configId)!;
    }

    const config = await this.getModelConfig(configId);
    const model = LangChainModelFactory.createChatModel(config);
    this.modelCache.set(configId, model);

    return model;
  }

  /**
   * 获取模型配置
   */
  private async getModelConfig(configId: string): Promise<ModelConfigEntity> {
    if (this.configCache.has(configId)) {
      return this.configCache.get(configId)!;
    }

    // 这里应该从配置服务获取，暂时返回默认配置
    const config = await this.getDefaultConfig(configId);
    this.configCache.set(configId, config);

    return config;
  }

  /**
   * 获取默认配置（临时实现）
   */
  private async getDefaultConfig(modelKey: string): Promise<ModelConfigEntity> {
    // 基于模型key返回默认配置
    if (modelKey.includes('claude')) {
      return new ModelConfigEntity({
        id: modelKey,
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        baseURL: '',
        isEnabled: true,
        status: 'available',
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 统一使用ChatAnywhere代理 - 支持所有OpenAI兼容模型
    // modelKey现在直接是模型名称，无需处理前缀
    return new ModelConfigEntity({
      id: modelKey,
      name: this.getModelDisplayName(modelKey), // 动态生成显示名称
      provider: 'openai',
      model: modelKey, // 直接使用modelKey作为模型名称
      apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto', // 统一API密钥
      baseURL: 'https://api.chatanywhere.tech/v1', // 统一代理地址
      isEnabled: true,
      status: 'available',
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * 根据模型ID生成友好的显示名称
   */
  private getModelDisplayName(modelName: string): string {
    if (modelName.includes('gpt-4')) return 'GPT-4';
    if (modelName.includes('gpt-3.5')) return 'GPT-3.5';
    if (modelName.includes('gpt')) return 'GPT';
    if (modelName.includes('kimi')) return 'Kimi';
    if (modelName.includes('qwen')) return 'Qwen';
    if (modelName.includes('claude')) return 'Claude';
    if (modelName.includes('gemini')) return 'Gemini';
    
    // 默认使用模型名称的首字母大写形式
    return modelName.charAt(0).toUpperCase() + modelName.slice(1);
  }

  /**
   * 获取提供商的可用模型列表 - 从真实API获取
   */
  async getAvailableModels(config: ModelConfigEntity): Promise<string[]> {
    if (!config.baseURL || !config.apiKey) {
      log.warn(`⚠️ [模型列表] 配置不完整: baseURL=${!!config.baseURL}, apiKey=${!!config.apiKey}`);
      return [];
    }
    
    try {
      log.info(`🌐 [模型列表] 从API获取模型: ${config.baseURL}`);
      
      // 构造 /models 端点URL
      const baseURL = config.baseURL.replace(/\/+$/, ''); // 移除末尾斜杠
      const modelsURL = `${baseURL}/models`;
      
      const response = await fetch(modelsURL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          // OpenAI格式的响应：{ data: [{id: "model-name"}, ...] }
          const models = data.data
            .map((model: any) => model.id)
            .filter((id: string) => id && typeof id === 'string')
            .sort(); // 按字母排序
          
          log.info(`✅ [模型列表] 从API获取到 ${models.length} 个模型`);
          return models;
        } else {
          log.warn(`⚠️ [模型列表] API响应格式错误:`, data);
          return [];
        }
      } else {
        const errorText = await response.text();
        log.warn(`⚠️ [模型列表] API请求失败: ${response.status} ${response.statusText}`, errorText);
        return [];
      }
    } catch (error) {
      log.error(`❌ [模型列表] API获取失败:`, error);
      return [];
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.modelCache.clear();
    this.configCache.clear();
    this.sessionContexts.clear();
    log.info('🧹 [缓存] LangChain服务缓存已清理');
  }
}