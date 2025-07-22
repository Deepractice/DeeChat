/**
 * Jest测试环境设置
 */

// 设置测试超时时间
jest.setTimeout(30000);

// 模拟环境变量
process.env.NODE_ENV = 'test';

// 全局测试工具函数
global.createMockModelConfig = () => ({
  id: 'test-config-1',
  name: 'Test Model',
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'test-api-key',
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 清理函数
afterEach(() => {
  jest.clearAllMocks();
});
