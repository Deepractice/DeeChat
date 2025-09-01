/**
 * 消息实体 (Domain Entity)
 * 🏗️ DDD重构: 代表对话中的一条消息
 */

import { MessageId } from '../value-objects/MessageId';
import { MessageContent } from '../value-objects/MessageContent';
import { SessionId } from '../value-objects/SessionId';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface MessageTimestamp {
  createdAt: Date;
  updatedAt?: Date;
  deliveredAt?: Date;
}

export interface MessageStatus {
  isDelivered: boolean;
  isRead: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  deliveryError?: string;
}

export class Message {
  private readonly _id: MessageId;
  private readonly _sessionId: SessionId;
  private readonly _role: MessageRole;
  private _content: MessageContent;
  private _timestamp: MessageTimestamp;
  private _status: MessageStatus;
  private _parentMessageId?: MessageId;
  private _toolExecutions: any[];
  private _editHistory: MessageContent[];

  constructor(
    id: MessageId,
    sessionId: SessionId,
    role: MessageRole,
    content: MessageContent,
    timestamp?: MessageTimestamp,
    parentMessageId?: MessageId
  ) {
    this._id = id;
    this._sessionId = sessionId;
    this._role = role;
    this._content = content;
    this._timestamp = timestamp || { createdAt: new Date() };
    this._status = {
      isDelivered: true,
      isRead: false,
      isEdited: false,
      isDeleted: false
    };
    this._parentMessageId = parentMessageId;
    this._toolExecutions = [];
    this._editHistory = [];
  }

  // Getters - 暴露只读属性
  get id(): MessageId { return this._id; }
  get sessionId(): SessionId { return this._sessionId; }
  get role(): MessageRole { return this._role; }
  get content(): MessageContent { return this._content; }
  get timestamp(): Readonly<MessageTimestamp> { return this._timestamp; }
  get status(): Readonly<MessageStatus> { return this._status; }
  get parentMessageId(): MessageId | undefined { return this._parentMessageId; }
  get toolExecutions(): readonly any[] { return this._toolExecutions; }
  get editHistory(): readonly MessageContent[] { return this._editHistory; }

  /**
   * 业务方法：编辑消息内容
   */
  edit(newContent: MessageContent): void {
    if (this._status.isDeleted) {
      throw new Error('无法编辑已删除的消息');
    }

    const validation = newContent.validate();
    if (!validation.isValid) {
      throw new Error(`消息内容无效: ${validation.errors.join(', ')}`);
    }

    // 保存编辑历史
    this._editHistory.push(this._content);
    
    // 更新内容
    this._content = newContent;
    this._timestamp.updatedAt = new Date();
    this._status.isEdited = true;
  }

  /**
   * 业务方法：标记消息为已读
   */
  markAsRead(): void {
    if (!this._status.isDeleted) {
      this._status.isRead = true;
    }
  }

  /**
   * 业务方法：标记消息为已送达
   */
  markAsDelivered(): void {
    this._status.isDelivered = true;
    this._status.deliveryError = undefined;
    this._timestamp.deliveredAt = new Date();
  }

  /**
   * 业务方法：标记送达失败
   */
  markDeliveryFailed(error: string): void {
    this._status.isDelivered = false;
    this._status.deliveryError = error;
  }

  /**
   * 业务方法：软删除消息
   */
  delete(): void {
    this._status.isDeleted = true;
    this._timestamp.updatedAt = new Date();
  }

  /**
   * 业务方法：恢复已删除的消息
   */
  restore(): void {
    this._status.isDeleted = false;
    this._timestamp.updatedAt = new Date();
  }

  /**
   * 业务方法：添加工具执行记录
   */
  addToolExecution(execution: any): void {
    if (this._role !== 'assistant' && this._role !== 'tool') {
      throw new Error('只有助手或工具消息才能添加工具执行记录');
    }
    
    this._toolExecutions.push(execution);
    this._timestamp.updatedAt = new Date();
  }

