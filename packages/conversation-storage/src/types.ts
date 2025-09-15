import { z } from 'zod';

// === 基础数据库实体类型 ===

// 对话会话表
export interface ConversationSession {
  id: string;
  title: string;
  ai_config_name: string;
  created_at: string;                  // ISO格式时间戳
  updated_at: string;                  // ISO格式时间戳  
  message_count: number;
}

// 对话消息表
export interface ConversationMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;                   // ISO格式时间戳
  token_usage?: TokenUsage;            // 可选的token使用统计
}

// Token使用统计
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// === 数据库原始行类型（JSON 字段为字符串）===

export interface ConversationSessionRow {
  id: string;
  title: string;
  ai_config_name: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  timestamp: string;
  token_usage?: string;                // JSON 字符串
}

// === 输入/输出 Schema ===

// 创建会话输入
export const CreateSessionSchema = z.object({
  title: z.string().min(1, '会话标题不能为空'),
  ai_config_name: z.string().min(1, 'AI配置名称不能为空'),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// 更新会话输入
export const UpdateSessionSchema = CreateSessionSchema.partial();
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

// 创建消息输入
export const CreateMessageSchema = z.object({
  session_id: z.string().min(1, '会话ID不能为空'),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, '消息内容不能为空'),
  token_usage: z.object({
    prompt_tokens: z.number().min(0),
    completion_tokens: z.number().min(0),
    total_tokens: z.number().min(0),
  }).optional(),
});

export type CreateMessageInput = z.infer<typeof CreateMessageSchema>;

// === 查询选项 ===

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface SessionQueryOptions extends QueryOptions {
  ai_config_name?: string;
}

export interface MessageQueryOptions extends QueryOptions {
  session_id?: string;
  role?: 'user' | 'assistant' | 'system';
}

// === 错误类型 ===

export class ConversationStorageError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'ConversationStorageError';
  }
}

export class ValidationError extends ConversationStorageError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends ConversationStorageError {
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`, 'NOT_FOUND_ERROR');
  }
}

export class DatabaseError extends ConversationStorageError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', details);
  }
}

// === 配置选项 ===

export interface ConversationStorageOptions {
  database: import('@deepracticex/database-adapter').DatabaseAdapter;  // 必需：注入的数据库适配器
  tablePrefix?: string;                // 可选：表前缀
  autoMigrate?: boolean;               // 可选：自动迁移表结构
}

// 向后兼容的选项（已废弃）
/** @deprecated 使用新的依赖注入方式替代 */
export interface LegacyConversationStorageOptions {
  dbPath: string;                      // 必需：数据库文件路径
  tablePrefix?: string;                // 可选：表前缀
  readonly?: boolean;                  // 可选：只读模式
}

// === 统计信息类型 ===

export interface ConversationStats {
  total_sessions: number;              // 总会话数
  total_messages: number;              // 总消息数
  messages_by_role: {                  // 按角色分组的消息数
    user: number;
    assistant: number;
    system: number;
  };
}