import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { mkdirSync, existsSync } from 'fs';
import { DatabaseOptions, DatabaseError } from '../types.js';

export class DatabaseAdapter {
  private db: Database.Database | null = null;
  private dbPath: string;
  private options: Required<Omit<DatabaseOptions, 'database_path'>> & { database_path: string };

  constructor(options: DatabaseOptions) {
    // 验证必需的数据库路径
    if (!options.database_path) {
      throw new DatabaseError('Database path is required');
    }

    // 配置选项
    this.options = {
      database_path: options.database_path,
      auto_migrate: options.auto_migrate !== false, // 默认为 true
      backup_enabled: options.backup_enabled !== false, // 默认为 true
      readonly: options.readonly || false,
    };

    this.dbPath = this.options.database_path;
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

      this.db = new Database(this.dbPath, {
        readonly: this.options.readonly || false,
        fileMustExist: false,
        timeout: 5000,
        verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
      });

      if (!this.options.readonly) {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.pragma('cache_size = 1000');
        this.db.pragma('temp_store = MEMORY');
      }

      // 启用外键约束
      this.db.pragma('foreign_keys = ON');

      // 自动迁移数据库
      if (this.options.auto_migrate) {
        await this.migrate();
      }

      console.log('✅ better-sqlite3数据库连接成功');

    } catch (error) {
      throw new DatabaseError(`Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行数据库迁移
   */
  private async migrate(): Promise<void> {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    try {
      // 在ESM中获取当前文件路径
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      // 读取 schema 文件 - 从源码目录的sql文件夹读取
      const schemaPath = join(__dirname, '../../sql/schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');

      // 执行 schema
      this.db.exec(schema);

      // 执行 schema 一致性检查
      await this.ensureSchemaConsistency();

      // 注意：不再执行 seeds，保持数据库完全干净
      // 让消费者应用自己决定初始数据

    } catch (error) {
      throw new DatabaseError(`Database migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 确保数据库 schema 与 schema.sql 文件一致
   */
  private async ensureSchemaConsistency(): Promise<void> {
    console.log('🔍 [ai-config] 开始检查数据库schema一致性...');

    try {
      // 从 schema.sql 文件解析期望的表结构
      const expectedSchemas = await this.parseSchemaFromSQL();

      // 检查每个表
      for (const [tableName, expectedColumns] of Object.entries(expectedSchemas)) {
        // 获取实际的列结构
        interface ColumnInfo {
          cid: number;
          name: string;
          type: string;
          notnull: number;
          dflt_value: string | null;
          pk: number;
        }

        const actualColumns = this.all<ColumnInfo>(`PRAGMA table_info(${tableName})`);

        if (actualColumns.length === 0) {
          console.warn(`⚠️  表 ${tableName} 不存在,跳过迁移`);
          continue;
        }

        const actualColumnNames = new Set(actualColumns.map((col: ColumnInfo) => col.name));

        console.log(`📋 检查表 ${tableName}:`, {
          actual: Array.from(actualColumnNames),
          expected: expectedColumns.map(c => c.name)
        });

        // 找出缺失的列
        const missingColumns = expectedColumns.filter(
          expectedCol => !actualColumnNames.has(expectedCol.name)
        );

        if (missingColumns.length > 0) {
          console.log(`🔧 表 ${tableName} 缺少 ${missingColumns.length} 个列,准备添加:`,
            missingColumns.map(c => c.name));

          // 为每个缺失的列执行 ALTER TABLE
          for (const column of missingColumns) {
            const alterSQL = `ALTER TABLE ${tableName} ADD COLUMN ${column.name} ${column.type}`.trim();

            try {
              this.exec(alterSQL);
              console.log(`✅ 成功添加列: ${tableName}.${column.name}`);
            } catch (error) {
              console.error(`❌ 添加列失败: ${tableName}.${column.name}`, error);
              throw error;
            }
          }
        } else {
          console.log(`✅ 表 ${tableName} schema一致`);
        }
      }

      console.log('✅ [ai-config] Schema一致性检查完成');
    } catch (error) {
      console.error('❌ [ai-config] Schema一致性检查失败:', error);
      throw error;
    }
  }

  /**
   * 从 schema.sql 文件解析期望的表结构
   */
  private async parseSchemaFromSQL(): Promise<Record<string, Array<{ name: string; type: string }>>> {
    // 使用 ESM 动态导入
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { dirname } = path;

    // 获取当前文件目录路径
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // schema.sql 在 sql 目录
    const schemaPath = path.join(__dirname, '../../sql/schema.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new DatabaseError(`Schema file not found: ${schemaPath}`);
    }

    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

    // 解析 CREATE TABLE 语句
    const schemas: Record<string, Array<{ name: string; type: string }>> = {};

    // 匹配 CREATE TABLE 语句
    const createTableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)\s*\(([\s\S]*?)\);/gi;
    let match;

    while ((match = createTableRegex.exec(schemaSQL)) !== null) {
      const tableName = match[1]; // ai_configs 或 preferences
      const columnsBlock = match[2];

      // 解析列定义
      const columns: Array<{ name: string; type: string }> = [];
      const lines = columnsBlock.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // 跳过注释、空行、约束和 UNIQUE
        if (!trimmed ||
            trimmed.startsWith('--') ||
            trimmed.startsWith('FOREIGN KEY') ||
            trimmed.startsWith('CHECK') ||
            trimmed.startsWith('PRIMARY KEY') ||
            trimmed.startsWith('UNIQUE')) {
          continue;
        }

        // 解析列定义: column_name TYPE [constraints]
        const columnMatch = trimmed.match(/^(\w+)\s+(TEXT|INTEGER|REAL|BLOB|DATETIME|NUMERIC|BOOLEAN)/i);
        if (columnMatch) {
          columns.push({
            name: columnMatch[1],
            type: columnMatch[2].toUpperCase()
          });
        }
      }

      if (columns.length > 0) {
        schemas[tableName] = columns;
        console.log(`📄 从schema.sql解析表 ${tableName}: ${columns.length} 列`);
      }
    }

    if (Object.keys(schemas).length === 0) {
      throw new DatabaseError('Failed to parse any table schemas from schema.sql');
    }

    return schemas;
  }

