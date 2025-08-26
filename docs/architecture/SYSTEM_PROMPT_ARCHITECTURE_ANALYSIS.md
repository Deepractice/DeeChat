# DeeChat 系统提示词架构分析

## 🔍 奥卡姆剃刀分析：问题的本质

### 核心问题（最简单的事实）
**用户反馈**：女娲的提示词没有全部注入 → AI不能完整执行角色指令  
**根本原因**：前端压根没给后端传基础系统提示词

### 证据链（直接因果）
1. `useUnifiedMessage.ts:92` 发送requestData → **缺少baseSystemPrompt字段**
2. 后端收到空的baseSystemPrompt → **使用"你是一个有帮助的AI助手"**  
3. AI收到通用指令 → **当然不知道自己应该是什么角色**

### 问题现状
1. **AI无法执行完整角色创建指令**：女娲角色的完整提示词未被注入，导致AI功能受限
2. **系统提示词退化**：使用通用的"你是一个有帮助的AI助手"而非专业角色模板
3. **架构偏离原始设计**：deechat-assistant角色模板未被正确激活和使用

## 📊 系统提示词生成流程分析

### 当前实际流程
```mermaid
graph TD
    A[前端用户输入] --> B[useUnifiedMessage.sendMessage]
    B --> C[构建requestData]
    C --> D{是否包含baseSystemPrompt?}
    D -->|否| E[后端SmartLayeredPromptSystem]
    E --> F[使用通用后备提示词]
    F --> G["你是一个有帮助的AI助手。"]
    
    H[用户选择角色] --> I[RoleStatusMonitorLayer.activateRole]
    I --> J[promptxService.execute action]
    J --> K[ActionCommand处理]
    K --> L[SemanticRenderer展开@!execution://]
    L --> M[角色内容正确解析]
    M --> N[但未传递给系统提示词层]
```

### 原始设计意图流程
```mermaid
graph TD
    A[系统启动] --> B[默认激活deechat-assistant]
    B --> C[通过action工具提取角色内容]
    C --> D[作为baseSystemPrompt模板]
    D --> E[注入动态变量]
    E --> F[{{AVAILABLE_TOOLS_DETAILED}}]
    E --> G[{{PROJECT_NAME}}]
    E --> H[{{RUNTIME_INJECTION}}]
    I[用户选择其他角色] --> J[覆盖或扩展基础模板]
```

## 🏗️ 架构层次分析

### Layer 1: Frontend Request (useUnifiedMessage.ts)
**文件位置**: `src/renderer/src/hooks/useUnifiedMessage.ts`

**问题**: requestData结构缺失systemPrompt字段
```typescript
// 当前实现 (第75-88行)
const requestData = {
  llmRequest: {
    message: content,
    activeRole,      // ✅ 有角色信息
    sessionId
    // ❌ 缺失: baseSystemPrompt字段
  },
  configId,
  enableMCPTools
};
```

**修复需求**: 添加baseSystemPrompt字段，默认使用deechat-assistant

### Layer 2: Backend Prompt Construction (SmartLayeredPromptSystem.ts)
**文件位置**: `src/shared/langchain/SmartLayeredPromptSystem.ts`

**问题**: 后备提示词过于简单
```typescript
// 第228行
new SystemMessage(baseSystemPrompt || '你是一个有帮助的AI助手。')
```

**修复需求**: 当baseSystemPrompt为空时，应该主动加载deechat-assistant模板

### Layer 3: Role Management (SystemRoleManager.ts)
**文件位置**: `src/main/core/SystemRoleManager.ts`

**问题**: 注册的是通用'assistant'而非'deechat-assistant'
```typescript
// 第48-55行
{
  id: 'assistant',           // ❌ 应该是 'deechat-assistant'
  name: 'AI助手',            // ❌ 应该使用完整模板
  description: '通用AI助手角色，提供基础对话和任务处理能力',
  isActive: true
}
```

### Layer 4: Role Template (deechat-assistant.role.md)
**文件位置**: `src/shared/promptx/roles/deechat-assistant/deechat-assistant.role.md`

**状态**: 模板完整但未被使用
```markdown
<role>
  <personality>
    我是DeeChat的智能AI助手，您身边友好、专业的数字伙伴。
    @!thought://role-activation-intelligence
  </personality>
  
  <knowledge>
    ## 📊 项目上下文动态注入
    - 当前项目：{{PROJECT_NAME}}
    - 技术栈：{{TECH_STACK}}
    
    ## 🔧 工具生态动态注入
    当前可用工具：{{AVAILABLE_TOOLS_DETAILED}}
  </knowledge>
</role>
```

## 🔧 变量注入机制状态

