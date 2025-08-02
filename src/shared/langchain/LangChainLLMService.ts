import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage
} from "@langchain/core/messages";

import { LangChainModelFactory } from './LangChainModelFactory';
import { ModelConfigEntity } from '../entities/ModelConfigEntity';

/**
 * LangChain LLM服务
 * 提供统一的LLM调用接口，内部使用LangChain模型
 */
export class LangChainLLMService {
  private modelCache: Map<string, BaseChatModel> = new Map();
  private configCache: Map<string, ModelConfigEntity> = new Map();

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
    const model = await this.getModel(configId);

    const messages: BaseMessage[] = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
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
    const model = LangChainModelFactory.createChatModel(config);

    const messages: BaseMessage[] = [
      ...(systemPrompt ? [new SystemMessage(systemPrompt)] : []),
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
   * 获取配置（这里需要实现配置获取逻辑）
   * @param configId 配置ID
   * @returns 配置实体
   */
  private async getConfig(configId: string): Promise<ModelConfigEntity> {
    if (!this.configCache.has(configId)) {
      // TODO: 这里需要实现从数据库或配置存储中获取配置的逻辑
      // 暂时抛出错误，提醒需要实现
      throw new Error(`配置获取未实现: ${configId}`);
    }
    return this.configCache.get(configId)!;
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
}
