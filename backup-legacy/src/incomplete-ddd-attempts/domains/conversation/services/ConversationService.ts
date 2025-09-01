/**
 * 对话管理领域服务
 * 🏗️ DDD重构: 负责对话会话的核心业务逻辑
 */

import { ChatSession } from '../entities/ChatSession';
import { Message } from '../entities/Message';
import { SessionId } from '../value-objects/SessionId';
import { MessageId } from '../value-objects/MessageId';
import { MessageContent } from '../value-objects/MessageContent';
import { ISessionRepository } from '../repositories/ISessionRepository';
import { IMessageRepository } from '../repositories/IMessageRepository';
import { ConversationStarted } from '../events/ConversationStarted';
import { MessageSent } from '../events/MessageSent';
import { MessageReceived } from '../events/MessageReceived';
import { SessionArchived } from '../events/SessionArchived';

export interface ConversationContext {
  userId?: string;
  modelConfig: string;
  activeRole?: string;
  enableAutoSave: boolean;
}

export interface SendMessageOptions {
  parentMessageId?: MessageId;
  attachments?: any[];
  metadata?: Record<string, any>;
}

export interface ConversationStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  totalMessages: number;
  averageSessionLength: number;
  mostActiveSession: {
    id: string;
    title: string;
    messageCount: number;
  } | null;
}

