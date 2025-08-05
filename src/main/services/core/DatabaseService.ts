import Database = require('better-sqlite3');
import { app } from 'electron';
import * as path from 'path';

/**
 * DeeChat SQLite数据库服务 - 奥卡姆剃刀实现
 * 
 * 设计原则：
 * 1. 最简洁有效的实现
 * 2. 零配置自动初始化
 * 3. 高性能预编译语句
 * 4. 完整的事务支持
 */
export class DatabaseService {
  private db: Database.Database;
  private isInitialized = false;
  
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'deechat.db');
    this.db = new Database(dbPath);
    this.initialize();
  }
  
  private initialize() {
    if (this.isInitialized) return;
    
    // SQLite性能优化设置
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('foreign_keys = ON');
    
    // 创建核心表结构
    this.createTables();
    this.createIndexes();
    this.createTriggers();
    
    this.isInitialized = true;
    console.log('✅ DatabaseService初始化完成');
  }
  
  private createTables() {
    this.db.exec(`
      -- 对话会话表
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        selected_model_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- 对话消息表
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        model_id TEXT,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
      );
      
      -- 工具执行记录表
      CREATE TABLE IF NOT EXISTS tool_executions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        server_id TEXT,
        server_name TEXT,
        params TEXT,
        result TEXT,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        duration INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
      );
      
      -- 模型配置表
      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        api_key TEXT,
        base_url TEXT,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'unknown',
        priority INTEGER NOT NULL DEFAULT 0,
        available_models TEXT,
        enabled_models TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      -- 用户偏好设置表
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }
  
  private createIndexes() {
    this.db.exec(`
      -- 性能优化索引
      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_model ON chat_sessions(selected_model_id);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON chat_messages(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_tools_message ON tool_executions(message_id);
      CREATE INDEX IF NOT EXISTS idx_configs_provider ON model_configs(provider, is_enabled);
    `);
  }
  
  private createTriggers() {
    this.db.exec(`
      -- 自动更新时间戳触发器
      CREATE TRIGGER IF NOT EXISTS update_session_timestamp 
      AFTER UPDATE ON chat_sessions
      BEGIN
        UPDATE chat_sessions SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.id;
      END;
      
      CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
      AFTER UPDATE ON model_configs
      BEGIN
        UPDATE model_configs SET updated_at = (strftime('%s', 'now') * 1000) WHERE id = NEW.id;
      END;
    `);
  }
  
  /**
   * 获取预编译语句 - 高性能查询核心
   */
  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }
  
  /**
   * 事务执行 - 原子性操作保证
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
  
  /**
   * 获取数据库统计信息
   */
  getStats(): DatabaseStats {
    const stmt = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM chat_sessions) as sessions_count,
        (SELECT COUNT(*) FROM chat_messages) as messages_count,
        (SELECT COUNT(*) FROM model_configs) as configs_count,
        (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size
    `);
    
    return stmt.get() as DatabaseStats;
  }
  
  /**
   * 安全关闭数据库
   */
  close(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
  
  /**
   * 检查数据库是否健康
   */
  healthCheck(): boolean {
    try {
      const result = this.db.prepare('SELECT 1 as test').get() as any;
      return result?.test === 1;
    } catch {
      return false;
    }
  }
}

export interface DatabaseStats {
  sessions_count: number;
  messages_count: number;
  configs_count: number;
  db_size: number;
}