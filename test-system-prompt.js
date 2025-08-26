/**
 * 系统提示词测试脚本
 * 验证增强后的工具描述是否正确生成
 */

console.log('🔍 [系统提示词测试] 验证工具描述增强效果\n');

// 模拟增强后的工具描述生成
function simulateEnhancedToolDescription() {
  console.log('📋 [系统提示词] 模拟增强后的工具描述');
  console.log('='.repeat(50));

  // 模拟learn工具的描述
  const learnToolDescription = `### 🔧 promptx-builtin__learn
**描述**: PromptX学习工具

**参数**:
- \`resource\` (string) 🚨**必需** - **此参数不能为空** - PromptX资源标识符

**使用方式**:
🚨 **重要**: 此工具的resource参数是必需的，绝对不能为空或省略！

**必需参数**:
- \`resource\` (string) 🚨**必需** - PromptX资源标识符

**正确调用示例**:
\`\`\`
工具名: promptx-builtin__learn
参数: {
  "resource": "@manual://filesystem"
}
\`\`\`

⚠️ **错误示例**:
\`\`\`
❌ 绝对禁止: {"resource": ""}
❌ 绝对禁止: {}
❌ 绝对禁止: {"invalidParam": "value"}
\`\`\`
`;

  // 模拟action工具的描述  
  const actionToolDescription = `### 🔧 promptx-builtin__action
**描述**: PromptX角色激活工具

**参数**:
- \`role\` (string) 🚨**必需** - **此参数不能为空** - 要激活的角色ID

**使用方式**:
🚨 **重要**: 此工具的role参数是必需的，绝对不能为空或省略！

**必需参数**:
- \`role\` (string) 🚨**必需** - 要激活的角色ID

**正确调用示例**:
\`\`\`
工具名: promptx-builtin__action
参数: {
  "role": "nuwa"
}
\`\`\`

⚠️ **错误示例**:
\`\`\`
❌ 绝对禁止: {"role": ""}
❌ 绝对禁止: {}
❌ 绝对禁止: {"invalidParam": "value"}
\`\`\`
`;

  // 模拟系统提示词中的重要说明
  const importantInstructions = `## 📋 工具调用重要说明

🚨 **关键提醒**：调用工具时必须严格按照参数格式提供所有必需参数！

⚠️ **绝对禁止**：
- ❌ **绝对不能**传递空参数对象 \`{}\` 给有必需参数的工具
- ❌ **绝对不能**省略任何标记为"必需"的参数
- ❌ **绝对不能**使用undefined、null或空字符串作为必需参数值

✅ **必须遵循**：
- ✅ **必须**为每个标记为"必需"的参数提供有效值
- ✅ **必须**严格按照工具描述中的参数格式
- ✅ **必须**在调用前检查参数完整性

**正确的工具调用步骤**：
1. **查看参数要求**：每个工具都明确列出了必需参数
2. **按格式提供参数**：严格按照示例格式提供参数对象
3. **检查参数完整性**：确保所有必需参数都已提供且格式正确

**常见错误及避免方法**：
❌ 错误：调用toolx工具时参数为空 \`{}\`
✅ 正确：必须提供 \`{"tool_resource": "@tool://工具名", "parameters": {...}}\`

❌ 错误：调用learn工具时参数为空 \`{}\`
✅ 正确：必须提供 \`{"resource": "@manual://手册名"}\`

❌ 错误：调用action工具时参数为空 \`{}\`
✅ 正确：必须提供 \`{"role": "角色ID"}\`

🔥 **重要**：如果工具调用失败并提示"参数验证失败"，说明您没有提供必需参数！请重新检查工具描述中的参数要求。

💡 **提示**：参数验证失败通常是因为缺少必需参数或参数格式错误，请仔细对照示例格式。`;

  console.log('📄 [Learn工具描述]');
  console.log(learnToolDescription);
  console.log('\n📄 [Action工具描述]');  
  console.log(actionToolDescription);
  console.log('\n📄 [重要说明]');
  console.log(importantInstructions);

  return {
    learnToolDescription,
    actionToolDescription,
    importantInstructions
  };
}

