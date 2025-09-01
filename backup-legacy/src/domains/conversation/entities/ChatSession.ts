import { AggregateRoot } from '../../../domain/core/AggregateRoot'
import { SessionId } from '../value-objects/SessionId'
import { Message } from './Message'
import { MessageContent } from '../value-objects/MessageContent'
import { MessageRole } from '../value-objects/MessageRole'
import { MessageId } from '../value-objects/MessageId'
import { UniqueEntityID } from '../../../domain/shared/primitives/UniqueEntityID'

// 领域事件
import { DomainEvent } from '../../../domain/core/DomainEvent'

export class MessageAdded extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly messageId: string,
    public readonly content: string,
    public readonly role: 'user' | 'assistant' | 'system'
  ) {
    super()
  }

  getEventName(): string {
    return 'MessageAdded'
  }

  getEventData(): Record<string, any> {
    return {
      sessionId: this.sessionId,
      messageId: this.messageId,
      content: this.content,
      role: this.role
    }
  }
}

export class SessionCreated extends DomainEvent {
  constructor(
    public readonly sessionId: string,
    public readonly title: string
  ) {
    super()
  }

  getEventName(): string {
    return 'SessionCreated'
  }

  getEventData(): Record<string, any> {
    return {
      sessionId: this.sessionId,
      title: this.title
    }
  }
}

interface ChatSessionProps {
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
  modelId?: string
  metadata?: {
    tags?: string[]
    category?: string
    archived?: boolean
  }
}

/**
 * 聊天会话聚合根 - 对话领域的核心聚合
 * 管理整个会话的生命周期和业务规则
 */
export class ChatSession extends AggregateRoot<SessionId> {
  private readonly props: ChatSessionProps

  private constructor(id: SessionId, props: ChatSessionProps) {
    super(id)
    this.props = { ...props }
  }

  /**
   * 创建新的聊天会话
   */
  static create(title?: string): ChatSession {
    const sessionId = SessionId.create()
    const defaultTitle = title || `新会话 - ${new Date().toLocaleString()}`
    
    const session = new ChatSession(sessionId, {
      title: defaultTitle,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    })

    // 发布领域事件
    session.addDomainEvent(new SessionCreated(
      sessionId.getValue(),
      defaultTitle
    ))

    return session
  }

  /**
   * 从现有数据重构会话（用于数据库读取）
   */
  static reconstitute(
    id: string,
    title: string,
    messages: any[],
    createdAt: Date,
    updatedAt: Date,
    modelId?: string,
    metadata?: any
  ): ChatSession {
    const sessionId = SessionId.of(id)
    const domainMessages = messages.map(msg => Message.create({
      sessionId: SessionId.of(msg.sessionId || id),
      role: msg.role,
      content: MessageContent.of(msg.content),
      createdAt: new Date(msg.createdAt)
    }, new UniqueEntityID(msg.id)))
    
    return new ChatSession(sessionId, {
      title,
      messages: domainMessages,
      createdAt,
      updatedAt,
      modelId,
      metadata
    })
  }

  // 🔥 核心业务方法

  /**
   * 添加用户消息
   */
  addUserMessage(content: string): void {
    const message = Message.create({
      sessionId: this.id,
      role: 'user',
      content: MessageContent.of(content),
      createdAt: new Date()
    })
    this.addMessage(message)
  }

  /**
   * 添加AI回复
   */
  addAssistantMessage(content: string, modelId?: string): void {
    const message = Message.create({
      sessionId: this.id,
      role: 'assistant',
      content: MessageContent.of(content),
      createdAt: new Date(),
      metadata: modelId ? { modelId } : undefined
    })
    this.addMessage(message)
  }

  /**
   * 添加系统消息
   */
  addSystemMessage(content: string): void {
    const message = Message.create({
      sessionId: this.id,
      role: 'system',
      content: MessageContent.of(content),
      createdAt: new Date()
    })
    this.addMessage(message)
  }

