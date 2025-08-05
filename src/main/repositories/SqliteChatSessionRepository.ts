import { IChatSessionRepository } from '../../shared/interfaces/IRepository';
import { ChatSessionEntity, ChatSessionData } from '../../shared/entities/ChatSessionEntity';
import { MinimalDatabaseService } from '../services/core/MinimalDatabaseService';

/**
 * SQLite聊天会话仓储实现 - 奥卡姆剃刀原则
 * 
 * 设计要点：
 * 1. 保持与FrontendChatSessionRepository相同的接口
 * 2. 用SQLite替换JSON存储，其他逻辑不变
 * 3. 高性能批量操作和查询优化
 */
export class SqliteChatSessionRepository implements IChatSessionRepository {
  private initialized = false;
  
  // 预编译语句缓存 - 性能优化核心
  private statements = {
    findAll: null as any,
    findById: null as any,
    findRecent: null as any,
    insert: null as any,
    update: null as any,
    delete: null as any,
    updateSelectedModel: null as any,
    findByModelId: null as any,
    getStats: null as any,
    updateTitle: null as any
  };

  constructor(private databaseService: MinimalDatabaseService) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // 预编译所有常用语句 - 显著提升性能
      this.statements.findAll = this.databaseService.getDatabase().prepare(`
        SELECT * FROM chat_sessions ORDER BY updated_at DESC
      `);
      
      this.statements.findById = this.databaseService.getDatabase().prepare(`
        SELECT * FROM chat_sessions WHERE id = ?
      `);
      
      this.statements.findRecent = this.databaseService.getDatabase().prepare(`
        SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?
      `);
      
      this.statements.insert = this.databaseService.getDatabase().prepare(`
        INSERT OR REPLACE INTO chat_sessions 
        (id, title, selected_model_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?)
      `);
      
      this.statements.delete = this.databaseService.getDatabase().prepare(`
        DELETE FROM chat_sessions WHERE id = ?
      `);
      
      this.statements.updateSelectedModel = this.databaseService.getDatabase().prepare(`
        UPDATE chat_sessions SET selected_model_id = ?, updated_at = ? WHERE id = ?
      `);
      
      this.statements.findByModelId = this.databaseService.getDatabase().prepare(`
        SELECT * FROM chat_sessions WHERE selected_model_id = ?
      `);
      
      this.statements.getStats = this.databaseService.getDatabase().prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN (SELECT COUNT(*) FROM chat_messages WHERE session_id = chat_sessions.id) > 0 THEN 1 END) as withMessages,
          COUNT(CASE WHEN selected_model_id IS NOT NULL THEN 1 END) as withSelectedModel,
          COALESCE(AVG((SELECT COUNT(*) FROM chat_messages WHERE session_id = chat_sessions.id)), 0) as averageMessages
        FROM chat_sessions
      `);
      
      this.statements.updateTitle = this.databaseService.getDatabase().prepare(`
        UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?
      `);
      
      this.initialized = true;
      console.log('✅ SqliteChatSessionRepository初始化完成');
    } catch (error) {
      console.error('❌ 初始化SQLite聊天会话仓储失败:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('仓储未初始化，请先调用 initialize()');
    }
  }

  async findAll(): Promise<ChatSessionEntity[]> {
    this.ensureInitialized();
    const rows = this.statements.findAll.all();
    return rows.map((row: any) => this.rowToEntity(row));
  }

  async findById(id: string): Promise<ChatSessionEntity | null> {
    this.ensureInitialized();
    const row = this.statements.findById.get(id);
    return row ? this.rowToEntity(row) : null;
  }

  async findRecent(limit: number): Promise<ChatSessionEntity[]> {
    this.ensureInitialized();
    const rows = this.statements.findRecent.all(limit);
    return rows.map((row: any) => this.rowToEntity(row));
  }

  async save(session: ChatSessionEntity): Promise<void> {
    this.ensureInitialized();
    
    const timestamp = Date.now();
    this.statements.insert.run(
      session.id,
      session.title,
      session.selectedModelId,
      session.createdAt.getTime(),
      timestamp
    );
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized();
    this.statements.delete.run(id);
  }

  async updateSelectedModel(sessionId: string, modelId: string): Promise<void> {
    this.ensureInitialized();
    const timestamp = Date.now();
    this.statements.updateSelectedModel.run(modelId, timestamp, sessionId);
  }

  async saveAll(sessions: ChatSessionEntity[]): Promise<void> {
    this.ensureInitialized();
    
    // 事务批量保存 - 性能优化
    this.databaseService.getDatabase().transaction(() => {
      for (const session of sessions) {
        this.statements.insert.run(
          session.id,
          session.title,
          session.selectedModelId,
          session.createdAt.getTime(),
          session.updatedAt.getTime()
        );
      }
    });
  }

  async deleteAll(): Promise<void> {
    this.ensureInitialized();
    this.databaseService.getDatabase().prepare('DELETE FROM chat_sessions').run();
  }

  // === 业务方法实现 ===

  async findByModelId(modelId: string): Promise<ChatSessionEntity[]> {
    this.ensureInitialized();
    const rows = this.statements.findByModelId.all(modelId);
    return rows.map((row: any) => this.rowToEntity(row));
  }

  async getSessionStats(): Promise<{
    total: number;
    withMessages: number;
    withSelectedModel: number;
    averageMessages: number;
  }> {
    this.ensureInitialized();
    return this.statements.getStats.get();
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    this.ensureInitialized();
    const timestamp = Date.now();
    this.statements.updateTitle.run(title, timestamp, sessionId);
  }

  async clearMessages(sessionId: string): Promise<void> {
    this.ensureInitialized();
    // 由于消息表有外键约束，直接删除即可
    this.databaseService.getDatabase().prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
  }

  // === 私有工具方法 ===

  private rowToEntity(row: any): ChatSessionEntity {
    const data: ChatSessionData = {
      id: row.id,
      title: row.title,
      selectedModelId: row.selected_model_id,
      messages: [], // 按需加载消息
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
    
    return new ChatSessionEntity(data);
  }
}