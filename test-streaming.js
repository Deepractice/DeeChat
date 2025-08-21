/**
 * 流式输出功能测试脚本
 * 直接测试LangChain流式API
 */

const { LangChainLLMService } = require('./dist/main/shared/langchain/LangChainLLMService.js');
const { LangChainModelFactory } = require('./dist/main/shared/langchain/LangChainModelFactory.js');
const { ModelConfigEntity } = require('./dist/main/shared/entities/ModelConfigEntity.js');

async function testStreamingOutput() {
  console.log('🌊 开始测试流式输出功能...');
  
  try {
    // 创建测试配置
    const testConfig = new ModelConfigEntity({
      id: 'test-config',
      name: 'Test ChatAnywhere',
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
      baseURL: 'https://api.chatanywhere.tech/v1/',
      isEnabled: true,
      status: 'untested',
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      availableModels: ['gpt-4o-mini'],
      enabledModels: ['gpt-4o-mini']
    });

    console.log('📋 测试配置:', testConfig.name, testConfig.model);

    // 创建LangChain服务实例
    const langChainService = new LangChainLLMService();
    
    // 手动设置配置缓存
    langChainService.configCache = new Map();
    langChainService.configCache.set('test-config', testConfig);
    
    // 设置流式更新回调
    const streamUpdates = [];
    const onStreamUpdate = (update) => {
      console.log('🌊 流式更新:', JSON.stringify(update, null, 2));
      streamUpdates.push(update);
      
      if (update.partialContent) {
        process.stdout.write('📝 当前内容: ' + update.partialContent + '\n');
      }
    };

    console.log('🚀 开始发送流式消息...');
    
    // 调用流式方法
    const result = await langChainService.streamMessage(
      '请用20个字简单介绍一下人工智能',
      'test-config', 
      onStreamUpdate,
      'test-session'
    );

    console.log('✅ 流式输出完成!');
    console.log('📊 最终结果:', result);
    console.log('📈 总共收到', streamUpdates.length, '次更新');
    
    return { success: true, result, updates: streamUpdates.length };
    
  } catch (error) {
    console.error('❌ 流式输出测试失败:', error);
    return { success: false, error: error.message };
  }
}

// 运行测试
testStreamingOutput()
  .then(result => {
    console.log('🎯 测试结果:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 测试异常:', error);
    process.exit(1);
  });