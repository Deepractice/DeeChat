/**
 * 数据库迁移运行器
 * 管理SQLite数据库结构的版本控制和迁移
 */

import { Database } from 'sqlite3'
import { Result } from '../../../domain/shared/primitives/Result'

interface IMigration {
  version: number
  name: string
  up: (db: Database) => Promise<void>
  down: (db: Database) => Promise<void>
}

export class DatabaseMigrationRunner {
  private migrations: IMigration[] = []

  constructor(private readonly database: Database) {
    this.registerMigrations()
  }

  /**
   * 运行所有待执行的迁移
   */
  async runMigrations(): Promise<Result<void, Error>> {
    try {
      // 确保迁移表存在
      await this.ensureMigrationTable()
      
      // 获取当前数据库版本
      const currentVersion = await this.getCurrentVersion()
      
      // 获取待执行的迁移
      const pendingMigrations = this.migrations.filter(m => m.version > currentVersion)
      
      if (pendingMigrations.length === 0) {
        console.log('✅ [DatabaseMigrationRunner] 数据库已是最新版本')
        return Result.success()
      }

      console.log(`🔄 [DatabaseMigrationRunner] 开始执行 ${pendingMigrations.length} 个迁移`)

      // 按版本号排序并执行迁移
      pendingMigrations.sort((a, b) => a.version - b.version)
      
      for (const migration of pendingMigrations) {
        await this.runMigration(migration)
      }

      console.log('✅ [DatabaseMigrationRunner] 所有迁移执行完成')
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Migration failed: ${error.message}`))
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(targetVersion: number): Promise<Result<void, Error>> {
    try {
      const currentVersion = await this.getCurrentVersion()
      
      if (targetVersion >= currentVersion) {
        return Result.error(new Error('Target version must be lower than current version'))
      }

      const migrationsToRollback = this.migrations
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version) // 倒序回滚

      console.log(`🔄 [DatabaseMigrationRunner] 开始回滚到版本 ${targetVersion}`)

      for (const migration of migrationsToRollback) {
        await this.rollbackMigration(migration)
      }

      console.log('✅ [DatabaseMigrationRunner] 回滚完成')
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Rollback failed: ${error.message}`))
    }
  }

  /**
   * 注册所有迁移
   */
  private registerMigrations(): void {
    // Migration 001: 创建基础表结构
    this.migrations.push({
      version: 1,
      name: 'create_base_tables',
      up: async (db: Database) => {
        // 创建会话表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            archived INTEGER DEFAULT 0,
            user_id TEXT,
            INDEX idx_user_sessions (user_id, archived),
            INDEX idx_updated_at (updated_at)
          )
        `)

        // 创建消息表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            content TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
            timestamp TEXT NOT NULL,
            token_count INTEGER DEFAULT 0,
            user_id TEXT,
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
            INDEX idx_session_messages (session_id, timestamp),
            INDEX idx_user_messages (user_id, timestamp)
          )
        `)
      },
      down: async (db: Database) => {
        await this.executeQuery(db, 'DROP TABLE IF EXISTS chat_messages')
        await this.executeQuery(db, 'DROP TABLE IF EXISTS chat_sessions')
      }
    })

    // Migration 002: 创建AI角色表
    this.migrations.push({
      version: 2,
      name: 'create_intelligence_tables',
      up: async (db: Database) => {
        // 创建角色表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS promptx_roles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            capabilities TEXT NOT NULL, -- JSON array
            layered_prompt TEXT NOT NULL, -- JSON object
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            usage_count INTEGER DEFAULT 0,
            last_used_at TEXT,
            version TEXT DEFAULT '1.0.0',
            metadata TEXT DEFAULT '{}', -- JSON object
            INDEX idx_active_roles (is_active),
            INDEX idx_usage_stats (usage_count, last_used_at),
            INDEX idx_capabilities (capabilities)
          )
        `)

        // 创建token使用记录表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS role_token_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_id TEXT NOT NULL,
            input_tokens INTEGER NOT NULL,
            output_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (role_id) REFERENCES promptx_roles(id) ON DELETE CASCADE,
            INDEX idx_role_usage (role_id, timestamp)
          )
        `)
      },
      down: async (db: Database) => {
        await this.executeQuery(db, 'DROP TABLE IF EXISTS role_token_usage')
        await this.executeQuery(db, 'DROP TABLE IF EXISTS promptx_roles')
      }
    })

    // Migration 003: 创建工具表
    this.migrations.push({
      version: 3,
      name: 'create_tool_tables',
      up: async (db: Database) => {
        // 创建工具表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS mcp_tools (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            server_name TEXT NOT NULL,
            schema TEXT NOT NULL, -- JSON object
            capabilities TEXT DEFAULT '[]', -- JSON array
            is_enabled INTEGER DEFAULT 1,
            is_healthy INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_used_at TEXT,
            usage_count INTEGER DEFAULT 0,
            success_rate REAL DEFAULT 1.0,
            average_execution_time REAL DEFAULT 0.0,
            metadata TEXT DEFAULT '{}', -- JSON object
            INDEX idx_server_tools (server_name),
            INDEX idx_enabled_healthy (is_enabled, is_healthy),
            INDEX idx_usage_stats (usage_count, success_rate),
            UNIQUE(name, server_name)
          )
        `)

        // 创建工具执行记录表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS tool_executions (
            id TEXT PRIMARY KEY,
            tool_id TEXT NOT NULL,
            parameters TEXT NOT NULL, -- JSON object
            result TEXT NOT NULL, -- JSON object
            success INTEGER NOT NULL,
            execution_time REAL NOT NULL,
            created_at TEXT NOT NULL,
            user_id TEXT,
            session_id TEXT,
            context TEXT DEFAULT '{}', -- JSON object
            FOREIGN KEY (tool_id) REFERENCES mcp_tools(id) ON DELETE CASCADE,
            INDEX idx_tool_executions (tool_id, created_at),
            INDEX idx_user_executions (user_id, created_at),
            INDEX idx_session_executions (session_id, created_at)
          )
        `)
      },
      down: async (db: Database) => {
        await this.executeQuery(db, 'DROP TABLE IF EXISTS tool_executions')
        await this.executeQuery(db, 'DROP TABLE IF EXISTS mcp_tools')
      }
    })

    // Migration 004: 创建系统配置和日志表
    this.migrations.push({
      version: 4,
      name: 'create_system_tables',
      up: async (db: Database) => {
        // 创建系统配置表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `)

        // 创建事件日志表
        await this.executeQuery(db, `
          CREATE TABLE IF NOT EXISTS event_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            event_name TEXT NOT NULL,
            payload TEXT NOT NULL, -- JSON object
            correlation_id TEXT,
            user_id TEXT,
            session_id TEXT,
            created_at TEXT NOT NULL,
            INDEX idx_event_type (event_type, created_at),
            INDEX idx_correlation (correlation_id),
            INDEX idx_user_events (user_id, created_at)
          )
        `)
      },
      down: async (db: Database) => {
        await this.executeQuery(db, 'DROP TABLE IF EXISTS event_logs')
        await this.executeQuery(db, 'DROP TABLE IF EXISTS system_config')
      }
    })
  }

  /**
   * 执行单个迁移
   */
  private async runMigration(migration: IMigration): Promise<void> {
    console.log(`🔄 [Migration] 执行迁移: ${migration.name} (v${migration.version})`)
    
    try {
      await migration.up(this.database)
      await this.recordMigration(migration.version, migration.name)
      
      console.log(`✅ [Migration] 完成迁移: ${migration.name} (v${migration.version})`)
    } catch (error) {
      console.error(`❌ [Migration] 迁移失败: ${migration.name} (v${migration.version})`, error)
      throw error
    }
  }

  /**
   * 回滚单个迁移
   */
  private async rollbackMigration(migration: IMigration): Promise<void> {
    console.log(`🔄 [Migration] 回滚迁移: ${migration.name} (v${migration.version})`)
    
    try {
      await migration.down(this.database)
      await this.removeMigrationRecord(migration.version)
      
      console.log(`✅ [Migration] 完成回滚: ${migration.name} (v${migration.version})`)
    } catch (error) {
      console.error(`❌ [Migration] 回滚失败: ${migration.name} (v${migration.version})`, error)
      throw error
    }
  }

  /**
   * 确保迁移表存在
   */
  private async ensureMigrationTable(): Promise<void> {
    await this.executeQuery(this.database, `
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        executed_at TEXT NOT NULL
      )
    `)
  }

  /**
   * 获取当前数据库版本
   */
  private async getCurrentVersion(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.database.get(
        'SELECT MAX(version) as version FROM migrations',
        (error, row: any) => {
          if (error) reject(error)
          else resolve(row?.version || 0)
        }
      )
    })
  }

  /**
   * 记录迁移执行
   */
  private async recordMigration(version: number, name: string): Promise<void> {
    await this.executeQuery(this.database, 
      'INSERT INTO migrations (version, name, executed_at) VALUES (?, ?, ?)',
      [version, name, new Date().toISOString()]
    )
  }

  /**
   * 移除迁移记录
   */
  private async removeMigrationRecord(version: number): Promise<void> {
    await this.executeQuery(this.database, 
      'DELETE FROM migrations WHERE version = ?',
      [version]
    )
  }

  /**
   * 执行SQL查询
   */
  private async executeQuery(db: Database, sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}