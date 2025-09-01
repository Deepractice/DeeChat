/**
 * 聊天会话实体 (Domain Entity)
 * 🏗️ DDD重构: 代表一个完整的对话会话
 */

import { SessionId } from '../value-objects/SessionId';
import { Message } from './Message';
import { MessageId } from '../value-objects/MessageId';
import { MessageContent } from '../value-objects/MessageContent';

export interface SessionMetadata {
  title: string;
  description?: string;
  tags: string[];
  category?: string;
  modelConfig?: string;
  activeRole?: string;
  lastModelUsed?: string;
}

export interface SessionStatistics {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  totalTokens: number;
  averageResponseTime: number;
  toolExecutions: number;
}

export interface SessionSettings {
  isPrivate: boolean;
  isArchived: boolean;
  isPinned: boolean;
  maxMessages?: number;
  autoSave: boolean;
  notificationsEnabled: boolean;
}

export class ChatSession {
  private readonly _id: SessionId;
  private _metadata: SessionMetadata;
  private _settings: SessionSettings;
  private _messages: Map<string, Message>;
  private _messageOrder: MessageId[];
  private _createdAt: Date;
  private _updatedAt: Date;
  private _lastActiveAt: Date;
  private _isActive: boolean;

  constructor(
    id: SessionId,
    metadata: SessionMetadata,
    settings?: Partial<SessionSettings>
  ) {
    this._id = id;
    this._metadata = metadata;
    this._settings = {
      isPrivate: false,
      isArchived: false,
      isPinned: false,
      autoSave: true,
      notificationsEnabled: true,
      ...settings
    };
    this._messages = new Map();
    this._messageOrder = [];
    const now = new Date();
    this._createdAt = now;
    this._updatedAt = now;
    this._lastActiveAt = now;
    this._isActive = false;
  }

  // Getters - 暴露只读属性
  get id(): SessionId { return this._id; }
  get metadata(): Readonly<SessionMetadata> { return this._metadata; }
  get settings(): Readonly<SessionSettings> { return this._settings; }
  get messages(): readonly Message[] { 
    return this._messageOrder.map(id => this._messages.get(id.value)!).filter(Boolean);
  }
  get messageCount(): number { return this._messageOrder.length; }
  get createdAt(): Date { return this._createdAt; }
  get updatedAt(): Date { return this._updatedAt; }
  get lastActiveAt(): Date { return this._lastActiveAt; }
  get isActive(): boolean { return this._isActive; }

  /**
   * 业务方法：添加消息
   */
  addMessage(message: Message): void {
    if (!message.sessionId.equals(this._id)) {
      throw new Error('消息的会话ID与当前会话不匹配');
    }

    const validation = message.content.validate();
    if (!validation.isValid) {
      throw new Error(`消息内容无效: ${validation.errors.join(', ')}`);
    }

    // 检查消息限制
    if (this._settings.maxMessages && this._messageOrder.length >= this._settings.maxMessages) {
      throw new Error(`会话消息数量超过限制: ${this._settings.maxMessages}`);
    }

    this._messages.set(message.id.value, message);
    this._messageOrder.push(message.id);
    this.updateTimestamp();
  }

  /**
   * 业务方法：删除消息
   */
  removeMessage(messageId: MessageId): void {
    const message = this._messages.get(messageId.value);
    if (!message) {
      throw new Error(`消息不存在: ${messageId.value}`);
    }

    // 软删除消息
    message.delete();
    this.updateTimestamp();
  }

  /**
   * 业务方法：编辑消息
   */
  editMessage(messageId: MessageId, newContent: MessageContent): void {
    const message = this._messages.get(messageId.value);
    if (!message) {
      throw new Error(`消息不存在: ${messageId.value}`);
    }

    if (!message.canEdit()) {
      throw new Error('该消息不能编辑');
    }

    message.edit(newContent);
    this.updateTimestamp();
  }

  /**
   * 业务方法：获取消息
   */
  getMessage(messageId: MessageId): Message | undefined {
    return this._messages.get(messageId.value);
  }

  /**
   * 业务方法：获取最后一条消息
   */
  getLastMessage(): Message | undefined {
    if (this._messageOrder.length === 0) return undefined;
    const lastId = this._messageOrder[this._messageOrder.length - 1];
    return this._messages.get(lastId.value);
  }

  /**
   * 业务方法：获取用户的最后一条消息
   */
  getLastUserMessage(): Message | undefined {
    for (let i = this._messageOrder.length - 1; i >= 0; i--) {
      const message = this._messages.get(this._messageOrder[i].value);
      if (message && message.isFromUser() && !message.status.isDeleted) {
        return message;
      }
    }
    return undefined;
  }

