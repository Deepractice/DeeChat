import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage
} from "@langchain/core/messages";

import { LangChainModelFactory } from './LangChainModelFactory';
import { ModelConfigEntity } from '../entities/ModelConfigEntity';
import { enhancedSystemPromptProvider } from '../prompts/EnhancedSystemPromptProvider';
import { llmPromptIntegration } from '../prompts/LLMServiceIntegration';
import { ISystemPromptProvider } from '../interfaces/ISystemPromptProvider';
import { IModelConfigService } from '../interfaces/IModelProvider';
import { DeeChatFeature } from '../prompts/FeatureContextProvider';
import { ConversationContext } from '../prompts/ConversationContextAnalyzer';
import log from 'electron-log';

// MCP工具相关类型定义
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
  serverId: string;
  serverName?: string;
}

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
  getAllTools(): Promise<MCPTool[]>;
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;
}

/**
 * LangChain LLM服务
 * 提供统一的LLM调用接口，内部使用LangChain模型
 */
export class LangChainLLMService {
  private modelCache: Map<string, BaseChatModel> = new Map();
  private configCache: Map<string, ModelConfigEntity> = new Map();
  private promptProvider: ISystemPromptProvider;
  private configService?: IModelConfigService;
  private mcpService?: MCPIntegrationServiceInterface;
  
  // DeeChat智能对话相关
  private currentSessionId?: string;
  private isIntentSystemEnabled: boolean = true;

  constructor(
    promptProvider?: ISystemPromptProvider, 
    configService?: IModelConfigService,
    mcpService?: MCPIntegrationServiceInterface
  ) {
    // 使用增强的提示词提供器作为默认值，向后兼容
    this.promptProvider = promptProvider || enhancedSystemPromptProvider;
    this.configService = configService;
    this.mcpService = mcpService;
    
    // 初始化DeeChat提示词系统（异步，不阻塞构造）
    this.initializeDeeChatPrompts();
    
    log.info('🚀 [LangChain服务] 初始化DeeChat智能对话LLM服务');
  }

  /**
   * 初始化DeeChat提示词系统
   */
  private async initializeDeeChatPrompts(): Promise<void> {
    try {
      if (this.promptProvider === enhancedSystemPromptProvider) {
        await llmPromptIntegration.initializeLLMServicePrompts();
        log.info('✅ [LangChain] DeeChat提示词系统初始化完成');
      }
    } catch (error) {
      log.warn('⚠️ [LangChain] DeeChat提示词系统初始化失败，将使用基础提示词:', error);
    }
  }

  /**
   * 发送消息
   * @param message 用户消息
   * @param configId 模型配置ID
   * @param systemPrompt 可选的系统提示词
   * @returns 模型响应
   */
  async sendMessage(
    message: string,
    configId: string,
    systemPrompt?: string
  ): Promise<string> {
    // 确保DeeChat提示词系统已初始化
    if (this.promptProvider === enhancedSystemPromptProvider) {
      await llmPromptIntegration.initializeLLMServicePrompts();
    }

    const model = await this.getModel(configId);

    // 构建系统提示词（现在会包含DeeChat专属内容）
    let finalSystemPrompt = this.promptProvider.buildSystemPrompt();
    
    // 如果提供了额外的系统提示词，追加到最后
    if (systemPrompt) {
      finalSystemPrompt = finalSystemPrompt ? 
        `${finalSystemPrompt}\n\n${systemPrompt}` : 
        systemPrompt;
    }

    const messages: BaseMessage[] = [
      ...(finalSystemPrompt ? [new SystemMessage(finalSystemPrompt)] : []),
      new HumanMessage(message)
    ];

    const response = await model.invoke(messages);
    return response.content as string;
  }


  /**
   * 使用临时配置发送消息（不缓存模型）
   * @param message 用户消息
   * @param config 临时模型配置
   * @param systemPrompt 可选的系统提示词
   * @returns 模型响应
   */
  async sendMessageWithConfig(
    message: string,
    config: ModelConfigEntity,
    systemPrompt?: string
  ): Promise<string> {
    // 直接创建模型，不使用缓存
    log.info(`🏭 [LangChain工厂] 创建模型 - Provider: ${config.provider}, Model: ${config.model}`)
    const model = LangChainModelFactory.createChatModel(config);

    // 构建系统提示词
    let finalSystemPrompt = this.promptProvider.buildSystemPrompt();
    
    // 如果提供了额外的系统提示词，追加到最后
    if (systemPrompt) {
      finalSystemPrompt = finalSystemPrompt ? 
        `${finalSystemPrompt}\n\n${systemPrompt}` : 
        systemPrompt;
    }

    const messages: BaseMessage[] = [
      ...(finalSystemPrompt ? [new SystemMessage(finalSystemPrompt)] : []),
      new HumanMessage(message)
    ];

    const response = await model.invoke(messages);
    return response.content as string;
  }


