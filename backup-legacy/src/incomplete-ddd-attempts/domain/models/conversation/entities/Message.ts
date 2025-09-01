/**
 * 消息实体
 * 代表聊天中的一条消息
 */

import { Entity } from '../../../core/Entity'
import { MessageId } from '../value-objects/MessageId'
import { MessageContent } from '../value-objects/MessageContent'
import { MessageRole } from '../value-objects/MessageRole'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export interface MessageMetadata {
  tokens?: number
  responseTime?: number
  error?: string
  modelId?: string
  toolExecutions?: any[]
  attachments?: any[]
}

export class Message extends Entity<MessageId> {
  private readonly role: MessageRole
  private readonly content: MessageContent
  private readonly timestamp: Timestamp
  private metadata?: MessageMetadata

  constructor(
    id: MessageId,
    role: MessageRole,
    content: MessageContent,
    timestamp: Timestamp,
    metadata?: MessageMetadata
  ) {
    super(id)
    this.role = role
    this.content = content
    this.timestamp = timestamp
    this.metadata = metadata
  }

  /**
   * 创建用户消息
   */
  static createUserMessage(content: string, metadata?: MessageMetadata): Message {
    return new Message(
      MessageId.generate(),
      MessageRole.user(),
      MessageContent.create(content),
      Timestamp.now(),
      metadata
    )
  }

  /**
   * 创建助手消息
   */
  static createAssistantMessage(content: string, metadata?: MessageMetadata): Message {
    return new Message(
      MessageId.generate(),
      MessageRole.assistant(),
      MessageContent.create(content),
      Timestamp.now(),
      metadata
    )
  }

  /**
   * 创建系统消息
   */
  static createSystemMessage(content: string, metadata?: MessageMetadata): Message {
    return new Message(
      MessageId.generate(),
      MessageRole.system(),
      MessageContent.create(content),
      Timestamp.now(),
      metadata
    )
  }

  /**
   * 从现有数据重建消息
   */
  static reconstruct(
    id: string,
    role: string,
    content: string,
    timestamp: number,
    metadata?: MessageMetadata
  ): Message {
    return new Message(
      MessageId.fromString(id),
      MessageRole.fromString(role),
      MessageContent.create(content),
      Timestamp.fromMilliseconds(timestamp),
      metadata
    )
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata: Partial<MessageMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata }
  }

  /**
   * 检查是否为用户消息
   */
  isUserMessage(): boolean {
    return this.role.isUser()
  }

  /**
   * 检查是否为助手消息
   */
  isAssistantMessage(): boolean {
    return this.role.isAssistant()
  }

  /**
   * 检查是否为系统消息
   */
  isSystemMessage(): boolean {
    return this.role.isSystem()
  }

  /**
   * 检查是否包含工具执行
   */
  hasToolExecutions(): boolean {
    return !!(this.metadata?.toolExecutions && this.metadata.toolExecutions.length > 0)
  }

  /**
   * 检查是否包含附件
   */
  hasAttachments(): boolean {
    return !!(this.metadata?.attachments && this.metadata.attachments.length > 0)
  }

  /**
   * 检查是否有错误
   */
  hasError(): boolean {
    return !!this.metadata?.error
  }

  /**
   * 获取内容长度
   */
  getContentLength(): number {
    return this.content.getLength()
  }

  /**
   * 检查内容是否为空
   */
  isEmpty(): boolean {
    return this.content.isEmpty()
  }

  // Getter 方法
  getRole(): MessageRole { return this.role }
  getContent(): string { return this.content.getValue() }
  getTimestamp(): Timestamp { return this.timestamp }
  getMetadata(): MessageMetadata | undefined { return this.metadata ? { ...this.metadata } : undefined }

  /**
   * 获取token数量
   */
  getTokenCount(): number {
    return this.metadata?.tokens || 0
  }

  /**
   * 获取响应时间
   */
  getResponseTime(): number {
    return this.metadata?.responseTime || 0
  }

  /**
   * 获取模型ID
   */
  getModelId(): string | undefined {
    return this.metadata?.modelId
  }

  /**
   * 获取工具执行结果
   */
  getToolExecutions(): any[] {
    return this.metadata?.toolExecutions || []
  }

  /**
   * 获取附件
   */
  getAttachments(): any[] {
    return this.metadata?.attachments || []
  }

  /**
   * 获取错误信息
   */
  getError(): string | undefined {
    return this.metadata?.error
  }
}