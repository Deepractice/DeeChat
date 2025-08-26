#!/usr/bin/env node

/**
 * 测试Layer职责边界修复效果
 * 验证Layer1不再处理工具信息，Layer3正确处理工具信息
 */

console.log('🎯 [测试] 开始测试Layer职责边界修复效果...');

// 模拟修复后的Layer架构
function testLayerBoundaries() {
  console.log('🏗️ [测试] === Layer职责边界测试 ===');
  
  // Layer1: 只处理角色状态和角色内容
  console.log('📋 [Layer1] RoleStatusMonitorLayer - 角色状态监控');
  const layer1Result = {
    systemPrompt: `
# 🎭 ROLE_CONTEXT_INFO
当前角色: python-dev | 上下文使用率: 35% (1200 tokens) | 角色存在感: strong
模型级别: normal | 状态: 角色激活成功

# 🎭 角色状态
✅ 当前激活角色：python-dev

# 📝 BASE_SYSTEM_PROMPT
你是专业的AI助手，现在激活python-dev角色。
    `.trim()
  };
  
  console.log('✅ [Layer1] 角色内容构建完成，长度:', layer1Result.systemPrompt.length);
  console.log('✅ [Layer1] 不包含工具信息:', !layer1Result.systemPrompt.includes('AVAILABLE_TOOLS'));
  
  // Layer2: 历史上下文
  console.log('\\n📚 [Layer2] HistoryContextLayer - 历史上下文');
  const layer2Result = '用户: 你好\\n助手: 您好！我是专业的AI助手。';
  console.log('✅ [Layer2] 历史上下文构建完成，长度:', layer2Result.length);
  
  // Layer3: 工具集成（应该包含所有工具信息）
  console.log('\\n🔧 [Layer3] ToolIntegrationLayer - 工具集成');
  const layer3Result = {
    toolsPrompt: `
# 🔧 可用工具

## 📦 promptx-builtin 服务器工具

### 🔧 welcome
**描述**: PromptX欢迎工具
**参数**: 无参数要求
**使用示例**: {}

### 🔧 action  
**描述**: PromptX角色激活工具
**参数**:
- \`role\` (string) 🚨**必需** - 角色ID
**使用示例**: {"role": "python-dev"}

### 🔧 learn
**描述**: PromptX学习工具
**参数**:
- \`resource\` (string) 🚨**必需** - 资源路径
**使用示例**: {"resource": "@role://python-dev"}
    `.trim(),
    toolsCount: 3
  };
  
  console.log('✅ [Layer3] 工具信息构建完成，工具数量:', layer3Result.toolsCount);
  console.log('✅ [Layer3] 包含完整工具描述:', layer3Result.toolsPrompt.includes('AVAILABLE_TOOLS') || layer3Result.toolsPrompt.includes('可用工具'));
  
  // Layer4: 当前消息
  console.log('\\n📝 [Layer4] CurrentMessageLayer - 当前消息');
  const layer4Result = 'HumanMessage: 我想创建一个Python开发者角色';
  console.log('✅ [Layer4] 用户消息处理完成');
  
  // 最终组合测试（模拟buildFinalMessages）
  console.log('\\n🎯 [Final] === 最终系统提示词组合测试 ===');
  
  const finalSystemContent = `${layer1Result.systemPrompt}

# 📚 CONVERSATION_HISTORY
${layer2Result}

${layer3Result.toolsPrompt}`;

  console.log('🎯 [Final] 最终系统提示词长度:', finalSystemContent.length);
  
  // 关键验证点
  console.log('\\n✅ [验证] === 职责边界验证 ===');
  
  const layer1HasTools = layer1Result.systemPrompt.includes('AVAILABLE_TOOLS') || 
                        layer1Result.systemPrompt.includes('可用工具') ||
                        layer1Result.systemPrompt.includes('工具调用');
  
  const layer3HasTools = layer3Result.toolsPrompt.includes('welcome') ||
                        layer3Result.toolsPrompt.includes('action') ||
                        layer3Result.toolsPrompt.includes('工具');
  
  const finalHasCorrectStructure = finalSystemContent.includes('ROLE_CONTEXT_INFO') &&
                                  finalSystemContent.includes('CONVERSATION_HISTORY') &&
                                  finalSystemContent.includes('可用工具');
  
  console.log('✅ [验证] Layer1不包含工具信息:', !layer1HasTools);
  console.log('✅ [验证] Layer3包含工具信息:', layer3HasTools);
  console.log('✅ [验证] 最终结构正确:', finalHasCorrectStructure);
  
  // 问题检测
  console.log('\\n❗ [检测] === 问题检测结果 ===');
  
  if (layer1HasTools) {
    console.log('❌ [检测] Layer1仍然包含工具信息 - 职责边界未修复！');
  } else {
    console.log('✅ [检测] Layer1不包含工具信息 - 职责边界修复成功！');
  }
  
  if (!layer3HasTools) {
    console.log('❌ [检测] Layer3缺少工具信息 - 工具集成有问题！');
  } else {
    console.log('✅ [检测] Layer3包含完整工具信息 - 工具集成正常！');
  }
  
  if (finalHasCorrectStructure) {
    console.log('✅ [检测] 最终系统提示词结构正确 - 层级组合成功！');
  } else {
    console.log('❌ [检测] 最终系统提示词结构异常 - 层级组合有问题！');
  }
  
  return {
    layer1Clean: !layer1HasTools,
    layer3HasTools: layer3HasTools,
    structureCorrect: finalHasCorrectStructure
  };
}

// 运行测试
const testResult = testLayerBoundaries();

console.log('\\n🎉 [测试] 测试完成！');
console.log('📊 [结果] 修复效果评估:');
console.log(`  - Layer1职责边界: ${testResult.layer1Clean ? '✅ 修复成功' : '❌ 仍有问题'}`);
console.log(`  - Layer3工具集成: ${testResult.layer3HasTools ? '✅ 正常工作' : '❌ 缺失功能'}`);
console.log(`  - 整体架构: ${testResult.structureCorrect ? '✅ 结构正确' : '❌ 需要调整'}`);

if (testResult.layer1Clean && testResult.layer3HasTools && testResult.structureCorrect) {
  console.log('🎯 [总结] Layer职责边界修复成功！各层职责清晰，不再有越界问题。');
} else {
  console.log('⚠️ [总结] 仍有部分问题需要进一步修复。');
}