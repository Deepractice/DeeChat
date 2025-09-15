import { z } from 'zod';

// === 基础数据库实体类型 ===

// AI 配置表
export interface AIConfig {
  id: number;
  name: string;                    // 用户自定义名称：\"我的ChatGPT\"、\"公司API\"
  api_key: string;                 // API密钥
  base_url: string;                // API服务地址
  is_default: boolean;             // 是否为默认配置
  is_active: boolean;              // 是否启用
  created_at: string;
  updated_at: string;
}

// 用户偏好表
export interface Preference {
  key: string;                     // 偏好键：如\"default_temperature\"、\"ui_theme\"
  value: any;                      // 偏好值 (JSON格式)
  category?: string;               // 分类：ui、ai、general等
  description?: string;            // 描述
  created_at: string;
  updated_at: string;
}

// === 数据库原始行类型（JSON 字段为字符串）===

export interface AIConfigRow {
  id: number;
  name: string;
  api_key: string;
  base_url: string;
  is_default: number;              // SQLite 中的 boolean
  is_active: number;               // SQLite 中的 boolean
  created_at: string;
  updated_at: string;
}

export interface PreferenceRow {
  key: string;
  value: string;                   // JSON 字符串
  category?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

// === 输入/输出 Schema ===

// AI 配置创建输入
export const CreateAIConfigSchema = z.object({
  name: z.string().min(1, '配置名称不能为空'),
  api_key: z.string().min(1, 'API密钥不能为空'),
  base_url: z.string().url('请输入有效的API地址'),
  is_default: z.boolean().default(false).optional(),
  is_active: z.boolean().default(true).optional(),
});

export type CreateAIConfigInput = z.input<typeof CreateAIConfigSchema>;

// AI 配置更新输入
export const UpdateAIConfigSchema = CreateAIConfigSchema.partial();
export type UpdateAIConfigInput = z.infer<typeof UpdateAIConfigSchema>;

// 偏好设置输入
export const PreferenceSchema = z.object({
  key: z.string().min(1, '偏好键不能为空'),
  value: z.any(),
  category: z.string().optional(),
  description: z.string().optional(),
});

export type PreferenceInput = z.infer<typeof PreferenceSchema>;

// === 查询选项 ===

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface AIConfigQueryOptions extends QueryOptions {
  is_active?: boolean;
  is_default?: boolean;
}

export interface PreferenceQueryOptions extends QueryOptions {
  category?: string;
}

// === 错误类型 ===

export class AIConfigError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'AIConfigError';
  }
}

export class ValidationError extends AIConfigError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AIConfigError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 'NOT_FOUND_ERROR');
  }
}

export class DatabaseError extends AIConfigError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', details);
  }
}

// === 统计信息类型 ===

export interface ConfigStats {
  total_configs: number;           // 总配置数
  active_configs: number;          // 活跃配置数
  default_configs: number;         // 默认配置数
  total_preferences: number;       // 总偏好设置数
}

// === 数据库连接选项 ===

export interface DatabaseOptions {
  database_path: string;           // 必需：数据库路径
  auto_migrate?: boolean;          // 自动迁移数据库
  backup_enabled?: boolean;        // 启用备份
  readonly?: boolean;              // 只读模式
}

// === AI配置管理器选项 ===

export interface AIConfigManagerOptions {
  database: import('@deepracticex/database-adapter').DatabaseAdapter;  // 必需：注入的数据库适配器
  tablePrefix?: string;            // 可选：表前缀
  autoMigrate?: boolean;           // 可选：自动迁移表结构
}

// 向后兼容的选项（已废弃）
/** @deprecated 使用新的依赖注入方式替代 */
export interface LegacyAIConfigManagerOptions {
  dbPath: string;                  // 必需：数据库文件路径
  tablePrefix?: string;            // 可选：表前缀
  readonly?: boolean;              // 可选：只读模式
}

// === 向后兼容的类型别名 ===
// 为了与现有代码保持兼容，保留一些旧的类型名称

/** @deprecated 使用 AIConfig 替代 */
export type Config = AIConfig;

/** @deprecated 使用 CreateAIConfigInput 替代 */
export type CreateConfigInput = CreateAIConfigInput;

/** @deprecated 使用 UpdateAIConfigInput 替代 */
export type UpdateConfigInput = UpdateAIConfigInput;

/** @deprecated 使用 AIConfigQueryOptions 替代 */
export type ConfigQueryOptions = AIConfigQueryOptions;

/** @deprecated 使用 CreateAIConfigSchema 替代 */
export const CreateConfigSchema = CreateAIConfigSchema;

/** @deprecated 使用 UpdateAIConfigSchema 替代 */
export const UpdateConfigSchema = UpdateAIConfigSchema;