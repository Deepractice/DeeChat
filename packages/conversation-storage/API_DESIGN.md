# conversation-storage API 设计

## 核心原则
- **纯存储层**：只负责数据的CRUD操作，不包含业务逻辑
- **简洁API**：参考ai-config包的设计模式
- **类型安全**：完整的TypeScript类型定义
- **错误处理**：统一的错误处理机制

## 类型定义

### 存储实体类型
```typescript
// 会话存储数据
interface ConversationSession {
  id: string
  title: string
  ai_config_name: string
  created_at: string        // ISO格式时间戳
  updated_at: string        // ISO格式时间戳
  message_count: number
}

// 消息存储数据
interface ConversationMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string         // ISO格式时间戳
  token_usage?: TokenUsage  // 可选的token使用统计
}

// Token使用统计
interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}
```

### 输入数据类型
```typescript
// 创建会话输入
interface CreateSessionData {
  title: string
  ai_config_name: string
}

// 更新会话输入
interface UpdateSessionData {
  title?: string
  ai_config_name?: string
}

// 创建消息输入
interface CreateMessageData {
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  token_usage?: TokenUsage
}
```

## 主要API接口

### 会话管理
```typescript
class ConversationStorage {
  // 创建会话
  async createSession(data: CreateSessionData): Promise<ConversationSession>
  
  // 获取单个会话
  async getSession(sessionId: string): Promise<ConversationSession | null>
  
  // 获取所有会话（按更新时间倒序）
  async getSessions(): Promise<ConversationSession[]>
  
  // 更新会话
  async updateSession(sessionId: string, data: UpdateSessionData): Promise<void>
  
  // 删除会话（级联删除相关消息）
  async deleteSession(sessionId: string): Promise<void>
  
  // 更新会话的消息数量
  async updateMessageCount(sessionId: string): Promise<void>
}
```

### 消息管理
```typescript
class ConversationStorage {
  // 保存消息
  async saveMessage(data: CreateMessageData): Promise<ConversationMessage>
  
  // 获取会话的消息历史（按时间正序）
  async getMessageHistory(sessionId: string): Promise<ConversationMessage[]>
  
  // 删除会话的所有消息
  async deleteMessagesBySession(sessionId: string): Promise<void>
}
```

## 使用示例

### 基本使用流程
```typescript
import { ConversationStorage } from '@deepracticex/conversation-storage'

// 初始化存储
const storage = new ConversationStorage({
  dbPath: './conversations.db'  // 数据库文件路径
})

// 创建会话
const session = await storage.createSession({
  title: '与ChatGPT的对话',
  ai_config_name: 'my-openai-config'
})

// 保存用户消息
const userMessage = await storage.saveMessage({
  session_id: session.id,
  role: 'user',
  content: '你好，请介绍一下自己'
})

// 保存AI回复
const aiMessage = await storage.saveMessage({
  session_id: session.id,
  role: 'assistant',
  content: '我是ChatGPT，一个AI助手...',
  token_usage: {
    prompt_tokens: 15,
    completion_tokens: 25,
    total_tokens: 40
  }
})

// 获取消息历史
const history = await storage.getMessageHistory(session.id)
console.log('对话历史:', history)

// 获取所有会话
const allSessions = await storage.getSessions()
console.log('所有会话:', allSessions)
```

### 与ConversationDomain集成
```typescript
// ConversationDomain中的使用
export class ConversationDomain implements IDomain {
  constructor(
    private aiConfigDomain: AIConfigurationDomain,
    private conversationStorage: ConversationStorage
  ) {}
  
  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    // 1. 业务逻辑验证
    const aiConfig = await this.aiConfigDomain.getUserConfiguration(input.ai_config_name)
    if (!aiConfig) {
      throw new Error(`AI配置 '${input.ai_config_name}' 不存在`)
    }
    
    // 2. 生成标题
    const title = input.title || `对话 ${new Date().toLocaleString()}`
    
    // 3. 调用存储层
    const session = await this.conversationStorage.createSession({
      title,
      ai_config_name: input.ai_config_name
    })
    
    // 4. 可选：添加系统消息
    if (input.system_prompt) {
      await this.conversationStorage.saveMessage({
        session_id: session.id,
        role: 'system',
        content: input.system_prompt
      })
      await this.conversationStorage.updateMessageCount(session.id)
    }
    
    return session
  }
}
```

## 错误处理

### 统一错误类型
```typescript
class ConversationStorageError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'ConversationStorageError'
  }
}

// 常见错误码
const ErrorCodes = {
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INVALID_INPUT: 'INVALID_INPUT'
} as const
```

### 错误处理示例
```typescript
try {
  const session = await storage.getSession('non-existent-id')
} catch (error) {
  if (error instanceof ConversationStorageError) {
    switch (error.code) {
      case 'SESSION_NOT_FOUND':
        console.log('会话不存在')
        break
      case 'DATABASE_ERROR':
        console.log('数据库错误:', error.message)
        break
    }
  }
}
```

## 配置选项

```typescript
interface ConversationStorageConfig {
  dbPath: string              // 数据库文件路径
  maxMessageHistory?: number  // 每个会话最大消息数（可选）
  enableWAL?: boolean        // 是否启用WAL模式（可选，默认true）
}
```

这个API设计如何？符合纯存储层的职责定位吗？