  /**
   * 业务查询：是否为用户消息
   */
  isFromUser(): boolean {
    return this._role === 'user';
  }

  /**
   * 业务查询：是否为AI助手消息
   */
  isFromAssistant(): boolean {
    return this._role === 'assistant';
  }

  /**
   * 业务查询：是否为系统消息
   */
  isSystemMessage(): boolean {
    return this._role === 'system';
  }

  /**
   * 业务查询：是否包含工具调用
   */
  hasToolExecutions(): boolean {
    return this._toolExecutions.length > 0;
  }

  /**
   * 业务查询：是否为回复消息
   */
  isReply(): boolean {
    return this._parentMessageId !== undefined;
  }

  /**
   * 业务查询：消息年龄（分钟）
   */
  getAgeInMinutes(): number {
    const now = new Date().getTime();
    const created = this._timestamp.createdAt.getTime();
    return Math.floor((now - created) / (1000 * 60));
  }

  /**
   * 业务查询：是否可以编辑
   */
  canEdit(): boolean {
    return !this._status.isDeleted && 
           this._role === 'user' && 
           this.getAgeInMinutes() < 60; // 1小时内可编辑
  }

  /**
   * 业务查询：是否可以删除
   */
  canDelete(): boolean {
    return !this._status.isDeleted;
  }

  /**
   * 获取消息摘要信息
   */
  getSummary(): string {
    const roleLabel = this._role === 'user' ? '👤' : 
                     this._role === 'assistant' ? '🤖' : 
                     this._role === 'system' ? '⚙️' : '🔧';
    
    const contentSummary = this._content.getSummary(50);
    const timestamp = this._timestamp.createdAt.toLocaleTimeString();
    
    let summary = `${roleLabel} ${contentSummary} (${timestamp})`;
    
    if (this._status.isEdited) summary += ' [已编辑]';
    if (this._status.isDeleted) summary += ' [已删除]';
    if (this.hasToolExecutions()) summary += ` [工具执行×${this._toolExecutions.length}]`;
    
    return summary;
  }

  /**
   * 工厂方法：创建用户消息
   */
  static createUserMessage(
    sessionId: SessionId,
    content: MessageContent,
    parentMessageId?: MessageId
  ): Message {
    return new Message(
      MessageId.generate(),
      sessionId,
      'user',
      content,
      { createdAt: new Date() },
      parentMessageId
    );
  }

  /**
   * 工厂方法：创建AI助手消息
   */
  static createAssistantMessage(
    sessionId: SessionId,
    content: MessageContent,
    parentMessageId?: MessageId
  ): Message {
    const message = new Message(
      MessageId.generate(),
      sessionId,
      'assistant',
      content,
      { createdAt: new Date() },
      parentMessageId
    );
    
    // AI消息默认标记为已送达和已读
    message.markAsDelivered();
    message.markAsRead();
    
    return message;
  }

  /**
   * 工厂方法：创建系统消息
   */
  static createSystemMessage(
    sessionId: SessionId,
    content: MessageContent
  ): Message {
    return new Message(
      MessageId.generate(),
      sessionId,
      'system',
      content,
      { createdAt: new Date() }
    );
  }

  /**
   * 转换为数据传输对象
   */
  toData(): any {
    return {
      id: this._id.value,
      sessionId: this._sessionId.value,
      role: this._role,
      content: {
        text: this._content.text,
        type: this._content.type,
        attachments: this._content.attachments,
        metadata: this._content.metadata
      },
      timestamp: {
        createdAt: this._timestamp.createdAt.toISOString(),
        updatedAt: this._timestamp.updatedAt?.toISOString(),
        deliveredAt: this._timestamp.deliveredAt?.toISOString()
      },
      status: this._status,
      parentMessageId: this._parentMessageId?.value,
      toolExecutions: this._toolExecutions,
      editHistory: this._editHistory.map(content => content.text)
    };
  }
}