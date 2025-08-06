/**
 * DeeChat提示词系统测试脚本
 * 用于验证提示词系统的各项功能
 */

import {
  initializeDeeChatPrompts,
  setPromptXRole,
  setFeatureContext,
  updateMCPToolStatus,
  getCurrentSystemPrompt,
  getPromptStats,
  validatePromptIntegrity,
  enableDeveloperMode,
  enableConciseMode,
  clearPresetModes,
  getSystemStatus
} from './index';

/**
 * 运行提示词系统测试
 */
export async function testDeeChatPrompts(): Promise<void> {
  console.log('🚀 开始测试DeeChat提示词系统...\n');

  try {
    // 1. 测试初始化
    console.log('1. 测试系统初始化...');
    await initializeDeeChatPrompts(); // Initialize prompt system
    console.log('✅ 初始化成功');

    // 2. 测试基础提示词
    console.log('\n2. 测试基础提示词生成...');
    const basePrompt = getCurrentSystemPrompt();
    console.log(`✅ 基础提示词长度: ${basePrompt.length} 字符`);
    console.log(`预览: ${basePrompt.substring(0, 200)}...`);

    // 3. 测试统计信息
    console.log('\n3. 测试提示词统计...');
    const stats = getPromptStats();
    console.log(`✅ 统计信息:`, {
      totalLength: stats.totalLength,
      segmentCount: stats.segmentCount,
      activeSegmentCount: stats.activeSegmentCount,
      topSegments: stats.topSegments.map(s => s.id)
    });

    // 4. 测试功能上下文切换
    console.log('\n4. 测试功能上下文切换...');
    
    setFeatureContext('chat');
    const chatPrompt = getCurrentSystemPrompt();
    console.log(`✅ 聊天模式提示词长度: ${chatPrompt.length}`);

    setFeatureContext('file-manager');
    const filePrompt = getCurrentSystemPrompt();
    console.log(`✅ 文件管理模式提示词长度: ${filePrompt.length}`);

    setFeatureContext('resources');
    const resourcesPrompt = getCurrentSystemPrompt();
    console.log(`✅ 资源管理模式提示词长度: ${resourcesPrompt.length}`);

    // 5. 测试PromptX角色
    console.log('\n5. 测试PromptX角色激活...');
    setPromptXRole(
      'deechat-architect',
      'DeeChat架构专家，精通桌面应用架构设计',
      ['架构设计', '性能优化', '系统集成', 'MCP协议']
    );
    const rolePrompt = getCurrentSystemPrompt();
    console.log(`✅ 角色激活后提示词长度: ${rolePrompt.length}`);

    // 6. 测试MCP工具状态
    console.log('\n6. 测试MCP工具状态更新...');
    updateMCPToolStatus([
      'promptx_action',
      'promptx_recall',
      'promptx_remember',
      'context7_resolve-library-id',
      'context7_get-library-docs'
    ]);
    const mcpPrompt = getCurrentSystemPrompt();
    console.log(`✅ MCP工具更新后提示词长度: ${mcpPrompt.length}`);

    // 7. 测试预设模式
    console.log('\n7. 测试预设模式...');
    
    enableDeveloperMode();
    const devPrompt = getCurrentSystemPrompt();
    console.log(`✅ 开发者模式提示词长度: ${devPrompt.length}`);

    enableConciseMode();
    const concisePrompt = getCurrentSystemPrompt();
    console.log(`✅ 简洁模式提示词长度: ${concisePrompt.length}`);

    clearPresetModes();
    const cleanPrompt = getCurrentSystemPrompt();
    console.log(`✅ 清除模式后提示词长度: ${cleanPrompt.length}`);

    // 8. 测试完整性验证
    console.log('\n8. 测试完整性验证...');
    const validation = validatePromptIntegrity();
    console.log(`✅ 完整性验证结果:`, {
      isValid: validation.isValid,
      issueCount: validation.issues.length,
      recommendationCount: validation.recommendations.length
    });

    if (validation.issues.length > 0) {
      console.log('问题:', validation.issues);
    }
    if (validation.recommendations.length > 0) {
      console.log('建议:', validation.recommendations);
    }

    // 9. 测试系统状态
    console.log('\n9. 测试系统状态...');
    const status = getSystemStatus();
    console.log(`✅ 系统状态:`, status);

    // 10. 生成最终提示词示例
    console.log('\n10. 生成最终提示词示例...');
    console.log('=' .repeat(80));
    console.log('完整系统提示词预览:');
    console.log('=' .repeat(80));
    const finalPrompt = getCurrentSystemPrompt();
    console.log(finalPrompt);
    console.log('=' .repeat(80));

    console.log('\n🎉 DeeChat提示词系统测试完成！所有功能正常运行。');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    throw error;
  }
}

/**
 * 性能测试
 */
export async function performanceTest(): Promise<void> {
  console.log('⚡ 开始性能测试...\n');

  const startTime = Date.now();
  
  // 初始化
  await initializeDeeChatPrompts();
  const initTime = Date.now() - startTime;
  console.log(`初始化耗时: ${initTime}ms`);

  // 构建提示词性能测试
  const buildStartTime = Date.now();
  for (let i = 0; i < 100; i++) {
    getCurrentSystemPrompt();
  }
  const buildTime = (Date.now() - buildStartTime) / 100;
  console.log(`提示词构建平均耗时: ${buildTime.toFixed(2)}ms`);

  // 上下文切换性能测试
  const switchStartTime = Date.now();
  const contexts: Array<'chat' | 'file-manager' | 'resources' | 'settings'> = 
    ['chat', 'file-manager', 'resources', 'settings'];
  
  for (let i = 0; i < 50; i++) {
    const context = contexts[i % contexts.length];
    setFeatureContext(context);
    getCurrentSystemPrompt();
  }
  const switchTime = (Date.now() - switchStartTime) / 50;
  console.log(`上下文切换平均耗时: ${switchTime.toFixed(2)}ms`);

  console.log('✅ 性能测试完成');
}

/**
 * 运行所有测试
 */
export async function runAllTests(): Promise<void> {
  try {
    await testDeeChatPrompts();
    console.log('\n');
    await performanceTest();
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAllTests().then(() => {
    console.log('\n🏁 所有测试完成');
    process.exit(0);
  }).catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
  });
}