  /**
   * 获取提供商的可用模型列表
   * @param config 模型配置（用于获取API密钥等信息）
   * @returns 可用模型列表
   */
  async getAvailableModels(config: ModelConfigEntity): Promise<string[]> {
    const provider = config.provider.toLowerCase();

    switch (provider) {
      case 'gemini':
      case 'google':
        return await this.getGeminiModels(config);

      case 'openai':
        return await this.getOpenAIModels(config);

      case 'claude':
      case 'anthropic':
        // Claude通常不提供模型列表API，返回预定义列表
        return [
          'claude-3-5-sonnet-20241022',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ];

      case 'custom':
        // 自定义提供商，尝试通过API获取模型列表
        return await this.getCustomProviderModels(config);

      default:
        throw new Error(`不支持的提供商: ${provider}`);
    }
  }

  /**
   * 使用提示词模板发送消息
   * @param template 提示词模板
   * @param variables 模板变量
   * @param configId 模型配置ID
   * @returns 模型响应
   */
  async sendMessageWithTemplate(
    template: ChatPromptTemplate,
    variables: Record<string, any>,
    configId: string
  ): Promise<string> {
    const model = await this.getModel(configId);
    const chain = template.pipe(model);
    const response = await chain.invoke(variables);
    return response.content as string;
  }

  /**
   * 发送多轮对话消息
   * @param messages 消息历史
   * @param configId 模型配置ID
   * @returns 模型响应
   */
  async sendConversation(
    messages: BaseMessage[],
    configId: string
  ): Promise<string> {
    const model = await this.getModel(configId);
    const response = await model.invoke(messages);
    return response.content as string;
  }

  /**
   * 流式发送消息
   * @param message 用户消息
   * @param configId 模型配置ID
   * @param systemPrompt 可选的系统提示词
   * @param onChunk 处理每个chunk的回调函数
   */
  async streamMessage(
    message: string,
    configId: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    const model = await this.getModel(configId);
    
    const messages: BaseMessage[] = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
      new HumanMessage(message)
    ];
    
    let fullResponse = '';
    const stream = await model.stream(messages);
    
    for await (const chunk of stream) {
      const content = chunk.content as string;
      fullResponse += content;
      if (onChunk) {
        onChunk(content);
      }
    }
    
