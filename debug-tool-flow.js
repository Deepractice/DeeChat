/**
 * 工具传递路径完整诊断脚本
 * 分析从CoreLLMService到AI的完整工具传递流程
 */

console.log('🔍 [工具流程诊断] 完整分析工具传递路径\n');

// 分析问题的完整流程
function analyzeToolFlow() {
  console.log('📋 [流程分析] DeeChat工具传递完整路径');
  console.log('='.repeat(80));
  
  console.log('🎯 [步骤1] CoreLLMService.streamMessage()');
  console.log('├─ 88行: tools = await this.getAvailableTools()');
  console.log('├─ 96行: tools传递给promptContext');
  console.log('├─ 112行: buildResult = await promptBuilder.build(promptContext)');
  console.log('└─ 116行: bindToolsToModel(model, tools) // 🔧 Schema绑定路径');
  console.log('');
  
  console.log('🎯 [步骤2] PromptBuilder.build()');  
  console.log('├─ 71行: context.tools传递给promptSystem.buildMessages()');
  console.log('└─ 调用: SmartLayeredPromptSystem.buildMessages()');
  console.log('');
  
  console.log('🎯 [步骤3] SmartLayeredPromptSystem.buildMessages()');
  console.log('├─ 175-193行: 工具格式适配 MCPTool[]');
  console.log('├─ 196行: executeAllLayers(availableTools)'); 
  console.log('└─ 调用: layer3.render(availableTools) // 🔧 文本描述路径');
  console.log('');
  
  console.log('🎯 [步骤4A] ToolIntegrationLayer.render() - 文本描述路径');
  console.log('├─ 60-77行: 接收availableTools参数');
  console.log('├─ 86行: buildToolsPrompt(processedTools)');
  console.log('├─ 181-214行: formatSingleTool() 生成工具描述');
  console.log('└─ 输出: 增强的工具文本描述');
  console.log('');
  
  console.log('🎯 [步骤4B] MCPToolConverter.bindToolsToModel() - Schema绑定路径');
  console.log('├─ 414行: convertAllMCPTools() 转换Schema');
  console.log('├─ 456行: model.bindTools(langchainTools)');
  console.log('└─ 输出: 绑定Schema的模型');
  console.log('');
  
  console.log('❓ [关键问题] 两个路径的工具数据是否一致？');
  console.log('1. 📝 文本路径: CoreLLM.tools → PromptBuilder → SmartLayered → ToolIntegration');
  console.log('2. 🔧 Schema路径: CoreLLM.tools → MCPToolConverter → model.bindTools()');
  console.log('');
  
  console.log('🚨 [可能的问题]');
  console.log('1. tools数据格式不一致 (MCPTool[] vs MCPToolEntity[])');
  console.log('2. ToolIntegrationLayer收到的tools为空或格式错误');
  console.log('3. SmartLayeredPromptSystem的工具适配逻辑有bug');
  console.log('4. 两个路径使用了不同的工具数据源');
}

// 分析需要验证的具体点
function generateDebugPlan() {
  console.log('\n📋 [调试计划] 需要验证的关键检查点');
  console.log('='.repeat(80));
  
  console.log('🔍 [检查点1] CoreLLMService.getAvailableTools()返回值');
  console.log('- 验证: tools数组长度和内容');
  console.log('- 验证: 每个工具的name, inputSchema, required字段');
  console.log('- 关键代码: CoreLLMService.ts:343-377');
  console.log('');
  
  console.log('🔍 [检查点2] SmartLayeredPromptSystem工具适配');
  console.log('- 验证: availableTools参数是否正确传递');
  console.log('- 验证: adaptedTools转换结果');
  console.log('- 关键代码: SmartLayeredPromptSystem.ts:175-193'); 
  console.log('');
  
  console.log('🔍 [检查点3] ToolIntegrationLayer.render()接收');
  console.log('- 验证: 是否收到非空的availableTools');
  console.log('- 验证: 工具的inputSchema.required字段');
  console.log('- 关键代码: ToolIntegrationLayer.ts:60-77');
  console.log('');
  
  console.log('🔍 [检查点4] 系统提示词最终内容');
  console.log('- 验证: 是否包含增强的参数说明');
  console.log('- 验证: 🚨**必需** 标识是否存在');
  console.log('- 关键代码: SmartLayeredPromptSystem.ts:208-243');
  console.log('');
  
  console.log('🔍 [检查点5] MCPToolConverter Schema生成');
  console.log('- 验证: z.string() vs z.string().optional()');
  console.log('- 验证: 必需参数是否正确标识');
  console.log('- 关键代码: MCPToolConverter.ts:76-83');
}

// 生成具体的验证方案
function generateVerificationActions() {
  console.log('\n📋 [验证方案] 具体的调试行动');
  console.log('='.repeat(80));
  
  console.log('🎯 [行动1] 添加CoreLLMService调试日志');
  console.log('在CoreLLMService.ts第89行后添加:');
  console.log(`console.log('🔍 [CoreLLM-DEBUG] 获取到工具:', tools.length, tools.map(t => t.name));`);
  console.log('');
  
  console.log('🎯 [行动2] 添加SmartLayered调试日志');
  console.log('在SmartLayeredPromptSystem.ts第193行后添加:');
  console.log(`console.log('🔍 [SmartLayered-DEBUG] adaptedTools:', adaptedTools?.length, adaptedTools?.map(t => t.name));`);
  console.log('');
  
  console.log('🎯 [行动3] 验证ToolIntegrationLayer接收');
  console.log('检查ToolIntegrationLayer.ts第64-71行的现有调试日志');
  console.log('确认是否输出工具数量和内容');
  console.log('');
  
  console.log('🎯 [行动4] 检查系统提示词输出');
  console.log('查看SmartLayeredPromptSystem.ts第208-243行的调试输出');
  console.log('确认系统提示词是否包含增强的工具描述');
  console.log('');
  
  console.log('🚀 [验证步骤]');
  console.log('1. 启动DeeChat应用 (已启动)');
  console.log('2. 在应用中输入 "学习PromptX文档"');
  console.log('3. 观察控制台中以上所有调试日志');
  console.log('4. 分析工具传递链条中的断点');
}

// 主诊断流程
async function runToolFlowDiagnosis() {
  try {
    analyzeToolFlow();
    console.log('\n');
    
    generateDebugPlan();
    console.log('\n');
    
    generateVerificationActions();
    
    console.log('\n🎯 [诊断总结]');
    console.log('='.repeat(80));
    console.log('🤔 核心怀疑: 工具数据在文本描述路径和Schema绑定路径之间不同步');
    console.log('🔍 关键验证: SmartLayeredPromptSystem是否正确接收和处理工具数据');  
    console.log('🚀 下一步: 在DeeChat中测试，观察所有调试日志的输出');
    console.log('');
    console.log('💡 特别注意观察:');
    console.log('  - CoreLLM获取的工具数量和名称');
    console.log('  - SmartLayered适配后的工具数据');  
    console.log('  - ToolIntegrationLayer收到的工具参数');
    console.log('  - 系统提示词中是否包含🚨**必需**标识');
    
  } catch (error) {
    console.error('❌ 工具流程诊断过程中出现错误:', error);
  }
}

// 执行诊断
runToolFlowDiagnosis();