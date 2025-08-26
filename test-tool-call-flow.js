#!/usr/bin/env node

/**
 * DeeChat工具调用流程测试脚本
 * 测试工具输出是否错误地替换了系统提示词
 */

const path = require('path');

// 设置环境变量
process.env.NODE_ENV = 'development';

console.log('🔍 [测试脚本] 开始测试DeeChat工具调用流程...');
console.log('🔍 [测试脚本] 工作目录:', process.cwd());

async function testToolCallFlow() {
  try {
    // 导入必要的服务（使用编译后的JS文件）
    const { CoreLLMServiceFactory } = require('./dist/main/main/services/llm/CoreLLMServiceFactory');
    const { StreamProcessor } = require('./dist/main/main/services/streaming/StreamProcessor');
    
    console.log('✅ [测试脚本] 模块导入成功');
    
    // 模拟一个简单的MCP客户端
    const mockMCPClient = {
      async listTools(serverId) {
        console.log(`🔧 [Mock MCP] listTools called for server: ${serverId}`);
        return [
          {
            name: 'welcome',
            description: 'PromptX欢迎工具',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'action',
            description: 'PromptX角色激活工具',
            inputSchema: {
              type: 'object',
              properties: {
                role: { type: 'string', description: '角色ID' }
              },
              required: ['role']
            }
          }
        ];
      },
      
      async callTool(serverId, toolName, args) {
        console.log(`🔧 [Mock MCP] callTool: ${serverId}::${toolName}`, args);
        
        if (toolName === 'welcome') {
          return `
🎉 PromptX智能角色系统欢迎您！

📦 系统角色 (3个)
- \`luban\`: 鲁班 → action("luban")
- \`nuwa\`: 女娲 → action("nuwa")  
- \`deechat-assistant\`: DeeChat助手 → action("deechat-assistant")

✨ 使用方式：
1. 查看可用角色：使用此工具
2. 激活角色：action("角色名称")
3. 学习资源：learn("@resource://资源名")

💡 开始您的AI协作之旅吧！
          `.trim();
        }
        
        if (toolName === 'action') {
          return `✅ 角色 ${args.role} 激活成功！现在我是专业的${args.role}角色。`;
        }
        
        return 'Mock工具执行结果';
      },
      
      getConnectedServers() {
        return ['promptx-builtin'];
      }
    };
    
    // 创建CoreLLMService实例
    console.log('🏭 [测试脚本] 创建CoreLLMService...');
    
    const factory = new CoreLLMServiceFactory();
    const coreService = await factory.createService({
      model: 'mock-model',
      baseURL: 'http://localhost',
      apiKey: 'test-key'
    }, mockMCPClient);
    
    console.log('✅ [测试脚本] CoreLLMService创建成功');
    
    // 模拟一个对话请求
    const testRequest = {
      llmRequest: {
        message: '你好，我想创建一个Python开发者角色',
        temperature: 0.7,
        maxTokens: 2000,
        sessionId: 'test-session-123'
      },
      configId: 'test-config',
      enableMCPTools: true,
      chatHistory: [],
      sessionId: 'test-session-123'
    };
    
    console.log('📤 [测试脚本] 发送测试请求...');
    console.log('📤 [测试脚本] 请求内容:', JSON.stringify(testRequest, null, 2));
    
    // 创建一个简单的chunk处理器来收集结果
    const chunks = [];
    const onChunk = (chunk) => {
      console.log(`📦 [测试脚本] 收到chunk: ${chunk.type}`);
      chunks.push(chunk);
      
      if (chunk.type === 'tool_start') {
        console.log(`🔧 [测试脚本] 工具开始: ${chunk.toolName}`, chunk.args);
      } else if (chunk.type === 'tool_result') {
        console.log(`✅ [测试脚本] 工具结果: ${chunk.toolName}`, 
          typeof chunk.result === 'string' ? chunk.result.substring(0, 200) + '...' : chunk.result);
      }
    };
    
    // 执行流式消息处理
    try {
      const result = await coreService.streamMessage(testRequest, onChunk);
      console.log('✅ [测试脚本] 流式处理完成');
      console.log('📊 [测试脚本] 总共收到', chunks.length, '个chunks');
      
      // 分析chunks
      const toolStartChunks = chunks.filter(c => c.type === 'tool_start');
      const toolResultChunks = chunks.filter(c => c.type === 'tool_result');
      const textChunks = chunks.filter(c => c.type === 'text');
      
      console.log('📊 [测试脚本] 工具调用分析:');
      console.log(`  - 工具开始: ${toolStartChunks.length}个`);
      console.log(`  - 工具结果: ${toolResultChunks.length}个`);
      console.log(`  - 文本块: ${textChunks.length}个`);
      
      if (toolStartChunks.length > 0) {
        console.log('🔧 [测试脚本] 调用的工具:');
        toolStartChunks.forEach((chunk, i) => {
          console.log(`  ${i + 1}. ${chunk.toolName}:`, chunk.args);
        });
      }
      
      if (toolResultChunks.length > 0) {
        console.log('📋 [测试脚本] 工具执行结果:');
        toolResultChunks.forEach((chunk, i) => {
          const preview = typeof chunk.result === 'string' 
            ? chunk.result.substring(0, 100) + (chunk.result.length > 100 ? '...' : '')
            : JSON.stringify(chunk.result);
          console.log(`  ${i + 1}. ${chunk.toolName}: ${preview}`);
        });
      }
      
    } catch (error) {
      console.error('❌ [测试脚本] 流式处理失败:', error);
      console.error('❌ [测试脚本] 错误详情:', error.stack);
    }
    
  } catch (error) {
    console.error('❌ [测试脚本] 测试失败:', error);
    console.error('❌ [测试脚本] 错误详情:', error.stack);
    process.exit(1);
  }
}

// 运行测试
testToolCallFlow().then(() => {
  console.log('🎉 [测试脚本] 测试完成');
  process.exit(0);
}).catch(error => {
  console.error('💥 [测试脚本] 测试崩溃:', error);
  process.exit(1);
});