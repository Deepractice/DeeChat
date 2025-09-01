import { ModelConfigEntity } from '../../shared/entities/ModelConfigEntity';
import { MinimalDatabaseService } from '../services/core/MinimalDatabaseService';

/**
 * SQLite模型配置仓储实现 - 使用MinimalDatabaseService
 */
export class SqliteModelConfigRepository {
  constructor(private databaseService: MinimalDatabaseService) {}

  /**
   * 初始化模型配置仓储
   */
  async initialize(): Promise<void> {
    // 表已在MinimalDatabaseService中创建，这里只需要确认
    console.log('✅ [SqliteModelConfigRepository] 模型配置表初始化完成');
  }

  /**
   * 获取所有模型配置
   */
  async findAll(): Promise<ModelConfigEntity[]> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, name, provider, model, api_key, base_url, 
             is_enabled, status, priority, created_at, updated_at 
      FROM model_configs 
      ORDER BY priority DESC, name ASC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => new ModelConfigEntity({
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: row.api_key,
      baseURL: row.base_url,
      isEnabled: Boolean(row.is_enabled),
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  }

  /**
   * 根据ID获取模型配置
   */
  async findById(id: string): Promise<ModelConfigEntity | null> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, name, provider, model, api_key, base_url, 
             is_enabled, status, priority, created_at, updated_at 
      FROM model_configs 
      WHERE id = ?
    `);
    
    const row = stmt.get(id) as any;
    
    if (!row) {
      return null;
    }
    
    return new ModelConfigEntity({
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: row.api_key,
      baseURL: row.base_url,
      isEnabled: Boolean(row.is_enabled),
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    });
  }

  /**
   * 获取启用的模型配置
   */
  async findEnabled(): Promise<ModelConfigEntity[]> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, name, provider, model, api_key, base_url, 
             is_enabled, status, priority, created_at, updated_at 
      FROM model_configs 
      WHERE is_enabled = 1
      ORDER BY priority DESC, name ASC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => new ModelConfigEntity({
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: row.api_key,
      baseURL: row.base_url,
      isEnabled: Boolean(row.is_enabled),
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  }

  /**
   * 获取可用的模型配置
   */
  async findAvailable(): Promise<ModelConfigEntity[]> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, name, provider, model, api_key, base_url, 
             is_enabled, status, priority, created_at, updated_at 
      FROM model_configs 
      WHERE is_enabled = 1 AND status = 'available'
      ORDER BY priority DESC, name ASC
    `);
    
    const rows = stmt.all() as any[];
    
    return rows.map(row => new ModelConfigEntity({
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: row.api_key,
      baseURL: row.base_url,
      isEnabled: Boolean(row.is_enabled),
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  }

  /**
   * 保存模型配置
   */
  async save(entity: ModelConfigEntity): Promise<void> {
    const db = this.databaseService.getDatabase();
    const data = entity.toData();
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO model_configs 
      (id, name, provider, model, api_key, base_url, is_enabled, status, priority, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.id,
      data.name,
      data.provider,
      data.model,
      data.apiKey || null,
      data.baseURL || null,
      data.isEnabled ? 1 : 0,
      data.status,
      data.priority,
      new Date(data.createdAt).getTime(),
      new Date(data.updatedAt).getTime()
    );
    
    console.log(`✅ [SqliteModelConfigRepository] 模型配置已保存: ${data.name}`);
  }

  /**
   * 删除模型配置
   */
  async delete(id: string): Promise<boolean> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare('DELETE FROM model_configs WHERE id = ?');
    const result = stmt.run(id);
    const deleted = result.changes > 0;
    
    if (deleted) {
      console.log(`✅ [SqliteModelConfigRepository] 模型配置已删除: ${id}`);
    }
    
    return deleted;
  }

  /**
   * 删除所有模型配置
   */
  async deleteAll(): Promise<void> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare('DELETE FROM model_configs');
    const result = stmt.run();
    
    console.log(`✅ [SqliteModelConfigRepository] 已删除 ${result.changes} 个模型配置`);
  }

  /**
   * 更新配置状态
   */
  async updateStatus(id: string, status: string): Promise<boolean> {
    const db = this.databaseService.getDatabase();
    const now = new Date().getTime();
    
    const stmt = db.prepare(`
      UPDATE model_configs 
      SET status = ?, updated_at = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(status, now, id);
    const updated = result.changes > 0;
    
    if (updated) {
      console.log(`✅ [SqliteModelConfigRepository] 配置状态已更新: ${id} -> ${status}`);
    }
    
    return updated;
  }

  /**
   * 批量保存配置
   */
  async saveAll(entities: ModelConfigEntity[]): Promise<void> {
    const db = this.databaseService.getDatabase();
    
    const transaction = db.transaction((configs: ModelConfigEntity[]) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO model_configs 
        (id, name, provider, model, api_key, base_url, is_enabled, status, priority, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      for (const entity of configs) {
        const data = entity.toData();
        stmt.run(
          data.id,
          data.name,
          data.provider,
          data.model,
          data.apiKey || null,
          data.baseURL || null,
          data.isEnabled ? 1 : 0,
          data.status,
          data.priority,
          new Date(data.createdAt).getTime(),
          new Date(data.updatedAt).getTime()
        );
      }
    });
    
    transaction(entities);
    console.log(`✅ [SqliteModelConfigRepository] 批量保存 ${entities.length} 个模型配置`);
  }

  /**
   * 获取配置统计信息
   */
  async getStats(): Promise<{
    total: number;
    enabled: number;
    available: number;
  }> {
    const db = this.databaseService.getDatabase();
    
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM model_configs');
    const totalResult = totalStmt.get() as any;
    
    const enabledStmt = db.prepare('SELECT COUNT(*) as count FROM model_configs WHERE is_enabled = 1');
    const enabledResult = enabledStmt.get() as any;
    
    const availableStmt = db.prepare('SELECT COUNT(*) as count FROM model_configs WHERE is_enabled = 1 AND status = \'available\'');
    const availableResult = availableStmt.get() as any;
    
    return {
      total: totalResult.count,
      enabled: enabledResult.count,
      available: availableResult.count
    };
  }

  /**
   * 根据提供商搜索配置
   */
  async findByProvider(provider: string): Promise<ModelConfigEntity[]> {
    const db = this.databaseService.getDatabase();
    
    const stmt = db.prepare(`
      SELECT id, name, provider, model, api_key, base_url, 
             is_enabled, status, priority, created_at, updated_at 
      FROM model_configs 
      WHERE provider = ?
      ORDER BY priority DESC, name ASC
    `);
    
    const rows = stmt.all(provider) as any[];
    
    return rows.map(row => new ModelConfigEntity({
      id: row.id,
      name: row.name,
      provider: row.provider,
      model: row.model,
      apiKey: row.api_key,
      baseURL: row.base_url,
      isEnabled: Boolean(row.is_enabled),
      status: row.status,
      priority: row.priority,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    }));
  }
}