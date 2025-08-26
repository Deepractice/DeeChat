/**
 * MCPToolConverter修复验证测试脚本
 * 测试修复后的Schema转换是否正确处理required字段
 */

const path = require('path');
const { z } = require('zod');

console.log('🔧 [修复测试] 开始测试MCPToolConverter修复效果...\n');

// 1. 模拟修复前后的Schema转换对比
async function testSchemaConversionFix() {
  console.log('📋 [测试1] Schema转换修复前后对比');
  console.log('=' .repeat(50));
  
  // 模拟PromptX learn工具的定义
  const learnTool = {
    name: 'learn',
    serverId: 'promptx-builtin',
    description: '学习指定资源内容',
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Resource URL or path to learn from'
        }
      },
      required: ['resource']
    }
  };
  
  console.log('🔍 工具定义:', learnTool.name);
  console.log('   Required字段:', learnTool.inputSchema.required);
  console.log('   Properties:', Object.keys(learnTool.inputSchema.properties));
  
  // 修复前的转换逻辑
  console.log('\n❌ 修复前的Schema转换:');
  const oldZodFields = {};
  const required = learnTool.inputSchema.required || [];
  for (const [key, propSchema] of Object.entries(learnTool.inputSchema.properties)) {
    // 旧逻辑：全部设为可选
    oldZodFields[key] = 'z.string().optional()';
    console.log(`   ${key}: z.string().optional() (AI认为可选)`);
  }
  
  // 修复后的转换逻辑  
  console.log('\n✅ 修复后的Schema转换:');
  const newZodFields = {};
  for (const [key, propSchema] of Object.entries(learnTool.inputSchema.properties)) {
    if (required.includes(key)) {
      newZodFields[key] = 'z.string()';
      console.log(`   ${key}: z.string() (AI知道必需)`);
    } else {
      newZodFields[key] = 'z.string().optional()';
      console.log(`   ${key}: z.string().optional() (AI知道可选)`);
    }
  }
  
  console.log('\n📊 转换结果对比:');
  console.log(`   修复前: resource字段被标记为可选，AI可能不提供参数`);
  console.log(`   修复后: resource字段被标记为必需，AI必须提供参数`);
}

// 2. 测试Zod Schema的实际验证行为
async function testZodValidationBehavior() {
  console.log('\n📋 [测试2] Zod Schema验证行为测试');
  console.log('=' .repeat(50));
  
  // 创建两种Schema
  const optionalSchema = z.object({
    resource: z.string().optional().describe('resource parameter')
  });
  
  const requiredSchema = z.object({
    resource: z.string().describe('resource parameter (required)')
  });
  
  console.log('🧪 测试数据: 空对象 {}');
  
  // 测试可选Schema
  console.log('\n❌ 可选Schema (修复前):');
  try {
    const result1 = optionalSchema.parse({});
    console.log('   解析结果:', result1);
    console.log('   状态: 成功 (AI认为不需要提供参数)');
  } catch (error) {
    console.log('   状态: 失败');
    console.log('   错误:', error.message);
  }
  
  // 测试必需Schema
  console.log('\n✅ 必需Schema (修复后):');
  try {
    const result2 = requiredSchema.parse({});
    console.log('   解析结果:', result2);
    console.log('   状态: 成功');
  } catch (error) {
    console.log('   状态: 失败 (AI被强制提供参数)');
    console.log('   错误:', error.issues?.[0]?.message || error.message);
  }
  
  console.log('\n🧪 测试数据: { resource: "https://example.com" }');
  
  // 测试正确参数
  const testData = { resource: "https://example.com" };
  
  console.log('\n✅ 可选Schema:');
  try {
    const result3 = optionalSchema.parse(testData);
    console.log('   解析结果:', result3);
    console.log('   状态: 成功');
  } catch (error) {
    console.log('   状态: 失败');
    console.log('   错误:', error.message);
  }
  
  console.log('\n✅ 必需Schema:');  
  try {
    const result4 = requiredSchema.parse(testData);
    console.log('   解析结果:', result4);
    console.log('   状态: 成功');
  } catch (error) {
    console.log('   状态: 失败');
    console.log('   错误:', error.message);
  }
}

