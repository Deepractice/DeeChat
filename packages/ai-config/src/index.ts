import { InjectedDatabaseAdapter } from './database/injected-adapter.js';
import { ConfigManager } from './configs/index.js';
import { PreferenceManager } from './preferences/index.js';
import { ConfigStats, DatabaseError, AIConfigManagerOptions, LegacyAIConfigManagerOptions } from './types.js';
import { BetterSQLite3Adapter, DatabaseAdapter as ExternalDatabaseAdapter } from '@deepracticex/database-adapter';

/**
 * AI 配置管理器主类（简化版）
 * 基于"如非必要，勿增实体"原则设计
 * 移除了复杂的供应商管理，专注于核心的配置和偏好管理
 */
export class AIConfigManager {
  private database: InjectedDatabaseAdapter;
  private _configs: ConfigManager | null = null;
  private _preferences: PreferenceManager | null = null;
  private _initialized = false;
  private tablePrefix: string;

  constructor(private options: AIConfigManagerOptions) {
    // 验证必需的数据库适配器
    if (!options.database) {
      throw new DatabaseError('Database adapter is required');
    }

    this.tablePrefix = options.tablePrefix || '';
    this.database = new InjectedDatabaseAdapter(options.database);
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      await this.database.connect();
      
      // 初始化管理器实例
      this._configs = new ConfigManager(this.database);
      this._preferences = new PreferenceManager(this.database);

      this._initialized = true;
    } catch (error) {
      throw new DatabaseError(`Failed to initialize AI Config Manager: ${error instanceof Error ? error.message : String(error)}`);
    }
  }


  /**
   * 获取配置管理器
   */
  get configs(): ConfigManager {
    this.ensureInitialized();
    return this._configs!;
  }

  /**
   * 获取偏好管理器
   */
  get preferences(): PreferenceManager {
    this.ensureInitialized();
    return this._preferences!;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * 获取配置统计信息
   */
  async getStats(): Promise<ConfigStats> {
    this.ensureInitialized();

    try {
      const total_configs = await this.configs.count();
      const active_configs = await this.configs.count({ is_active: true });
      const default_configs = await this.configs.count({ is_default: true });
      const preferenceStats = await this.preferences.getStats();
      const total_preferences = preferenceStats.total;

      return {
        total_configs,
        active_configs,
        default_configs,
        total_preferences,
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 备份数据库
   */
  async backup(backupPath?: string): Promise<string> {
    this.ensureInitialized();
    return this.database.backup(backupPath);
  }

  /**
   * 获取数据库健康状态
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; details: Record<string, any> } {
    if (!this._initialized) {
      return {
        status: 'unhealthy',
        details: { error: 'AI Config Manager not initialized' }
      };
    }

    return this.database.healthCheck();
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.database.isConnected()) {
      this.database.close();
    }
    this._initialized = false;
    this._configs = null;
    this._preferences = null;
  }

  /**
   * 获取数据库适配器实例（高级用法）
   */
  getDatabase(): InjectedDatabaseAdapter {
    this.ensureInitialized();
    return this.database;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new DatabaseError('AI Config Manager not initialized. Call initialize() first.');
    }
  }
}

// ============ 便利函数 ============

let globalManager: AIConfigManager | null = null;

/**
 * 初始化全局 AI 配置管理器（新版本 - 使用依赖注入）
 */
export async function initializeAIConfig(options: AIConfigManagerOptions): Promise<AIConfigManager>;
/**
 * 初始化全局 AI 配置管理器（向后兼容版本）
 * @deprecated 使用新的依赖注入方式替代
 */
export async function initializeAIConfig(dbPath: string, options?: Omit<LegacyAIConfigManagerOptions, 'dbPath'>): Promise<AIConfigManager>;
export async function initializeAIConfig(
  optionsOrDbPath: AIConfigManagerOptions | string,
  legacyOptions?: Omit<LegacyAIConfigManagerOptions, 'dbPath'>
): Promise<AIConfigManager> {
  if (globalManager) {
    return globalManager;
  }

  let manager: AIConfigManager;

  if (typeof optionsOrDbPath === 'string') {
    // 向后兼容：使用旧的初始化方式
    const dbPath = optionsOrDbPath;
    const dbAdapter = new BetterSQLite3Adapter(dbPath, {
      readonly: legacyOptions?.readonly || false,
    });

    manager = new AIConfigManager({
      database: dbAdapter,
      tablePrefix: legacyOptions?.tablePrefix,
      autoMigrate: true
    });
  } else {
    // 新方式：直接使用传入的选项
    manager = new AIConfigManager(optionsOrDbPath);
  }

  globalManager = manager;
  await globalManager.initialize();
  return globalManager;
}

/**
 * 获取全局 AI 配置管理器
 */
export function getAIConfigManager(): AIConfigManager {
  if (!globalManager) {
    throw new DatabaseError('AI Config Manager not initialized. Call initializeAIConfig() first.');
  }
  return globalManager;
}

/**
 * 关闭全局 AI 配置管理器
 */
export function closeAIConfig(): void {
  if (globalManager) {
    globalManager.close();
    globalManager = null;
  }
}

// ============ 快捷函数 ============

/**
 * 创建AI配置
 */
export async function createConfig(input: import('./types').CreateAIConfigInput): Promise<import('./types').AIConfig> {
  const manager = getAIConfigManager();
  return manager.configs.create(input);
}

/**
 * 根据ID获取配置
 */
export async function getConfigById(id: number): Promise<import('./types').AIConfig | null> {
  const manager = getAIConfigManager();
  return await manager.configs.findById(id);
}

/**
 * 根据名称获取配置
 */
export async function getConfigByName(name: string): Promise<import('./types').AIConfig | null> {
  const manager = getAIConfigManager();
  return await manager.configs.findByName(name);
}

/**
 * 获取默认配置
 */
export async function getDefaultConfig(): Promise<import('./types').AIConfig | null> {
  const manager = getAIConfigManager();
  return await manager.configs.findDefault();
}

/**
 * 获取所有配置
 */
export async function getAllConfigs(options?: import('./types').AIConfigQueryOptions): Promise<import('./types').AIConfig[]> {
  const manager = getAIConfigManager();
  return await manager.configs.findAll(options);
}

/**
 * 设置偏好
 */
export async function setPreference(key: string, value: any, category?: string, description?: string): Promise<import('./types').Preference> {
  const manager = getAIConfigManager();
  return manager.preferences.set({ key, value, category, description });
}

/**
 * 获取偏好
 */
export async function getPreference<T = any>(key: string, defaultValue?: T): Promise<T | null> {
  const manager = getAIConfigManager();
  return defaultValue !== undefined 
    ? await manager.preferences.getWithDefault(key, defaultValue)
    : await manager.preferences.get<T>(key);
}

// ============ 向后兼容的函数 ============
// 为了支持现有代码，保留一些旧的函数签名

/** @deprecated 使用 createConfig 替代 */
export async function createConfig_legacy(input: import('./types').CreateConfigInput): Promise<import('./types').Config> {
  // 适配旧的输入格式到新的格式
  const newInput: import('./types').CreateAIConfigInput = {
    name: (input as any).config_name || `${(input as any).provider_code}-config`,
    api_key: ((input as any).config_data as any)?.apiKey || ((input as any).config_data as any)?.api_key || '',
    base_url: ((input as any).config_data as any)?.baseUrl || ((input as any).config_data as any)?.base_url || '',
    is_default: (input as any).is_default,
    is_active: (input as any).is_active,
  };
  
  return createConfig(newInput) as any;
}

/** @deprecated 使用 getConfigByName 替代 */
export function getConfig(provider_code: string, config_name?: string): import('./types').Config | null {
  const manager = getAIConfigManager();
  if (config_name) {
    return manager.configs.findByName(config_name) as any;
  } else {
    return manager.configs.findDefault() as any;
  }
}

// ============ 导出所有类型 ============

export * from './types.js';
export { InjectedDatabaseAdapter } from './database/injected-adapter.js';
export { ConfigManager } from './configs/index.js';
export { PreferenceManager } from './preferences/index.js';
export { BetterSQLite3Adapter, DatabaseAdapter as ExternalDatabaseAdapter } from '@deepracticex/database-adapter';