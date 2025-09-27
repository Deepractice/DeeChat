# @deepracticex/context-manager

> 简单而强大的AI上下文格式化器，专注于文本组装，职责单一

## 🎯 核心理念

**职责单一，专注格式化**
- ✅ 只负责文本格式化和组装  
- ✅ 数据由外部传入，不处理数据获取
- ✅ XML结构清晰，四层可选组合
- ✅ API简单，一个方法解决所有需求

## 📦 安装

```bash
npm install @deepracticex/context-manager
```

## 🚀 快速开始

```typescript
import { ContextManager } from '@deepracticex/context-manager';

// 基础使用
const context = ContextManager.format({
  role: "You are a helpful assistant",
  current: "Hello world"
});

console.log(context);
// 输出：
// <context>
// <role>You are a helpful assistant</role>
// 
// <current>Hello world</current>
// </context>
```

## 📋 四层结构

| 层级 | 标签 | 说明 | 可选 |
|-----|------|------|------|
| 第一层 | `<role>` | AI角色定义 | ✅ |
| 第二层 | `<tools>` | MCP工具列表 | ✅ |
| 第三层 | `<conversation>` | 历史对话 | ✅ |
| 第四层 | `<current>` | 当前消息 | ✅ |

## 💡 使用示例

### 完整四层结构

```typescript
const context = ContextManager.format({
  role: "You are a frontend developer with expertise in React",
  tools: [
    "code_analyzer: 分析代码质量和性能",
    "debugger: 帮助调试问题", 
    "optimizer: 提供优化建议"
  ],
  conversation: [
    "User: 你好，我需要帮助优化我的React应用",
    "Assistant: 你好！我很乐意帮助你优化React应用。请告诉我具体遇到了什么问题？",
    "User: 我的组件渲染很慢，特别是列表组件"
  ],
  current: "这是我的列表组件代码，请帮我看看性能问题"
});
```

输出：
```xml
<context>
<role>You are a frontend developer with expertise in React</role>

<tools>
- code_analyzer: 分析代码质量和性能
- debugger: 帮助调试问题
- optimizer: 提供优化建议
</tools>

<conversation>
User: 你好，我需要帮助优化我的React应用
Assistant: 你好！我很乐意帮助你优化React应用。请告诉我具体遇到了什么问题？
User: 我的组件渲染很慢，特别是列表组件
</conversation>

<current>这是我的列表组件代码，请帮我看看性能问题</current>
</context>
```

### 层级可选组合

```typescript
// 只要角色和当前消息
const simple = ContextManager.format({
  role: "You are a coding assistant",
  current: "Help me write a function"
});

// 只要工具和当前消息  
const withTools = ContextManager.format({
  tools: ["generator: 代码生成", "reviewer: 代码审查"],
  current: "Generate a React component"
});

// 只要对话历史
const historyOnly = ContextManager.format({
  conversation: ["User: Hello", "Assistant: Hi!"],
  current: "How are you?"
});
```

### 数据格式灵活支持

```typescript
// 工具：数组格式（自动添加 "- " 前缀）
ContextManager.format({
  tools: ["analyzer: 分析", "debugger: 调试"]
});

// 工具：字符串格式（直接使用）
ContextManager.format({
  tools: "analyzer: 分析工具\ndebugger: 调试工具"
});

// 对话：数组格式（换行拼接）
ContextManager.format({
  conversation: ["User: Hello", "Assistant: Hi"]
});

// 对话：字符串格式（直接使用）
ContextManager.format({
  conversation: "User: Hello\nAssistant: Hi"
});
```



## ⚙️ 格式选项

```typescript
// 禁用根标签
const withoutRoot = ContextManager.format(data, {
  includeRootTag: false
});

// 自定义空行间距
const customSpacing = ContextManager.format(data, {
  spacingLines: 2
});
```

## 📝 API 参考

### `ContextManager.format(data, options?)`

唯一核心方法，负责所有上下文格式化

**参数：**
- `data: ContextData` - 上下文数据，所有层都是可选的
- `options?: FormatOptions` - 格式化选项

**返回：** `string` - 格式化后的XML字符串

### `ContextData` 接口

```typescript
interface ContextData {
  role?: string;                    // 角色层
  tools?: string | string[];        // 工具层  
  conversation?: string | string[];  // 对话层
  current?: string;                 // 当前消息层
}
```

### `FormatOptions` 接口

```typescript
interface FormatOptions {
  includeRootTag?: boolean;    // 是否包含 <context> 根标签，默认 true
  spacingLines?: number;       // 层级间空行数量，默认 1
}
```

## 🎨 设计特点

- **职责单一**：只做文本格式化，不处理数据获取
- **结构清晰**：XML标签天然分层，便于阅读和解析  
- **高度复用**：可在任何需要上下文的地方调用
- **类型安全**：完整的TypeScript类型支持
- **零依赖**：无运行时依赖，轻量级设计

## 📄 License

MIT

## 🤝 Contributing

欢迎提交 Issue 和 Pull Request！

---

**简单而强大，专注于做好一件事** 🎯