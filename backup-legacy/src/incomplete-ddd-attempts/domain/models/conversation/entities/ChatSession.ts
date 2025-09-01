/**
 * 聊天会话聚合根
 * 管理聊天会话的业务逻辑和完整性
 */

import { AggregateRoot } from '../../../core/AggregateRoot'
import { SessionId } from '../value-objects/SessionId'
import { Message } from './Message'
import { SessionTitle } from '../value-objects/SessionTitle'
import { Timestamp } from '../../../shared/primitives/Timestamp'
import { MessageAdded } from '../events/MessageAdded'
import { SessionTitleUpdated } from '../events/SessionTitleUpdated'
import { ModelSwitched } from '../events/ModelSwitched'

export interface SessionMetadata {
  tags?: string[]
  category?: string
  priority?: number
  isBookmarked?: boolean
  lastModelUsed?: string
  tokenCount?: number
  estimatedCost?: number
}

export interface SessionPreferences {
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
  systemPrompt?: string
}

export class ChatSession extends AggregateRoot<SessionId> {
  private title: SessionTitle
  private messages: Message[] = []
  private selectedModelId?: string
  private readonly createdAt: Timestamp
  private updatedAt: Timestamp
  private isArchived: boolean = false
  private metadata?: SessionMetadata
  private preferences?: SessionPreferences

  constructor(
    id: SessionId,
    title: SessionTitle,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    selectedModelId?: string,
    messages: Message[] = [],
    isArchived: boolean = false,
    metadata?: SessionMetadata,
    preferences?: SessionPreferences
  ) {
    super(id)
    this.title = title
    this.selectedModelId = selectedModelId
    this.messages = [...messages]
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.isArchived = isArchived
    this.metadata = metadata
    this.preferences = preferences
  }

  /**
   * 创建新的聊天会话
   */
  static create(title?: string, modelId?: string): ChatSession {
    const id = SessionId.generate()
    const sessionTitle = title ? SessionTitle.create(title) : SessionTitle.createDefault()
    const now = Timestamp.now()
    
    return new ChatSession(id, sessionTitle, now, now, modelId)
  }

  /**
   * 添加消息
   */
  addMessage(message: Message): void {
    // 业务规则：不能向已归档的会话添加消息
    if (this.isArchived) {
      throw new Error('Cannot add message to archived session')
    }

    // 业务规则：消息不能重复
    if (this.messages.some(m => m.getId().equals(message.getId()))) {
      throw new Error('Message with the same ID already exists')
    }

    this.messages.push(message)
    this.updatedAt = Timestamp.now()

    // 业务规则：如果是第一条用户消息，自动更新会话标题
    if (this.messages.length === 1 && message.isUserMessage()) {
      const autoTitle = this.generateAutoTitle(message.getContent())
      if (autoTitle !== this.title.getValue()) {
        this.updateTitle(autoTitle)
      }
    }

    // 发布领域事件
    this.addDomainEvent(new MessageAdded(this.id, message.getId(), message.getRole()))
  }

  /**
   * 更新会话标题
   */
  updateTitle(newTitle: string): void {
    const oldTitle = this.title.getValue()
    this.title = SessionTitle.create(newTitle)
    this.updatedAt = Timestamp.now()
    
    // 发布领域事件
    this.addDomainEvent(new SessionTitleUpdated(this.id, oldTitle, newTitle))
  }

  /**
   * 切换模型
   */
  switchModel(modelId: string): void {
    if (this.isArchived) {
      throw new Error('Cannot switch model for archived session')
    }

    const oldModelId = this.selectedModelId
    this.selectedModelId = modelId
    this.updatedAt = Timestamp.now()
    
    // 更新元数据
    if (this.metadata) {
      this.metadata.lastModelUsed = modelId
    }

    // 发布领域事件
    this.addDomainEvent(new ModelSwitched(this.id, oldModelId, modelId))
  }

  /**
   * 归档会话
   */
  archive(): void {
    if (this.isArchived) {
      return // 已经是归档状态
    }
    
    this.isArchived = true
    this.updatedAt = Timestamp.now()
  }

  /**
   * 取消归档
   */
  unarchive(): void {
    if (!this.isArchived) {
      return // 已经是非归档状态
    }
    
    this.isArchived = false
    this.updatedAt = Timestamp.now()
  }

  /**
   * 清空消息
   */
  clearMessages(): void {
    if (this.isArchived) {
      throw new Error('Cannot clear messages from archived session')
    }

    this.messages = []
    this.updatedAt = Timestamp.now()
    
    // 更新元数据
    if (this.metadata) {
      this.metadata.tokenCount = 0
      this.metadata.estimatedCost = 0
    }
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata: Partial<SessionMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata }
    this.updatedAt = Timestamp.now()
  }

  /**
   * 更新偏好设置
   */
  updatePreferences(preferences: Partial<SessionPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences }
    this.updatedAt = Timestamp.now()
  }

  /**
   * 生成自动标题
   */
  private generateAutoTitle(content: string): string {
    const maxLength = 20
    if (content.length <= maxLength) {
      return content
    }
    return content.slice(0, maxLength) + '...'
  }

  // Getter 方法
  getTitle(): SessionTitle { return this.title }
  getMessages(): Message[] { return [...this.messages] }
  getSelectedModelId(): string | undefined { return this.selectedModelId }
  getCreatedAt(): Timestamp { return this.createdAt }
  getUpdatedAt(): Timestamp { return this.updatedAt }
  getIsArchived(): boolean { return this.isArchived }
  getMetadata(): SessionMetadata | undefined { return this.metadata ? { ...this.metadata } : undefined }
  getPreferences(): SessionPreferences | undefined { return this.preferences ? { ...this.preferences } : undefined }

  /**
   * 获取最后一条消息
   */
  getLastMessage(): Message | undefined {
    return this.messages.length > 0 ? this.messages[this.messages.length - 1] : undefined
  }

  /**
   * 获取消息数量
   */
  getMessageCount(): number {
    return this.messages.length
  }

  /**
   * 检查是否有消息
   */
  hasMessages(): boolean {
    return this.messages.length > 0
  }

  /**
   * 获取用户消息数量
   */
  getUserMessageCount(): number {
    return this.messages.filter(m => m.isUserMessage()).length
  }

  /**
   * 获取AI消息数量
   */
  getAssistantMessageCount(): number {
    return this.messages.filter(m => m.isAssistantMessage()).length
  }
}