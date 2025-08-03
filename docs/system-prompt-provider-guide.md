# 系统提示词提供器框架使用指南

## 概述

系统提示词提供器（System Prompt Provider）是DeeChat中用于统一管理AI系统提示词的框架。它提供了灵活的方式来动态组合和管理系统提示词，支持根据不同的功能上下文注入相应的提示词片段。

## 核心概念

### 1. PromptSegment（提示词片段）

提示词片段是系统提示词的基本组成单元。

```typescript
interface PromptSegment {
  id: string;                    // 唯一标识
  content: string;               // 提示词内容
  enabled: boolean;              // 是否启用
  priority?: number;             // 优先级（数字越大越优先）
  condition?: () => boolean;     // 动态条件函数
}
```

### 2. PromptProvider（提示词提供者）

提示词提供者负责提供一组相关的提示词片段。

```typescript
interface PromptProvider {
  getSegments(): PromptSegment[];
}
```

### 3. ISystemPromptProvider（系统提示词提供器）

系统提示词提供器是整个框架的核心，负责管理所有提示词片段并构建最终的系统提示词。

## 基本使用

### 1. 获取系统提示词提供器

```typescript
import { LLMService } from '@/services/llm/LLMService';

const llmService = new LLMService();
const promptProvider = llmService.getSystemPromptProvider();
```

### 2. 设置基础系统提示词

```typescript
promptProvider.setBasePrompt("You are DeeChat AI assistant, a helpful and friendly chatbot.");
```

### 3. 添加提示词片段

```typescript
// 添加单个片段
promptProvider.addSegment({
  id: 'timestamp',
  content: `Current time: ${new Date().toISOString()}`,
  enabled: true,
  priority: 100  // 高优先级，会出现在前面
});

// 添加带条件的片段
promptProvider.addSegment({
  id: 'debug-mode',
  content: 'Debug mode is enabled. Please provide detailed technical information.',
  enabled: true,
  priority: 50,
  condition: () => process.env.DEBUG === 'true'  // 只在调试模式下包含
});
```

### 4. 移除提示词片段

```typescript
promptProvider.removeSegment('debug-mode');
```

### 5. 清除所有片段

```typescript
promptProvider.clearSegments();  // 只清除片段，保留基础提示词
```

## 高级用法

### 1. 实现自定义提示词提供者

```typescript
class FeatureContextProvider implements PromptProvider {
  private currentFeature: string = 'chat';
  
  setCurrentFeature(feature: string) {
    this.currentFeature = feature;
  }
  
  getSegments(): PromptSegment[] {
    switch(this.currentFeature) {
      case 'code-editor':
        return [{
          id: 'code-context',
          content: 'User is in code editor. Provide code-focused assistance.',
          enabled: true,
          priority: 20
        }];
      
      case 'file-manager':
        return [{
          id: 'file-context',
          content: 'User is browsing files. Help with file operations.',
          enabled: true,
          priority: 20
        }];
      
      default:
        return [];
    }
  }
}

// 注册提供者
const featureProvider = new FeatureContextProvider();
promptProvider.registerProvider(featureProvider);

// 切换功能上下文
featureProvider.setCurrentFeature('code-editor');
```

### 2. 动态条件示例

```typescript
class TimeBasedProvider implements PromptProvider {
  getSegments(): PromptSegment[] {
    const hour = new Date().getHours();
    
    return [{
      id: 'morning-greeting',
      content: 'Good morning! How can I help you today?',
      enabled: true,
      priority: 10,
      condition: () => hour >= 6 && hour < 12
    }, {
      id: 'afternoon-greeting',
      content: 'Good afternoon! What can I do for you?',
      enabled: true,
      priority: 10,
      condition: () => hour >= 12 && hour < 18
    }, {
      id: 'evening-greeting',
      content: 'Good evening! How may I assist you?',
      enabled: true,
      priority: 10,
      condition: () => hour >= 18 || hour < 6
    }];
  }
}
```

### 3. PromptX集成示例

