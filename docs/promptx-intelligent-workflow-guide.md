# PromptX智能工作流使用指南

## 概述

DeeChat已集成PromptX认知增强系统，通过智能工作流让AI能够自动检测用户意图并调用合适的PromptX工具，实现真正的"用户无感"专业服务。

## 核心特性

### 1. 🤖 智能意图检测
- 自动识别用户需求类型
- 无需用户了解工具名称
- 基于自然语言理解

### 2. 📋 工作流自动编排
- 根据意图自动组合工具
- 优化执行顺序
- 避免冗余操作

### 3. 🎯 透明化调用
- 用户感知不到技术细节
- 自然流畅的对话体验
- 智能反馈和引导

## 架构设计

```
┌─────────────────────────────────────────────────┐
│                   用户输入                       │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│              意图检测层                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │角色需求 │ │记忆需求 │ │思考需求 │ ...      │
│  └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│              决策判断层                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │工具选择 │ │角色推荐 │ │工作流编排│          │
│  └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────┬───────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│              执行反馈层                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │工具执行 │ │结果格式化│ │用户反馈 │          │
│  └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────┘
```

## 使用方式

### 1. 基础集成

```typescript
import { LLMService } from '@/services/llm/LLMService';
import { PROMPTX_SYSTEM_PROMPT } from '@/shared/prompts/PromptXSystemPrompt';

// LLMService已自动集成PromptX系统提示词
const llmService = new LLMService();

// 发送消息时会自动检测意图
const response = await llmService.sendMessage({
  message: "帮我开发一个计算器工具",
  systemPrompt: PROMPTX_SYSTEM_PROMPT // 可选，已默认集成
}, modelId);
```

### 2. 高级用法（使用LangChain）

```typescript
import { createPromptXEnhancedChat } from '@/shared/langchain/PromptXEnhancedChain';
import { ChatOpenAI } from "@langchain/openai";

// 创建增强的聊天链
const llm = new ChatOpenAI({ modelName: "gpt-4" });
const chain = createPromptXEnhancedChat(llm);

// 调用时返回建议的工作流
const result = await chain.invoke({
  input: "我想学习机器学习",
  chat_history: []
});

console.log("AI响应:", result.response);
console.log("建议的PromptX操作:", result.promptx_actions);
console.log("完整工作流:", result.suggested_workflow);
```

## 意图检测示例

### 角色激活

```
用户输入: "帮我开发一个网站"
检测结果: 
- 意图类型: role
- 建议角色: luban (工具开发专家)
- 置信度: 0.85
- 工作流: promptx_action(luban) → promptx_learn → promptx_tool
```

### 记忆操作

```
用户输入: "记住我喜欢使用React框架"
检测结果:
- 意图类型: memory
- 建议操作: promptx_remember
- 置信度: 0.9
- 工作流: promptx_remember(user_preference)
```

### 深度思考

```
用户输入: "帮我深入分析这个架构的优缺点"
检测结果:
- 意图类型: thinking
- 建议操作: promptx_think
- 置信度: 0.8
- 工作流: promptx_recall → promptx_think → promptx_remember
```

## 工作流模板

### 1. 开发工具工作流
```javascript
[
  { tool: 'promptx_action', params: { role: 'luban' } },
  { tool: 'promptx_learn', params: { resource: '@manual://tool-development' } },
  { tool: 'promptx_think', params: { pattern: 'systematic' } },
  { tool: 'promptx_tool', params: { /* 动态参数 */ } },
  { tool: 'promptx_remember', params: { /* 记忆结果 */ } }
]
```

### 2. 学习知识工作流
```javascript
[
  { tool: 'promptx_action', params: { role: 'noface' } },
  { tool: 'promptx_learn', params: { /* 动态资源 */ } },
  { tool: 'promptx_think', params: { pattern: 'analytical' } },
  { tool: 'promptx_remember', params: { /* 核心概念 */ } }
]
```

### 3. 回忆信息工作流
```javascript
[
  { tool: 'promptx_recall', params: { /* 查询关键词 */ } },
  { tool: 'promptx_think', params: { pattern: 'reasoning' } }
]
```

## 最佳实践

### 1. 系统提示词配置

在创建新会话时，确保使用PromptX系统提示词：

```typescript
import { PROMPTX_SYSTEM_PROMPT } from '@/shared/prompts/PromptXSystemPrompt';

// 方式1：直接使用
const systemPrompt = PROMPTX_SYSTEM_PROMPT;

// 方式2：自定义扩展
const customPrompt = `
${PROMPTX_SYSTEM_PROMPT}

# 项目特定规则
- 优先使用TypeScript
- 遵循公司代码规范
`;
```

### 2. 意图检测优化

```typescript
import { promptXIntentDetector } from '@/shared/services/PromptXIntentDetector';

// 检测用户意图
const intent = promptXIntentDetector.detectIntent(userInput, {
  currentRole: 'assistant',
  memoryHistory: previousMemories
});

// 根据置信度决定是否执行
if (intent && intent.confidence > 0.7) {
  // 执行建议的PromptX操作
  console.log(`建议执行: ${intent.suggestedAction.tool}`);
}
```

### 3. 工作流编排

```typescript
import { promptXWorkflowOrchestrator } from '@/shared/services/PromptXWorkflowOrchestrator';

// 编排工作流
const workflow = promptXWorkflowOrchestrator.orchestrateWorkflow(intent, context);

// 优化工作流（去除冗余）
const optimizedWorkflow = promptXWorkflowOrchestrator.optimizeWorkflow(workflow, context);
```

## 注意事项

1. **性能考虑**
   - 意图检测是轻量级操作，不会显著影响响应时间
   - 工作流编排在客户端完成，不增加网络开销

2. **隐私保护**
   - 所有PromptX工具调用都在本地沙箱中执行
   - 记忆系统数据存储在用户本地

3. **降级策略**
   - 如果PromptX服务不可用，自动降级为普通AI对话
   - 保持基础功能可用性

4. **调试模式**
   - 设置 `verbose: true` 可以看到详细的意图检测和工作流信息
   - 有助于优化意图检测规则

## 扩展开发

### 添加新的意图模式

```typescript
// 在 PromptXSystemPrompt.ts 中添加
export const INTENT_PATTERNS = {
  // ... 现有模式
  
  // 添加自定义模式
  customPattern: {
    myFeature: [
      /特征词1/i,
      /特征词2/i
    ]
  }
};
```

### 自定义工作流模板

```typescript
// 在 PromptXWorkflowOrchestrator.ts 中添加
private createCustomWorkflow(intent: DetectedIntent, context: WorkflowContext): WorkflowStep[] {
  return [
    { tool: 'promptx_action', params: { role: 'custom-role' } },
    { tool: 'promptx_learn', params: { resource: '@custom://resource' } },
    // ... 更多步骤
  ];
}
```

## 总结

PromptX智能工作流系统让DeeChat的AI助手能够：

1. ✅ 自动理解用户意图
2. ✅ 智能选择和组合工具
3. ✅ 提供专业化服务
4. ✅ 保持对话的自然流畅
5. ✅ 记忆重要信息跨会话保持

通过这套系统，用户无需了解PromptX的技术细节，就能享受到强大的AI认知增强能力。