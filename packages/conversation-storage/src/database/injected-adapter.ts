import { DatabaseAdapter as ExternalDatabaseAdapter } from '@deepracticex/database-adapter';
import { DatabaseError } from '../types.js';

/**
 * 基于依赖注入的数据库适配器包装类
 * 将新的 DatabaseAdapter 接口适配到现有的内部 DatabaseAdapter 接口
 */
export class InjectedDatabaseAdapter {
  private _isConnected = false;

  constructor(private database: ExternalDatabaseAdapter) {}

  /**
   * 连接数据库
   */
  async connect(): Promise<void> {
    if (!this._isConnected) {
      await this.database.connect();
      this._isConnected = true;
      this.setupTables();
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this._isConnected) {
      this.database.close();
      this._isConnected = false;
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this._isConnected && this.database.isConnected();
  }

  /**
   * 执行SQL查询
   */
  exec(sql: string): void {
    return this.database.exec(sql);
  }

  /**
   * 准备SQL语句
   */
  prepare(sql: string) {
    return this.database.prepare(sql);
  }

  /**
   * 执行事务
   */
  transaction<T>(fn: () => T): T {
    return this.database.transaction(fn);
  }

  /**
   * 执行 SQL 并返回结果（兼容方法）
   */
  run(sql: string, ...params: any[]) {
    const stmt = this.database.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * 执行查询并获取单行结果（兼容方法）
   */
  get<T = any>(sql: string, ...params: any[]): T | undefined {
    const stmt = this.database.prepare(sql);
    return stmt.get<T>(...params);
  }

  /**
   * 执行查询并获取所有结果（兼容方法）
   */
  all<T = any>(sql: string, ...params: any[]): T[] {
    const stmt = this.database.prepare(sql);
    return stmt.all<T>(...params);
  }

  /**
   * 备份数据库
   */
  backup(backupPath?: string): string {
    if (!backupPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      backupPath = `./backup-${timestamp}.db`;
    }

    // 这里需要实现备份逻辑
    // 由于新的 DatabaseAdapter 没有内置备份功能，我们可能需要使用其他方式
    throw new DatabaseError('Backup functionality not implemented in injected adapter');
  }

  /**
   * 健康检查
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; details: Record<string, any> } {
    if (!this.isConnected()) {
      return {
        status: 'unhealthy',
        details: { error: 'Database not connected' }
      };
    }

    try {
      // 尝试执行一个简单的查询来检查数据库健康状态
      this.database.exec('SELECT 1');
      return {
        status: 'healthy',
        details: {
          connected: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * 设置数据库表
   */
  private setupTables(): void {
    try {
      // 创建对话会话表
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS conversation_sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          ai_config_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          message_count INTEGER DEFAULT 0
        )
      `);

      // 创建对话消息表
      this.database.exec(`
        CREATE TABLE IF NOT EXISTS conversation_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          token_usage TEXT,
          FOREIGN KEY (session_id) REFERENCES conversation_sessions (id) ON DELETE CASCADE
        )
      `);

      // 创建索引
      this.database.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_session_id
        ON conversation_messages (session_id)
      `);

      this.database.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp
        ON conversation_messages (timestamp)
      `);

      this.database.exec(`
        CREATE INDEX IF NOT EXISTS idx_sessions_updated_at
        ON conversation_sessions (updated_at)
      `);

      // 创建触发器用于自动更新 updated_at 字段
      this.database.exec(`
        CREATE TRIGGER IF NOT EXISTS conversation_sessions_update_timestamp
        AFTER UPDATE ON conversation_sessions
        BEGIN
          UPDATE conversation_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      // 创建触发器用于自动更新会话的消息计数
      this.database.exec(`
        CREATE TRIGGER IF NOT EXISTS update_session_message_count_insert
        AFTER INSERT ON conversation_messages
        BEGIN
          UPDATE conversation_sessions
          SET message_count = message_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = NEW.session_id;
        END
      `);

      this.database.exec(`
        CREATE TRIGGER IF NOT EXISTS update_session_message_count_delete
        AFTER DELETE ON conversation_messages
        BEGIN
          UPDATE conversation_sessions
          SET message_count = message_count - 1, updated_at = CURRENT_TIMESTAMP
          WHERE id = OLD.session_id;
        END
      `);

    } catch (error) {
      throw new DatabaseError(`Failed to setup database tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}