  /**
   * 获取数据库实例
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new DatabaseError('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * 执行查询并返回单行结果
   */
  get<T = any>(sql: string, params: any[] = []): T | undefined {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.get(...params);
      return result as T | undefined;
    } catch (error) {
      throw new DatabaseError(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行查询并返回多行结果
   */
  all<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    try {
      const stmt = this.db.prepare(sql);
      const results = stmt.all(...params);
      return results as T[];
    } catch (error) {
      throw new DatabaseError(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行INSERT/UPDATE/DELETE并返回变更信息
   */
  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid)
      };
    } catch (error) {
      throw new DatabaseError(`Query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行SQL语句（不返回结果）
   */
  exec(sql: string): void {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    try {
      this.db.exec(sql);
    } catch (error) {
      throw new DatabaseError(`Failed to execute SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 开始事务
   */
  beginTransaction(): any {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    return (queries: Array<{ sql: string; params: any[] }>) => {
      const transaction = this.db!.transaction(() => {
        for (const query of queries) {
          this.run(query.sql, query.params);
        }
      });
      transaction();
    };
  }

  /**
   * 执行事务
   */
  transaction<T>(fn: (db: Database.Database) => T): T {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    const transaction = this.db.transaction(() => {
      return fn(this.db!);
    });
    return transaction();
  }

  /**
   * 备份数据库
   */
  async backup(backupPath?: string): Promise<string> {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    if (!this.options.backup_enabled) {
      throw new DatabaseError('Backup is disabled');
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const defaultBackupPath = join(this.dbPath, '..', `backup-${timestamp}.db`);
      const targetPath = backupPath || defaultBackupPath;

      // wa-sqlite doesn't have direct backup API, need to implement manual backup
      // For now, we'll export all data and create a new database
      const fs = await import('fs/promises');
      
      // Get all table data
      const tables = ['ai_configs', 'preferences'];
      const backupData: any = {};
      
      for (const table of tables) {
        backupData[table] = this.all(`SELECT * FROM ${table}`);
      }
      
      // Save backup as JSON for now (could implement SQL dump later)
      await fs.writeFile(targetPath.replace('.db', '.json'), JSON.stringify(backupData, null, 2));
      return targetPath.replace('.db', '.json');
    } catch (error) {
      throw new DatabaseError(`Backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): Record<string, any> {
    if (!this.db) {
      throw new DatabaseError('Database not connected');
    }

    const stats = {
      database_path: this.dbPath,
      file_size: 0,
      page_count: 0,
      page_size: 0,
      tables: {} as Record<string, number>,
    };

    try {
      // 获取数据库文件大小
      const pageCount = this.db.pragma('page_count', { simple: true }) as number;
      const pageSize = this.db.pragma('page_size', { simple: true }) as number;
      stats.file_size = pageCount * pageSize;
      stats.page_count = pageCount;
      stats.page_size = pageSize;

      // 获取表记录数  
      const tables = ['ai_configs', 'preferences'];
      for (const table of tables) {
        const result = this.get(`SELECT COUNT(*) as count FROM ${table}`);
        stats.tables[table] = result?.count || 0;
      }

      return stats;
    } catch (error) {
      throw new DatabaseError(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.db !== null;
  }

  /**
   * 执行健康检查
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; details: Record<string, any> } {
    try {
      if (!this.isConnected()) {
        return {
          status: 'unhealthy',
          details: { error: 'Database not connected' }
        };
      }

      // 执行一个简单查询
      const result = this.get('SELECT 1 as test');
      const stats = this.getStats();

      return {
        status: 'healthy',
        details: {
          connected: true,
          test_query: result?.test === 1,
          ...stats
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}