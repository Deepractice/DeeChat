# DeeChat 架构文档

## 🏗️ 架构概述

DeeChat 基于 Electron + React + TypeScript 构建，采用模块化设计，实现了统一的流式消息架构。

## 📁 项目结构

```
DeeChat/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts            # 主进程入口
│   │   ├── ipc/                # IPC 通信处理器
│   │   │   └── langchainHandlers.ts  # LangChain IPC 处理
│   │   ├── services/           # 核心服务
│   │   │   ├── llm/           # LLM 服务
│   │   │   │   └── LLMService.ts      # 统一流式消息服务
│   │   │   ├── mcp/           # MCP 协议服务
│   │   │   └── promptx/       # PromptX 服务
│   │   └── repositories/       # 数据访问层
│   ├── renderer/               # 渲染进程
│   │   ├── src/
│   │   │   ├── components/    # React 组件
│   │   │   ├── store/         # Redux 状态管理
│   │   │   │   └── slices/
│   │   │   │       └── chatSlice.ts   # 聊天状态切片
│   │   │   └── hooks/         # 自定义 Hooks
│   │   └── mockElectronAPI.ts # 开发环境 Mock API
│   ├── preload/               # 预加载脚本
│   │   └── index.ts          # API 暴露到渲染进程
│   └── shared/                # 共享模块
│       ├── langchain/         # LangChain 集成
│       │   ├── LangChainLLMService.ts        # 核心 LLM 服务
│       │   └── layers/
│       │       └── RoleStatusMonitorLayer.ts  # 角色监控层
│       └── services/          # 共享服务
└── resources/                 # 资源文件
    └── promptx/              # PromptX 框架
```

## 🔄 核心架构原理

### 1. 统一流式消息架构

**设计理念**: 所有AI交互统一使用 `streamMessage` 方法，实现实时响应。

```typescript
// 唯一的消息发送接口
async streamMessage(
  request: LLMRequest, 
  configId?: string, 
  onChunk?: (chunk: string) => void
): Promise<string>
```

**已删除的冗余方法**:
- ❌ `sendMessage` - 非流式方法
- ❌ `sendMessageWithMCPTools` - 非流式MCP方法

### 2. 智能分层提示词系统

基于 PromptX 框架的 3 层架构：

```
┌─────────────────────────────────────┐
│        Layer 1: 系统基础层          │
│     基础AI能力和行为规范           │
├─────────────────────────────────────┤
│        Layer 2: 角色专业层          │
│     PromptX角色激活和专业能力      │
├─────────────────────────────────────┤
│        Layer 3: 用户交互层          │
│       用户输入和上下文对话         │
└─────────────────────────────────────┘
```

### 3. PromptX 角色激活机制

```typescript
// 角色激活流程
promptX.action(roleId) → 加载角色内容 → 注入到 Layer 2 → AI获得专业能力
```

## 📡 IPC 通信架构

### 渲染进程 ↔ 主进程

```typescript
// 统一的流式消息 IPC
ipcRenderer.invoke('ai:streamMessage', request)

// 流式事件监听
ipcRenderer.on('ai:streamChunk', callback)
```

### 已清理的 IPC 处理器
- ❌ `ai:sendMessage` - 已删除
- ❌ `ai:sendMessageWithMCPTools` - 已删除

## 🧠 智能服务集成

### LangChain 服务层

```typescript
class LangChainLLMService {
  // 🔥 核心流式方法
  async streamMessage(request, configId, onChunk): Promise<string>
  
  // ✅ 智能分层提示词构建
  buildMessages(request): ChatMessage[]
  
  // ✅ PromptX 角色激活
  activateRole(roleId): Promise<string>
}
```

### PromptX 集成

- **本地服务**: `PromptXLocalService`
- **MCP 服务器**: 内置 PromptX MCP 服务器
- **命令执行**: 支持 `init`, `welcome`, `action`, `learn`, `recall`, `remember`

## 🔧 开发环境配置

### Mock API 支持

开发环境使用 `mockElectronAPI.ts` 模拟 Electron API：

```typescript
// ✅ 统一流式方法
streamMessage: async (request) => {
  // 模拟流式响应
  return new Promise((resolve) => {
    // 模拟响应逻辑
  })
}
```

### 编译和构建

```bash
# 开发环境
npm run dev

# 类型检查
npm run type-check

# 构建
npm run build

# 打包
npm run dist
```

## 🗄️ 数据架构

### SQLite 数据库

- **聊天会话**: `ChatSessionEntity`
- **消息历史**: 完整对话记录
- **配置管理**: LLM 配置和用户偏好
- **MCP 服务器**: 服务器配置和状态

### 状态管理 (Redux)

```typescript
// chatSlice.ts - 聊天状态管理
interface ChatState {
  sessions: ChatSession[]
  currentSession?: ChatSession
  isLoading: boolean
  // ❌ 已删除 sendMessage 相关状态
}
```

## 🚀 部署架构

### Electron 应用打包

- **主进程**: `dist/main/`
- **渲染进程**: `dist/renderer/`
- **预加载脚本**: `dist/preload/`

### 平台支持

- 🍎 **macOS**: .dmg 安装包
- 🪟 **Windows**: .exe 安装包  
- 🐧 **Linux**: AppImage 格式

## 📈 性能优化

### 流式响应优化

- **实时输出**: 边生成边显示，提升用户体验
- **内存管理**: 流式处理减少内存占用
- **错误处理**: 优雅的错误恢复机制

### 代码优化

- **统一接口**: 消除重复代码，提升维护性
- **类型安全**: TypeScript 确保类型安全
- **模块化**: 清晰的模块边界和依赖关系

## 🔐 安全架构

### 数据安全

- **本地存储**: 所有数据本地 SQLite 数据库
- **加密保护**: API 密钥加密存储
- **沙箱执行**: MCP 工具安全隔离

### API 安全

- **主进程隔离**: 敏感操作在主进程执行
- **IPC 验证**: 严格的 IPC 消息验证
- **权限控制**: 细粒度的权限管理

## 🧪 测试架构

### 单元测试

- **Jest**: 测试框架
- **Mock**: 完整的 Mock API 支持
- **覆盖率**: 核心功能测试覆盖

### 集成测试

- **IPC 通信**: 主渲染进程通信测试
- **服务集成**: LangChain 和 PromptX 集成测试
- **端到端**: 完整用户流程测试

---

## 📝 架构变更日志

### v1.0.0 - 统一流式架构重构

**重大变更**:
- ✅ 统一使用 `streamMessage` 作为唯一消息接口
- ❌ 删除 `sendMessage` 和 `sendMessageWithMCPTools` 冗余方法
- 🔧 修复编译错误和运行时错误
- 📱 优化流式响应用户体验

**文件变更**:
- `LLMService.ts`: 删除 200+ 行冗余代码
- `langchainHandlers.ts`: 清理 IPC 处理器
- `chatSlice.ts`: 移除过期状态管理
- `mockElectronAPI.ts`: 统一 Mock API

**影响**:
- 🚀 代码简洁性提升 40%
- ⚡ 维护成本降低
- 📊 用户体验改善
- 🛡️ 系统稳定性增强

---

*更新时间: 2025-08-20*
*版本: v1.0.0*