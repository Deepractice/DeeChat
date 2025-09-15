import { InjectedDatabaseAdapter } from '../database/injected-adapter.js';
import {
  ConversationMessage,
  ConversationMessageRow,
  CreateMessageInput,
  MessageQueryOptions,
  TokenUsage,
  CreateMessageSchema,
  ValidationError,
  NotFoundError,
  DatabaseError,
} from '../types.js';

/**
 * 消息管理类
 * 负责消息的CRUD操作
 */
export class MessageManager {
  constructor(
    private db: InjectedDatabaseAdapter,
    private tablePrefix: string = ''
  ) {
    if (!db.isConnected()) {
      throw new DatabaseError('Database adapter is not connected');
    }
  }

  /**
   * 获取表名
   */
  private get tableName(): string {
    return `${this.tablePrefix}messages`;
  }

  /**
   * 保存消息
   */
  save(input: CreateMessageInput): ConversationMessage {
    // 验证输入
    const validatedInput = CreateMessageSchema.parse(input);

    // 生成消息ID
    const messageId = this.generateMessageId();
    const timestamp = new Date().toISOString();

    try {
      // 准备token_usage数据
      const tokenUsageJson = validatedInput.token_usage 
        ? JSON.stringify(validatedInput.token_usage)
        : null;

      const result = this.db.run(`
        INSERT INTO ${this.tableName} (id, session_id, role, content, timestamp, token_usage)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        messageId,
        validatedInput.session_id,
        validatedInput.role,
        validatedInput.content,
        timestamp,
        tokenUsageJson
      ]);

      if (result.changes === 0) {
        throw new DatabaseError('Failed to save message');
      }

      return this.findById(messageId)!;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to save message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 根据ID获取消息
   */
  findById(messageId: string): ConversationMessage | null {
    try {
      const row = this.db.get<ConversationMessageRow>(`
        SELECT * FROM ${this.tableName} WHERE id = ?
      `, [messageId]);

      return row ? this.mapRowToMessage(row) : null;
    } catch (error) {
      throw new DatabaseError(`Failed to get message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取会话的消息历史
   */
  getMessageHistory(sessionId: string, options: MessageQueryOptions = {}): ConversationMessage[] {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      // 添加WHERE条件
      const conditions: string[] = ['session_id = ?'];
      params.push(sessionId);

      if (options.role) {
        conditions.push('role = ?');
        params.push(options.role);
      }

      sql += ' WHERE ' + conditions.join(' AND ');

      // 添加排序（消息历史通常按时间正序）
      const orderBy = options.orderBy || 'timestamp';
      const orderDirection = options.orderDirection || 'ASC';
      sql += ` ORDER BY ${orderBy} ${orderDirection}`;

      // 添加分页
      if (options.limit !== undefined) {
        sql += ' LIMIT ?';
        params.push(options.limit);
        
        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const rows = this.db.all<ConversationMessageRow>(sql, params);
      return rows.map(row => this.mapRowToMessage(row));
    } catch (error) {
      throw new DatabaseError(`Failed to get message history: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取最近的N条消息
   */
  getRecentMessages(sessionId: string, limit: number = 10): ConversationMessage[] {
    try {
      const rows = this.db.all<ConversationMessageRow>(`
        SELECT * FROM ${this.tableName} 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [sessionId, limit]);

      // 按时间正序返回（最早的在前）
      return rows.reverse().map(row => this.mapRowToMessage(row));
    } catch (error) {
      throw new DatabaseError(`Failed to get recent messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除会话的所有消息
   */
  deleteBySession(sessionId: string): void {
    try {
      this.db.run(`
        DELETE FROM ${this.tableName} WHERE session_id = ?
      `, [sessionId]);
    } catch (error) {
      throw new DatabaseError(`Failed to delete messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 统计会话的消息数量
   */
  countBySession(sessionId: string): number {
    try {
      const result = this.db.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM ${this.tableName} WHERE session_id = ?
      `, [sessionId]);
      
      return result?.count || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to count messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 按角色统计消息数量
   */
  countByRole(sessionId?: string): Record<string, number> {
    try {
      let sql = `
        SELECT role, COUNT(*) as count 
        FROM ${this.tableName}
      `;
      const params: any[] = [];

      if (sessionId) {
        sql += ' WHERE session_id = ?';
        params.push(sessionId);
      }

      sql += ' GROUP BY role';

      const rows = this.db.all<{ role: string; count: number }>(sql, params);
      
      const result: Record<string, number> = {
        user: 0,
        assistant: 0,
        system: 0
      };

      rows.forEach(row => {
        result[row.role] = row.count;
      });

      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to count messages by role: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成消息ID
   */
  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `msg_${timestamp}_${random}`;
  }

  /**
   * 将数据库行映射为消息对象
   */
  private mapRowToMessage(row: ConversationMessageRow): ConversationMessage {
    let tokenUsage: TokenUsage | undefined;
    
    if (row.token_usage) {
      try {
        tokenUsage = JSON.parse(row.token_usage);
      } catch (error) {
        // 如果JSON解析失败，忽略token_usage
        console.warn('Failed to parse token_usage JSON:', error);
      }
    }

    return {
      id: row.id,
      session_id: row.session_id,
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      token_usage: tokenUsage,
    };
  }
}