export class ConversationService {
  private _activeSessions = new Map<string, ChatSession>();

  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly messageRepository: IMessageRepository,
    private readonly eventPublisher: (event: any) => void
  ) {}

  /**
   * 创建新的对话会话
   */
  async createSession(
    title: string,
    context: ConversationContext
  ): Promise<ChatSession> {
    // 创建会话实体
    const session = ChatSession.create(
      title,
      context.modelConfig,
      context.activeRole,
      {
        autoSave: context.enableAutoSave
      }
    );

    // 激活会话
    session.activate();

    // 保存到仓储
    await this.sessionRepository.save(session);

    // 添加到活跃会话缓存
    this._activeSessions.set(session.id.value, session);

    // 发布会话创建事件
    this.eventPublisher(new ConversationStarted(
      session.id,
      session.metadata.title,
      context.modelConfig,
      context.activeRole
    ));

    return session;
  }

  /**
   * 发送用户消息
   */
  async sendUserMessage(
    sessionId: SessionId,
    content: MessageContent,
    options?: SendMessageOptions
  ): Promise<Message> {
    const session = await this.getOrLoadSession(sessionId);
    
    if (!session) {
      throw new Error(`会话不存在: ${sessionId.value}`);
    }

    // 创建用户消息
    const message = Message.createUserMessage(
      sessionId,
      content,
      options?.parentMessageId
    );

    // 添加附件和元数据
    if (options?.attachments) {
      let updatedContent = content;
      options.attachments.forEach(attachment => {
        updatedContent = updatedContent.withAttachment(attachment);
      });
      message.edit(updatedContent);
    }

    if (options?.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        message.edit(message.content.withMetadata(key, value));
      });
    }

    // 添加到会话
    session.addMessage(message);

    // 保存消息
    await this.messageRepository.save(message);

    // 如果启用自动保存，保存会话
    if (session.needsAutoSave()) {
      await this.sessionRepository.save(session);
    }

    // 发布消息发送事件
    this.eventPublisher(new MessageSent(
      message.id,
      sessionId,
      message.role,
      content.getSummary()
    ));

    return message;
  }

  /**
   * 接收AI助手消息
   */
  async receiveAssistantMessage(
    sessionId: SessionId,
    content: MessageContent,
    parentMessageId?: MessageId,
    toolExecutions?: any[]
  ): Promise<Message> {
    const session = await this.getOrLoadSession(sessionId);
    
    if (!session) {
      throw new Error(`会话不存在: ${sessionId.value}`);
    }

    // 创建助手消息
    const message = Message.createAssistantMessage(
      sessionId,
      content,
      parentMessageId
    );

    // 添加工具执行记录
    if (toolExecutions && toolExecutions.length > 0) {
      toolExecutions.forEach(execution => {
        message.addToolExecution(execution);
      });
    }

    // 添加到会话
    session.addMessage(message);

    // 保存消息
    await this.messageRepository.save(message);

    // 如果启用自动保存，保存会话
    if (session.needsAutoSave()) {
      await this.sessionRepository.save(session);
    }

    // 发布消息接收事件
    this.eventPublisher(new MessageReceived(
      message.id,
      sessionId,
      message.role,
      content.getSummary(),
      toolExecutions?.length || 0
    ));

    return message;
  }

  /**
   * 获取会话
   */
  async getSession(sessionId: SessionId): Promise<ChatSession | null> {
    // 先从缓存获取
    const cachedSession = this._activeSessions.get(sessionId.value);
    if (cachedSession) {
      return cachedSession;
    }

    // 从仓储加载
    return await this.sessionRepository.findById(sessionId);
  }

  /**
   * 激活会话
   */
  async activateSession(sessionId: SessionId): Promise<ChatSession> {
    let session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`会话不存在: ${sessionId.value}`);
    }

    // 停用其他活跃会话
    for (const activeSession of this._activeSessions.values()) {
      if (!activeSession.id.equals(sessionId)) {
        activeSession.deactivate();
        await this.sessionRepository.save(activeSession);
      }
    }

    // 激活目标会话
    session.activate();
    await this.sessionRepository.save(session);

    // 更新缓存
    this._activeSessions.clear();
    this._activeSessions.set(sessionId.value, session);

    return session;
  }

  /**
   * 归档会话
   */
  async archiveSession(sessionId: SessionId): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`会话不存在: ${sessionId.value}`);
    }

    session.archive();
    await this.sessionRepository.save(session);

    // 从活跃会话缓存移除
    this._activeSessions.delete(sessionId.value);

    // 发布会话归档事件
    this.eventPublisher(new SessionArchived(
      sessionId,
      session.metadata.title
    ));
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: SessionId): Promise<void> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`会话不存在: ${sessionId.value}`);
    }

    // 删除所有消息
    await this.messageRepository.deleteBySessionId(sessionId);

    // 删除会话
    await this.sessionRepository.delete(sessionId);

    // 从活跃会话缓存移除
    this._activeSessions.delete(sessionId.value);
  }

  /**
   * 获取会话历史消息
   */
  async getSessionMessages(
    sessionId: SessionId,
    limit?: number,
    offset: number = 0
  ): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`会话不存在: ${sessionId.value}`);
    }

    // 如果会话已加载消息，直接返回
    if (session.messageCount > 0) {
      return session.getMessageHistory(limit, offset);
    }

    // 从仓储加载消息
    return await this.messageRepository.findBySessionId(sessionId, limit, offset);
  }

  /**
   * 搜索消息
   */
  async searchMessages(
    query: string,
    sessionId?: SessionId,
    limit: number = 50
  ): Promise<Message[]> {
    return await this.messageRepository.searchByContent(query, sessionId, limit);
  }

  /**
   * 获取对话统计信息
   */
  async getConversationStats(): Promise<ConversationStats> {
    const sessions = await this.sessionRepository.findAll();
    const totalMessages = await this.messageRepository.getTotalCount();

    const activeSessions = sessions.filter(s => s.isActive).length;
    const archivedSessions = sessions.filter(s => s.settings.isArchived).length;

    // 找到最活跃的会话
    let mostActiveSession = null;
    let maxMessages = 0;

    for (const session of sessions) {
      const stats = session.getStatistics();
      if (stats.totalMessages > maxMessages) {
        maxMessages = stats.totalMessages;
        mostActiveSession = {
          id: session.id.value,
          title: session.metadata.title,
          messageCount: stats.totalMessages
        };
      }
    }

    const averageSessionLength = sessions.length > 0 
      ? Math.round(totalMessages / sessions.length)
      : 0;

    return {
      totalSessions: sessions.length,
      activeSessions,
      archivedSessions,
      totalMessages,
      averageSessionLength,
      mostActiveSession
    };
  }

  /**
   * 清理旧会话
   */
  async cleanupOldSessions(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const oldSessions = await this.sessionRepository.findOlderThan(cutoffDate);
    let deletedCount = 0;

    for (const session of oldSessions) {
      if (!session.settings.isPinned && session.settings.isArchived) {
        await this.deleteSession(session.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 获取或加载会话（私有方法）
   */
  private async getOrLoadSession(sessionId: SessionId): Promise<ChatSession | null> {
    // 先从活跃缓存获取
    let session = this._activeSessions.get(sessionId.value);
    
    if (!session) {
      // 从仓储加载
      session = await this.sessionRepository.findById(sessionId);
      
      if (session) {
        // 添加到缓存
        this._activeSessions.set(sessionId.value, session);
      }
    }

    return session;
  }
}