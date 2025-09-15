import { InjectedDatabaseAdapter } from '../database/injected-adapter.js';
import {
  ConversationSession,
  ConversationSessionRow,
  CreateSessionInput,
  UpdateSessionInput,
  SessionQueryOptions,
  CreateSessionSchema,
  UpdateSessionSchema,
  ValidationError,
  NotFoundError,
  DatabaseError,
} from '../types.js';

/**
 * 会话管理类
 * 负责会话的CRUD操作
 */
export class SessionManager {
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
    return `${this.tablePrefix}sessions`;
  }

  /**
   * 创建新会话
   */
  async create(input: CreateSessionInput): Promise<ConversationSession> {
    // 验证输入
    const validatedInput = CreateSessionSchema.parse(input);

    // 生成会话ID
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();

    try {
      const result = await this.db.run(`
        INSERT INTO ${this.tableName} (id, title, ai_config_name, created_at, updated_at, message_count)
        VALUES (?, ?, ?, ?, ?, 0)
      `, [sessionId, validatedInput.title, validatedInput.ai_config_name, now, now]);

      if (result.changes === 0) {
        throw new DatabaseError('Failed to create session');
      }

      return (await this.findById(sessionId))!;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to create session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 根据ID获取会话
   */
  findById(sessionId: string): ConversationSession | null {
    try {
      const row = this.db.get<ConversationSessionRow>(`
        SELECT * FROM ${this.tableName} WHERE id = ?
      `, [sessionId]);

      return row ? this.mapRowToSession(row) : null;
    } catch (error) {
      throw new DatabaseError(`Failed to get session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有会话
   */
  findAll(options: SessionQueryOptions = {}): ConversationSession[] {
    try {
      let sql = `SELECT * FROM ${this.tableName}`;
      const params: any[] = [];

      // 添加WHERE条件
      const conditions: string[] = [];
      if (options.ai_config_name) {
        conditions.push('ai_config_name = ?');
        params.push(options.ai_config_name);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      // 添加排序
      const orderBy = options.orderBy || 'updated_at';
      const orderDirection = options.orderDirection || 'DESC';
      sql += ` ORDER BY ${orderBy} ${orderDirection}`;

      // 添加分页
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
        
        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const rows = this.db.all<ConversationSessionRow>(sql, params);
      return rows.map((row: ConversationSessionRow) => this.mapRowToSession(row));
    } catch (error) {
      throw new DatabaseError(`Failed to get sessions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新会话
   */
  async update(sessionId: string, input: UpdateSessionInput): Promise<void> {
    // 验证输入
    const validatedInput = UpdateSessionSchema.parse(input);

    // 检查会话是否存在
    const existing = this.findById(sessionId);
    if (!existing) {
      throw new NotFoundError('Session', sessionId);
    }

    // 构建更新语句
    const updates: string[] = [];
    const params: any[] = [];

    if (validatedInput.title !== undefined) {
      updates.push('title = ?');
      params.push(validatedInput.title);
    }

    if (validatedInput.ai_config_name !== undefined) {
      updates.push('ai_config_name = ?');
      params.push(validatedInput.ai_config_name);
    }

    if (updates.length === 0) {
      return; // 没有需要更新的字段
    }

    // 添加更新时间
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    // 添加WHERE条件
    params.push(sessionId);

    try {
      const result = this.db.run(`
        UPDATE ${this.tableName} 
        SET ${updates.join(', ')} 
        WHERE id = ?
      `, params);

      if (result.changes === 0) {
        throw new NotFoundError('Session', sessionId);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to update session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除会话
   */
  async delete(sessionId: string): Promise<void> {
    // 检查会话是否存在
    const existing = this.findById(sessionId);
    if (!existing) {
      throw new NotFoundError('Session', sessionId);
    }

    try {
      const result = this.db.run(`
        DELETE FROM ${this.tableName} WHERE id = ?
      `, [sessionId]);

      if (result.changes === 0) {
        throw new NotFoundError('Session', sessionId);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete session: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新会话的消息数量
   */
  updateMessageCount(sessionId: string): void {
    // 检查会话是否存在
    const existing = this.findById(sessionId);
    if (!existing) {
      throw new NotFoundError('Session', sessionId);
    }

    try {
      const messagesTableName = `${this.tablePrefix}messages`;
      const result = this.db.run(`
        UPDATE ${this.tableName} 
        SET message_count = (
          SELECT COUNT(*) FROM ${messagesTableName} WHERE session_id = ?
        ), updated_at = ?
        WHERE id = ?
      `, [sessionId, new Date().toISOString(), sessionId]);

      if (result.changes === 0) {
        throw new NotFoundError('Session', sessionId);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to update message count: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `session_${timestamp}_${random}`;
  }

  /**
   * 将数据库行映射为会话对象
   */
  private mapRowToSession(row: ConversationSessionRow): ConversationSession {
    return {
      id: row.id,
      title: row.title,
      ai_config_name: row.ai_config_name,
      created_at: row.created_at,
      updated_at: row.updated_at,
      message_count: row.message_count,
    };
  }
}