import { InjectedDatabaseAdapter } from '../database/injected-adapter.js';
import {
  Preference,
  PreferenceRow,
  PreferenceInput,
  PreferenceQueryOptions,
  PreferenceSchema,
  ValidationError,
  NotFoundError,
  DatabaseError,
} from '../types.js';

/**
 * 用户偏好管理类
 * 提供用户偏好的存储和检索功能
 */
export class PreferenceManager {
  constructor(private db: InjectedDatabaseAdapter) {
    if (!db.isConnected()) {
      throw new DatabaseError('Database adapter is not connected');
    }
  }

  /**
   * 设置偏好
   */
  async set(input: PreferenceInput): Promise<Preference> {
    // 验证输入
    const validatedInput = PreferenceSchema.parse(input);

    try {
      // 使用 INSERT OR REPLACE 来实现 upsert 操作
      this.db.run(
        `INSERT OR REPLACE INTO preferences (key, value, category, description) 
         VALUES (?, ?, ?, ?)`,
        [
          validatedInput.key,
          JSON.stringify(validatedInput.value),
          validatedInput.category || null,
          validatedInput.description || null,
        ]
      );

      const created = await this.get(validatedInput.key);
      if (!created) {
        throw new DatabaseError('Failed to retrieve created preference');
      }

      return created;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof DatabaseError) {
        throw error;
      }
      throw new DatabaseError(`Failed to set preference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取偏好
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const row = await this.db.get<PreferenceRow>(
        'SELECT * FROM preferences WHERE key = ?',
        [key]
      );

      if (!row) {
        return null;
      }

      const preference = this.transformRow(row);
      return preference.value as T;
    } catch (error) {
      throw new DatabaseError(`Failed to get preference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取偏好对象（包含元数据）
   */
  async getPreference(key: string): Promise<Preference | null> {
    try {
      const row = await this.db.get<PreferenceRow>(
        'SELECT * FROM preferences WHERE key = ?',
        [key]
      );

      return row ? this.transformRow(row) : null;
    } catch (error) {
      throw new DatabaseError(`Failed to get preference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取带默认值的偏好
   */
  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key);
    return value !== null ? value : defaultValue;
  }

  /**
   * 获取所有偏好
   */
  async getAll(options: PreferenceQueryOptions = {}): Promise<Preference[]> {
    try {
      let sql = 'SELECT * FROM preferences';
      const params: any[] = [];
      const conditions: string[] = [];

      // 构建查询条件
      if (options.category) {
        conditions.push('category = ?');
        params.push(options.category);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      // 排序
      if (options.orderBy) {
        const direction = options.orderDirection || 'ASC';
        sql += ` ORDER BY ${options.orderBy} ${direction}`;
      } else {
        sql += ' ORDER BY key ASC';
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

      const rows = await this.db.all<PreferenceRow>(sql, params);
      return rows.map(row => this.transformRow(row));
    } catch (error) {
      throw new DatabaseError(`Failed to get all preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 根据分类获取偏好
   */
  async getByCategory(category: string, options: Omit<PreferenceQueryOptions, 'category'> = {}): Promise<Preference[]> {
    return await this.getAll({ ...options, category });
  }

  /**
   * 删除偏好
   */
  async remove(key: string): Promise<void> {
    try {
      const result = this.db.run('DELETE FROM preferences WHERE key = ?', [key]);
      
      if (result.changes === 0) {
        throw new NotFoundError('Preference', key);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError(`Failed to remove preference: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查偏好是否存在
   */
  async has(key: string): Promise<boolean> {
    return (await this.getPreference(key)) !== null;
  }

  /**
   * 获取所有偏好键
   */
  async getKeys(category?: string): Promise<string[]> {
    try {
      let sql = 'SELECT key FROM preferences';
      const params: any[] = [];

      if (category) {
        sql += ' WHERE category = ?';
        params.push(category);
      }

      sql += ' ORDER BY key ASC';

      const rows = await this.db.all<{ key: string }>(sql, params);
      return rows.map(row => row.key);
    } catch (error) {
      throw new DatabaseError(`Failed to get preference keys: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<string[]> {
    try {
      const rows = await this.db.all<{ category: string }>(
        'SELECT DISTINCT category FROM preferences WHERE category IS NOT NULL ORDER BY category ASC'
      );
      return rows.map(row => row.category);
    } catch (error) {
      throw new DatabaseError(`Failed to get categories: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 批量设置偏好
   */
  async setBatch(preferences: Record<string, any>, category?: string): Promise<Preference[]> {
    try {
      const results: Preference[] = [];

      // 使用事务来确保原子性
      this.db.transaction(() => {
        for (const [key, value] of Object.entries(preferences)) {
          this.db.run(
            `INSERT OR REPLACE INTO preferences (key, value, category) 
             VALUES (?, ?, ?)`,
            [key, JSON.stringify(value), category || null]
          );
        }
      });

      // 获取所有设置的偏好
      for (const key of Object.keys(preferences)) {
        const preference = await this.getPreference(key);
        if (preference) {
          results.push(preference);
        }
      }

      return results;
    } catch (error) {
      throw new DatabaseError(`Failed to set batch preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清空分类下的所有偏好
   */
  async clearCategory(category: string): Promise<number> {
    try {
      const result = this.db.run('DELETE FROM preferences WHERE category = ?', [category]);
      return result.changes || 0;
    } catch (error) {
      throw new DatabaseError(`Failed to clear category: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取偏好统计
   */
  async getStats(): Promise<Record<string, number>> {
    try {
      const total = (await this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM preferences'))?.count || 0;
      
      const categoryStats = await this.db.all<{ category: string; count: number }>(
        `SELECT COALESCE(category, 'uncategorized') as category, COUNT(*) as count 
         FROM preferences 
         GROUP BY category 
         ORDER BY count DESC`
      );

      const stats: Record<string, number> = { total };
      
      for (const stat of categoryStats) {
        stats[stat.category] = stat.count;
      }

      return stats;
    } catch (error) {
      throw new DatabaseError(`Failed to get preference stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 搜索偏好
   */
  async search(query: string, options: PreferenceQueryOptions = {}): Promise<Preference[]> {
    try {
      const searchQuery = `%${query.toLowerCase()}%`;
      
      let sql = `SELECT * FROM preferences 
                 WHERE LOWER(key) LIKE ? 
                    OR LOWER(description) LIKE ?`;
      
      const params: any[] = [searchQuery, searchQuery];

      // 添加分类过滤
      if (options.category) {
        sql += ' AND category = ?';
        params.push(options.category);
      }

      // 排序
      if (options.orderBy) {
        const direction = options.orderDirection || 'ASC';
        sql += ` ORDER BY ${options.orderBy} ${direction}`;
      } else {
        sql += ' ORDER BY key ASC';
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

      const rows = await this.db.all<PreferenceRow>(sql, params);
      return rows.map(row => this.transformRow(row));
    } catch (error) {
      throw new DatabaseError(`Failed to search preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 导出偏好为 JSON
   */
  async export(category?: string): Promise<Record<string, any>> {
    try {
      const preferences = category ? await this.getByCategory(category) : await this.getAll();
      const exported: Record<string, any> = {};

      for (const preference of preferences) {
        exported[preference.key] = preference.value;
      }

      return exported;
    } catch (error) {
      throw new DatabaseError(`Failed to export preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 从 JSON 导入偏好
   */
  async import(data: Record<string, any>, category?: string, overwrite = false): Promise<number> {
    try {
      let imported = 0;

      for (const [key, value] of Object.entries(data)) {
        // 如果不覆盖且键已存在，则跳过
        if (!overwrite && (await this.has(key))) {
          continue;
        }

        this.db.run(
          `INSERT OR REPLACE INTO preferences (key, value, category) 
           VALUES (?, ?, ?)`,
          [key, JSON.stringify(value), category || null]
        );
        imported++;
      }

      return imported;
    } catch (error) {
      throw new DatabaseError(`Failed to import preferences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 转换数据库行为领域对象
   */
  private transformRow(row: PreferenceRow): Preference {
    return {
      key: row.key,
      value: JSON.parse(row.value),
      category: row.category || undefined,
      description: row.description || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}