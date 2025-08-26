/**
 * DeeChat工具调用诊断测试脚本
 * 
 * 目标：
 * 1. 测试PromptX工具的正确调用方式
 * 2. 模拟StreamProcessor的工具调用流程
 * 3. 诊断AI生成空参数的原因
 */

const path = require('path');
const { spawn } = require('child_process');

console.log('🔧 [工具调用诊断] 开始测试...\n');

// 1. 直接测试PromptX MCP工具
async function testPromptXToolsDirect() {
  console.log('📋 [测试1] 直接测试PromptX MCP工具');
  console.log('=' .repeat(50));
  
  // 模拟正确的工具调用
  const correctToolCalls = [
    {
      name: 'promptx-builtin__welcome',
      args: {}, // welcome工具不需要参数
      description: '获取角色列表'
    },
    {
      name: 'promptx-builtin__learn', 
      args: { resource: 'https://example.com/doc' },
      description: '学习资源，需要resource参数'
    },
    {
      name: 'promptx-builtin__action',
      args: { roleId: 'deechat-assistant' },
      description: '激活角色，需要roleId参数'
    },
    {
      name: 'promptx-builtin__remember',
      args: { role: 'deechat-assistant', content: 'test memory' },
      description: '记忆信息，需要role和content参数'
    }
  ];
  
  correctToolCalls.forEach(toolCall => {
    console.log(`✅ 正确调用: ${toolCall.name}`);
    console.log(`   参数: ${JSON.stringify(toolCall.args)}`);
    console.log(`   说明: ${toolCall.description}\n`);
  });
  
  // 模拟错误的工具调用（AI当前的问题）
  console.log('❌ 当前AI的问题调用:');
  correctToolCalls.forEach(toolCall => {
    console.log(`❌ 错误调用: ${toolCall.name}`);
    console.log(`   参数: {} (空对象)`);
    console.log(`   问题: 缺少必需参数\n`);
  });
}

// 2. 测试StreamProcessor的工具解析逻辑
async function testStreamProcessorFlow() {
  console.log('📋 [测试2] StreamProcessor工具调用流程');
  console.log('=' .repeat(50));
  
  // 模拟LangChain工具调用chunk
  const mockToolCallChunk = {
    content: '',
    tool_calls: [
      {
        id: 'call_123',
        name: 'promptx-builtin__learn',
        args: {} // 这是问题所在：AI生成空参数
      }
    ]
  };
  
  console.log('🔍 模拟AI生成的工具调用:');
  console.log(JSON.stringify(mockToolCallChunk, null, 2));
  
  // 模拟StreamProcessor的parseToolName逻辑
  const toolCall = mockToolCallChunk.tool_calls[0];
  const parts = toolCall.name.split('__');
  
  console.log('\n🔧 StreamProcessor解析结果:');
  console.log(`   完整工具名: ${toolCall.name}`);
  console.log(`   解析parts: [${parts.join(', ')}]`);
  console.log(`   serverId: ${parts[0]}`);
  console.log(`   actualToolName: ${parts[1]}`);
  console.log(`   工具参数: ${JSON.stringify(toolCall.args)}`);
  console.log(`   参数为空?: ${JSON.stringify(toolCall.args) === '{}'}`);
  
  // 检查参数问题
  if (JSON.stringify(toolCall.args) === '{}') {
    console.log('\n❌ 发现问题: AI生成了空参数对象');
    console.log('   预期: { resource: "some-url" }');
    console.log('   实际: {}');
    console.log('   原因: AI没有理解工具需要的参数格式');
  }
}

