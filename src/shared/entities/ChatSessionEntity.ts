// 避免循环依赖，直接定义ChatMessage接口
interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  modelId?: string
  metadata?: {
    tokens?: number
    responseTime?: number
    error?: string
  }
}

export interface ChatSessionData {
  id: string
  title: string
  selectedModelId?: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string

  // 增强字段
  modelConfigId?: string        // 关联的模型配置ID
  metadata?: {
    tags?: string[]            // 会话标签
    category?: string          // 会话分类
    priority?: number          // 优先级
    isBookmarked?: boolean     // 是否收藏
    lastModelUsed?: string     // 最后使用的模型
    tokenCount?: number        // 总token数
    estimatedCost?: number     // 估算成本
  }
  isArchived?: boolean          // 是否归档
  messageCount?: number         // 消息数量（冗余字段，提升查询性能）

  // 会话偏好设置
  preferences?: {
    modelSettings?: {
      temperature?: number
      maxTokens?: number
      topP?: number
      frequencyPenalty?: number
      presencePenalty?: number
    }
    uiSettings?: {
      theme?: string
      fontSize?: number
      showTimestamps?: boolean
      enableMarkdown?: boolean
    }
    systemPrompt?: string       // 自定义系统提示词
  }
}

export class ChatSessionEntity {
  public readonly id: string
  public title: string
  public selectedModelId?: string
  public messages: ChatMessage[]
  public readonly createdAt: Date
  public updatedAt: Date

  constructor(data: ChatSessionData) {
    this.id = data.id
    this.title = data.title
    this.selectedModelId = data.selectedModelId
    this.messages = data.messages || []
    this.createdAt = new Date(data.createdAt)
    this.updatedAt = new Date(data.updatedAt)
  }

  // 切换模型
  switchModel(modelId: string): void {
    this.selectedModelId = modelId
    this.updatedAt = new Date()
  }

  // 添加消息
  addMessage(message: ChatMessage): void {
    this.messages.push(message)
    this.updatedAt = new Date()
    
    // 如果是第一条用户消息，更新会话标题
    if (this.messages.length === 1 && message.role === 'user') {
      this.title = message.content.slice(0, 20) + (message.content.length > 20 ? '...' : '')
    }
  }

  // 获取最后一条消息
  getLastMessage(): ChatMessage | undefined {
    return this.messages[this.messages.length - 1]
  }

  // 获取消息数量
  getMessageCount(): number {
    return this.messages.length
  }

  // 清空消息
  clearMessages(): void {
    this.messages = []
    this.updatedAt = new Date()
  }

  // 转换为数据对象
  toData(): ChatSessionData {
    return {
      id: this.id,
      title: this.title,
      selectedModelId: this.selectedModelId,
      messages: this.messages,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  // 创建新的会话实体
  static create(title?: string): ChatSessionEntity {
    const now = new Date().toISOString()
    return new ChatSessionEntity({
      id: crypto.randomUUID(),
      title: title || '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now
    })
  }

  // 克隆实体
  clone(): ChatSessionEntity {
    return new ChatSessionEntity(this.toData())
  }
}
