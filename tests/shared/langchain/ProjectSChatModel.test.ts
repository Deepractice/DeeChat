import { ProjectSChatModel } from '../../../src/shared/langchain/ProjectSChatModel';
import { ModelConfigEntity } from '../../../src/shared/entities/ModelConfigEntity';
import { UniversalLLMProvider } from '../../../src/shared/providers/UniversalLLMProvider';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CallbackManager } from '@langchain/core/callbacks/manager';

// Mock UniversalLLMProvider
jest.mock('../../../src/shared/providers/UniversalLLMProvider');

describe('ProjectSChatModel', () => {
  let mockConfig: ModelConfigEntity;
  let mockUniversalProvider: jest.Mocked<UniversalLLMProvider>;
  let model: ProjectSChatModel;

  beforeEach(() => {
    mockConfig = global.createMockModelConfig();
    
    // Setup mock for UniversalLLMProvider
    mockUniversalProvider = new UniversalLLMProvider(mockConfig) as jest.Mocked<UniversalLLMProvider>;
    (UniversalLLMProvider as jest.Mock).mockImplementation(() => mockUniversalProvider);
    
    // Mock sendMessage method
    mockUniversalProvider.sendMessage.mockResolvedValue({
      content: 'Mock response',
      role: 'assistant'
    });

    // Create model instance
    model = new ProjectSChatModel({ config: mockConfig });
  });

  describe('_llmType', () => {
    it('should return the correct LLM type', () => {
      expect(model._llmType()).toBe('projects_universal');
    });
  });

  describe('modelName and providerName', () => {
    it('should return the correct model name', () => {
      expect(model.modelName).toBe(mockConfig.model);
    });

    it('should return the correct provider name', () => {
      expect(model.providerName).toBe(mockConfig.provider);
    });
  });

  describe('_call', () => {
    it('should convert messages and call UniversalLLMProvider', async () => {
      const messages = [
        new SystemMessage('You are a helpful assistant'),
        new HumanMessage('Hello, how are you?')
      ];

      const result = await model._call(messages, {}, undefined);

      expect(mockUniversalProvider.sendMessage).toHaveBeenCalledWith({
        message: 'User: Hello, how are you?',
        systemPrompt: 'You are a helpful assistant',
        stream: false
      });
      expect(result).toBe('Mock response');
    });

    it('should handle messages without system message', async () => {
      const messages = [
        new HumanMessage('Hello, how are you?')
      ];

      const result = await model._call(messages, {}, undefined);

      expect(mockUniversalProvider.sendMessage).toHaveBeenCalledWith({
        message: 'Hello, how are you?',
        systemPrompt: undefined,
        stream: false
      });
      expect(result).toBe('Mock response');
    });

    it('should handle error from UniversalLLMProvider', async () => {
      mockUniversalProvider.sendMessage.mockRejectedValue(new Error('API error'));
      
      const messages = [
        new HumanMessage('Hello')
      ];

      await expect(model._call(messages, {}, undefined)).rejects.toThrow('ProjectS LLM调用失败: API error');
    });

    it('should pass temperature and maxTokens to UniversalLLMProvider', async () => {
      const messages = [
        new HumanMessage('Hello')
      ];
      
      const options = {
        temperature: 0.5,
        max_tokens: 1000
      };

      await model._call(messages, options, undefined);

      expect(mockUniversalProvider.sendMessage).toHaveBeenCalledWith({
        message: 'Hello',
        systemPrompt: undefined,
        temperature: 0.5,
        maxTokens: 1000,
        stream: false
      });
    });
  });

  describe('_streamResponseChunks', () => {
    it('should return response as a single chunk', async () => {
      const messages = [
        new HumanMessage('Hello')
      ];
      
      const generator = model._streamResponseChunks(messages, {}, undefined);
      const result = await generator.next();
      
      expect(result.value.text).toBe('Mock response');
      expect(result.done).toBe(false);
      
      const end = await generator.next();
      expect(end.done).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should call getModelInfo on UniversalLLMProvider', () => {
      mockUniversalProvider.getModelInfo.mockReturnValue({
        name: 'Test Model',
        maxTokens: 4000
      });
      
      const info = model.getModelInfo();
      
      expect(mockUniversalProvider.getModelInfo).toHaveBeenCalledWith(mockConfig.model);
      expect(info).toEqual({
        name: 'Test Model',
        maxTokens: 4000
      });
    });

    it('should call testConnection on UniversalLLMProvider', async () => {
      mockUniversalProvider.testConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful'
      });
      
      const result = await model.testConnection();
      
      expect(mockUniversalProvider.testConnection).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Connection successful'
      });
    });

    it('should call validateConfig on UniversalLLMProvider', () => {
      mockUniversalProvider.validateConfig.mockReturnValue(true);
      
      const result = model.validateConfig();
      
      expect(mockUniversalProvider.validateConfig).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
