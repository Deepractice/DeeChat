#!/usr/bin/env node

/**
 * MCP工具修复测试
 * 测试不同的Schema策略来解决参数传递问题
 */

const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

console.log('🔧 测试MCP工具修复方案...\n');

// 模拟MCP工具
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
  serverId: 'promptx-local'
};

// 策略1: 当前方案 (全部必需字段)
function createToolWithRequiredFields(mcpTool) {
  console.log('📋 策略1: 全部必需字段');
  
  const zodFields = {};
  const required = mcpTool.inputSchema.required || [];
  
  for (const [key, propSchema] of Object.entries(mcpTool.inputSchema.properties)) {
    if (required.includes(key)) {
      zodFields[key] = z.string().describe(propSchema.description || `${key} parameter`);
      console.log(`  ✅ ${key}: z.string() (required)`);
    } else {
      zodFields[key] = z.string().optional().describe(propSchema.description || `${key} parameter (optional)`);
      console.log(`  ⭕ ${key}: z.string().optional()`);
    }
  }
  
  const schema = z.object(zodFields);
  return tool(
    async (args) => {
      console.log(`  🛠️  参数:`, JSON.stringify(args, null, 2));
      return `策略1执行: ${JSON.stringify(args)}`;
    },
    {
      name: `${mcpTool.serverId}__${mcpTool.name}_v1`,
      description: mcpTool.description,
      schema: schema
    }
  );
}

// 策略2: 全部设为可选
function createToolWithOptionalFields(mcpTool) {
  console.log('\n📋 策略2: 全部可选字段');
  
  const zodFields = {};
  
  for (const [key, propSchema] of Object.entries(mcpTool.inputSchema.properties)) {
    zodFields[key] = z.string().optional().describe(propSchema.description || `${key} parameter`);
    console.log(`  ⭕ ${key}: z.string().optional()`);
  }
  
  const schema = z.object(zodFields);
  return tool(
    async (args) => {
      console.log(`  🛠️  参数:`, JSON.stringify(args, null, 2));
      // 在执行时检查必需参数
      if (!args.resource) {
        return `❌ 错误：缺少必需参数 resource`;
      }
      return `策略2执行: ${JSON.stringify(args)}`;
    },
    {
      name: `${mcpTool.serverId}__${mcpTool.name}_v2`,
      description: mcpTool.description,
      schema: schema
    }
  );
}

// 策略3: 使用更宽松的any类型
function createToolWithAnyFields(mcpTool) {
  console.log('\n📋 策略3: 宽松any类型');
  
  const zodFields = {};
  
  for (const [key, propSchema] of Object.entries(mcpTool.inputSchema.properties)) {
    zodFields[key] = z.any().optional().describe(propSchema.description || `${key} parameter`);
    console.log(`  🌐 ${key}: z.any().optional()`);
  }
  
  const schema = z.object(zodFields);
  return tool(
    async (args) => {
      console.log(`  🛠️  参数:`, JSON.stringify(args, null, 2));
      return `策略3执行: ${JSON.stringify(args)}`;
    },
    {
      name: `${mcpTool.serverId}__${mcpTool.name}_v3`,
      description: mcpTool.description,
      schema: schema
    }
  );
}

// 策略4: 空schema
function createToolWithEmptySchema(mcpTool) {
  console.log('\n📋 策略4: 空schema');
  
  const schema = z.object({});
  return tool(
    async (args) => {
      console.log(`  🛠️  参数:`, JSON.stringify(args, null, 2));
      return `策略4执行: ${JSON.stringify(args)}`;
    },
    {
      name: `${mcpTool.serverId}__${mcpTool.name}_v4`,
      description: mcpTool.description + ' (accepts any parameters)',
      schema: schema
    }
  );
}

// 测试所有策略
async function testAllStrategies() {
  const tools = [
    createToolWithRequiredFields(mockMCPTool),
    createToolWithOptionalFields(mockMCPTool),
    createToolWithAnyFields(mockMCPTool),
    createToolWithEmptySchema(mockMCPTool)
  ];
  
  const testCases = [
    { name: '带参数', args: { resource: '@manual://filesystem' } },
    { name: '空参数', args: {} },
    { name: '额外参数', args: { resource: 'test', extra: 'value' } }
  ];
  
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    console.log(`\n🧪 测试${tool.name}:`);
    
    for (const testCase of testCases) {
      console.log(`\n  📞 ${testCase.name}: ${JSON.stringify(testCase.args)}`);
      try {
        const result = await tool.invoke(testCase.args);
        console.log(`  ✅ 成功: ${result}`);
      } catch (error) {
        console.log(`  ❌ 失败: ${error.message}`);
      }
    }
  }
}

// 运行测试
testAllStrategies().catch(console.error);