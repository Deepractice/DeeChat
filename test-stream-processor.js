#!/usr/bin/env node

/**
 * 简化版StreamProcessor测试脚本
 * 专门测试消息处理逻辑
 */

console.log('🔍 [测试] 开始测试StreamProcessor消息处理逻辑...');

// 模拟StreamProcessor的关键逻辑
function simulateStreamProcessor() {
  // 模拟初始messages（从SmartLayeredPromptSystem来的）
  let currentMessages = [
    {
      role: 'system',
      content: '你是DeeChat助手。可用工具：promptx-builtin__welcome, promptx-builtin__action'
    },
    {
      role: 'user', 
      content: '你好，我想创建一个Python开发者角色'
    }
  ];

  console.log('📋 [测试] === 初始状态 ===');
  logMessages(currentMessages, 'INIT');

  // 模拟第1轮：AI调用welcome工具
  console.log('\n🔄 [测试] === 第1轮迭代：AI调用welcome工具 ===');
  
  // AI响应：调用welcome工具
  const aiMessage1 = {
    role: 'assistant',
    content: '我来为你查看可用的角色。',
    tool_calls: [
      {
        id: 'call_1',
        name: 'promptx-builtin__welcome', 
        args: {}
      }
    ]
  };
  currentMessages.push(aiMessage1);

  // 工具执行结果
  const welcomeResult = `
🎉 PromptX智能角色系统欢迎您！

📦 系统角色 (3个)
- \`python-dev\`: Python开发者 → action("python-dev")
- \`frontend-dev\`: 前端开发者 → action("frontend-dev")  
- \`data-scientist\`: 数据科学家 → action("data-scientist")

✨ 使用方式：
1. 查看可用角色：使用此工具
2. 激活角色：action("角色名称")
3. 学习资源：learn("@resource://资源名")

💡 开始您的AI协作之旅吧！
  `.trim();

  const toolMessage1 = {
    role: 'tool',
    content: welcomeResult,
    tool_call_id: 'call_1'
  };
  currentMessages.push(toolMessage1);

  console.log('📋 [测试] 第1轮迭代后的messages:');
  logMessages(currentMessages, 'ITER1');

  // 模拟第2轮：AI基于welcome结果调用action工具
  console.log('\n🔄 [测试] === 第2轮迭代：AI调用action工具 ===');
  
  const aiMessage2 = {
    role: 'assistant',
    content: '我看到有Python开发者角色，让我为你激活它。',
    tool_calls: [
      {
        id: 'call_2',
        name: 'promptx-builtin__action',
        args: { role: 'python-dev' }
      }
    ]
  };
  currentMessages.push(aiMessage2);

  const actionResult = '✅ 角色 python-dev 激活成功！现在我是专业的Python开发者。';
  
  const toolMessage2 = {
    role: 'tool',
    content: actionResult,
    tool_call_id: 'call_2'
  };
  currentMessages.push(toolMessage2);

  console.log('📋 [测试] 第2轮迭代后的messages:');
  logMessages(currentMessages, 'ITER2');

  // 模拟第3轮：AI最终响应
  console.log('\n🔄 [测试] === 第3轮迭代：AI最终响应 ===');
  
  console.log('📤 [测试] 发送给AI模型的messages:');
  logMessages(currentMessages, 'FINAL');

  // 检查问题：系统提示词是否被污染
  const systemMessage = currentMessages.find(msg => msg.role === 'system');
  console.log('\n🔍 [测试] === 问题分析 ===');
  console.log('🔍 [测试] 系统消息内容长度:', systemMessage?.content?.length || 0);
  console.log('🔍 [测试] 系统消息是否包含welcome输出:', 
    systemMessage?.content?.includes('PromptX智能角色系统欢迎您') || false);
  
  const toolMessages = currentMessages.filter(msg => msg.role === 'tool');
  console.log('🔍 [测试] 工具消息数量:', toolMessages.length);
  toolMessages.forEach((msg, i) => {
    console.log(`🔍 [测试] 工具消息${i+1}长度:`, msg.content.length);
    console.log(`🔍 [测试] 工具消息${i+1}预览:`, msg.content.substring(0, 100) + '...');
  });

  // 关键问题检测
  console.log('\n❗ [测试] === 关键问题检测 ===');
  
  if (currentMessages.length > 2) {
    console.log('✅ [测试] 正常：消息数量增加到', currentMessages.length);
  }
  
  if (systemMessage && systemMessage.content.includes('可用工具')) {
    console.log('✅ [测试] 正常：系统消息保持工具描述格式');
  } else {
    console.log('❌ [测试] 异常：系统消息可能被污染');
  }
  
  const hasWelcomeInSystem = systemMessage?.content?.includes('PromptX智能角色系统欢迎您');
  if (hasWelcomeInSystem) {
    console.log('❌ [测试] 发现问题：系统消息包含welcome工具输出！');
    console.log('❌ [测试] 这表明工具输出错误地替换了系统提示词');
  } else {
    console.log('✅ [测试] 正常：系统消息没有被工具输出污染');
  }

  const longToolMessages = toolMessages.filter(msg => msg.content.length > 500);
  if (longToolMessages.length > 0) {
    console.log(`⚠️  [测试] 注意：发现${longToolMessages.length}个长工具消息`);
    longToolMessages.forEach((msg, i) => {
      console.log(`⚠️  [测试] 长工具消息${i+1}: ${msg.content.length}字符`);
    });
  }
}

function logMessages(messages, stage) {
  console.log(`📋 [${stage}] Messages总数: ${messages.length}`);
  messages.forEach((msg, i) => {
    const contentPreview = msg.content 
      ? (msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content)
      : 'no content';
    console.log(`📋 [${stage}] ${i+1}. role=${msg.role}, content长度=${msg.content?.length || 0}`);
    console.log(`📋 [${stage}]    预览: ${contentPreview}`);
    if (msg.tool_calls) {
      console.log(`📋 [${stage}]    tool_calls: ${msg.tool_calls.map(tc => tc.name).join(', ')}`);
    }
  });
}

// 运行测试
simulateStreamProcessor();

console.log('\n🎉 [测试] 测试完成！');
console.log('🎯 [测试] 关键观察：检查系统消息是否被工具输出污染');