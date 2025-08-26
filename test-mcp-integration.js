#!/usr/bin/env node

/**
 * MCP工具集成测试脚本 - TDD方式验证修复效果
 */

const { ChatOpenAI } = require('@langchain/openai');

// 导入我们修复后的MCPToolConverter
async function loadMCPToolConverter() {
  try {
    const { MCPToolConverter } = await import('./dist/main/shared/langchain/MCPToolConverter.js');
    return MCPToolConverter;
  } catch (error) {
    console.error('❌ 无法加载MCPToolConverter:', error.message);
    console.error('💡 请先运行: npm run build:main');
    process.exit(1);
  }
}

// 模拟MCP服务
function createMockMCPService() {
  return {
    getAllTools: async () => {
      return [
        {
          name: 'learn',
          description: 'Learn from a resource',
          serverId: 'promptx-local',
          serverName: 'PromptX Local',
          inputSchema: {
            type: 'object',
            properties: {
              resource: {
                type: 'string',
                description: 'The resource to learn from'
              }
            },
            required: ['resource']
          }
        },
        {
          name: 'action',
          description: 'Activate a role',
          serverId: 'promptx-local',
          serverName: 'PromptX Local',
          inputSchema: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                description: 'Role ID to activate'
              }
            },
            required: ['role']
          }
        }
      ];
    },
    
    callTool: async (request) => {
      console.log(`🔧 [MockMCP] 工具调用: ${request.toolName}`, request.arguments);
      
      if (!request.arguments || Object.keys(request.arguments).length === 0) {
        return {
          success: false,
          error: `MCP error -32602: Tool '${request.toolName}' parameter validation failed: missing required parameters`
        };
      }
      
      return {
        success: true,
        result: `✅ Mock执行成功: ${request.toolName} with args ${JSON.stringify(request.arguments)}`
      };
    }
  };
}

// 测试用例
const testCases = [
  {
    name: '正常调用-带参数',
    prompt: '请使用learn工具学习资源 "@manual://filesystem"',
    expectation: 'success',
    description: '工具应该正常调用并传递参数'
  },
  {
    name: '缺少参数调用',
    prompt: '请使用learn工具',
    expectation: 'parameter_validation_error',
    description: '应该在工具执行时检测到缺少必需参数'
  },
  {
    name: '角色激活',
    prompt: '请激活nuwa角色',
    expectation: 'success',
    description: '角色激活工具应该正常工作'
  }
];

async function runTest(MCPToolConverter, testCase) {
  console.log(`\n🧪 测试: ${testCase.name}`);
  console.log(`📝 描述: ${testCase.description}`);
  console.log(`💬 输入: "${testCase.prompt}"`);
  
  try {
    // 创建模拟MCP服务
    const mockMCPService = createMockMCPService();
    
    // 创建工具转换器
    const converter = new MCPToolConverter(mockMCPService);
    
    // 转换所有MCP工具
    console.log(`🔄 转换MCP工具...`);
    const langchainTools = await converter.convertAllMCPTools();
    console.log(`✅ 转换完成，得到 ${langchainTools.length} 个工具`);
    
    // 创建模型并绑定工具
    const model = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
      apiKey: 'test-key-123',  // 使用假的API密钥进行测试
      configuration: {
        baseURL: 'http://localhost:8080'  // 使用本地测试服务器
      }
    });
    
    // 绑定工具到模型
    const modelWithTools = model.bindTools(langchainTools);
    console.log(`🔗 工具已绑定到模型`);
    
    // 模拟工具调用（不实际发送API请求）
    console.log(`📞 模拟工具调用测试...`);
    
    // 直接测试工具调用
    let testResult = 'unknown';
    
    if (testCase.name.includes('带参数')) {
      // 测试带参数的调用
      const learnTool = langchainTools.find(t => t.name.includes('learn'));
      if (learnTool) {
        try {
          const result = await learnTool.invoke({ resource: '@manual://filesystem' });
          console.log(`📤 工具执行结果: ${result}`);
          testResult = result.includes('Mock执行成功') ? 'success' : 'failed';
        } catch (error) {
          console.log(`❌ 工具调用失败: ${error.message}`);
          testResult = 'error';
        }
      }
    } else if (testCase.name.includes('缺少参数')) {
      // 测试缺少参数的调用
      const learnTool = langchainTools.find(t => t.name.includes('learn'));
      if (learnTool) {
        try {
          const result = await learnTool.invoke({});
          console.log(`📤 工具执行结果: ${result}`);
          testResult = result.includes('参数验证失败') ? 'parameter_validation_error' : 'unexpected_success';
        } catch (error) {
          console.log(`❌ 工具调用失败: ${error.message}`);
          testResult = 'schema_error';
        }
      }
    } else if (testCase.name.includes('角色激活')) {
      // 测试角色激活
      const actionTool = langchainTools.find(t => t.name.includes('action'));
      if (actionTool) {
        try {
          const result = await actionTool.invoke({ role: 'nuwa' });
          console.log(`📤 工具执行结果: ${result}`);
          testResult = result.includes('Mock执行成功') ? 'success' : 'failed';
        } catch (error) {
          console.log(`❌ 工具调用失败: ${error.message}`);
          testResult = 'error';
        }
      }
    }
    
    // 验证结果
    const passed = testResult === testCase.expectation;
    console.log(`🎯 期望结果: ${testCase.expectation}`);
    console.log(`📊 实际结果: ${testResult}`);
    console.log(`${passed ? '✅ 测试通过' : '❌ 测试失败'}`);
    
    return { name: testCase.name, passed, expected: testCase.expectation, actual: testResult };
    
  } catch (error) {
    console.log(`💥 测试异常: ${error.message}`);
    return { name: testCase.name, passed: false, expected: testCase.expectation, actual: 'exception', error: error.message };
  }
}

async function runAllTests() {
  console.log('🚀 开始MCP工具集成测试...\n');
  
  // 加载MCPToolConverter
  const MCPToolConverter = await loadMCPToolConverter();
  console.log('✅ MCPToolConverter加载成功\n');
  
  const results = [];
  
  // 运行所有测试
  for (const testCase of testCases) {
    const result = await runTest(MCPToolConverter, testCase);
    results.push(result);
  }
  
  // 输出测试总结
  console.log('\n📋 测试总结');
  console.log('='.repeat(50));
  
  let passedCount = 0;
  let failedCount = 0;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (!result.passed) {
      console.log(`     期望: ${result.expected}, 实际: ${result.actual}`);
      if (result.error) {
        console.log(`     错误: ${result.error}`);
      }
    }
    
    if (result.passed) passedCount++;
    else failedCount++;
  });
  
  console.log('='.repeat(50));
  console.log(`📊 总计: ${results.length} 个测试`);
  console.log(`✅ 通过: ${passedCount}`);
  console.log(`❌ 失败: ${failedCount}`);
  
  if (failedCount === 0) {
    console.log('\n🎉 所有测试通过！MCP工具参数传递修复成功！');
  } else {
    console.log(`\n⚠️  有 ${failedCount} 个测试失败，需要进一步调试`);
  }
  
  process.exit(failedCount === 0 ? 0 : 1);
}

// 运行测试
runAllTests().catch(error => {
  console.error('💥 测试运行失败:', error);
  process.exit(1);
});