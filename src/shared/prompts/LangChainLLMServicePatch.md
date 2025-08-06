# LangChainLLMService 集成指南

## 概述

这个文档展示如何将DeeChat专属提示词系统集成到现有的LangChainLLMService中。

## 集成步骤

### 1. 修改构造函数

在`src/shared/langchain/LangChainLLMService.ts`中修改构造函数：

```typescript
import { enhancedSystemPromptProvider } from '../prompts';
import { llmPromptIntegration } from '../prompts/LLMServiceIntegration';

export class LangChainLLMService {
  // ... 现有代码 ...

  constructor(
    promptProvider?: ISystemPromptProvider, 
    configService?: IModelConfigService,
    mcpService?: MCPIntegrationServiceInterface
  ) {
    // 使用增强的提示词提供器作为默认值
    this.promptProvider = promptProvider || enhancedSystemPromptProvider;
    this.configService = configService;
    this.mcpService = mcpService;
    
    // 初始化DeeChat提示词系统
    this.initializeDeeChatPrompts();
  }

  /**
   * 初始化DeeChat提示词系统
   */
  private async initializeDeeChatPrompts(): Promise<void> {
    try {
      await llmPromptIntegration.initializeLLMServicePrompts();
    } catch (error) {
      console.warn('DeeChat提示词系统初始化失败，将使用基础提示词:', error);
    }
  }
}
```

### 2. 增强sendMessage方法

```typescript
async sendMessage(
  message: string,
  configId: string,
  systemPrompt?: string
): Promise<string> {
  // 确保提示词系统已初始化
  if (this.promptProvider === enhancedSystemPromptProvider) {
    await llmPromptIntegration.initializeLLMServicePrompts();
  }

  const model = await this.getModel(configId);

  // 构建系统提示词（现在会包含DeeChat专属内容）
  let finalSystemPrompt = this.promptProvider.buildSystemPrompt();
  
  // 如果提供了额外的系统提示词，追加到最后
  if (systemPrompt) {
    finalSystemPrompt = finalSystemPrompt ? 
      `${finalSystemPrompt}\n\n${systemPrompt}` : 
      systemPrompt;
  }

  const messages: BaseMessage[] = [
    ...(finalSystemPrompt ? [new SystemMessage(finalSystemPrompt)] : []),
    new HumanMessage(message)
  ];

  const response = await model.invoke(messages);
  return response.content as string;
}
```

### 3. 添加上下文设置方法

```typescript
/**
 * 设置功能上下文
 */
setFeatureContext(feature: DeeChatFeature, data?: Record<string, any>): void {
  if (this.promptProvider === enhancedSystemPromptProvider) {
    (this.promptProvider as EnhancedSystemPromptProvider).setFeatureContext(feature, data);
  }
}

/**
 * 设置PromptX角色
 */
setPromptXRole(role: string, description?: string, capabilities?: string[]): void {
  if (this.promptProvider === enhancedSystemPromptProvider) {
    (this.promptProvider as EnhancedSystemPromptProvider).setPromptXRole(role, description, capabilities);
  }
}

/**
 * 更新MCP工具状态
 */
updateMCPToolStatus(availableTools: string[]): void {
  if (this.promptProvider === enhancedSystemPromptProvider) {
    (this.promptProvider as EnhancedSystemPromptProvider).updateMCPToolStatus(availableTools);
  }
}

/**
 * 获取当前系统提示词（调试用）
 */
getCurrentSystemPrompt(): string {
  return this.promptProvider.buildSystemPrompt();
}
```

### 4. 在sendMessageWithMCPTools中集成

```typescript
async sendMessageWithMCPTools(
  message: string,
  config: ModelConfigEntity,
  systemPrompt?: string,
  enableMCPTools: boolean = true
): Promise<any> {
  // 设置MCP工具上下文
  if (enableMCPTools && this.mcpService) {
    const availableTools = await this.mcpService.getAllTools();
    const toolNames = availableTools.map(tool => tool.name);
    
    // 更新MCP工具状态到提示词系统
    if (this.promptProvider === enhancedSystemPromptProvider) {
      (this.promptProvider as EnhancedSystemPromptProvider).updateMCPToolStatus(toolNames);
    }
  }

  // ... 现有的MCP工具调用逻辑 ...
}
```

## 使用示例

### 在主服务中初始化

```typescript
// 在LLMService.ts的构造函数中
import { llmPromptIntegration } from '../../../shared/prompts/LLMServiceIntegration';

export class LLMService {
  constructor() {
    // ... 现有代码 ...
    
    // 初始化提示词系统
    this.initializePromptSystem();
  }

  private async initializePromptSystem(): Promise<void> {
    try {
      await llmPromptIntegration.initializeLLMServicePrompts();
    } catch (error) {
      console.error('提示词系统初始化失败:', error);
    }
  }
}
```

### 在UI组件中设置上下文

```typescript
// 在Chat组件中
import { setupChatContext } from '../../../shared/prompts/LLMServiceIntegration';

useEffect(() => {
  // 设置聊天上下文
  setupChatContext(['promptx-tools', 'context7-tools']);
}, []);
```

```typescript
// 在ResourcesPage组件中
import { setupResourcesContext } from '../../../shared/prompts/LLMServiceIntegration';

useEffect(() => {
  // 设置资源管理上下文
  setupResourcesContext(['file-management-tools']);
}, []);
```

### 动态角色切换

```typescript
// 当用户切换PromptX角色时
import { setupRoleContext } from '../../../shared/prompts/LLMServiceIntegration';

const handleRoleChange = async (role: string) => {
  await setupRoleContext(
    role,
    '专业开发者角色',
    ['代码生成', '架构设计', '技术咨询'],
    ['promptx-tools', 'context7-tools']
  );
};
```

## 调试和监控

### 查看当前系统提示词

```typescript
import { getLLMSystemPrompt } from '../../../shared/prompts/LLMServiceIntegration';

const debugPrompt = async () => {
  const prompt = await getLLMSystemPrompt();
  console.log('当前系统提示词:', prompt);
};
```

### 监控提示词统计

```typescript
import { getPromptStats } from '../../../shared/prompts';

const stats = getPromptStats();
console.log('提示词统计:', stats);
```

## 注意事项

1. **渐进式集成**: 可以逐步集成，现有功能不会受到影响
2. **向后兼容**: 如果初始化失败，会回退到原有的基础提示词系统
3. **性能优化**: 提示词系统使用懒加载，不会影响启动性能
4. **调试支持**: 提供丰富的调试接口，便于问题排查和优化

## 完成集成后的效果

- ✅ AI将具有明确的DeeChat身份和桌面应用特性
- ✅ 根据当前功能模块自动调整提示词上下文
- ✅ 支持PromptX角色动态切换和专业化
- ✅ MCP工具调用更加自然和智能
- ✅ 提供丰富的调试和监控能力
- ✅ 保持系统的可扩展性和可维护性