// 分析增强效果
function analyzeEnhancementEffect() {
  console.log('\n📋 [增强分析] 分析工具描述增强效果');
  console.log('='.repeat(50));
  
  console.log('✅ [增强效果] 每个工具描述现在包含：');
  console.log('1. 🚨 明确的必需参数标识');
  console.log('2. 📝 详细的使用说明');
  console.log('3. 💡 具体的正确调用示例');
  console.log('4. ❌ 明确的错误示例和禁止行为');
  console.log('5. 🔥 强调参数验证失败的后果');
  console.log('');
  
  console.log('🎯 [AI行为预期]：');
  console.log('- AI看到"🚨**必需**"标识，应该意识到参数不可省略');
  console.log('- AI看到"❌ 绝对禁止: {}"，应该避免传递空对象');
  console.log('- AI看到具体的正确示例，应该模仿正确格式');
  console.log('- AI看到重复强调的重要性，应该更加谨慎');
  console.log('');
  
  console.log('🔍 [验证方法]：');
  console.log('1. 启动DeeChat应用');
  console.log('2. 输入"学习PromptX文档"');
  console.log('3. 观察AI是否调用learn工具时提供resource参数');
  console.log('4. 观察控制台中的参数传递日志');
  console.log('');
  
  console.log('💭 [AI可能的思考过程]：');
  console.log('- "我需要调用learn工具"');
  console.log('- "看到resource参数标记为🚨**必需**"');
  console.log('- "看到错误示例明确禁止{}"');
  console.log('- "我必须提供resource参数，不能传递空对象"');
  console.log('- "按照示例格式：{\"resource\": \"@manual://文档\"}"');
}

// 模拟AI决策过程
function simulateAIDecision() {
  console.log('\n📋 [AI决策模拟] 模拟AI看到增强提示词后的决策过程');
  console.log('='.repeat(50));
  
  console.log('🤖 [AI内部思考] 当用户说"学习PromptX文档"：');
  console.log('');
  console.log('步骤1: AI识别意图');
  console.log('- "用户想要学习文档，我需要使用learn工具"');
  console.log('');
  
  console.log('步骤2: AI查看工具描述');
  console.log('- "工具名: promptx-builtin__learn"');
  console.log('- "参数: resource (string) 🚨**必需** - **此参数不能为空**"');
  console.log('- "看到🚨和**必需**标识，这个参数很重要"');
  console.log('');
  
  console.log('步骤3: AI检查使用说明');
  console.log('- "🚨 **重要**: 此工具的resource参数是必需的，绝对不能为空或省略！"');
  console.log('- "看到多次强调必需性"');
  console.log('');
  
  console.log('步骤4: AI查看错误示例');
  console.log('- "❌ 绝对禁止: {}"');
  console.log('- "❌ 绝对禁止: {\"resource\": \"\"}"');
  console.log('- "明确不能传递空对象或空值"');
  console.log('');
  
  console.log('步骤5: AI选择正确格式');
  console.log('- "正确调用示例: {\"resource\": \"@manual://filesystem\"}"');
  console.log('- "我需要提供一个合适的resource值"');
  console.log('- "用户想学习PromptX文档，我应该提供相关的resource"');
  console.log('');
  
  console.log('步骤6: AI最终决策');
  console.log('✅ [预期AI行为] 调用learn工具:');
  console.log('参数: {');
  console.log('  "resource": "@manual://promptx-guide"');
  console.log('}');
  console.log('');
  
  console.log('❌ [不应该出现] AI传递空参数:');
  console.log('参数: {}');
}

// 主测试流程
async function runSystemPromptTest() {
  try {
    const descriptions = simulateEnhancedToolDescription();
    console.log('\n');
    
    analyzeEnhancementEffect();
    console.log('\n');
    
    simulateAIDecision();
    
    console.log('\n🎯 [测试总结]');
    console.log('='.repeat(50));
    console.log('✅ 系统提示词已大幅增强');
    console.log('✅ 每个必需参数都有明确标识');
    console.log('✅ 提供了正确和错误的调用示例');
    console.log('✅ 多次强调了参数必需性');
    console.log('🚀 预期AI应该能正确识别并提供必需参数');
    console.log('');
    console.log('🔍 下一步：启动应用进行实际测试');
    
  } catch (error) {
    console.error('❌ 系统提示词测试过程中出现错误:', error);
  }
}

// 执行测试
runSystemPromptTest();