/**
 * 当前工具调用问题诊断脚本
 * 检查MCPToolConverter修复后的实际效果
 */

console.log('🔍 [问题诊断] 当前工具调用状态分析\n');

// 分析问题现象
async function analyzeCurrentIssue() {
  console.log('📋 [分析] 当前问题现象');
  console.log('=' .repeat(50));
  
  console.log('🤔 用户反馈：AI还是调用工具失败');
  console.log('');
  
  console.log('🔍 可能的原因分析：');
  console.log('1. MCPToolConverter修复没有生效（编译/加载问题）');
  console.log('2. ToolIntegrationLayer只传递了文本描述，没有传递Schema');
  console.log('3. LangChain工具绑定过程中Schema信息丢失');
  console.log('4. AI模型本身的工具调用问题');
  console.log('');
  
  console.log('📊 需要验证的关键点：');
  console.log('✅ MCPToolConverter是否输出正确的Schema日志');
  console.log('✅ ToolIntegrationLayer是否正确传递工具信息');
  console.log('✅ 系统提示词中是否包含完整的参数描述');
  console.log('✅ AI调用工具时的实际参数');
  console.log('');
}

// 分析MCPToolConverter状态
async function analyzeMCPToolConverter() {
  console.log('📋 [分析] MCPToolConverter状态');
  console.log('=' .repeat(50));
  
  console.log('🔍 MCPToolConverter修复状态：');
  console.log('✅ 源码已修复：第76-83行正确处理required字段');
  console.log('✅ 修复逻辑：if (required.includes(key)) -> z.string()');
  console.log('✅ 修复逻辑：else -> z.string().optional()');
  console.log('');
  
  console.log('❓ 待验证点：');
  console.log('1. 编译后的dist文件是否包含修复代码');
  console.log('2. 运行时是否加载了修复后的版本');
  console.log('3. MCPToolConverter调试日志输出');
  console.log('');
  
  console.log('🎯 验证方法：');
  console.log('- 触发AI对话，观察控制台中的MCPToolConverter日志');
  console.log('- 查找"🚨 [MCPToolConverter-DEBUG]"开头的日志');
  console.log('- 确认是否输出"z.string() (必需)"而不是"z.string().optional()"');
}

// 分析系统提示词传递
async function analyzeSystemPromptTransfer() {
  console.log('📋 [分析] 系统提示词传递机制');
  console.log('=' .repeat(50));
  
  console.log('🔍 当前机制分析：');
  console.log('1. MCPToolConverter: 转换MCP工具 -> LangChain工具 + Zod Schema');
  console.log('2. ToolIntegrationLayer: 生成工具文本描述 -> 系统提示词');
  console.log('3. SmartLayeredPromptSystem: 组合所有层级 -> 完整提示词');
  console.log('4. LangChain model.bindTools(): 绑定工具到模型');
  console.log('');
  
  console.log('❓ 潜在问题：');
  console.log('🚨 关键怀疑：ToolIntegrationLayer只传递文本描述，不传递Schema!');
  console.log('');
  console.log('📊 两种传递方式：');
  console.log('1. 📝 文本描述：在系统提示词中告诉AI工具参数（当前方式）');
  console.log('2. 🔧 Schema约束：通过LangChain Schema强制AI提供参数（正确方式）');
  console.log('');
  
  console.log('✅ 理想状态：');
  console.log('- AI看到文本: "learn工具需要resource参数（必需）"');
  console.log('- AI受到Schema约束: z.object({ resource: z.string() })');
  console.log('- AI被迫提供: { resource: "值" }');
  console.log('');
  
  console.log('❌ 当前可能状态：');
  console.log('- AI看到文本: "learn工具需要resource参数（必需）"');
  console.log('- AI不受Schema约束: z.object({ resource: z.string().optional() })');
  console.log('- AI可选择提供: {} 或 { resource: "值" }');
}

// 生成诊断方案
async function generateDiagnosticPlan() {
  console.log('📋 [诊断方案] 逐步验证计划');
  console.log('=' .repeat(50));
  
  console.log('🔍 Step 1: 验证MCPToolConverter修复效果');
  console.log('行动: 在DeeChat中输入"学习文档 https://example.com"');
  console.log('观察: 控制台是否输出');
  console.log('  - 🚨 [MCPToolConverter-DEBUG] - 字段: resource -> z.string() (必需)');
  console.log('  - 而不是: z.string().optional() (可选)');
  console.log('');
  
  console.log('🔍 Step 2: 验证AI工具调用参数');
  console.log('行动: 继续观察同一次对话');
  console.log('观察: StreamProcessor是否输出');
  console.log('  - 🔧 [StreamProcessor-DEBUG] - 参数内容: { "resource": "https://example.com" }');
  console.log('  - 而不是: 参数内容: {}');
  console.log('');
  
  console.log('🔍 Step 3: 验证系统提示词内容');  
  console.log('行动: 查看ToolIntegrationLayer的调试输出');
  console.log('观察: 是否正确显示"resource (string) 必需"');
  console.log('');
  
  console.log('🎯 预期结果：');
  console.log('✅ 如果MCPToolConverter修复生效: 应该看到z.string() (必需)');
  console.log('✅ 如果Schema约束生效: AI应该提供{ resource: "url" }');
  console.log('✅ 如果工具调用成功: StreamProcessor应该执行成功');
  console.log('');
  
  console.log('❌ 如果仍然失败:');
  console.log('1. 检查编译问题：dist文件是否更新');
  console.log('2. 检查绑定问题：model.bindTools()是否传递正确Schema');
  console.log('3. 检查模型问题：AI模型是否支持工具调用');
}

// 生成快速修复建议
async function generateQuickFixes() {
  console.log('📋 [快速修复] 可能的解决方案');
  console.log('=' .repeat(50));
  
  console.log('🚀 修复方案 1: 强制重新编译');
  console.log('npm run build');
  console.log('# 确保MCPToolConverter.ts的修复被编译');
  console.log('');
  
  console.log('🚀 修复方案 2: 增强ToolIntegrationLayer');
  console.log('# 在系统提示词中更明确地说明必需参数');
  console.log('# 添加更多的参数验证提醒');
  console.log('');
  
  console.log('🚀 修复方案 3: 直接在系统提示词中强调');
  console.log('# 在工具描述中明确说明：');
  console.log('# "🚨 此工具的resource参数是必需的，不能为空！"');
  console.log('');
  
  console.log('🚀 修复方案 4: 检查model.bindTools()传递');
  console.log('# 确保LangChain正确绑定了我们的Schema');
  console.log('# 可能需要在CoreLLMService中添加调试');
}

// 主诊断流程
async function runCurrentIssueDiagnosis() {
  try {
    await analyzeCurrentIssue();
    console.log('\n');
    
    await analyzeMCPToolConverter();
    console.log('\n');
    
    await analyzeSystemPromptTransfer();
    console.log('\n');
    
    await generateDiagnosticPlan();
    console.log('\n');
    
    await generateQuickFixes();
    
    console.log('\n🎯 [总结]');
    console.log('=' .repeat(50));
    console.log('🤔 核心怀疑：MCPToolConverter的Schema修复可能没有真正传递给AI');
    console.log('🔍 关键验证：观察实际对话中的MCPToolConverter调试日志');
    console.log('🚀 下一步：在DeeChat中测试工具调用，观察控制台输出');
    
  } catch (error) {
    console.error('❌ 诊断过程中出现错误:', error);
  }
}

// 执行诊断
runCurrentIssueDiagnosis();