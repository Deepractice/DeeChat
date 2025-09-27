import Database from 'better-sqlite3';
import { DatabaseError } from '../types.js';

export interface DatabaseOptions {
  database_path: string;               // 必需：数据库路径
  readonly?: boolean;                  // 可选：只读模式
}

export class DatabaseAdapter {
  private db: Database.Database | null = null;
  private dbPath: string;
  private readonly: boolean;

  constructor(options: DatabaseOptions) {
    // 验证必需的数据库路径
    if (!options.database_path) {
      throw new DatabaseError('Database path is required');
    }

    this.dbPath = options.database_path;
    this.readonly = options.readonly || false;
  }

  /**
   * 初始化数据库连接
   */
  async connect(): Promise<void> {
    try {
      // 确保数据库目录存在
      const path = await import('path');
      const fs = await import('fs');
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('📁 创建数据库目录:', dbDir);
      }
      
      console.log('🔗 尝试打开数据库:', this.dbPath);
      
      // 使用better-sqlite3创建数据库连接
      this.db = new Database(this.dbPath, {
        readonly: this.readonly,
        fileMustExist: false,
        timeout: 5000,
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
      });

      if (!this.readonly) {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 1000');
        this.db.pragma('temp_store = MEMORY');
      }

      this.db.pragma('foreign_keys = ON');

      console.log('✅ better-sqlite3数据库连接成功');

    } catch (error) {
      throw new DatabaseError(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行SQL语句
   */
  exec(sql: string): void {
    this.ensureConnected();
    try {
      this.db!.exec(sql);
    } catch (error) {
      throw new DatabaseError(`Failed to execute SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 运行SQL语句（INSERT, UPDATE, DELETE）
   */
  run(sql: string, params?: any[]): { changes: number; lastInsertRowid: number } {
    this.ensureConnected();
    try {
      const stmt = this.db!.prepare(sql);
      const result = stmt.run(...(params || []));
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid)
      };
    } catch (error) {
      throw new DatabaseError(`Failed to run SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取单行数据
   */
  get<T = any>(sql: string, params?: any[]): T | undefined {
    this.ensureConnected();
    try {
      const stmt = this.db!.prepare(sql);
      const result = stmt.get(...(params || []));
      return result as T | undefined;
    } catch (error) {
      throw new DatabaseError(`Failed to get data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取多行数据
   */
  all<T = any>(sql: string, params?: any[]): T[] {
    this.ensureConnected();
    try {
      const stmt = this.db!.prepare(sql);
      const results = stmt.all(...(params || []));
      return results as T[];
    } catch (error) {
      throw new DatabaseError(`Failed to get all data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 开始事务
   */
  transaction<T>(fn: () => T): T {
    this.ensureConnected();
    try {
      const transaction = this.db!.transaction(() => {
        return fn();
      });
      return transaction();
    } catch (error) {
      throw new DatabaseError(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.db !== null;
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db !== null) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 获取数据库健康状态
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; details: Record<string, any> } {
    try {
      if (!this.isConnected()) {
        return {
          status: 'unhealthy',
          details: { error: 'Database not connected' }
        };
      }

      // 执行简单查询测试连接
      this.get('SELECT 1');
      
      return {
        status: 'healthy',
        details: {
          path: this.dbPath,
          readonly: this.readonly,
          connected: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { 
          error: error instanceof Error ? error.message : String(error),
          path: this.dbPath 
        }
      };
    }
  }

  /**
   * 确保数据库已连接
   */
  private ensureConnected(): void {
    if (!this.isConnected()) {
      throw new DatabaseError('Database not connected. Call connect() first.');
    }
  }
}