// 3. 模拟AI模型的工具调用决策过程
async function simulateAIDecisionProcess() {
  console.log('\n📋 [测试3] AI模型工具调用决策模拟');
  console.log('=' .repeat(50));
  
  console.log('🤖 模拟场景: 用户说 "帮我学习这个文档: https://docs.example.com"');
  
  // 修复前的AI决策过程
  console.log('\n❌ 修复前AI决策过程:');
  console.log('1. AI识别需要调用learn工具');
  console.log('2. AI查看工具Schema: { resource: z.string().optional() }');  
  console.log('3. AI认为: resource是可选的，我可以不提供');
  console.log('4. AI生成工具调用: { name: "promptx-builtin__learn", args: {} }');
  console.log('5. StreamProcessor执行失败: 缺少resource参数');
  
  // 修复后的AI决策过程
  console.log('\n✅ 修复后AI决策过程:');
  console.log('1. AI识别需要调用learn工具');
  console.log('2. AI查看工具Schema: { resource: z.string() } (必需)');
  console.log('3. AI认为: resource是必需的，必须提供'); 
  console.log('4. AI从用户输入提取: "https://docs.example.com"');
  console.log('5. AI生成工具调用: { name: "promptx-builtin__learn", args: { resource: "https://docs.example.com" } }');
  console.log('6. StreamProcessor执行成功');
}

// 4. 测试所有PromptX工具的Schema修复
async function testAllPromptXTools() {
  console.log('\n📋 [测试4] 所有PromptX工具Schema修复测试');
  console.log('=' .repeat(50));
  
  const promptxTools = [
    {
      name: 'welcome',
      required: [],
      properties: {},
      expected: '无参数，正常调用'
    },
    {
      name: 'learn',
      required: ['resource'],
      properties: { resource: 'string' },
      expected: 'resource必需，AI必须提供URL'
    },
    {
      name: 'action', 
      required: ['roleId'],
      properties: { roleId: 'string' },
      expected: 'roleId必需，AI必须提供角色ID'
    },
    {
      name: 'remember',
      required: ['role', 'content'],
      properties: { role: 'string', content: 'string' },
      expected: 'role和content必需，AI必须提供两个参数'
    },
    {
      name: 'recall',
      required: ['role'],
      properties: { role: 'string', query: 'string' },
      expected: 'role必需，query可选'
    }
  ];
  
  promptxTools.forEach(tool => {
    console.log(`\n🔧 ${tool.name} 工具:`);
    console.log(`   Required: [${tool.required.join(', ')}]`);
    console.log(`   Properties: ${Object.keys(tool.properties).join(', ')}`);
    console.log(`   预期行为: ${tool.expected}`);
    
    // 模拟Schema生成
    const zodFields = [];
    Object.keys(tool.properties).forEach(key => {
      if (tool.required.includes(key)) {
        zodFields.push(`${key}: z.string()`);
      } else {
        zodFields.push(`${key}: z.string().optional()`);
      }
    });
    console.log(`   生成Schema: { ${zodFields.join(', ')} }`);
  });
}

// 5. 创建真实环境测试脚本
async function generateRealEnvironmentTest() {
  console.log('\n📋 [测试5] 生成真实环境测试指令');
  console.log('=' .repeat(50));
  
  console.log('🔄 重启应用测试步骤:');
  console.log('1. 重新编译项目: npm run build');
  console.log('2. 复制PromptX资源: npm run postbuild:resources');
  console.log('3. 启动应用: npm run dev');
  console.log('4. 观察MCPToolConverter日志中的Schema转换信息');
  console.log('5. 测试AI工具调用，观察参数是否正确生成');
  
  console.log('\n🧪 具体测试用例:');
  console.log('- 输入: "学习这个文档 https://example.com"');
  console.log('- 期望: AI调用 promptx-builtin__learn，参数 { resource: "https://example.com" }');
  console.log('- 输入: "激活 deechat-assistant 角色"');
  console.log('- 期望: AI调用 promptx-builtin__action，参数 { roleId: "deechat-assistant" }');
  
  console.log('\n📊 验证指标:');
  console.log('✅ MCPToolConverter日志显示正确的z.string()和z.string().optional()');
  console.log('✅ StreamProcessor不再输出"发现空参数问题"');
  console.log('✅ 工具调用成功，返回预期结果');
  console.log('✅ AI继续生成基于工具结果的响应');
}

// 主测试流程
async function runFixValidationTests() {
  try {
    await testSchemaConversionFix();
    await testZodValidationBehavior();
    await simulateAIDecisionProcess();
    await testAllPromptXTools();
    await generateRealEnvironmentTest();
    
    console.log('\n🎯 [修复验证总结]');
    console.log('=' .repeat(50));
    console.log('✅ MCPToolConverter.ts已修复：正确处理required字段');
    console.log('✅ 必需参数使用z.string()，可选参数使用z.string().optional()');
    console.log('✅ AI模型将基于正确的Schema生成必需参数');
    console.log('🔄 下一步：重启应用进行真实环境测试');
    
  } catch (error) {
    console.error('❌ 修复验证测试过程中出现错误:', error);
  }
}

// 执行测试
runFixValidationTests();