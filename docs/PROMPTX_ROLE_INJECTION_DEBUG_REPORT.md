# DeeChat PromptX角色注入系统调试报告

## 问题概述

**主要问题**：女娲的提示词没有全部注入到系统提示词中，导致角色切换后系统提示词不完整。

**症状**：
1. 角色选择后，系统提示词只有15个字符（显示为"[object Object]"）
2. 角色内容没有正确注入到LLM请求中
3. 工具调用表面上执行成功，但实际文件创建失败

## 根本原因分析

### 1. PromptX对象解析错误
- **问题**：PromptX返回的是嵌套对象结构 `{success: boolean, data: {content: string, context: object, format: string}}`
- **错误**：前端直接将整个对象转换为字符串，导致得到"[object Object]"
- **影响**：系统提示词只有15个字符，完全没有角色内容

### 2. API调用路径错误
- **问题**：前端调用 `window.electronAPI.streamMessage()` 方法不存在
- **错误**：应该使用 `window.electronAPI.ai.streamMessage()`
- **影响**：导致请求发送失败

### 3. 工具调用执行机制问题
- **问题**：AI检测到 `<promptx_tool>` 标签但工具实际执行失败
- **现象**：创建SQL专家角色时，只创建了thought文件，核心的`sql-expert.role.md`文件创建失败
- **影响**：角色表面上创建成功，但实际无法被PromptX发现

## 已修复的问题

### ✅ 1. PromptX初始化死锁问题
**问题**：ProjectManager初始化循环依赖
```
initWorkspace → PouchCLI.execute → PouchStateMachine.saveState 
→ ProjectManager.getCurrentProjectPath → requires initialized project
```

**解决方案**：移除显式初始化调用，使用PromptX自动初始化机制
```typescript
// 移除了这些代码
// await this.promptxService.execute('init', [workspacePath, ideType])
```

### ✅ 2. 前端角色解析器更新
**问题**：解析器无法识别新的角色格式

**解决方案**：更新正则表达式匹配新格式
```typescript
// 更新前：旧格式解析
// 更新后：新格式解析
const roleMatch = trimmedLine.match(/^-\s*`([^`]+)`:\s*([^→]+)(?:→\s*action\("[^"]+"\))?/)
```

### ✅ 3. PromptX对象解析修复
**问题**：`baseTemplateResult.data` 被转换为"[object Object]"

**解决方案**：正确提取嵌套内容
```typescript
// 修复前
baseTemplate = String(baseTemplateResult.data) // "[object Object]"

// 修复后
if (baseTemplateResult.success && baseTemplateResult.data?.content) {
  baseTemplate = String(baseTemplateResult.data.content) // 实际内容
}
```

### ✅ 4. API调用路径修复
**问题**：`window.electronAPI.streamMessage` 不存在

**解决方案**：使用正确的API路径
```typescript
// 修复前
const response = await window.electronAPI.streamMessage(requestData)

// 修复后  
const response = await window.electronAPI.ai.streamMessage(requestData)
```

### ✅ 5. 系统提示词传递统一
**问题**：多处对系统提示词进行不一致的处理

**解决方案**：统一使用`systemPrompt`字段传递
```typescript
// 在主进程IPC处理中统一提取
const systemPrompt = llmRequest?.systemPrompt || request?.systemPrompt || null
```

## 架构优化

### 简化设计原则（奥卡姆剃刀）
1. **移除冗余组件**：删除了重复的角色内容解析器
2. **统一参数传递**：所有地方都使用`systemPrompt`字段
3. **依赖注入模式**：使用PromptX自动初始化避免循环依赖
4. **全局模式运行**：避免项目初始化的复杂性

### 角色管理架构
```
用户选择角色 → 
前端调用promptx.action(roleId) → 
PromptX返回角色内容 → 
变量注入器处理 → 
生成完整系统提示词 → 
发送给LLM服务
```

## 当前待解决问题

### ❌ 工具调用执行失败
**问题描述**：
- AI响应中包含 `<promptx_tool>` 标签
- 系统检测到工具调用并尝试执行
- 但实际文件创建失败（如sql-expert.role.md缺失）

**影响**：
- 角色创建表面成功，实际失败
- 用户看不到新创建的角色

**需要进一步调查**：
1. 工具执行的具体失败原因
2. 错误处理和反馈机制
3. 文件权限或路径问题

## 文件变更记录

### 核心修复文件
1. **src/renderer/src/hooks/useUnifiedMessage.ts**
   - 修复PromptX对象解析逻辑
   - 修复API调用路径

2. **src/main/index.ts** 
   - 移除PromptX初始化逻辑
   - 统一systemPrompt参数传递

3. **src/preload/index.ts**
   - 添加根层级streamMessage方法

4. **src/renderer/src/utils/promptxParser.ts**
   - 更新角色格式解析器
   - 过滤工具条目

## 测试验证

### 已验证功能 ✅
- [x] 角色列表正确解析（6个角色：5系统+1用户）
- [x] 角色内容正确注入（从15字符提升到完整内容）
- [x] 系统提示词正确传递给LLM
- [x] API调用路径正确

### 待验证功能 ❓
- [ ] 工具调用实际文件创建
- [ ] 新角色的PromptX发现机制
- [ ] 角色创建完整流程

## 建议后续工作

1. **优先级1**：修复工具调用执行失败问题
2. **优先级2**：完善错误处理和用户反馈
3. **优先级3**：添加角色创建状态监控
4. **优先级4**：优化角色发现和刷新机制

## 技术架构建议

### 角色资源管理
- 考虑在用户安装时将deechat-assistant复制到系统角色目录
- 统一角色发现机制，避免多路径查找
- 实现角色热重载功能

### 工具执行监控
- 添加工具执行状态追踪
- 实现执行失败的用户反馈
- 提供工具执行日志查看功能

---

**调试会话总结**：本次调试成功解决了角色注入的核心问题，系统提示词现在能正确包含角色内容。但工具调用执行失败的问题仍需进一步调查。整体架构通过奥卡姆剃刀原则得到了简化和优化。