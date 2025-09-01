import { IChatSessionRepository } from '../../shared/interfaces/IRepository'
import { ChatSessionEntity } from '../../shared/entities/ChatSessionEntity'
import { LocalStorageService } from '../services/core/LocalStorageService'

export class FrontendChatSessionRepository implements IChatSessionRepository {
  private sessions: ChatSessionEntity[] = []
  private initialized = false

  constructor(private storageService: LocalStorageService) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    try {
      this.sessions = await this.storageService.loadChatSessions()
      this.initialized = true
      console.log(`已加载 ${this.sessions.length} 个聊天会话`)
    } catch (error) {
      console.error('初始化聊天会话仓储失败:', error)
      this.sessions = []
      this.initialized = true
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('仓储未初始化，请先调用 initialize()')
    }
  }

  async findAll(): Promise<ChatSessionEntity[]> {
    this.ensureInitialized()
    return [...this.sessions]
  }

  async findById(id: string): Promise<ChatSessionEntity | null> {
    this.ensureInitialized()
    return this.sessions.find(s => s.id === id) || null
  }

  async findRecent(limit: number): Promise<ChatSessionEntity[]> {
    this.ensureInitialized()
    return this.sessions
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit)
  }

  async save(session: ChatSessionEntity): Promise<void> {
    this.ensureInitialized()
    
    const index = this.sessions.findIndex(s => s.id === session.id)
    if (index >= 0) {
      // 更新现有会话
      this.sessions[index] = session
    } else {
      // 添加新会话
      this.sessions.push(session)
    }

    // 持久化到本地文件
    await this.storageService.saveChatSessions(this.sessions)
  }

  async delete(id: string): Promise<void> {
    this.ensureInitialized()
    
    const initialLength = this.sessions.length
    this.sessions = this.sessions.filter(s => s.id !== id)
    
    // 只有在实际删除了会话时才持久化
    if (this.sessions.length < initialLength) {
      await this.storageService.saveChatSessions(this.sessions)
    }
  }

  async updateSelectedModel(sessionId: string, modelId: string): Promise<void> {
    this.ensureInitialized()
    
    const session = this.sessions.find(s => s.id === sessionId)
    if (session) {
      session.switchModel(modelId)
      await this.storageService.saveChatSessions(this.sessions)
    }
  }

  async saveAll(sessions: ChatSessionEntity[]): Promise<void> {
    this.ensureInitialized()
    
    this.sessions = [...sessions]
    await this.storageService.saveChatSessions(this.sessions)
  }

  async deleteAll(): Promise<void> {
    this.ensureInitialized()
    
    this.sessions = []
    await this.storageService.saveChatSessions(this.sessions)
  }

  // 额外的便利方法
  async findByModelId(modelId: string): Promise<ChatSessionEntity[]> {
    this.ensureInitialized()
    return this.sessions.filter(s => s.selectedModelId === modelId)
  }

  async getSessionStats(): Promise<{
    total: number
    withMessages: number
    withSelectedModel: number
    averageMessages: number
  }> {
    this.ensureInitialized()
    
    const total = this.sessions.length
    const withMessages = this.sessions.filter(s => s.getMessageCount() > 0).length
    const withSelectedModel = this.sessions.filter(s => s.selectedModelId).length
    const totalMessages = this.sessions.reduce((sum, s) => sum + s.getMessageCount(), 0)
    const averageMessages = total > 0 ? totalMessages / total : 0

    return {
      total,
      withMessages,
      withSelectedModel,
      averageMessages
    }
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    this.ensureInitialized()
    
    const session = this.sessions.find(s => s.id === sessionId)
    if (session) {
      session.title = title
      session.updatedAt = new Date()
      await this.storageService.saveChatSessions(this.sessions)
    }
  }

  async clearMessages(sessionId: string): Promise<void> {
    this.ensureInitialized()
    
    const session = this.sessions.find(s => s.id === sessionId)
    if (session) {
      session.clearMessages()
      await this.storageService.saveChatSessions(this.sessions)
    }
  }
}
