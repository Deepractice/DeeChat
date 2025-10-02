import { DatabaseAdapter as ExternalDatabaseAdapter } from '@deepracticex/database-adapter';
import { DatabaseError } from '../types.js';

/**
 * 基于依赖注入的数据库适配器包装类
 * 将新的 DatabaseAdapter 接口适配到现有的内部 DatabaseAdapter 接口
 */
export class InjectedDatabaseAdapter {
  private _isConnected = false;

  constructor(private database: ExternalDatabaseAdapter) {
    // 表名固定，不使用前缀
  }

  /**
   * 连接数据库
   */
  async connect(): Promise<void> {
    if (!this._isConnected) {
      await this.database.connect();
      this._isConnected = true;
      // 表创建由 ConversationStorage.migrate() 统一管理
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

  // ✅ setupTables, ensureSchemaConsistency, parseSchemaFromSQL 已删除
  // 表创建统一由 ConversationStorage.migrate() 执行 schema.sql 管理

}