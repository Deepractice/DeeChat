import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

import { ModelConfigEntity } from '../entities/ModelConfigEntity';

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
    
    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: config.model,
          openAIApiKey: config.apiKey,
          configuration: {
            baseURL: config.baseURL
          },
          temperature: 0.7,
          maxTokens: 2000
        });
      
      case 'claude':
      case 'anthropic':
        return new ChatAnthropic({
          modelName: config.model,
          anthropicApiKey: config.apiKey,
          temperature: 0.7,
          maxTokens: 2000,
          clientOptions: {
            baseURL: config.baseURL
          }
        });
      
      case 'gemini':
      case 'google':
        // 检查是否有代理设置
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
        const clientOptions: any = {}

        if (proxyUrl) {
          console.log(`使用代理访问Gemini API: ${proxyUrl}`)
          // 为Google Generative AI设置代理
          clientOptions.httpAgent = require('https-proxy-agent')(proxyUrl)
        }

        if (config.baseURL && config.baseURL !== 'https://generativelanguage.googleapis.com') {
          clientOptions.baseURL = config.baseURL
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
        return new ChatOpenAI({
          apiKey: config.apiKey,
          model: config.model,
          configuration: {
            baseURL: config.baseURL
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
    
    switch (provider) {
      case 'openai':
        return new ChatOpenAI({
          modelName: config.model,
          openAIApiKey: config.apiKey,
          configuration: {
            baseURL: config.baseURL
          },
          ...params
        });
      
      case 'claude':
      case 'anthropic':
        return new ChatAnthropic({
          modelName: config.model,
          anthropicApiKey: config.apiKey,
          clientOptions: {
            baseURL: config.baseURL
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
          apiKey: config.apiKey,
          model: config.model,
          configuration: {
            baseURL: config.baseURL
          },
          ...params
        });
    }
  }
}