```typescript
class PromptXRoleProvider implements PromptProvider {
  private currentRole?: string;
  private availableTools: string[] = [];
  
  setCurrentRole(role: string) {
    this.currentRole = role;
  }
  
  setAvailableTools(tools: string[]) {
    this.availableTools = tools;
  }
  
  getSegments(): PromptSegment[] {
    const segments: PromptSegment[] = [];
    
    // 当前角色提示
    if (this.currentRole) {
      segments.push({
        id: 'promptx-current-role',
        content: `You are currently using PromptX role: ${this.currentRole}`,
        enabled: true,
        priority: 30
      });
    }
    
    // 可用工具提示
    if (this.availableTools.length > 0) {
      segments.push({
        id: 'promptx-tools',
        content: `Available PromptX tools: ${this.availableTools.join(', ')}`,
        enabled: true,
        priority: 25
      });
    }
    
    return segments;
  }
}
```

## 系统提示词构建流程

当调用 `buildSystemPrompt()` 时，系统会按以下步骤构建最终的提示词：

1. **收集所有片段**
   - 从直接添加的片段中收集
   - 从所有注册的Provider中收集

2. **过滤片段**
   - 检查 `enabled` 属性
   - 如果有 `condition` 函数，执行并检查返回值

3. **排序片段**
   - 按 `priority` 降序排序（优先级高的在前）

4. **组合内容**
   - 基础提示词放在最前
   - 按顺序添加所有片段
   - 使用双换行符连接

## 与LangChain集成

系统提示词提供器已经集成到 `LangChainLLMService` 中：

```typescript
// 发送消息时自动使用系统提示词
await llmService.sendMessage("Hello", "gpt-4");

// 也可以提供额外的临时提示词
await llmService.sendMessage(
  "Hello", 
  "gpt-4",
  "Additional context for this specific request"
);
```

## 最佳实践

### 1. ID命名规范

使用清晰的命名空间避免冲突：

```typescript
// 好的命名
'feature-code-editor'
'promptx-role-luban'
'context-timestamp'

// 避免的命名
'prompt1'
'temp'
'test'
```

### 2. 优先级使用建议

- 100+: 关键系统信息（时间戳、环境信息）
- 50-99: 功能上下文
- 20-49: 角色和工具信息
- 0-19: 其他辅助信息

### 3. 条件函数注意事项

条件函数应该：
- 执行快速，避免复杂计算
- 不产生副作用
- 处理异常情况

```typescript
// 好的条件函数
condition: () => userSettings.theme === 'dark'

// 避免的条件函数
condition: () => {
  // 不要在条件函数中进行异步操作或修改状态
  fetchUserSettings();  // ❌
  userSettings.theme = 'dark';  // ❌
}
```

### 4. Provider生命周期管理

```typescript
class ManagedProvider implements PromptProvider {
  private disposed = false;
  
  getSegments(): PromptSegment[] {
    if (this.disposed) return [];
    // 返回片段...
  }
  
  dispose() {
    this.disposed = true;
    // 清理资源
  }
}
```

## 调试技巧

### 1. 查看当前系统提示词

```typescript
const currentPrompt = promptProvider.buildSystemPrompt();
console.log('Current system prompt:', currentPrompt);
```

### 2. 查看所有活跃片段

```typescript
const activeSegments = promptProvider.getSegments();
console.log('Active segments:', activeSegments);
```

### 3. 调试Provider

```typescript
class DebugProvider implements PromptProvider {
  getSegments(): PromptSegment[] {
    const segments = this.generateSegments();
    console.log('Provider segments:', segments);
    return segments;
  }
  
  private generateSegments(): PromptSegment[] {
    // 实际逻辑
  }
}
```

## 注意事项

1. **性能考虑**：Provider的 `getSegments()` 方法会在每次构建提示词时调用，应避免耗时操作。

2. **内存管理**：注册的Provider会一直保留引用，不再使用时应考虑清理机制。

3. **提示词长度**：注意总的系统提示词长度，避免超过模型的上下文限制。

4. **线程安全**：当前实现不是线程安全的，在多线程环境中使用需要额外的同步机制。

## 扩展计划

未来可能的扩展方向：

1. **持久化支持**：保存和加载提示词配置
2. **提示词模板**：支持变量替换的模板系统
3. **版本管理**：提示词版本控制和回滚
4. **A/B测试**：支持多个提示词版本的对比测试
5. **性能优化**：缓存机制减少重复构建