  /**
   * 业务方法：获取消息历史（分页）
   */
  getMessageHistory(limit?: number, offset: number = 0): Message[] {
    const allMessages = this.messages.filter(msg => !msg.status.isDeleted);
    
    if (!limit) return allMessages.slice(offset);
    return allMessages.slice(offset, offset + limit);
  }

  /**
   * 业务方法：激活会话
   */
  activate(): void {
    this._isActive = true;
    this._lastActiveAt = new Date();
  }

  /**
   * 业务方法：停用会话
   */
  deactivate(): void {
    this._isActive = false;
    this.updateTimestamp();
  }

  /**
   * 业务方法：更新元数据
   */
  updateMetadata(updates: Partial<SessionMetadata>): void {
    this._metadata = { ...this._metadata, ...updates };
    this.updateTimestamp();
  }

  /**
   * 业务方法：更新设置
   */
  updateSettings(updates: Partial<SessionSettings>): void {
    this._settings = { ...this._settings, ...updates };
    this.updateTimestamp();
  }

  /**
   * 业务方法：归档会话
   */
  archive(): void {
    this._settings.isArchived = true;
    this.deactivate();
  }

  /**
   * 业务方法：取消归档
   */
  unarchive(): void {
    this._settings.isArchived = false;
    this.updateTimestamp();
  }

  /**
   * 业务方法：置顶会话
   */
  pin(): void {
    this._settings.isPinned = true;
    this.updateTimestamp();
  }

  /**
   * 业务方法：取消置顶
   */
  unpin(): void {
    this._settings.isPinned = false;
    this.updateTimestamp();
  }

  /**
   * 业务查询：获取会话统计信息
   */
  getStatistics(): SessionStatistics {
    const activeMessages = this.messages.filter(msg => !msg.status.isDeleted);
    
    const stats = activeMessages.reduce(
      (acc, message) => {
        acc.totalMessages++;
        
        if (message.isFromUser()) acc.userMessages++;
        else if (message.isFromAssistant()) acc.assistantMessages++;
        else if (message.isSystemMessage()) acc.systemMessages++;
        
        acc.totalTokens += message.content.length; // 简化的token计算
        acc.toolExecutions += message.toolExecutions.length;
        
        return acc;
      },
      {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        systemMessages: 0,
        totalTokens: 0,
        averageResponseTime: 0, // 需要更复杂的计算
        toolExecutions: 0
      }
    );

    return stats;
  }

  /**
   * 业务查询：检查会话是否为空
   */
  isEmpty(): boolean {
    return this._messageOrder.length === 0;
  }

  /**
   * 业务查询：获取会话年龄（天数）
   */
  getAgeInDays(): number {
    const now = new Date().getTime();
    const created = this._createdAt.getTime();
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  /**
   * 业务查询：获取最后活动时间（分钟前）
   */
  getLastActivityMinutesAgo(): number {
    const now = new Date().getTime();
    const lastActive = this._lastActiveAt.getTime();
    return Math.floor((now - lastActive) / (1000 * 60));
  }

  /**
   * 业务查询：是否需要自动保存
   */
  needsAutoSave(): boolean {
    return this._settings.autoSave && 
           this.getLastActivityMinutesAgo() <= 5 && // 5分钟内有活动
           !this.isEmpty();
  }

  /**
   * 获取会话摘要
   */
  getSummary(): string {
    const stats = this.getStatistics();
    const age = this.getAgeInDays();
    const lastActivity = this.getLastActivityMinutesAgo();
    
    let summary = `📝 ${this._metadata.title}`;
    summary += `\n💬 ${stats.totalMessages}条消息 (👤${stats.userMessages} 🤖${stats.assistantMessages})`;
    summary += `\n📅 ${age}天前创建`;
    summary += `\n🕐 ${lastActivity}分钟前活动`;
    
    if (this._settings.isPinned) summary += ' 📌';
    if (this._settings.isArchived) summary += ' 📦';
    if (this._settings.isPrivate) summary += ' 🔒';
    
    return summary;
  }

  /**
   * 更新时间戳
   */
  private updateTimestamp(): void {
    const now = new Date();
    this._updatedAt = now;
    this._lastActiveAt = now;
  }

  /**
   * 工厂方法：创建新会话
   */
  static create(
    title: string,
    modelConfig?: string,
    activeRole?: string,
    settings?: Partial<SessionSettings>
  ): ChatSession {
    const metadata: SessionMetadata = {
      title,
      tags: [],
      modelConfig,
      activeRole
    };
    
    return new ChatSession(SessionId.generate(), metadata, settings);
  }

  /**
   * 转换为数据传输对象
   */
  toData(): any {
    const stats = this.getStatistics();
    
    return {
      id: this._id.value,
      metadata: this._metadata,
      settings: this._settings,
      messages: this.messages.map(msg => msg.toData()),
      statistics: stats,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      lastActiveAt: this._lastActiveAt.toISOString(),
      isActive: this._isActive
    };
  }
}