// 3. 测试系统提示词中的工具描述
async function testToolPromptGeneration() {
  console.log('📋 [测试3] 系统提示词工具描述分析');
  console.log('=' .repeat(50));
  
  // 模拟SmartLayeredPromptSystem生成的工具部分
  const toolSection = `
# 🔧 可用工具

## PromptX内置工具
- promptx-builtin__welcome: 获取所有可用角色列表
- promptx-builtin__learn: 学习指定资源内容，需要参数: resource (URL)
- promptx-builtin__action: 激活指定角色，需要参数: roleId (角色ID)
- promptx-builtin__remember: 记忆信息到指定角色，需要参数: role, content
- promptx-builtin__recall: 回忆指定角色的记忆，需要参数: role, query?
- promptx-builtin__init: 初始化工作区，需要参数: workingDirectory?, ideType?
- promptx-builtin__toolx: 执行工具，需要参数: toolResource, parameters

请根据用户需求智能选择合适的工具。调用工具时必须提供所需的参数。
`;
  
  console.log('🔍 系统提示词工具部分:');
  console.log(toolSection);
  
  // 分析问题
  console.log('📊 分析结果:');
  console.log('✅ 工具描述包含了参数要求');
  console.log('✅ 说明了哪些参数是必需的');
  console.log('❓ 问题可能在于:');
  console.log('   1. AI模型没有正确解析参数格式');
  console.log('   2. LangChain工具转换过程丢失了参数信息');
  console.log('   3. 工具schema定义不完整');
}

// 4. 模拟正确的工具调用流程
async function simulateCorrectToolFlow() {
  console.log('📋 [测试4] 模拟正确的工具调用流程');
  console.log('=' .repeat(50));
  
  const scenarios = [
    {
      userInput: '帮我学习这个文档: https://docs.example.com',
      expectedTool: 'promptx-builtin__learn',
      expectedArgs: { resource: 'https://docs.example.com' },
      aiShouldGenerate: '我来帮你学习这个文档',
      toolResponse: '文档学习完成'
    },
    {
      userInput: '激活deechat-assistant角色',
      expectedTool: 'promptx-builtin__action', 
      expectedArgs: { roleId: 'deechat-assistant' },
      aiShouldGenerate: '正在激活deechat-assistant角色',
      toolResponse: '角色激活成功'
    }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`\n🎯 场景 ${index + 1}: ${scenario.userInput}`);
    console.log(`   期望工具: ${scenario.expectedTool}`);
    console.log(`   期望参数: ${JSON.stringify(scenario.expectedArgs)}`);
    console.log(`   AI应生成: ${scenario.aiShouldGenerate}`);
    console.log(`   工具响应: ${scenario.toolResponse}`);
  });
}

// 5. 检查工具定义和Schema
async function checkToolDefinitions() {
  console.log('📋 [测试5] 检查工具定义和Schema');
  console.log('=' .repeat(50));
  
  console.log('🔍 需要检查的文件:');
  const filesToCheck = [
    'src/shared/langchain/MCPToolConverter.ts - MCP工具转换器',
    'src/main/services/mcp/servers/InProcessMCPServer.ts - MCP服务器',
    'resources/promptx/package/src/lib/tool/ - PromptX工具定义',
    'src/shared/entities/MCPToolEntity.ts - MCP工具实体定义'
  ];
  
  filesToCheck.forEach(file => {
    console.log(`   📄 ${file}`);
  });
  
  console.log('\n🎯 检查要点:');
  console.log('   1. 工具schema是否包含required参数定义');
  console.log('   2. MCPToolConverter是否正确转换参数信息');
  console.log('   3. LangChain工具格式是否符合标准');
  console.log('   4. 工具描述是否足够明确');
}

// 主测试流程
async function runDiagnosticTests() {
  try {
    await testPromptXToolsDirect();
    console.log('\n');
    
    await testStreamProcessorFlow(); 
    console.log('\n');
    
    await testToolPromptGeneration();
    console.log('\n');
    
    await simulateCorrectToolFlow();
    console.log('\n');
    
    await checkToolDefinitions();
    
    console.log('\n🎯 [诊断总结]');
    console.log('=' .repeat(50));
    console.log('❌ 主要问题: AI生成工具调用时参数为空对象 {}');
    console.log('🔍 可能原因:');
    console.log('   1. 工具schema缺少required字段定义');
    console.log('   2. 系统提示词中工具描述不够精确');
    console.log('   3. MCPToolConverter转换过程丢失参数信息');
    console.log('   4. LangChain工具格式不符合AI模型期望');
    console.log('\n🔧 下一步调试方向:');
    console.log('   1. 检查MCPToolConverter.ts中的工具转换逻辑');
    console.log('   2. 验证PromptX工具的schema定义');
    console.log('   3. 测试LangChain工具调用的参数传递');
    console.log('   4. 优化系统提示词中的工具描述格式');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 执行测试
runDiagnosticTests();