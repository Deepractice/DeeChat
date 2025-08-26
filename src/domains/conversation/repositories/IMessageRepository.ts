/**
 * 消息仓储接口
 * 🏗️ DDD重构: 定义消息持久化的契约
 */

import { Message } from '../entities/Message';
import { MessageId } from '../value-objects/MessageId';
import { SessionId } from '../value-objects/SessionId';

export interface IMessageRepository {
  /**
   * 根据ID查找消息
   */
  findById(id: MessageId): Promise<Message | null>;

  /**
   * 根据会话ID查找消息
   */
  findBySessionId(sessionId: SessionId, limit?: number, offset?: number): Promise<Message[]>;

  /**
   * 搜索消息内容
   */
  searchByContent(query: string, sessionId?: SessionId, limit?: number): Promise<Message[]>;

  /**
   * 根据角色查找消息
   */
  findByRole(role: string, sessionId?: SessionId, limit?: number): Promise<Message[]>;

  /**
   * 查找包含工具执行的消息
   */
  findWithToolExecutions(sessionId?: SessionId, limit?: number): Promise<Message[]>;

  /**
   * 查找指定日期范围的消息
   */
  findByDateRange(startDate: Date, endDate: Date, sessionId?: SessionId): Promise<Message[]>;

  /**
   * 获取最近的消息
   */
  findRecent(limit: number, sessionId?: SessionId): Promise<Message[]>;

  /**
   * 查找未读消息
   */
  findUnread(sessionId?: SessionId): Promise<Message[]>;

  /**
   * 查找已编辑的消息
   */
  findEdited(sessionId?: SessionId): Promise<Message[]>;

  /**
   * 保存消息
   */
  save(message: Message): Promise<void>;

  /**
   * 批量保存消息
   */
  saveBatch(messages: Message[]): Promise<void>;

  /**
   * 删除消息
   */
  delete(id: MessageId): Promise<void>;

  /**
   * 根据会话ID删除所有消息
   */
  deleteBySessionId(sessionId: SessionId): Promise<void>;

  /**
   * 获取消息总数
   */
  getTotalCount(sessionId?: SessionId): Promise<number>;

  /**
   * 获取消息统计信息
   */
  getStats(sessionId?: SessionId): Promise<MessageStats>;

  /**
   * 清理过期的已删除消息
   */
  cleanupDeletedMessages(olderThanDays: number): Promise<number>;
}

export interface MessageStats {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  systemMessages: number;
  toolMessages: number;
  messagesWithAttachments: number;
  messagesWithToolExecutions: number;
  editedMessages: number;
  deletedMessages: number;
  averageMessageLength: number;
  longestMessage: {
    id: string;
    length: number;
    preview: string;
  } | null;
  mostActiveDay: {
    date: string;
    messageCount: number;
  } | null;
}