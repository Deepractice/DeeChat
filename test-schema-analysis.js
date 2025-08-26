/**
 * 工具Schema分析脚本
 * 分析PromptX工具的实际inputSchema定义
 */

const path = require('path');

console.log('🔍 [Schema分析] 开始分析PromptX工具Schema定义...\n');

// 模拟一个完整的工具定义分析
async function analyzeMCPToolSchemas() {
  console.log('📋 [分析] PromptX MCP工具实际Schema');
  console.log('=' .repeat(50));
  
  // 基于日志和代码分析，模拟PromptX工具的Schema定义
  const promptxTools = [
    {
      name: 'welcome',
      serverId: 'promptx-builtin',
      description: '获取所有可用角色列表',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
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
    },
    {
      name: 'action',
      serverId: 'promptx-builtin', 
      description: '激活指定角色',
      inputSchema: {
        type: 'object',
        properties: {
          roleId: {
            type: 'string',
            description: 'Role ID to activate'
          }
        },
        required: ['roleId']
      }
    },
    {
      name: 'remember',
      serverId: 'promptx-builtin',
      description: '记忆信息到指定角色',
      inputSchema: {
        type: 'object',
        properties: {
          role: {
            type: 'string', 
            description: 'Role to store memory for'
          },
          content: {
            type: 'string',
            description: 'Content to remember'
          }
        },
        required: ['role', 'content']
      }
    }
  ];
  
  console.log('🎯 分析MCPToolConverter的转换过程:\n');
  
  promptxTools.forEach(tool => {
    console.log(`🔧 工具: ${tool.name}`);
    console.log(`   serverId: ${tool.serverId}`);
    console.log(`   转换后名称: ${tool.serverId}__${tool.name}`);
    
    // 模拟MCPToolConverter的转换逻辑
    console.log('   📊 Schema分析:');
    console.log(`     - properties: ${Object.keys(tool.inputSchema.properties || {}).join(', ')}`);
    console.log(`     - required: ${tool.inputSchema.required?.join(', ') || '无'}`);
    
    // 问题分析：MCPToolConverter将所有字段设为可选
    console.log('   ❌ MCPToolConverter问题:');
    console.log('     - 代码76-78行: 全部字段设为 z.string().optional()');
    console.log('     - 理由: "避免LangChain Schema验证失败"');
    console.log('     - 后果: AI不知道哪些参数是必需的');
    
    // 正确的做法
    console.log('   ✅ 正确做法:');
    const requiredFields = tool.inputSchema.required || [];
    Object.keys(tool.inputSchema.properties || {}).forEach(field => {
      const isRequired = requiredFields.includes(field);
      const zodType = isRequired ? 'z.string()' : 'z.string().optional()';
      console.log(`     - ${field}: ${zodType} ${isRequired ? '(必需)' : '(可选)'}`);
    });
    
    console.log('');
  });
}

// 分析AI调用工具时的决策过程
async function analyzeAIDecisionProcess() {
  console.log('📋 [分析] AI工具调用决策过程');
  console.log('=' .repeat(50));
  
  console.log('🤖 AI模型的工具调用决策链：');
  console.log('1. 读取系统提示词中的工具描述');
  console.log('2. 基于用户输入识别需要的工具');
  console.log('3. 查看工具的Schema定义（来自LangChain）');
  console.log('4. 生成工具调用参数');
  console.log('');
  
  console.log('❌ 当前问题链条：');
  console.log('1. PromptX定义工具有required参数 ✅');
  console.log('2. MCPToolConverter转换时丢失required信息 ❌');
  console.log('3. LangChain Schema标记所有参数为可选 ❌');
  console.log('4. AI模型认为所有参数都是可选的 ❌');
  console.log('5. AI生成空参数对象 {} ❌');
  console.log('6. StreamProcessor执行时缺少必需参数 ❌');
  console.log('');
  
  console.log('✅ 修复方案：');
  console.log('1. 保持PromptX原始的required定义');
  console.log('2. MCPToolConverter正确转换required字段');
  console.log('3. LangChain Schema正确标记必需参数');
  console.log('4. AI模型基于Schema生成正确参数');
  console.log('5. 工具执行成功');
}

// 生成修复后的MCPToolConverter代码
async function generateFixedConverter() {
  console.log('📋 [修复] 生成修复后的MCPToolConverter代码');
  console.log('=' .repeat(50));
  
  console.log('🔧 核心修复点：');
  console.log('');
  
  const fixCode = `
// 当前问题代码（第76-78行）：
zodFields[key] = z.string().optional().describe(prop.description || \`\${key} parameter\`);
console.log(\`🚨 [MCPToolConverter-DEBUG] - 字段: \${key} -> z.string().optional() (原本\${required.includes(key) ? '必需' : '可选'})\`);

// ✅ 修复后的代码：
if (required.includes(key)) {
  zodFields[key] = z.string().describe(prop.description || \`\${key} parameter (required)\`);
  console.log(\`🚨 [MCPToolConverter-DEBUG] - 字段: \${key} -> z.string() (必需)\`);
} else {
  zodFields[key] = z.string().optional().describe(prop.description || \`\${key} parameter (optional)\`);
  console.log(\`🚨 [MCPToolConverter-DEBUG] - 字段: \${key} -> z.string().optional() (可选)\`);
}
`;
  
  console.log(fixCode);
  
  console.log('📊 修复效果：');
  console.log('- learn工具的resource参数变为z.string() (必需)');  
  console.log('- action工具的roleId参数变为z.string() (必需)');
  console.log('- remember工具的role和content参数变为z.string() (必需)');
  console.log('- AI模型将正确识别并提供必需参数');
}

// 主分析流程
async function runSchemaAnalysis() {
  try {
    await analyzeMCPToolSchemas();
    console.log('\n');
    
    await analyzeAIDecisionProcess();  
    console.log('\n');
    
    await generateFixedConverter();
    
    console.log('\n🎯 [总结]');
    console.log('=' .repeat(50));
    console.log('🎯 根本原因: MCPToolConverter将所有参数设为可选，导致AI不知道必需参数');
    console.log('🔧 解决方案: 修复MCPToolConverter，正确转换required字段到Zod Schema');
    console.log('✅ 预期结果: AI将根据Schema正确生成必需参数，工具调用成功');
    
  } catch (error) {
    console.error('❌ Schema分析过程中出现错误:', error);
  }
}

// 执行分析
runSchemaAnalysis();