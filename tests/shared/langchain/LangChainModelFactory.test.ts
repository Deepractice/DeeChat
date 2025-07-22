import { LangChainModelFactory } from '../../../src/shared/langchain/LangChainModelFactory';
import { ModelConfigEntity } from '../../../src/shared/entities/ModelConfigEntity';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ProjectSChatModel } from '../../../src/shared/langchain/ProjectSChatModel';

// Mock LangChain modules
jest.mock('@langchain/openai');
jest.mock('@langchain/anthropic');
jest.mock('@langchain/google-genai');
jest.mock('../../../src/shared/langchain/ProjectSChatModel');

describe('LangChainModelFactory', () => {
  let mockConfig: ModelConfigEntity;

  beforeEach(() => {
    mockConfig = global.createMockModelConfig();
    jest.clearAllMocks();
  });

  describe('createChatModel', () => {
    it('should create ChatOpenAI for OpenAI provider', () => {
      mockConfig.provider = 'openai';
      mockConfig.model = 'gpt-4';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: 'gpt-4',
        openAIApiKey: 'test-api-key',
        configuration: {
          baseURL: 'https://api.openai.com/v1'
        },
        temperature: 0.7,
        maxTokens: 2000
      });
    });

    it('should create ChatAnthropic for Claude provider', () => {
      mockConfig.provider = 'claude';
      mockConfig.model = 'claude-3-sonnet';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: 'claude-3-sonnet',
        anthropicApiKey: 'test-api-key',
        temperature: 0.7,
        maxTokens: 2000,
        clientOptions: {
          baseURL: 'https://api.openai.com/v1'
        }
      });
    });

    it('should create ChatAnthropic for anthropic provider', () => {
      mockConfig.provider = 'anthropic';
      mockConfig.model = 'claude-3-opus';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ChatAnthropic).toHaveBeenCalledWith({
        modelName: 'claude-3-opus',
        anthropicApiKey: 'test-api-key',
        temperature: 0.7,
        maxTokens: 2000,
        clientOptions: {
          baseURL: 'https://api.openai.com/v1'
        }
      });
    });

    it('should create ChatGoogleGenerativeAI for Gemini provider', () => {
      mockConfig.provider = 'gemini';
      mockConfig.model = 'gemini-pro';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith({
        modelName: 'gemini-pro',
        apiKey: 'test-api-key',
        temperature: 0.7,
        maxOutputTokens: 2000
      });
    });

    it('should create ChatGoogleGenerativeAI for Google provider', () => {
      mockConfig.provider = 'google';
      mockConfig.model = 'gemini-pro-vision';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ChatGoogleGenerativeAI).toHaveBeenCalledWith({
        modelName: 'gemini-pro-vision',
        apiKey: 'test-api-key',
        temperature: 0.7,
        maxOutputTokens: 2000
      });
    });

    it('should create ProjectSChatModel for custom provider', () => {
      mockConfig.provider = 'custom-provider';
      mockConfig.model = 'custom-model';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ProjectSChatModel).toHaveBeenCalledWith({
        config: mockConfig,
        temperature: 0.7,
        maxTokens: 2000
      });
    });

    it('should create ProjectSChatModel for unknown provider', () => {
      mockConfig.provider = 'unknown';
      mockConfig.model = 'unknown-model';

      const model = LangChainModelFactory.createChatModel(mockConfig);

      expect(ProjectSChatModel).toHaveBeenCalledWith({
        config: mockConfig,
        temperature: 0.7,
        maxTokens: 2000
      });
    });
  });

  describe('getDefaultModelParams', () => {
    it('should return correct default params for OpenAI', () => {
      const params = LangChainModelFactory.getDefaultModelParams('openai');
      expect(params).toEqual({
        temperature: 0.7,
        maxTokens: 2000
      });
    });

    it('should return correct default params for Claude', () => {
      const params = LangChainModelFactory.getDefaultModelParams('claude');
      expect(params).toEqual({
        temperature: 0.7,
        maxTokens: 2000
      });
    });

    it('should return correct default params for Gemini', () => {
      const params = LangChainModelFactory.getDefaultModelParams('gemini');
      expect(params).toEqual({
        temperature: 0.7,
        maxOutputTokens: 2000
      });
    });

    it('should return default params for unknown provider', () => {
      const params = LangChainModelFactory.getDefaultModelParams('unknown');
      expect(params).toEqual({
        temperature: 0.7,
        maxTokens: 2000
      });
    });
  });

  describe('createChatModelWithParams', () => {
    it('should create model with custom parameters', () => {
      mockConfig.provider = 'openai';
      const customParams = {
        temperature: 0.5,
        maxTokens: 1000
      };

      const model = LangChainModelFactory.createChatModelWithParams(mockConfig, customParams);

      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: mockConfig.model,
        openAIApiKey: mockConfig.apiKey,
        configuration: {
          baseURL: mockConfig.baseURL
        },
        temperature: 0.5,
        maxTokens: 1000
      });
    });
  });
});
