import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { ModelConfigEntity } from '../entities/ModelConfigEntity';
import log from 'electron-log';

/**
 * LangChain模型工厂
 * 负责根据配置创建适当的LangChain模型实例
 */
export class LangChainModelFactory {
  /**
   * 创建聊天模型
   * 根据提供商类型选择合适的LangChain模型实现
   * 对于已知的提供商使用原生LangChain实现，对于自定义提供商使用ProjectSChatModel
   */
  static createChatModel(config: ModelConfigEntity): BaseChatModel {
    const provider = config.provider.toLowerCase();
    
    // 🔧 修复URL构造问题：确保baseURL正确格式化
    const normalizedBaseURL = this.normalizeBaseURL(config.baseURL);
    
    log.info(`🔧 [ModelFactory] 开始创建模型 - Provider: ${provider}, Model: ${config.model}, BaseURL: ${normalizedBaseURL}`)
    
    switch (provider) {
      case 'openai':
        log.info(`🤖 [ModelFactory] 创建ChatOpenAI实例 - Model: ${config.model}, BaseURL: ${normalizedBaseURL}`)
        return new ChatOpenAI({
          modelName: config.model, // LangChain 0.5.x 使用 modelName
          openAIApiKey: config.apiKey, // LangChain 0.5.x 使用 openAIApiKey
          configuration: {
            baseURL: normalizedBaseURL || 'https://api.openai.com/v1'
          },
          temperature: 0.7,
          maxTokens: 2000
        });
      
      case 'claude':
      case 'anthropic':
        log.info(`🧠 [ModelFactory] 创建ChatAnthropic实例 - Model: ${config.model}`)
        return new ChatAnthropic({
          modelName: config.model,
          anthropicApiKey: config.apiKey,
          temperature: 0.7,
          maxTokens: 2000,
          clientOptions: {
            baseURL: normalizedBaseURL
          }
        });
      
      case 'gemini':
      case 'google':
        log.info(`🌟 [ModelFactory] 创建ChatGoogleGenerativeAI实例 - Model: ${config.model}`)
        // 检查是否有代理设置
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
        const clientOptions: any = {}

        if (proxyUrl) {
          console.log(`使用代理访问Gemini API: ${proxyUrl}`)
          // 为Google Generative AI设置代理
          clientOptions.httpAgent = require('https-proxy-agent')(proxyUrl)
        }

        if (normalizedBaseURL && normalizedBaseURL !== 'https://generativelanguage.googleapis.com') {
          clientOptions.baseURL = normalizedBaseURL
        }

        return new ChatGoogleGenerativeAI({
          model: config.model,
          apiKey: config.apiKey,
          temperature: 0.7,
          maxOutputTokens: 2000,
          ...(Object.keys(clientOptions).length > 0 ? { clientOptions } : {})
        });
      
      // 对于自定义提供商，使用ChatOpenAI with 自定义baseURL
      // 大多数自定义API都是OpenAI兼容的
      default:
        log.info(`🔧 [ModelFactory] 创建默认ChatOpenAI实例 - Provider: ${provider}, Model: ${config.model}, BaseURL: ${normalizedBaseURL}`)
        return new ChatOpenAI({
          openAIApiKey: config.apiKey,
          modelName: config.model,
          configuration: {
            baseURL: normalizedBaseURL || 'https://api.openai.com/v1'
          },
          temperature: 0.7,
          maxTokens: 2000
        });
    }
  }

  /**
   * 获取模型的默认参数
   */
  static getDefaultModelParams(provider: string): any {
    switch (provider.toLowerCase()) {
      case 'openai':
        return {
          temperature: 0.7,
          maxTokens: 2000
        };
      
      case 'claude':
      case 'anthropic':
        return {
          temperature: 0.7,
          maxTokens: 2000
        };
      
      case 'gemini':
      case 'google':
        return {
          temperature: 0.7,
          maxOutputTokens: 2000
        };
      
      default:
        return {
          temperature: 0.7,
          maxTokens: 2000
        };
    }
  }

  /**
   * 创建带有自定义参数的聊天模型
   */
  static createChatModelWithParams(
    config: ModelConfigEntity, 
    params: Record<string, any>
  ): BaseChatModel {
    const provider = config.provider.toLowerCase();
    const normalizedBaseURL = this.normalizeBaseURL(config.baseURL);
    
    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: config.model,
          openAIApiKey: config.apiKey,
          configuration: {
            baseURL: normalizedBaseURL || 'https://api.openai.com/v1'
          },
          ...params
        });
      
      case 'claude':
      case 'anthropic':
        return new ChatAnthropic({
          modelName: config.model,
          anthropicApiKey: config.apiKey,
          clientOptions: {
            baseURL: normalizedBaseURL
          },
          ...params
        });
      
      case 'gemini':
      case 'google':
        return new ChatGoogleGenerativeAI({
          model: config.model,
          apiKey: config.apiKey,
          ...params
        });
      
      default:
        // 对于自定义提供商，使用ChatOpenAI with 自定义baseURL
        return new ChatOpenAI({
          openAIApiKey: config.apiKey,
          modelName: config.model,
          configuration: {
            baseURL: normalizedBaseURL || 'https://api.openai.com/v1'
          },
          ...params
        });
    }
  }

  /**
   * 规范化BaseURL，确保不会导致双斜杠问题
   * 🔧 修复URL构造问题：移除尾随斜杠以防止//v1/messages的问题
   */
  private static normalizeBaseURL(baseURL?: string): string | undefined {
    if (!baseURL) return baseURL;
    
    // 如果URL以斜杠结尾且包含/v1路径，移除尾随斜杠
    if (baseURL.endsWith('/') && baseURL.includes('/v1')) {
      const normalized = baseURL.slice(0, -1);
      log.debug(`🔧 [ModelFactory] URL规范化: ${baseURL} → ${normalized}`);
      return normalized;
    }
    
    return baseURL;
  }
}