### 预期变量列表
- `{{PROJECT_NAME}}` - 当前项目名称
- `{{PROJECT_PATH}}` - 项目路径
- `{{TECH_STACK}}` - 技术栈信息
- `{{CONVERSATION_ROUNDS}}` - 对话轮次
- `{{AVAILABLE_TOOLS_DETAILED}}` - 详细工具列表
- `{{RUNTIME_INJECTION}}` - 运行时特殊指令
- `{{USER_CONTEXT}}` - 用户上下文
- `{{TOOL_SUBSTITUTION_RULES}}` - 工具替代规则
- `{{EXECUTION_CONSTRAINTS}}` - 执行约束

### 实现状态
❌ **未实现**: 代码库中未找到变量注入的实现逻辑

## 🛣️ 解决方案路线图

### Phase 1: 恢复基础模板系统
1. **修改SystemRoleManager**: 默认注册'deechat-assistant'而非'assistant'
2. **更新前端请求**: useUnifiedMessage添加baseSystemPrompt字段
3. **集成PromptX**: 在系统启动时加载deechat-assistant模板

### Phase 2: 实现变量注入机制
1. **创建变量解析器**: 实现{{}}语法的变量替换
2. **收集运行时数据**: PROJECT_NAME, TECH_STACK, AVAILABLE_TOOLS等
3. **集成到模板渲染**: 在角色内容解析后进行变量注入

### Phase 3: 优化角色切换逻辑
1. **保持基础模板**: deechat-assistant作为永久基础层
2. **叠加角色内容**: 其他角色内容作为增强层
3. **智能推荐**: 实现intelligent-workflow.execution.md中的推荐逻辑

## 📋 关键文件修复清单

### 1. useUnifiedMessage.ts:92
```typescript
const response = await (window.electronAPI as any).ai.streamMessage({
  ...requestData,
  baseSystemPrompt: await getDefaultSystemPrompt() // 新增
});
```

### 2. SystemRoleManager.ts:50
```typescript
{
  id: 'deechat-assistant',  // 修改
  name: 'DeeChat智能助手',   // 修改
  description: 'DeeChat的专业AI助手，具备完整角色模板',
  isActive: true
}
```

### 3. SmartLayeredPromptSystem.ts:228
```typescript
const defaultPrompt = baseSystemPrompt || await this.loadDeeChatAssistant();
new SystemMessage(defaultPrompt)
```

## 💡 架构改进建议

### 1. 统一提示词管理
- 创建PromptTemplateManager统一管理所有模板
- 实现模板继承机制(基础模板 + 角色扩展)
- 添加模板版本控制和热更新

### 2. 变量注入系统
- 实现运行时上下文收集器
- 支持动态变量注册和更新
- 添加变量缓存机制提升性能

### 3. 角色生态完善
- 标准化角色定义格式(DPML)
- 实现角色能力评估和匹配
- 添加角色切换的平滑过渡

## 🔧 奥卡姆剃刀修复方案

### 最简修复（只需要这一个）
**文件**: `src/renderer/src/hooks/useUnifiedMessage.ts:75-88`

```typescript
// 当前代码（有问题）
const requestData = {
  llmRequest: {
    message: content,
    activeRole,
    sessionId
    // ❌ 缺失: baseSystemPrompt
  },
  configId,
  enableMCPTools
};

// 修复代码（加一行）
const requestData = {
  llmRequest: {
    message: content,
    activeRole,
    sessionId
  },
  baseSystemPrompt: await getDeeChatAssistantPrompt(), // ✅ 就这一行
  configId,
  enableMCPTools
};
```

### 需要实现的辅助函数
```typescript
// 在useUnifiedMessage.ts顶部添加
const getDeeChatAssistantPrompt = async () => {
  const response = await (window.electronAPI as any).promptx.action('deechat-assistant');
  return response?.content || '你是DeeChat的智能AI助手';
};
```

## ❌ 奥卡姆剃刀删减的"伪问题"

### 不是问题的问题
- ✅ PromptX的action命令执行（已验证正常）
- ✅ SemanticRenderer的@!execution://展开（已验证正常）  
- ✅ RoleStatusMonitorLayer的角色激活（已验证正常）
- ❓ 变量注入机制（锦上添花，不是核心问题）

### 过度设计的解决方案
- ❌ 重构整个PromptTemplateManager
- ❌ 实现复杂的模板继承机制  
- ❌ 添加变量缓存和热更新
- ❌ 创建角色生态完善系统

## 🎯 修复优先级（简化版）

### P0 (唯一关键修复)
- [ ] **修复useUnifiedMessage缺失baseSystemPrompt** ← 这个解决99%的问题

### P1 (可选优化)
- [ ] 实现{{变量}}注入（提升体验）
- [ ] 优化角色切换流程（用户友好）

---

**奥卡姆剃刀结论**: 问题的根本原因极其简单 - 前端没传baseSystemPrompt，后端就用了通用提示词。修复只需要在前端加载deechat-assistant模板并传给后端即可。其他都是次要问题。