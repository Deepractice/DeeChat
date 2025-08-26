#!/usr/bin/env node

/**
 * 测试MCP工具参数验证问题
 * 重现"Tool 'learn' parameter validation failed: resource: Required"错误
 */

console.log('🔍 [MCP参数验证测试] 开始测试MCP工具参数验证...');

// 模拟AI调用工具的不同情况
function testParameterValidation() {
  console.log('📋 [测试] === MCP参数验证问题分析 ===');
  
  // 测试案例1：空参数对象
  console.log('\n❌ [案例1] AI传递空参数对象');
  const case1Args = {};
  console.log(`工具调用: promptx-builtin__learn`);
  console.log(`参数:`, JSON.stringify(case1Args, null, 2));
  console.log(`结果: MCP error -32602: Tool 'learn' parameter validation failed: resource: Required`);
  
  // 测试案例2：缺少必需参数
  console.log('\n❌ [案例2] AI传递错误参数名');
  const case2Args = {
    wrongParam: "@manual://filesystem"
  };
  console.log(`工具调用: promptx-builtin__learn`);
  console.log(`参数:`, JSON.stringify(case2Args, null, 2));
  console.log(`结果: MCP error -32602: Tool 'learn' parameter validation failed: resource: Required`);
  
  // 测试案例3：正确的参数
  console.log('\n✅ [案例3] AI传递正确参数');
  const case3Args = {
    resource: "@manual://filesystem"
  };
  console.log(`工具调用: promptx-builtin__learn`);
  console.log(`参数:`, JSON.stringify(case3Args, null, 2));
  console.log(`结果: 成功执行，返回手册内容`);
  
  console.log('\n🔍 [问题分析] === 可能的原因 ===');
  
  console.log('1. **AI理解问题**：');
  console.log('   - AI可能没有正确理解工具参数要求');
  console.log('   - 系统提示词中的工具描述可能不够清晰');
  console.log('   - AI可能忽略了参数验证的重要性');
  
  console.log('\n2. **工具描述问题**：');
  console.log('   - Layer3的工具描述格式可能有问题');
  console.log('   - 必需参数的标记可能不够显眼');
  console.log('   - 示例格式可能不够清晰');
  
  console.log('\n3. **MCPToolConverter问题**：');
  console.log('   - Zod schema定义可能有问题');
  console.log('   - 参数类型转换可能有问题');
  console.log('   - LangChain工具绑定可能有问题');
  
  console.log('\n4. **StreamProcessor问题**：');
  console.log('   - 工具调用路由可能有问题');
  console.log('   - 参数传递格式可能有问题');
  console.log('   - 错误处理可能掩盖了真正的问题');
  
  console.log('\n🎯 [解决方案] === 可能的修复方向 ===');
  
  console.log('1. **增强工具描述**：');
  console.log('   - 在Layer3中使用更强烈的警告语言');
  console.log('   - 提供更多的正确和错误示例');
  console.log('   - 使用emoji和格式突出必需参数');
  
  console.log('\n2. **检查MCPToolConverter**：');
  console.log('   - 验证Zod schema是否正确反映了工具要求');
  console.log('   - 确保必需参数被正确标记为required');
  console.log('   - 测试LangChain工具的参数验证');
  
  console.log('\n3. **添加参数验证调试**：');
  console.log('   - 在StreamProcessor中添加参数检查');
  console.log('   - 记录AI实际传递的参数内容');
  console.log('   - 在调用MCP服务器前验证参数完整性');
  
  console.log('\n4. **测试具体工具**：');
  console.log('   - 直接测试promptx-builtin服务器的learn工具');
  console.log('   - 验证MCP协议级别的参数验证');
  console.log('   - 确认工具定义和实际实现的一致性');
}

// 模拟正确的工具调用应该是什么样的
function demonstrateCorrectToolCalls() {
  console.log('\n📝 [正确示例] === 应该如何调用PromptX工具 ===');
  
  const correctCalls = [
    {
      toolName: 'promptx-builtin__welcome',
      description: '获取PromptX欢迎信息和角色列表',
      args: {},
      reason: 'welcome工具不需要参数'
    },
    {
      toolName: 'promptx-builtin__learn',
      description: '学习特定资源或手册',
      args: { resource: '@manual://filesystem' },
      reason: 'resource参数是必需的，必须是有效的资源标识符'
    },
    {
      toolName: 'promptx-builtin__action',
      description: '激活特定角色',
      args: { role: 'python-dev' },
      reason: 'role参数是必需的，必须是有效的角色ID'
    }
  ];
  
  correctCalls.forEach((call, index) => {
    console.log(`\n✅ [示例${index + 1}] ${call.description}`);
    console.log(`工具名: ${call.toolName}`);
    console.log(`参数: ${JSON.stringify(call.args, null, 2)}`);
    console.log(`原因: ${call.reason}`);
  });
}

// 运行测试
testParameterValidation();
demonstrateCorrectToolCalls();

console.log('\n🎉 [测试完成] MCP参数验证问题分析完成');
console.log('🔧 [下一步] 建议检查Layer3工具描述和StreamProcessor参数传递逻辑');