    return fullResponse;
  }

  /**
   * 批量处理消息
   * @param requests 批量请求
   * @param configId 模型配置ID
   * @returns 批量响应
   */
  async batchMessages(
    requests: Array<{
      message: string;
      systemPrompt?: string;
    }>,
    configId: string
  ): Promise<string[]> {
    const model = await this.getModel(configId);
    
    const messageBatches = requests.map(req => [
      ...(req.systemPrompt ? [new SystemMessage(req.systemPrompt)] : []),
      new HumanMessage(req.message)
    ]);
    
    const responses = await model.batch(messageBatches);
    return responses.map(response => response.content as string);
  }

  /**
   * 测试模型连接
   * @param configId 模型配置ID
   * @returns 测试结果
   */
  async testModel(configId: string): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    try {
      const startTime = Date.now();
      await this.sendMessage('Hello', configId);
      const responseTime = Date.now() - startTime;
      
      return {
        success: true,
        responseTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      };
    }
  }

  /**
   * 获取或创建模型实例
   * @param configId 配置ID
   * @returns 模型实例
   */
  private async getModel(configId: string): Promise<BaseChatModel> {
    if (!this.modelCache.has(configId)) {
      const config = await this.getConfig(configId);
      const model = LangChainModelFactory.createChatModel(config);
      this.modelCache.set(configId, model);
    }
    return this.modelCache.get(configId)!;
  }

  /**
   * 获取配置
   * @param configId 配置ID
   * @returns 配置实体
   */
  private async getConfig(configId: string): Promise<ModelConfigEntity> {
    // 先检查缓存
    if (this.configCache.has(configId)) {
      return this.configCache.get(configId)!;
    }

    // 如果没有配置服务，抛出错误
    if (!this.configService) {
      throw new Error(`配置服务未注入，无法获取配置: ${configId}`);
    }

    // 从配置服务获取
    const config = await this.configService.getConfigById(configId);
    if (!config) {
      throw new Error(`配置不存在: ${configId}`);
    }

    // 缓存配置
    this.configCache.set(configId, config);
    return config;
  }

  /**
   * 设置配置（用于测试或手动设置）
   * @param configId 配置ID
   * @param config 配置实体
   */
  setConfig(configId: string, config: ModelConfigEntity): void {
    this.configCache.set(configId, config);
    // 清除对应的模型缓存，强制重新创建
    this.modelCache.delete(configId);
  }

  /**
   * 清除缓存
   * @param configId 可选的配置ID，如果不提供则清除所有缓存
   */
  clearCache(configId?: string): void {
    if (configId) {
      this.modelCache.delete(configId);
      this.configCache.delete(configId);
    } else {
      this.modelCache.clear();
      this.configCache.clear();
    }
  }

  /**
   * 获取Gemini可用模型列表
   * @param config 模型配置
   * @returns Gemini模型列表
   */
  private async getGeminiModels(config: ModelConfigEntity): Promise<string[]> {
    try {
      const baseURL = config.baseURL || 'https://generativelanguage.googleapis.com';
      const url = `${baseURL}/v1beta/models?key=${config.apiKey}`;

      console.log(`🔍 获取Gemini模型列表: ${url.replace(config.apiKey, '***')}`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Gemini模型列表获取失败 (${response.status}): ${errorText}`);

        // 抛出详细错误而不是降级，让用户知道具体问题
        throw new Error(`Gemini API调用失败 (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('🔍 Gemini API原始响应:', JSON.stringify(data, null, 2));

      const models = this.parseGeminiModelsResponse(data);

      if (models.length === 0) {
        console.error('❌ 解析后的Gemini模型列表为空');
        console.log('原始数据结构:', data);
        throw new Error('Gemini API返回了数据但解析后模型列表为空，可能是API格式变化');
      }

      console.log(`✅ 成功获取 ${models.length} 个Gemini模型:`, models);
      return models;

    } catch (error) {
      console.error('❌ Gemini模型列表获取异常:', error);
      // 不再自动降级，抛出错误让用户知道具体问题
      throw error instanceof Error ? error : new Error(`Gemini模型获取失败: ${error}`);
    }
  }

  /**
   * 获取OpenAI可用模型列表
   * @param config 模型配置
   * @returns OpenAI模型列表
   */
  private async getOpenAIModels(config: ModelConfigEntity): Promise<string[]> {
    try {
      const baseURL = config.baseURL || 'https://api.openai.com/v1';
      const url = `${baseURL}/models`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`
        }
      });

      if (!response.ok) {
        console.warn(`OpenAI模型列表获取失败 (${response.status})，使用预定义列表`);
        return this.getDefaultOpenAIModels();
      }

      const data = await response.json();
      const models = this.parseOpenAIModelsResponse(data);

      if (models.length === 0) {
        console.warn('未获取到OpenAI模型，使用预定义列表');
        return this.getDefaultOpenAIModels();
      }

      console.log(`✅ 成功获取 ${models.length} 个OpenAI模型`);
      return models;

    } catch (error) {
      console.warn('OpenAI模型列表获取异常，使用预定义列表:', error);
      return this.getDefaultOpenAIModels();
    }
  }

  /**
   * 解析Gemini模型响应
   * @param data API响应数据
   * @returns 模型名称列表
   */
  private parseGeminiModelsResponse(data: any): string[] {
    try {
      if (data.models && Array.isArray(data.models)) {
        const models = data.models
          .map((model: any) => {
            // Gemini API返回格式: "models/gemini-1.5-pro"
            const modelName = model.name || model.id;
            if (typeof modelName === 'string' && modelName.startsWith('models/')) {
              return {
                name: modelName.replace('models/', ''),
                displayName: model.displayName || modelName.replace('models/', ''),
                description: model.description || '',
                inputTokenLimit: model.inputTokenLimit || 0,
                outputTokenLimit: model.outputTokenLimit || 0,
                supportedMethods: model.supportedGenerationMethods || []
              };
            }
            return null;
          })
          .filter((model: any) => {
            // 过滤出有效的Gemini聊天模型
            if (!model || !model.name) {
              console.log('❌ 跳过无效模型:', model);
              return false;
            }

            const name = model.name.toLowerCase();
            const isGeminiModel = name.includes('gemini') || name.includes('bison') || name.includes('chat-bison');
            const isChatModel = model.supportedMethods.includes('generateContent') ||
                               name.includes('chat') ||
                               name.includes('pro') ||
                               name.includes('flash') ||
                               name.includes('gemini'); // 放宽条件：包含gemini的都认为是聊天模型
            const isNotEmbedding = !name.includes('embedding') &&
                                  !name.includes('aqa') &&
                                  !name.includes('text-bison') &&
                                  !name.includes('imagen');

            const shouldInclude = isGeminiModel && isChatModel && isNotEmbedding;

            console.log(`🔍 模型过滤: ${model.name}`, {
              isGeminiModel,
              isChatModel,
              isNotEmbedding,
              shouldInclude,
              supportedMethods: model.supportedMethods
            });

            return shouldInclude;
          })
          .sort((a: any, b: any) => {
            // 排序：2.5版本 > 2.0版本 > 1.5版本 > 1.0版本，Pro > Flash > 其他
            const getVersionScore = (name: string) => {
              if (name.includes('2.5')) return 250;
              if (name.includes('2.0')) return 200;
              if (name.includes('1.5')) return 150;
              if (name.includes('1.0')) return 100;
              return 50;
            };

            const getTypeScore = (name: string) => {
              if (name.includes('pro')) return 30;
              if (name.includes('flash')) return 20;
              return 10;
            };

            const scoreA = getVersionScore(a.name) + getTypeScore(a.name);
            const scoreB = getVersionScore(b.name) + getTypeScore(b.name);

            return scoreB - scoreA; // 降序排列
          })
          .map((model: any) => model.name);

        console.log(`✅ 解析到 ${models.length} 个Gemini聊天模型:`, models.slice(0, 5));
        return models;
      }
    } catch (error) {
      console.warn('解析Gemini模型响应失败:', error);
    }
    return [];
  }

  /**
   * 解析OpenAI模型响应
   * @param data API响应数据
   * @returns 模型名称列表
   */
  private parseOpenAIModelsResponse(data: any): string[] {
    try {
      if (data.data && Array.isArray(data.data)) {
        return data.data
          .map((model: any) => model.id)
          .filter((id: string) => {
            if (!id) return false;
            
            // 排除非聊天模型
            const excludePatterns = [
              'text-embedding',    // embedding模型
              'tts-',             // 文本转语音模型
              'whisper',          // 语音识别模型
              'dall-e',           // 图像生成模型
              'davinci-002',      // 旧版本模型
              'text-ada',         // 旧版本embedding
              'transcribe',       // 转录模型
              'image-1'           // 图像处理模型
            ];
            
            // 如果包含排除模式，跳过
            if (excludePatterns.some(pattern => id.includes(pattern))) {
              return false;
            }
            
            // 包含聊天模型模式
            const includePatterns = [
              'gpt',              // GPT系列
              'o1',               // O1系列
              'o3',               // O3系列
              'o4',               // O4系列
              'chatgpt',          // ChatGPT系列
              'claude',           // Claude系列
              'gemini',           // Gemini系列
              'deepseek',         // DeepSeek系列
              'grok',             // Grok系列
              'qwen',             // Qwen系列
              'kimi'              // Kimi系列
            ];
            
            // 包含任意一个模式即可
            return includePatterns.some(pattern => id.includes(pattern));
          })
          .sort();
      }
    } catch (error) {
      console.warn('解析OpenAI模型响应失败:', error);
    }
    return [];
  }



  /**
   * 获取默认OpenAI模型列表
   * @returns 预定义的OpenAI模型列表
   */
  private getDefaultOpenAIModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1-preview',
      'o1-mini'
    ];
  }

  /**
   * 获取自定义提供商的模型列表
   * @param config 模型配置
   * @returns 可用模型列表
   */
  private async getCustomProviderModels(config: ModelConfigEntity): Promise<string[]> {
    try {
      // 对于自定义提供商，尝试通过通用API获取模型列表
      // 大多数OpenAI兼容的API都支持 /v1/models 端点
      const baseURL = config.baseURL.replace(/\/+$/, ''); // 移除末尾的斜杠
      const modelsURL = `${baseURL}/models`;

      console.log(`🔍 获取自定义提供商模型列表: ${modelsURL}`);

      const response = await fetch(modelsURL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`获取自定义提供商模型列表失败: ${response.status} ${response.statusText}`);
        return this.getDefaultCustomModels();
      }

      const data = await response.json();
      console.log('🔍 自定义提供商API原始响应:', JSON.stringify(data, null, 2));

      if (data.data && Array.isArray(data.data)) {
        const models = data.data
          .map((model: any) => model.id)
          .filter((id: string) => id && typeof id === 'string')
          .sort();

        console.log(`✅ 成功获取 ${models.length} 个自定义提供商模型:`, models);
        return models.length > 0 ? models : this.getDefaultCustomModels();
      }
    } catch (error) {
      console.warn('获取自定义提供商模型列表时出错:', error);
    }

    return this.getDefaultCustomModels();
  }

  /**
   * 获取默认的自定义模型列表
   * @returns 预定义的通用模型列表
   */
  private getDefaultCustomModels(): string[] {
    return [
      // Moonshot AI 模型
      'kimi-k2-0711-preview',
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k',
      // 通用OpenAI兼容模型
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini',
      // 其他常见第三方模型
      'deepseek-chat',
      'deepseek-coder',
      'qwen-turbo',
      'qwen-plus',
      'chatglm-6b',
      'chatglm2-6b',
      'llama-2-7b-chat',
      'llama-2-13b-chat',
      'mistral-7b-instruct',
      'custom-model'
    ];
  }

  /**
   * 获取系统提示词提供器
   * @returns 系统提示词提供器实例
   */
  getSystemPromptProvider(): ISystemPromptProvider {
    return this.promptProvider;
  }

  // ==================== MCP工具集成方法 ====================


  /**
   * 使用MCP工具增强的消息发送（标准LangChain方式）
   * @param message 用户消息
   * @param config 模型配置
   * @param systemPrompt 可选的系统提示词
   * @param enableMCPTools 是否启用MCP工具
   * @returns 模型响应和工具调用信息
   */
  async sendMessageWithMCPTools(
    message: string,
    config: ModelConfigEntity,
    systemPrompt?: string,
    enableMCPTools: boolean = true
  ): Promise<{
    content: string;
    toolCalls?: any[];
    hasToolCalls: boolean;
    error?: boolean;
  }> {
    // 如果没有启用MCP工具或没有MCP服务，使用标准方式
    if (!enableMCPTools || !this.mcpService) {
      const content = await this.sendMessageWithConfig(message, config, systemPrompt);
      return {
        content,
        hasToolCalls: false
      };
    }

    try {
      // 获取可用的MCP工具
      const mcpTools = await this.mcpService.getAllTools();
      log.info(`🔧 [LangChain工具集成] 获取到 ${mcpTools.length} 个MCP工具`);

      if (mcpTools.length === 0) {
        // 没有可用工具，使用普通模式
        const content = await this.sendMessageWithConfig(message, config, systemPrompt);
        return {
          content,
          hasToolCalls: false
        };
      }

      // 创建模型实例
      const model = LangChainModelFactory.createChatModel(config);
      
      // 构建消息，包含工具信息的系统提示
      let finalSystemPrompt = this.promptProvider.buildSystemPrompt();
      
      // 添加MCP工具信息到系统提示
      const toolsDescription = mcpTools.map(tool => 
        `- ${tool.name}: ${tool.description || '无描述'}`
      ).join('\n');
      
      const mcpSystemPrompt = `\n\n可用工具列表:\n${toolsDescription}\n\n🔧 工具调用规则：
1. 当用户明确要求执行某个工具或命令时，必须立即调用相应工具
2. 当用户询问可用角色、工具列表等信息时，使用 promptx_welcome 工具
3. 当用户要求激活角色时，使用 promptx_action 工具
4. 工具调用格式：[TOOL_CALL:工具名称:参数JSON]
5. 先执行工具，再基于工具结果回复用户

示例：
- 用户："帮我执行welcome命令" → 立即输出：[TOOL_CALL:promptx_welcome:{}]
- 用户："显示可用角色" → 立即输出：[TOOL_CALL:promptx_welcome:{}]
- 用户："激活architect角色" → 立即输出：[TOOL_CALL:promptx_action:{"role":"architect"}]`;
      
      if (systemPrompt) {
        finalSystemPrompt = finalSystemPrompt ? 
          `${finalSystemPrompt}\n\n${systemPrompt}${mcpSystemPrompt}` : 
          `${systemPrompt}${mcpSystemPrompt}`;
      } else {
        finalSystemPrompt = finalSystemPrompt ? 
          `${finalSystemPrompt}${mcpSystemPrompt}` : 
          mcpSystemPrompt;
      }

      const messages: BaseMessage[] = [
        ...(finalSystemPrompt ? [new SystemMessage(finalSystemPrompt)] : []),
        new HumanMessage(message)
      ];

      // 调用模型
      log.info(`🤖 [LangChain工具集成] 调用模型，可用工具数量: ${mcpTools.length}`);
      const response = await model.invoke(messages);
      const content = response.content as string;

      // 检查响应中是否包含工具调用
      const toolCallPattern = /\[TOOL_CALL:([^:]+):([^\]]+)\]/g;
      const toolCalls: any[] = [];
      let processedContent = content;
      let match;

      while ((match = toolCallPattern.exec(content)) !== null) {
        const [fullMatch, toolName, argsJson] = match;
        
        try {
          const args = JSON.parse(argsJson);
          const mcpTool = mcpTools.find(t => t.name === toolName);
          
          if (mcpTool) {
            log.info(`🔧 [LangChain工具集成] 检测到工具调用: ${toolName}`);
            
            // 执行MCP工具调用
            const toolResponse = await this.mcpService!.callTool({
              serverId: mcpTool.serverId,
              toolName: mcpTool.name,
              arguments: args
            });

            const toolResult = toolResponse.success ? 
              (typeof toolResponse.result === 'string' ? toolResponse.result : JSON.stringify(toolResponse.result)) :
              `工具执行失败: ${toolResponse.error}`;

            toolCalls.push({
              id: `tool_${Date.now()}_${toolCalls.length}`,
              name: toolName,
              args: args,
              result: toolResult
            });

            // 替换工具调用为结果
            processedContent = processedContent.replace(fullMatch, `[工具执行结果: ${toolResult}]`);
          }
        } catch (error) {
          log.error(`❌ [LangChain工具集成] 工具调用解析失败: ${toolName}`, error);
          processedContent = processedContent.replace(fullMatch, `[工具调用失败: 参数解析错误]`);
        }
      }

      const hasToolCalls = toolCalls.length > 0;
      log.info(`📊 [LangChain工具集成] 响应包含工具调用: ${hasToolCalls}, 调用数量: ${toolCalls.length}`);

      return {
        content: processedContent,
        toolCalls: hasToolCalls ? toolCalls : undefined,
        hasToolCalls
      };

    } catch (error) {
      log.error('❌ [LangChain工具集成] MCP工具增强消息发送失败:', error);
      
      // 检查是否是API相关错误，如果是则返回用户友好的错误信息
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('余额') || errorMessage.includes('balance') || 
          errorMessage.includes('401') || errorMessage.includes('403') ||
          errorMessage.includes('ApiKey') || errorMessage.includes('api key')) {
        return {
          content: `⚠️ **API服务异常**\n\n抱歉，当前AI服务遇到以下问题：\n\n${errorMessage.includes('余额') || errorMessage.includes('balance') ? '💳 **账户余额不足**：API密钥余额已用完，请联系管理员充值或更新密钥。' : '🔑 **API密钥问题**：当前密钥无效或已过期，请检查API配置。'}\n\n🛠️ **临时解决方案**：\n- 请在设置中更新有效的API密钥\n- 或联系管理员处理API配置问题\n- 或切换到其他可用的AI模型\n\n📝 **技术详情（供开发者参考）**：\n\`\`\`\n${errorMessage}\n\`\`\``,
          hasToolCalls: false,
          error: true // 标记为错误响应
        };
      }
      
      // 其他错误降级到普通模式
      try {
        const content = await this.sendMessageWithConfig(message, config, systemPrompt);
        return {
          content: `⚠️ **MCP工具服务暂时不可用**\n\n${content}\n\n---\n*注：当前以普通模式回复，MCP工具功能暂时关闭。如需使用专业工具，请联系管理员检查服务状态。*`,
          hasToolCalls: false,
          error: false
        };
      } catch (fallbackError) {
        log.error('❌ [LangChain降级] 普通模式也失败:', fallbackError);
        return {
          content: `❌ **AI服务完全不可用**\n\n抱歉，当前AI服务遇到严重问题，无法正常响应。请联系管理员检查：\n\n1. API密钥配置\n2. 网络连接状态\n3. 服务器状态\n\n**错误详情**：\n\`\`\`\n${String(fallbackError)}\n\`\`\``,
          hasToolCalls: false,
          error: true
        };
      }
    }
  }

  /**
   * 设置MCP服务（用于后续注入）
   * @param mcpService MCP集成服务实例
   */
  setMCPService(mcpService: MCPIntegrationServiceInterface): void {
    this.mcpService = mcpService;
    
    // 同步到增强提示词提供器
    if (this.promptProvider === enhancedSystemPromptProvider) {
      // 这里可以通知工具状态变化，但需要工具列表
      log.info('🔧 [LangChain服务] MCP服务已更新');
    }
  }

  // ==================== DeeChat智能对话方法 ====================

  /**
   * 🧠 DeeChat智能消息处理
   * 集成意图识别、上下文分析和用户自主权保护的完整对话系统
   */
  async sendIntelligentMessage(
    userMessage: string,
    config: ModelConfigEntity,
    sessionInfo: {
      sessionId: string;
      userId?: string;
      currentFeature: DeeChatFeature;
      activeRole?: string;
    },
    options?: {
      systemPrompt?: string;
      enableMCPTools?: boolean;
      enableIntentAnalysis?: boolean;
    }
  ): Promise<{
    content: string;
    context: ConversationContext;
    toolCalls?: any[];
    hasToolCalls: boolean;
    shouldRemember: boolean;
    suggestedActions: string[];
    error?: boolean;
    insights?: {
      intentConfidence: number;
      emotionalState: string;
      suggestedNextSteps: string[];
    };
  }> {
    const enableIntentAnalysis = options?.enableIntentAnalysis ?? this.isIntentSystemEnabled;
    const enableMCPTools = options?.enableMCPTools ?? true;

    try {
      // 准备会话信息
      const mcpTools = enableMCPTools && this.mcpService ? 
        await this.mcpService.getAllTools() : [];
      
      const fullSessionInfo = {
        ...sessionInfo,
        availableTools: mcpTools.map(tool => tool.name)
      };

      // 如果启用意图分析，使用增强的提示词系统
      if (enableIntentAnalysis && this.promptProvider === enhancedSystemPromptProvider) {
        // 使用DeeChat特有的智能消息处理
        const analysisResult = await enhancedSystemPromptProvider.processUserMessage(
          userMessage, 
          fullSessionInfo
        );

        // 使用增强的系统提示词发送消息（包含意图分析结果）
        const response = await this.sendMessageWithMCPTools(
          userMessage,
          config,
          options?.systemPrompt || analysisResult.enhancedPrompt,
          enableMCPTools
        );

        // 构建洞察信息
        const insights = {
          intentConfidence: analysisResult.context.confidence,
          emotionalState: this.analyzeEmotionalState(analysisResult.context),
          suggestedNextSteps: analysisResult.suggestedActions
        };

        log.info(`🧠 [智能对话] 意图: ${analysisResult.context.detectedIntent}, ` +
                 `置信度: ${(analysisResult.context.confidence * 100).toFixed(0)}%, ` +
                 `工具调用: ${response.hasToolCalls ? '是' : '否'}`);

        return {
          content: response.content,
          context: analysisResult.context,
          toolCalls: response.toolCalls,
          hasToolCalls: response.hasToolCalls,
          shouldRemember: analysisResult.shouldRemember,
          suggestedActions: analysisResult.suggestedActions,
          error: response.error,
          insights
        };
      } else {
        // 回退到标准模式
        log.info('📝 [标准对话] 使用基础LLM模式');
        
        const response = await this.sendMessageWithMCPTools(
          userMessage,
          config,
          options?.systemPrompt,
          enableMCPTools
        );

        // 创建基础上下文
        const basicContext: ConversationContext = {
          sessionId: sessionInfo.sessionId,
          timestamp: new Date(),
          userMessage,
          detectedIntent: 'unclear' as any,
          confidence: 0.5,
          currentFeature: sessionInfo.currentFeature,
          activeRole: sessionInfo.activeRole,
          availableTools: mcpTools.map(tool => tool.name),
          memoryScore: 1,
          shouldRemember: false,
          planNeedsUpdate: false,
          suggestedActions: ['继续对话'],
          isCorrection: false,
          isFrustration: false,
          requiresTools: response.hasToolCalls
        };

        return {
          content: response.content,
          context: basicContext,
          toolCalls: response.toolCalls,
          hasToolCalls: response.hasToolCalls,
          shouldRemember: false,
          suggestedActions: ['继续对话'],
          error: response.error,
          insights: {
            intentConfidence: 0.5,
            emotionalState: '中性',
            suggestedNextSteps: ['继续对话']
          }
        };
      }
    } catch (error) {
      log.error('❌ [智能对话] 处理失败:', error);
      
      // 创建错误上下文
      const errorContext: ConversationContext = {
        sessionId: sessionInfo.sessionId,
        timestamp: new Date(),
        userMessage,
        detectedIntent: 'unclear' as any,
        confidence: 0.1,
        currentFeature: sessionInfo.currentFeature,
        activeRole: sessionInfo.activeRole,
        availableTools: [],
        memoryScore: 1,
        shouldRemember: false,
        planNeedsUpdate: false,
        suggestedActions: ['重试对话', '检查系统状态'],
        isCorrection: false,
        isFrustration: false,
        requiresTools: false
      };

      return {
        content: `❌ **对话处理失败**\n\n抱歉，系统遇到了问题：${error instanceof Error ? error.message : String(error)}\n\n请稍后重试或联系技术支持。`,
        context: errorContext,
        hasToolCalls: false,
        shouldRemember: false,
        suggestedActions: ['重试对话', '检查系统状态'],
        error: true,
        insights: {
          intentConfidence: 0.1,
          emotionalState: '错误',
          suggestedNextSteps: ['重试对话', '检查系统状态']
        }
      };
    }
  }

  /**
   * 🎭 更新DeeChat会话上下文
   */
  updateSessionContext(
    feature: DeeChatFeature,
    activeRole?: string,
    availableTools?: string[]
  ): void {
    // 更新增强提示词提供器的状态
    if (this.promptProvider === enhancedSystemPromptProvider) {
      enhancedSystemPromptProvider.setFeatureContext(feature);
      
      if (activeRole) {
        enhancedSystemPromptProvider.setPromptXRole(activeRole);
      }
      
      if (availableTools) {
        enhancedSystemPromptProvider.updateMCPToolStatus(availableTools);
      }
      
      log.info(`🎭 [会话上下文] 功能: ${feature}, 角色: ${activeRole || '无'}, 工具: ${availableTools?.length || 0}个`);
    }
  }

  /**
   * 📊 获取智能对话统计
   */
  getIntelligentChatStats(): {
    enabled: boolean;
    currentSession?: string;
    systemStats: any;
    recommendations: string[];
  } {
    if (this.promptProvider === enhancedSystemPromptProvider) {
      const stats = enhancedSystemPromptProvider.getDeeChatStats();
      const insights = enhancedSystemPromptProvider.getConversationInsights();
      
      return {
        enabled: this.isIntentSystemEnabled,
        currentSession: this.currentSessionId,
        systemStats: stats,
        recommendations: insights.recommendations
      };
    }
    
    return {
      enabled: false,
      systemStats: null,
      recommendations: ['使用enhancedSystemPromptProvider以启用智能对话功能']
    };
  }

  /**
   * 🎛️ 智能系统控制
   */
  enableIntelligentChat(): void {
    this.isIntentSystemEnabled = true;
    if (this.promptProvider === enhancedSystemPromptProvider) {
      enhancedSystemPromptProvider.enableIntentSystem();
    }
    log.info('🧠 [智能对话] 已启用意图识别和上下文分析');
  }

  disableIntelligentChat(): void {
    this.isIntentSystemEnabled = false;
    if (this.promptProvider === enhancedSystemPromptProvider) {
      enhancedSystemPromptProvider.disableIntentSystem();
    }
    log.info('🔇 [智能对话] 已禁用，回到基础LLM模式');
  }

  isIntelligentChatEnabled(): boolean {
    return this.isIntentSystemEnabled && this.promptProvider === enhancedSystemPromptProvider;
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 分析情感状态
   */
  private analyzeEmotionalState(context: ConversationContext): string {
    if (context.isFrustration) return '挫败';
    if (context.isCorrection) return '纠正中';
    
    switch (context.detectedIntent) {
      case 'debugging': return '焦虑';
      case 'casual_chat': return '轻松';
      case 'tool_activation': return '目标导向';
      case 'complex': return '压力较大';
      default: 
        return context.confidence > 0.7 ? '专注' : '探索中';
    }
  }
}