  /**
   * 通用添加消息方法
   */
  private addMessage(message: Message): void {
    // 业务规则：限制消息数量
    if (this.props.messages.length >= 1000) {
      throw new Error('Session has reached maximum message limit (1000)')
    }

    this.props.messages.push(message)
    this.props.updatedAt = new Date()

    // 发布领域事件
    this.addDomainEvent(new MessageAdded(
      this.id.getValue(),
      message.id.toString(),
      message.content.getValue(),
      message.role
    ))
  }

  /**
   * 更新会话标题
   */
  updateTitle(newTitle: string): void {
    if (!newTitle || newTitle.trim().length === 0) {
      throw new Error('Session title cannot be empty')
    }

    if (newTitle.length > 200) {
      throw new Error('Session title is too long (max 200 characters)')
    }

    this.props.title = newTitle.trim()
    this.props.updatedAt = new Date()
  }

  /**
   * 设置模型ID
   */
  setModelId(modelId: string): void {
    this.props.modelId = modelId
    this.props.updatedAt = new Date()
  }

  /**
   * 归档会话
   */
  archive(): void {
    if (!this.props.metadata) {
      this.props.metadata = {}
    }
    this.props.metadata.archived = true
    this.props.updatedAt = new Date()
  }

  /**
   * 取消归档
   */
  unarchive(): void {
    if (this.props.metadata) {
      this.props.metadata.archived = false
    }
    this.props.updatedAt = new Date()
  }

  // Getters
  get title(): string {
    return this.props.title
  }

  get messages(): Message[] {
    return [...this.props.messages] // 返回副本，保护内部状态
  }

  get messageCount(): number {
    return this.props.messages.length
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  get modelId(): string | undefined {
    return this.props.modelId
  }

  get metadata(): ChatSessionProps['metadata'] {
    return this.props.metadata
  }

  // 业务查询方法
  isEmpty(): boolean {
    return this.props.messages.length === 0
  }

  isArchived(): boolean {
    return this.props.metadata?.archived === true
  }

  hasUserMessages(): boolean {
    return this.props.messages.some(msg => msg.isFromUser())
  }

  hasAssistantMessages(): boolean {
    return this.props.messages.some(msg => msg.isFromAssistant())
  }

  getLastMessage(): Message | null {
    return this.props.messages.length > 0 
      ? this.props.messages[this.props.messages.length - 1] 
      : null
  }

  getFirstMessage(): Message | null {
    return this.props.messages.length > 0 
      ? this.props.messages[0] 
      : null
  }

  canBeDeleted(): boolean {
    // 可以删除的条件：空会话或者已归档超过30天
    if (this.isEmpty()) return true
    
    if (this.isArchived()) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return this.props.updatedAt < thirtyDaysAgo
    }
    
    return false
  }

  /**
   * 获取会话统计信息
   */
  getStats() {
    const userMessages = this.props.messages.filter(msg => msg.isFromUser())
    const assistantMessages = this.props.messages.filter(msg => msg.isFromAssistant())
    const totalWordCount = this.props.messages.reduce((sum, msg) => sum + msg.getWordCount(), 0)

    return {
      totalMessages: this.props.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      totalWordCount,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      isArchived: this.isArchived()
    }
  }

  /**
   * 转换为传统的数据格式（用于与现有代码兼容）
   */
  toPlainObject() {
    return {
      id: this.id.getValue(),
      title: this.props.title,
      selectedModelId: this.props.modelId, // 保持向后兼容
      messages: this.props.messages.map(msg => ({
        id: msg.id.toString(),
        sessionId: msg.sessionId.getValue(),
        role: msg.role,
        content: msg.content.getValue(),
        createdAt: msg.createdAt.getTime(),
        metadata: msg.metadata
      })),
      createdAt: this.props.createdAt.getTime(),
      updatedAt: this.props.updatedAt.getTime(),
      metadata: this.props.metadata
    }
  }
}