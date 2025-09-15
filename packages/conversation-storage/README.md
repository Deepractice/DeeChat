# @deepracticex/conversation-storage

DeeChat 对话存储管理包 - 纯存储层实现

## 设计原则

### 职责边界
- ✅ **数据存储和检索** - 会话和消息的CRUD操作
- ✅ **数据库管理** - SQLite数据库初始化和迁移
- ✅ **类型定义** - 存储相关的TypeScript类型
- ❌ **业务逻辑** - 由 ConversationDomain 负责
- ❌ **AI集成** - 由 ConversationDomain 负责
- ❌ **流式处理** - 由 ConversationDomain 负责

### 架构分层
```
ConversationDomain (业务层)
       ↓ 依赖注入
conversation-storage (存储层)
       ↓ 持久化
SQLite 数据库
```

## 核心实体

### ConversationSession (会话)
```typescript
interface ConversationSession {
  id: string                 // 会话ID
  title: string             // 会话标题
  ai_config_name: string    // 关联的AI配置名称
  created_at: string        // 创建时间
  updated_at: string        // 更新时间
  message_count: number     // 消息数量
}
```

### ConversationMessage (消息)
```typescript
interface ConversationMessage {
  id: string                 // 消息ID
  session_id: string        // 所属会话ID
  role: 'user' | 'assistant' | 'system'  // 角色
  content: string           // 消息内容
  timestamp: string         // 时间戳
  token_usage?: TokenUsage  // Token使用情况(可选)
}
```

## API 设计

### 会话管理
- `createSession(data: CreateSessionData): Promise<ConversationSession>`
- `getSession(sessionId: string): Promise<ConversationSession | null>`
- `getSessions(): Promise<ConversationSession[]>`
- `updateSession(sessionId: string, updates: Partial<SessionData>): Promise<void>`
- `deleteSession(sessionId: string): Promise<void>`

### 消息管理
- `saveMessage(data: CreateMessageData): Promise<ConversationMessage>`
- `getMessageHistory(sessionId: string): Promise<ConversationMessage[]>`
- `deleteMessagesBySession(sessionId: string): Promise<void>`
- `updateMessageCount(sessionId: string): Promise<void>`

## 数据库设计

### sessions 表
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  ai_config_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  message_count INTEGER DEFAULT 0
);
```

### messages 表
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  token_usage TEXT, -- JSON格式存储
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

### 索引设计
```sql
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);
CREATE INDEX idx_sessions_updated_at ON sessions(updated_at);
```

## 集成方式

### ConversationDomain 中的使用
```typescript
export class ConversationDomain implements IDomain {
  private conversationStorage: ConversationStorage
  
  constructor(
    private aiConfigDomain: AIConfigurationDomain,
    conversationStorage: ConversationStorage
  ) {
    this.conversationStorage = conversationStorage
  }
  
  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    // 业务逻辑验证
    const aiConfig = await this.aiConfigDomain.getUserConfiguration(input.ai_config_name)
    if (!aiConfig) {
      throw new Error(`AI配置 '${input.ai_config_name}' 不存在`)
    }
    
    // 调用存储层
    return await this.conversationStorage.createSession({
      title: input.title || `对话 ${new Date().toLocaleString()}`,
      ai_config_name: input.ai_config_name
    })
  }
}
```

## 参考设计

参照 `@deepracticex/ai-config` 包的设计模式：
- 简洁的API设计
- 统一的错误处理
- 遵循"如非必要，勿增实体"原则
- 纯粹的存储职责

## 开发计划

1. **Phase 1**: 基础包结构和类型定义
2. **Phase 2**: SQLite存储实现
3. **Phase 3**: 集成到ConversationDomain
4. **Phase 4**: 测试和优化