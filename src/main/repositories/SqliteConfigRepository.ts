import { ConfigEntity } from '../../shared/entities/ConfigEntity'
import { MinimalDatabaseService } from '../services/core/MinimalDatabaseService'

/**
 * SQLite配置仓储 - 管理应用配置的数据库操作
 */
export class SqliteConfigRepository {
  constructor(private databaseService: MinimalDatabaseService) {}

  /**
   * 初始化配置表
   */
  async initialize(): Promise<void> {
    const db = this.databaseService.getDatabase()
    
    // 创建configs表
    db.exec(`
      CREATE TABLE IF NOT EXISTS configs (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    
    // 创建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_configs_key 
      ON configs(key)
    `)
    
    console.log('✅ [SqliteConfigRepository] 配置表初始化完成')
  }

  /**
   * 根据键获取配置
   */
  async findByKey(key: string): Promise<ConfigEntity | null> {
    const db = this.databaseService.getDatabase()
    
    const stmt = db.prepare(`
      SELECT id, key, value, created_at, updated_at 
      FROM configs 
      WHERE key = ?
    `)
    
    const row = stmt.get(key) as any
    
    if (!row) {
      return null
    }
    
    return new ConfigEntity({
      id: row.id,
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  }

  /**
   * 获取所有配置
   */
  async findAll(): Promise<ConfigEntity[]> {
    const db = this.databaseService.getDatabase()
    
    const stmt = db.prepare(`
      SELECT id, key, value, created_at, updated_at 
      FROM configs 
      ORDER BY key
    `)
    
    const rows = stmt.all() as any[]
    
    return rows.map(row => new ConfigEntity({
      id: row.id,
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }

  /**
   * 保存配置（新增或更新）
   */
  async save(entity: ConfigEntity): Promise<void> {
    const db = this.databaseService.getDatabase()
    const data = entity.toData()
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO configs (id, key, value, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    stmt.run(data.id, data.key, data.value, data.createdAt, data.updatedAt)
    console.log(`✅ [SqliteConfigRepository] 配置已保存: ${data.key}`)
  }

  /**
   * 更新配置值
   */
  async updateByKey(key: string, value: any): Promise<boolean> {
    const db = this.databaseService.getDatabase()
    const now = new Date().toISOString()
    
    const stmt = db.prepare(`
      UPDATE configs 
      SET value = ?, updated_at = ?
      WHERE key = ?
    `)
    
    const result = stmt.run(JSON.stringify(value), now, key)
    const updated = result.changes > 0
    
    if (updated) {
      console.log(`✅ [SqliteConfigRepository] 配置已更新: ${key}`)
    }
    
    return updated
  }

  /**
   * 删除配置
   */
  async deleteByKey(key: string): Promise<boolean> {
    const db = this.databaseService.getDatabase()
    
    const stmt = db.prepare(`
      DELETE FROM configs WHERE key = ?
    `)
    
    const result = stmt.run(key)
    const deleted = result.changes > 0
    
    if (deleted) {
      console.log(`✅ [SqliteConfigRepository] 配置已删除: ${key}`)
    }
    
    return deleted
  }

  /**
   * 删除所有配置
   */
  async deleteAll(): Promise<void> {
    const db = this.databaseService.getDatabase()
    
    const stmt = db.prepare('DELETE FROM configs')
    const result = stmt.run()
    
    console.log(`✅ [SqliteConfigRepository] 已删除 ${result.changes} 个配置`)
  }

  /**
   * 检查配置是否存在
   */
  async exists(key: string): Promise<boolean> {
    const db = this.databaseService.getDatabase()
    
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM configs WHERE key = ?
    `)
    
    const result = stmt.get(key) as any
    return result.count > 0
  }

  /**
   * 获取配置统计信息
   */
  async getStats(): Promise<{
    total: number
    lastUpdated: Date | null
  }> {
    const db = this.databaseService.getDatabase()
    
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM configs')
    const countResult = countStmt.get() as any
    
    const lastUpdatedStmt = db.prepare(`
      SELECT MAX(updated_at) as last_updated FROM configs
    `)
    const lastUpdatedResult = lastUpdatedStmt.get() as any
    
    return {
      total: countResult.count,
      lastUpdated: lastUpdatedResult.last_updated ? new Date(lastUpdatedResult.last_updated) : null
    }
  }

  /**
   * 批量保存配置
   */
  async saveAll(entities: ConfigEntity[]): Promise<void> {
    const db = this.databaseService.getDatabase()
    
    const transaction = db.transaction((configs: ConfigEntity[]) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO configs (id, key, value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      
      for (const entity of configs) {
        const data = entity.toData()
        stmt.run(data.id, data.key, data.value, data.createdAt, data.updatedAt)
      }
    })
    
    transaction(entities)
    console.log(`✅ [SqliteConfigRepository] 批量保存 ${entities.length} 个配置`)
  }

  /**
   * 搜索配置（支持键名模糊匹配）
   */
  async search(pattern: string): Promise<ConfigEntity[]> {
    const db = this.databaseService.getDatabase()
    
    const stmt = db.prepare(`
      SELECT id, key, value, created_at, updated_at 
      FROM configs 
      WHERE key LIKE ?
      ORDER BY key
    `)
    
    const rows = stmt.all(`%${pattern}%`) as any[]
    
    return rows.map(row => new ConfigEntity({
      id: row.id,
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  }
}