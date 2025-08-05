const Database = require('better-sqlite3');
import { app } from 'electron';
import * as path from 'path';

/**
 * 最小数据库服务 - 奥卡姆剃刀原则，仅实现必要功能
 */
export class MinimalDatabaseService {
  private db: any;
  private initialized = false;
  
  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'deechat.db');
    this.db = new Database(dbPath);
    this.initialize();
  }
  
  private initialize() {
    if (this.initialized) return;
    
    // 基本设置
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    
    // 创建基本表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        selected_model_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS configs (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL DEFAULT 'stdio',
        is_enabled INTEGER NOT NULL DEFAULT 1,
        command TEXT NOT NULL,
        args TEXT,
        env TEXT,
        working_directory TEXT,
        url TEXT,
        headers TEXT,
        timeout INTEGER NOT NULL DEFAULT 10000,
        retry_count INTEGER NOT NULL DEFAULT 2,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_configs_key 
      ON configs(key);
      
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_type 
      ON mcp_servers(type);
      
      CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled 
      ON mcp_servers(is_enabled);
    `);
    
    this.initialized = true;
    console.log('✅ 最小数据库服务初始化完成');
  }
  
  healthCheck(): boolean {
    try {
      const result = this.db.prepare('SELECT 1 as test').get();
      return result?.test === 1;
    } catch {
      return false;
    }
  }
  
  getStats(): any {
    const stmt = this.db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM chat_sessions) as sessions_count,
        (SELECT COUNT(*) FROM model_configs) as configs_count,
        (SELECT COUNT(*) FROM mcp_servers) as mcp_servers_count
    `);
    return stmt.get();
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
  
  // 获取原始数据库实例，供其他服务使用
  getDatabase() {
    return this.db;
  }
  
  // 事务支持
  transaction(fn: () => void) {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  // 数据库操作方法
  async run(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  // 创建表的辅助方法
  async createTable(_tableName: string, _schema: string): Promise<void> {
    // 表已经在初始化时创建，这里只是为了兼容接口
    return Promise.resolve();
  }
}