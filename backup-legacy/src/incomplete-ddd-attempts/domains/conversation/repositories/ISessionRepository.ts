/**
 * 会话仓储接口
 * 🏗️ DDD重构: 定义聊天会话持久化的契约
 */

import { ChatSession } from '../entities/ChatSession';
import { SessionId } from '../value-objects/SessionId';

export interface ISessionRepository {
  /**
   * 根据ID查找会话
   */
  findById(id: SessionId): Promise<ChatSession | null>;

  /**
   * 根据标题查找会话
   */
  findByTitle(title: string): Promise<ChatSession[]>;

  /**
   * 搜索会话
   */
  search(criteria: SessionSearchCriteria): Promise<ChatSession[]>;

  /**
   * 获取所有会话
   */
  findAll(): Promise<ChatSession[]>;

  /**
   * 获取活跃的会话
   */
  findActive(): Promise<ChatSession[]>;

  /**
   * 获取已归档的会话
   */
  findArchived(): Promise<ChatSession[]>;

  /**
   * 获取置顶的会话
   */
  findPinned(): Promise<ChatSession[]>;

  /**
   * 根据模型配置查找会话
   */
  findByModelConfig(modelConfig: string): Promise<ChatSession[]>;

  /**
   * 根据角色查找会话
   */
  findByRole(role: string): Promise<ChatSession[]>;

  /**
   * 获取最近的会话
   */
  findRecent(limit: number): Promise<ChatSession[]>;

  /**
   * 查找指定日期之前的会话
   */
  findOlderThan(date: Date): Promise<ChatSession[]>;

  /**
   * 保存会话
   */
  save(session: ChatSession): Promise<void>;

  /**
   * 删除会话
   */
  delete(id: SessionId): Promise<void>;

  /**
   * 检查会话是否存在
   */
  exists(id: SessionId): Promise<boolean>;

  /**
   * 获取会话统计信息
   */
  getStats(): Promise<SessionStats>;
}

export interface SessionSearchCriteria {
  searchTerm?: string;
  tags?: string[];
  modelConfig?: string;
  activeRole?: string;
  isActive?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  isPrivate?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  archivedSessions: number;
  pinnedSessions: number;
  privateSessions: number;
  averageMessagesPerSession: number;
  oldestSession?: {
    id: string;
    title: string;
    createdAt: Date;
  };
  newestSession?: {
    id: string;
    title: string;
    createdAt: Date;
  };
  modelUsage: Array<{
    model: string;
    sessionCount: number;
  }>;
  roleUsage: Array<{
    role: string;
    sessionCount: number;
  }>;
}