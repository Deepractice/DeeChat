import { InjectedDatabaseAdapter } from '../database/injected-adapter.js';
import {
  AIConfig,
  AIConfigRow,
  CreateAIConfigInput,
  UpdateAIConfigInput,
  AIConfigQueryOptions,
  CreateAIConfigSchema,
  UpdateAIConfigSchema,
  ValidationError,
  NotFoundError,
  DatabaseError,
  // 向后兼容的类型别名
  Config,
  CreateConfigInput,
  UpdateConfigInput,
  ConfigQueryOptions,
} from '../types.js';

/**
 * AI 配置管理类
 * 基于"如非必要，勿增实体"原则设计
 * 只管理 AI 配置，不再依赖复杂的供应商表
 */
export class ConfigManager {
  constructor(private db: InjectedDatabaseAdapter) {
    if (!db.isConnected()) {
      throw new DatabaseError('Database adapter is not connected');
    }
  }

  /**
   * 创建新的AI配置
   */
  async create(input: CreateAIConfigInput): Promise<AIConfig> {
    // 验证输入
    const validatedInput = CreateAIConfigSchema.parse(input);

    // 检查配置名称是否已存在
    const existing = await this.findByName(validatedInput.name);
    if (existing) {
      throw new ValidationError(`配置 '${validatedInput.name}' 已存在`);
    }

    try {
      // 如果设置为默认配置，需要先取消其他配置的默认状态
      if (validatedInput.is_default) {
        this.db.run('UPDATE ai_configs SET is_default = 0');
      }

      const result = this.db.run(
        `INSERT INTO ai_configs (
          name, api_key, base_url, is_default, is_active
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          validatedInput.name,
          validatedInput.api_key,
          validatedInput.base_url,
          validatedInput.is_default !== false ? 1 : 0,
          validatedInput.is_active !== false ? 1 : 0,
        ]
      );

      const created = await this.findById(result.lastInsertRowid as number);
      if (!created) {
        throw new DatabaseError('Failed to retrieve created configuration');
      }

      return created;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to create configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 根据 ID 查找配置
   */
  async findById(id: number): Promise<AIConfig | null> {
    try {
      const row = await this.db.get<AIConfigRow>(
        'SELECT * FROM ai_configs WHERE id = ?',
        [id]
      );

      return row ? this.transformRow(row) : null;
    } catch (error) {
      throw new DatabaseError(`Failed to find configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 根据配置名称查找配置
   */
  async findByName(name: string): Promise<AIConfig | null> {
    try {
      const row = await this.db.get<AIConfigRow>(
        'SELECT * FROM ai_configs WHERE name = ?',
        [name]
      );

      return row ? this.transformRow(row) : null;
    } catch (error) {
      throw new DatabaseError(`Failed to find configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 查找所有配置
   */
  async findAll(options: AIConfigQueryOptions = {}): Promise<AIConfig[]> {
    try {
      let sql = 'SELECT * FROM ai_configs';
      const params: any[] = [];
      const conditions: string[] = [];

      // 构建查询条件
      if (options.is_active !== undefined) {
        conditions.push('is_active = ?');
        params.push(options.is_active ? 1 : 0);
      }

      if (options.is_default !== undefined) {
        conditions.push('is_default = ?');
        params.push(options.is_default ? 1 : 0);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      // 排序
      if (options.orderBy) {
        const direction = options.orderDirection || 'ASC';
        sql += ` ORDER BY ${options.orderBy} ${direction}`;
      } else {
        sql += ' ORDER BY name ASC';
      }

      // 分页
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const rows = await this.db.all<AIConfigRow>(sql, params);
      return rows.map(row => this.transformRow(row));
    } catch (error) {
      throw new DatabaseError(`Failed to find configurations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取默认配置
   */
  async findDefault(): Promise<AIConfig | null> {
    const configs = await this.findAll({ 
      is_default: true, 
      is_active: true,
      limit: 1 
    });
    return configs.length > 0 ? configs[0] : null;
  }

  /**
   * 更新配置
   */
  async update(id: number, input: UpdateAIConfigInput): Promise<AIConfig> {
    // 验证输入
    const validatedInput = UpdateAIConfigSchema.parse(input);

    // 检查配置是否存在
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Configuration', id.toString());
    }

    try {
      const updateFields: string[] = [];
      const params: any[] = [];

      // 动态构建更新字段
      if (validatedInput.name !== undefined) {
        // 检查新名称是否已存在
        const existingWithName = await this.findByName(validatedInput.name);
        if (existingWithName && existingWithName.id !== id) {
          throw new ValidationError(`配置 '${validatedInput.name}' 已存在`);
        }
        updateFields.push('name = ?');
        params.push(validatedInput.name);
      }

      if (validatedInput.api_key !== undefined) {
        updateFields.push('api_key = ?');
        params.push(validatedInput.api_key);
      }

      if (validatedInput.base_url !== undefined) {
        updateFields.push('base_url = ?');
        params.push(validatedInput.base_url);
      }

      if (validatedInput.is_default !== undefined) {
        updateFields.push('is_default = ?');
        params.push(validatedInput.is_default ? 1 : 0);
        
        // 如果设置为默认配置，取消其他配置的默认状态
        if (validatedInput.is_default) {
          this.db.run(
            'UPDATE ai_configs SET is_default = 0 WHERE id != ?',
            [id]
          );
        }
      }

      if (validatedInput.is_active !== undefined) {
        updateFields.push('is_active = ?');
        params.push(validatedInput.is_active ? 1 : 0);
      }

      if (updateFields.length === 0) {
        return existing; // 没有更新字段，直接返回原数据
      }

      // 添加 WHERE 参数
      params.push(id);

      const sql = `UPDATE ai_configs SET ${updateFields.join(', ')} WHERE id = ?`;
      this.db.run(sql, params);

      const updated = await this.findById(id);
      if (!updated) {
        throw new DatabaseError('Failed to retrieve updated configuration');
      }

      return updated;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除配置
   */
  async delete(id: number): Promise<void> {
    // 检查配置是否存在
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Configuration', id.toString());
    }

    try {
      const result = this.db.run('DELETE FROM ai_configs WHERE id = ?', [id]);
      
      if (result.changes === 0) {
        throw new DatabaseError('No configuration was deleted');
      }
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to delete configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 设置默认配置
   */
  async setDefault(id: number): Promise<AIConfig> {
    return this.update(id, { is_default: true });
  }

  /**
   * 激活/停用配置
   */
  async setActive(id: number, active: boolean): Promise<AIConfig> {
    return this.update(id, { is_active: active });
  }

  /**
   * 获取活跃配置
   */
  async findActive(options: Omit<AIConfigQueryOptions, 'is_active'> = {}): Promise<AIConfig[]> {
    return await this.findAll({ ...options, is_active: true });
  }

  /**
   * 检查配置是否存在
   */
  async exists(name: string): Promise<boolean> {
    return (await this.findByName(name)) !== null;
  }

  /**
   * 获取配置数量
   */
  async count(options: Omit<AIConfigQueryOptions, 'limit' | 'offset' | 'orderBy' | 'orderDirection'> = {}): Promise<number> {
    try {
      let sql = 'SELECT COUNT(*) as count FROM ai_configs';
      const params: any[] = [];
      const conditions: string[] = [];

      if (options.is_active !== undefined) {
        conditions.push('is_active = ?');
        params.push(options.is_active ? 1 : 0);
      }

      if (options.is_default !== undefined) {
        conditions.push('is_default = ?');
        params.push(options.is_default ? 1 : 0);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      const result = await this.db.get<{ count: number }>(sql, params);
      return result?.count || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to count configurations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 复制配置
   */
  async duplicate(id: number, new_name: string): Promise<AIConfig> {
    const original = await this.findById(id);
    if (!original) {
      throw new NotFoundError('Configuration', id.toString());
    }

    const duplicateInput: CreateAIConfigInput = {
      name: new_name,
      api_key: original.api_key,
      base_url: original.base_url,
      is_default: false, // 复制的配置不能是默认配置
      is_active: original.is_active,
    };

    return this.create(duplicateInput);
  }

  /**
   * 转换数据库行为领域对象
   */
  private transformRow(row: AIConfigRow): AIConfig {
    return {
      id: row.id,
      name: row.name,
      api_key: row.api_key,
      base_url: row.base_url,
      is_default: Boolean(row.is_default),
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // === 向后兼容的方法 ===
  // 为了支持现有代码，保留一些旧的方法签名

  /** @deprecated 使用 findByName 替代 */
  async findByName_legacy(provider_code: string, config_name: string): Promise<Config | null> {
    // 在简化版本中，我们忽略 provider_code，只使用 config_name
    return (await this.findByName(config_name)) as Config;
  }

  /** @deprecated 使用 findByProvider 不再需要，直接使用 findAll */
  async findByProvider(provider_code: string, options: Omit<ConfigQueryOptions, 'provider_code'> = {}): Promise<Config[]> {
    // 在简化版本中，忽略 provider_code
    return (await this.findAll(options as AIConfigQueryOptions)) as Config[];
  }

  /** @deprecated 使用 findDefault 替代 */
  async findDefaultByProvider(provider_code: string): Promise<Config | null> {
    return (await this.findDefault()) as Config;
  }

  /** @deprecated 使用 exists(name) 替代 */
  async exists_legacy(provider_code: string, config_name: string): Promise<boolean> {
    return await this.exists(config_name);
  }
}