#!/usr/bin/env node

/**
 * 测试SmartLayeredPromptSystem的系统提示词构建逻辑
 * 重点检查是否welcome工具输出被错误地作为系统提示词
 */

console.log('🔍 [测试] 开始测试SmartLayeredPromptSystem...');

// 模拟SmartLayeredPromptSystem的构建过程
function simulatePromptSystemBuild() {
  console.log('🏗️ [测试] === 模拟系统提示词构建过程 ===');
  
  // 模拟Layer1: RoleStatusMonitorLayer 可能调用了PromptX
  console.log('🎭 [Layer1] RoleStatusMonitorLayer - 角色处理');
  
  // 这里是关键！如果Layer1调用了PromptX服务获取角色内容
  const mockPromptXResult = simulatePromptXCall();
  
  console.log('🎭 [Layer1] PromptX调用结果长度:', mockPromptXResult.length);
  console.log('🎭 [Layer1] PromptX调用结果预览:', mockPromptXResult.substring(0, 200) + '...');
  
  // Layer1构建的系统提示词部分
  let layer1SystemPrompt = '';
  
  // 🚨 关键问题：如果这里错误地将PromptX结果当作系统提示词
  if (mockPromptXResult.includes('PromptX智能角色系统')) {
    console.log('❌ [Layer1] 检测到问题：PromptX结果可能被当作系统提示词！');
    layer1SystemPrompt = mockPromptXResult; // 这就是问题所在！
  } else {
    layer1SystemPrompt = '你是专业的AI助手，具备以下角色能力...';
  }
  
  console.log('🎭 [Layer1] Layer1系统提示词长度:', layer1SystemPrompt.length);
  console.log('🎭 [Layer1] Layer1系统提示词预览:', layer1SystemPrompt.substring(0, 200) + '...');
  
  // Layer2: HistoryContextLayer
  console.log('\n📚 [Layer2] HistoryContextLayer - 历史上下文');
  const layer2Content = '基于以下对话历史：\n[历史对话内容...]';
  console.log('📚 [Layer2] Layer2内容长度:', layer2Content.length);
  
  // Layer3: ToolIntegrationLayer
  console.log('\n🔧 [Layer3] ToolIntegrationLayer - 工具集成');
  const layer3Content = `
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
  `;
  console.log('🔧 [Layer3] Layer3内容长度:', layer3Content.length);
  
  // 最终系统提示词组合
  console.log('\n🎯 [Final] === 最终系统提示词构建 ===');
  
  const finalSystemPrompt = `${layer1SystemPrompt}\n\n${layer2Content}\n\n${layer3Content}`;
  
  console.log('🎯 [Final] 最终系统提示词总长度:', finalSystemPrompt.length);
  console.log('🎯 [Final] 最终系统提示词开头500字符:');
  console.log('---');
  console.log(finalSystemPrompt.substring(0, 500));
  console.log('---');
  
  // 问题检测
  console.log('\n❗ [检测] === 问题检测 ===');
  
  if (finalSystemPrompt.includes('PromptX智能角色系统欢迎您')) {
    console.log('❌ [检测] 发现严重问题：系统提示词包含welcome工具输出！');
    console.log('❌ [检测] 这会导致AI看到错误的系统提示词');
    
    // 定位问题来源
    if (layer1SystemPrompt.includes('PromptX智能角色系统欢迎您')) {
      console.log('❌ [检测] 问题来源：Layer1 (RoleStatusMonitorLayer)');
      console.log('❌ [检测] 原因：角色激活时错误地将PromptX输出当作系统提示词');
    }
  } else if (finalSystemPrompt.includes('可用工具')) {
    console.log('✅ [检测] 正常：系统提示词包含工具描述');
  }
  
  if (finalSystemPrompt.length > 5000) {
    console.log('⚠️ [检测] 注意：系统提示词很长，可能包含额外内容');
  }
  
  return finalSystemPrompt;
}

function simulatePromptXCall() {
  // 模拟调用PromptX的welcome或action命令
  console.log('📞 [PromptX] 模拟调用PromptX服务...');
  
  // 这里模拟实际的PromptX返回内容
  return `
🎉 PromptX智能角色系统欢迎您！

📦 系统角色 (3个)
- \`luban\`: 鲁班 → action("luban")
- \`nuwa\`: 女娲 → action("nuwa")  
- \`deechat-assistant\`: DeeChat助手 → action("deechat-assistant")

🏗️ 项目角色 (2个)
- \`python-dev\`: Python开发者 → action("python-dev")
- \`frontend-dev\`: 前端开发者 → action("frontend-dev")

✨ 使用方式：
1. 查看可用角色：使用此工具
2. 激活角色：action("角色名称")
3. 学习资源：learn("@resource://资源名")

💡 开始您的AI协作之旅吧！
  `.trim();
}

// 运行测试
const result = simulatePromptSystemBuild();

console.log('\n🎉 [测试] 测试完成！');
console.log('🎯 [测试] 关键发现：如果Layer1错误地使用PromptX输出作为系统提示词，就会出现您描述的问题');