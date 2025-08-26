#!/usr/bin/env node

/**
 * MCP工具调用调试脚本
 * 直接测试MCP工具参数传递问题
 */

const { ChatAnthropic } = require('@langchain/anthropic');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

console.log('🔧 开始MCP工具调用调试测试...\n');

// 1. 模拟一个简单的MCP工具
const mockMCPTool = {
  name: 'learn',
  description: 'Learn from a resource',
  inputSchema: {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        description: 'The resource to learn from'
      }
    },
    required: ['resource']
  },
  serverId: 'promptx-local',
  serverName: 'PromptX Local'
};

console.log('📋 模拟MCP工具:', JSON.stringify(mockMCPTool, null, 2));

// 2. 转换为LangChain工具 (简化版MCPToolConverter逻辑)
function convertMCPToolSimple(mcpTool) {
  console.log('\n🔄 开始转换MCP工具...');
  
  // 生成带server前缀的工具名称
  const toolNameWithPrefix = `${mcpTool.serverId}__${mcpTool.name}`;
  console.log(`🏷️  工具名称: ${mcpTool.name} -> ${toolNameWithPrefix}`);
  
  // 构建Zod schema
  let finalSchema;
  if (mcpTool.inputSchema?.properties && Object.keys(mcpTool.inputSchema.properties).length > 0) {
    const zodFields = {};
    const required = mcpTool.inputSchema.required || [];
    
    console.log('📝 构建Zod字段:');
    for (const [key, propSchema] of Object.entries(mcpTool.inputSchema.properties)) {
      const prop = propSchema;
      
      if (required.includes(key)) {
        zodFields[key] = z.string().describe(prop.description || `${key} parameter`);
        console.log(`  ✅ ${key}: z.string() (required)`);
      } else {
        zodFields[key] = z.string().optional().describe(prop.description || `${key} parameter (optional)`);
        console.log(`  ⭕ ${key}: z.string().optional()`);
      }
    }
    
    finalSchema = z.object(zodFields);
    console.log('🏗️  Schema构建完成');
  } else {
    finalSchema = z.object({});
    console.log('📭 使用空schema');
  }
  
  // 测试schema解析
  console.log('\n🧪 测试Schema解析:');
  try {
    const testEmpty = finalSchema.safeParse({});
    console.log(`  空对象 {}: ${testEmpty.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!testEmpty.success) {
      console.log(`  错误:`, testEmpty.error.issues);
    }
    
    const testWithData = finalSchema.safeParse({ resource: 'test-resource' });
    console.log(`  带数据 {resource: 'test-resource'}: ${testWithData.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (!testWithData.success) {
      console.log(`  错误:`, testWithData.error.issues);
    }
  } catch (error) {
    console.log(`  ❌ Schema测试失败:`, error.message);
  }
  
  // 创建LangChain工具
  const langchainTool = tool(
    async (args) => {
      console.log(`\n🛠️  工具执行: ${toolNameWithPrefix}`);
      console.log(`📥 接收参数:`, JSON.stringify(args, null, 2));
      console.log(`📊 参数类型: ${typeof args}, 键数量: ${Object.keys(args || {}).length}`);
      
      // 模拟MCP调用
      if (args && args.resource) {
        return `学习资源 "${args.resource}" 成功！获得了新知识。`;
      } else {
        return `❌ 错误：缺少必需参数 resource`;
      }
    },
    {
      name: toolNameWithPrefix,
      description: mcpTool.description || `MCP工具: ${mcpTool.name}`,
      schema: finalSchema
    }
  );
  
  console.log(`✅ LangChain工具创建成功: ${toolNameWithPrefix}\n`);
  return langchainTool;
}

// 3. 测试工具转换
const langchainTool = convertMCPToolSimple(mockMCPTool);

// 4. 测试直接工具调用
async function testDirectToolCall() {
  console.log('🎯 === 直接工具调用测试 ===');
  
  try {
    // 测试1: 带参数调用
    console.log('\n📞 测试1: 直接调用工具 (带参数)');
    const result1 = await langchainTool.invoke({ resource: '@manual://filesystem' });
    console.log('📤 结果1:', result1);
    
    // 测试2: 空参数调用
    console.log('\n📞 测试2: 直接调用工具 (空参数)');
    const result2 = await langchainTool.invoke({});
    console.log('📤 结果2:', result2);
    
  } catch (error) {
    console.error('❌ 直接调用失败:', error.message);
  }
}

// 5. 测试LangChain模型绑定和调用
async function testLangChainModelCall() {
  console.log('\n🤖 === LangChain模型调用测试 ===');
  
  // 检查环境变量
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('⚠️  未设置ANTHROPIC_API_KEY，跳过模型测试');
    return;
  }
  
  try {
    // 初始化模型
    const model = new ChatAnthropic({
      model: 'claude-3-haiku-20240307',
      temperature: 0,
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    console.log('🔗 绑定工具到模型...');
    const modelWithTools = model.bindTools([langchainTool]);
    console.log('✅ 工具绑定成功');
    
    // 测试调用
    console.log('\n💬 发送测试消息...');
    const response = await modelWithTools.invoke([
      {
        role: 'human',
        content: '请使用learn工具学习资源 "@manual://filesystem"'
      }
    ]);
    
    console.log('📨 模型响应:', JSON.stringify(response, null, 2));
    
    // 检查是否有工具调用
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log('\n🎯 发现工具调用:');
      for (const toolCall of response.tool_calls) {
        console.log(`  工具: ${toolCall.name}`);
        console.log(`  参数: ${JSON.stringify(toolCall.args, null, 2)}`);
        
        // 执行工具调用
        console.log('\n🏃 执行工具调用...');
        const toolResult = await langchainTool.invoke(toolCall.args);
        console.log('📤 工具结果:', toolResult);
      }
    } else {
      console.log('⚠️  模型没有生成工具调用');
    }
    
  } catch (error) {
    console.error('❌ 模型测试失败:', error.message);
  }
}

// 6. 主测试流程
async function runTests() {
  console.log('🚀 开始测试...\n');
  
  await testDirectToolCall();
  await testLangChainModelCall();
  
  console.log('\n🎉 测试完成！');
  console.log('\n💡 如果直接调用成功但模型调用失败，说明问题在LangChain的工具调用机制');
  console.log('💡 如果直接调用也失败，说明问题在工具转换逻辑');
}

// 执行测试
runTests().catch(console.error);