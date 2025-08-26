# DeeChat DDD 架构指南

🏗️ **DeeChat领域驱动设计(DDD)架构** - 将复杂的AI聊天应用按业务价值重新组织

## 🎯 架构概览

```
src/
├── domains/              # 领域层 - 业务核心
│   ├── tool/            # 工具领域 - MCP工具生态
│   ├── intelligence/    # 智能领域 - PromptX智能系统
│   ├── conversation/    # 对话领域 - 聊天会话管理
│   └── index.ts         # 域层统一导出
├── application/          # 应用服务层 - 用例编排
│   ├── conversation/    # 对话用例
│   ├── tool/            # 工具用例
│   ├── intelligence/   # 智能用例
│   └── index.ts         # 应用层统一导出
├── infrastructure/       # 基础设施层 - 技术实现
├── presentation/         # 表示层 - 用户界面
└── shared/              # 跨层共享代码
```

## 🏗️ 分层职责

### 1. 领域层 (Domain Layer) - 业务核心
**职责**: 包含业务逻辑、实体、值对象、领域服务和事件
**特点**: 不依赖任何其他层，是整个系统的核心

#### 🔧 Tool Domain (工具领域)
- **业务价值**: 管理MCP工具生态，提供AI工具扩展能力
- **核心实体**: `MCPTool`, `ToolExecution`
- **主要服务**: `ToolDiscoveryService`, `ToolExecutionService`
- **关键事件**: `ToolDiscovered`, `ToolExecuted`

#### 🧠 Intelligence Domain (智能领域)  
- **业务价值**: PromptX驱动的智能角色系统，DeeChat的核心竞争力
- **核心实体**: `PromptXRole`, `LayeredPrompt`
- **主要服务**: `RoleActivationService`, `SmartLayeredPromptService`
- **关键事件**: `RoleActivated`, `RoleDeactivated`

#### 💬 Conversation Domain (对话领域)
- **业务价值**: 用户与AI的对话交互，系统的主要业务流程
- **核心实体**: `ChatSession`, `Message`
- **主要服务**: `ConversationService`
- **关键事件**: `ConversationStarted`, `MessageSent`

### 2. 应用服务层 (Application Layer) - 用例编排
**职责**: 协调多个领域服务，实现完整的业务用例
**特点**: 依赖领域层，被表示层调用

- `SendMessageUseCase` - 完整的消息发送流程
- `CreateSessionUseCase` - 会话创建流程
- `ActivateRoleUseCase` - 角色激活流程
- `DiscoverToolsUseCase` - 工具发现流程

### 3. 基础设施层 (Infrastructure Layer) - 技术实现
**职责**: 实现仓储接口、外部服务集成、数据持久化
**特点**: 依赖领域层的接口，提供具体技术实现

### 4. 表示层 (Presentation Layer) - 用户界面
**职责**: 用户交互、API接口、Electron主进程
**特点**: 依赖应用服务层，不直接调用领域层

## 🎨 设计原则

### 1. 业务驱动 vs 技术驱动
```
❌ 传统分层 (技术驱动)          ✅ DDD分层 (业务驱动)
├── controllers/              ├── domains/
├── services/                 │   ├── conversation/
├── repositories/             │   ├── intelligence/
├── models/                   │   └── tool/
└── utils/                    └── application/
```

### 2. 充血模型 vs 贫血模型
```typescript
// ❌ 贫血模型 - 只有数据
interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

// ✅ 充血模型 - 包含业务逻辑
class ChatSession {
  addMessage(message: Message): void;
  archive(): void;
  getStatistics(): SessionStats;
  needsAutoSave(): boolean;
}
```

### 3. 强类型化 vs 原始类型
```typescript
// ❌ 原始类型 - 容易出错
function sendMessage(sessionId: string, content: string);

// ✅ 值对象 - 类型安全
function sendMessage(sessionId: SessionId, content: MessageContent);
```

## 🔄 数据流向

```
用户界面 → 应用用例 → 领域服务 → 实体/值对象 → 仓储接口 → 基础设施
   ↓         ↓         ↓         ↓           ↓          ↓
 React   UseCases   Domain    Entities   Repository  Database
```

## 📋 使用指南

### 添加新功能
1. **识别业务领域** - 确定功能属于哪个领域
2. **创建领域对象** - 实体、值对象、领域服务
3. **定义仓储接口** - 持久化需求
4. **实现应用用例** - 协调多个领域
5. **创建表示层** - 用户界面

### 领域间通信
- **事件驱动** - 使用领域事件实现解耦通信
- **应用服务协调** - 在应用层协调多个领域
- **避免直接依赖** - 领域间不直接调用

### 最佳实践
- ✅ 实体包含业务方法
- ✅ 值对象确保不变性
- ✅ 领域服务处理跨实体逻辑
- ✅ 应用服务编排用例
- ✅ 通过事件实现解耦

## 🚀 迁移路径

当前代码迁移到DDD架构的建议步骤：

1. **识别现有业务概念** → 创建实体和值对象
2. **提取业务逻辑** → 从服务层移动到领域层
3. **定义仓储接口** → 抽象数据访问
4. **重构用例** → 应用服务协调领域服务
5. **更新表示层** → 调用应用服务而非直接领域服务

## 📈 收益

- **业务清晰** - 代码结构直接反映业务模型
- **维护性强** - 业务逻辑集中，易于理解和修改
- **可测试性** - 领域逻辑独立，便于单元测试
- **扩展性好** - 新功能按领域添加，影响范围可控
- **团队协作** - 不同领域可以并行开发

---

**🎯 DeeChat的DDD架构让复杂的AI应用变得结构清晰、易于维护，真正实现了业务驱动的软件设计。**