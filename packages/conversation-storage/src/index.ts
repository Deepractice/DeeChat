import { InjectedDatabaseAdapter } from './database/injected-adapter.js';
import { SessionManager } from './session/manager.js';
import { MessageManager } from './message/manager.js';
import {
  ConversationStorageOptions,
  LegacyConversationStorageOptions,
  ConversationSession,
  ConversationMessage,
  CreateSessionInput,
  UpdateSessionInput,
  CreateMessageInput,
  SessionQueryOptions,
  MessageQueryOptions,
  ConversationStats,
  DatabaseError,
} from './types.js';
import { BetterSQLite3Adapter, DatabaseAdapter as ExternalDatabaseAdapter } from '@deepracticex/database-adapter';

/**
 * 对话存储管理器主类
 * 基于统一数据库文件的表管理模式设计
 * 专注于管理 sessions 和 messages 表
 */
export class ConversationStorage {
  private database: InjectedDatabaseAdapter;
  private _sessions: SessionManager | null = null;
  private _messages: MessageManager | null = null;
  private _initialized = false;
  private tablePrefix: string;

  constructor(private options: ConversationStorageOptions) {
    // 验证必需的数据库适配器
    if (!options.database) {
      throw new DatabaseError('Database adapter is required');
    }

    this.tablePrefix = options.tablePrefix || '';
    this.database = new InjectedDatabaseAdapter(options.database);
  }

  /**
   * 初始化对话存储管理器
   */
  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      await this.database.connect();
      
      // 执行数据库迁移，创建表结构
      await this.migrate();
      
      // 初始化管理器实例
      this._sessions = new SessionManager(this.database, this.tablePrefix);
      this._messages = new MessageManager(this.database, this.tablePrefix);

      this._initialized = true;
    } catch (error) {
      throw new DatabaseError(`Failed to initialize Conversation Storage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行数据库迁移
   */
  private async migrate(): Promise<void> {
    try {
      // 在ESM中获取当前文件路径
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');
      const { readFileSync } = await import('fs');
      
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      // 读取 schema 文件
      const schemaPath = join(__dirname, '../sql/schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      
      // 执行 schema  
      this.database.exec(schema);
    } catch (error) {
      throw new DatabaseError(`Database migration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============ 核心API ============

  /**
   * 创建会话
   */
  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    this.ensureInitialized();
    return this._sessions!.create(input);
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): ConversationSession | null {
    this.ensureInitialized();
    return this._sessions!.findById(sessionId);
  }

  /**
   * 获取所有会话
   */
  getSessions(options?: SessionQueryOptions): ConversationSession[] {
    this.ensureInitialized();
    return this._sessions!.findAll(options);
  }

  /**
   * 更新会话
   */
  async updateSession(sessionId: string, input: UpdateSessionInput): Promise<void> {
    this.ensureInitialized();
    await this._sessions!.update(sessionId, input);
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    await this._sessions!.delete(sessionId);
  }

  /**
   * 保存消息
   */
  saveMessage(input: CreateMessageInput): ConversationMessage {
    this.ensureInitialized();
    // 使用事务确保消息保存和计数更新的原子性
    return this.database.transaction(() => {
      const message = this._messages!.save(input);
      this._sessions!.updateMessageCount(input.session_id);
      return message;
    });
  }

  /**
   * 获取消息历史
   */
  getMessageHistory(sessionId: string, options?: MessageQueryOptions): ConversationMessage[] {
    this.ensureInitialized();
    return this._messages!.getMessageHistory(sessionId, options);
  }

  /**
   * 获取最近消息
   */
  getRecentMessages(sessionId: string, limit: number = 10): ConversationMessage[] {
    this.ensureInitialized();
    return this._messages!.getRecentMessages(sessionId, limit);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<ConversationStats> {
    this.ensureInitialized();

    try {
      // 获取会话总数
      const sessionResult = this.database.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM ${this.tablePrefix}sessions
      `);
      const totalSessions = sessionResult?.count || 0;

      // 获取消息总数
      const messageResult = this.database.get<{ count: number }>(`
        SELECT COUNT(*) as count FROM ${this.tablePrefix}messages
      `);
      const totalMessages = messageResult?.count || 0;

      // 获取按角色分组的消息数
      const messagesByRole = this._messages!.countByRole();

      return {
        total_sessions: totalSessions,
        total_messages: totalMessages,
        messages_by_role: messagesByRole as {
          user: number;
          assistant: number;
          system: number;
        },
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get stats: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取数据库健康状态
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; details: Record<string, any> } {
    if (!this._initialized) {
      return {
        status: 'unhealthy',
        details: { error: 'Conversation Storage not initialized' }
      };
    }

    const dbHealth = this.database.healthCheck();
    
    return {
      status: dbHealth.status,
      details: {
        ...dbHealth.details,
        tables_managed: ['sessions', 'messages'],
        table_prefix: this.tablePrefix
      }
    };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.database.isConnected()) {
      this.database.close();
    }
    this._initialized = false;
    this._sessions = null;
    this._messages = null;
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this._initialized) {
      throw new DatabaseError('Conversation Storage not initialized. Call initialize() first.');
    }
  }
}


// ============ 便利函数 ============

let globalStorage: ConversationStorage | null = null;

/**
 * 初始化全局对话存储管理器（新版本 - 使用依赖注入）
 */
export async function initializeConversationStorage(options: ConversationStorageOptions): Promise<ConversationStorage>;
/**
 * 初始化全局对话存储管理器（向后兼容版本）
 * @deprecated 使用新的依赖注入方式替代
 */
export async function initializeConversationStorage(dbPath: string, options?: Omit<LegacyConversationStorageOptions, 'dbPath'>): Promise<ConversationStorage>;
export async function initializeConversationStorage(
  optionsOrDbPath: ConversationStorageOptions | string,
  legacyOptions?: Omit<LegacyConversationStorageOptions, 'dbPath'>
): Promise<ConversationStorage> {
  if (globalStorage) {
    return globalStorage;
  }

  let storage: ConversationStorage;

  if (typeof optionsOrDbPath === 'string') {
    // 向后兼容：使用旧的初始化方式
    const dbPath = optionsOrDbPath;
    const dbAdapter = new BetterSQLite3Adapter(dbPath, {
      readonly: legacyOptions?.readonly || false,
    });

    storage = new ConversationStorage({
      database: dbAdapter,
      tablePrefix: legacyOptions?.tablePrefix,
      autoMigrate: true
    });
  } else {
    // 新方式：直接使用传入的选项
    storage = new ConversationStorage(optionsOrDbPath);
  }

  globalStorage = storage;
  await globalStorage.initialize();
  return globalStorage;
}

/**
 * 获取全局对话存储管理器
 */
export function getConversationStorage(): ConversationStorage {
  if (!globalStorage) {
    throw new DatabaseError('Conversation Storage not initialized. Call initializeConversationStorage() first.');
  }
  return globalStorage;
}

/**
 * 关闭全局对话存储管理器
 */
export function closeConversationStorage(): void {
  if (globalStorage) {
    globalStorage.close();
    globalStorage = null;
  }
}

// ============ 导出类型 ============

export * from './types.js';
export { InjectedDatabaseAdapter } from './database/injected-adapter.js';
export { SessionManager } from './session/manager.js';
export { MessageManager } from './message/manager.js';
export { BetterSQLite3Adapter, DatabaseAdapter as ExternalDatabaseAdapter } from '@deepracticex/database-adapter';