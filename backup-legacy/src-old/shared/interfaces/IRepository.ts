import { ModelConfigEntity } from '../entities/ModelConfigEntity'
import { ChatSessionEntity } from '../entities/ChatSessionEntity'
import { UserPreferenceEntity } from '../entities/UserPreferenceEntity'

// 模型配置仓储接口
export interface IModelConfigRepository {
  // 查询操作
  findAll(): Promise<ModelConfigEntity[]>
  findById(id: string): Promise<ModelConfigEntity | null>
  findByProvider(provider: string): Promise<ModelConfigEntity[]>
  findEnabled(): Promise<ModelConfigEntity[]>
  findByStatus(status: string): Promise<ModelConfigEntity[]>
  
  // 修改操作
  save(config: ModelConfigEntity): Promise<void>
  delete(id: string): Promise<void>
  updateStatus(id: string, status: string, errorMessage?: string): Promise<void>
  
  // 批量操作
  saveAll(configs: ModelConfigEntity[]): Promise<void>
  deleteAll(): Promise<void>
  
  // 初始化
  initialize(): Promise<void>
}

// 聊天会话仓储接口
export interface IChatSessionRepository {
  // 查询操作
  findAll(): Promise<ChatSessionEntity[]>
  findById(id: string): Promise<ChatSessionEntity | null>
  findRecent(limit: number): Promise<ChatSessionEntity[]>
  
  // 修改操作
  save(session: ChatSessionEntity): Promise<void>
  delete(id: string): Promise<void>
  updateSelectedModel(sessionId: string, modelId: string): Promise<void>
  
  // 批量操作
  saveAll(sessions: ChatSessionEntity[]): Promise<void>
  deleteAll(): Promise<void>
  
  // 初始化
  initialize(): Promise<void>
}

// 用户偏好仓储接口
export interface IUserPreferenceRepository {
  // 查询操作
  get(): Promise<UserPreferenceEntity>
  
  // 修改操作
  save(preferences: UserPreferenceEntity): Promise<void>
  updateLastSelected(modelId: string): Promise<void>
  setDefaultModel(modelId: string): Promise<void>
  
  // 初始化
  initialize(): Promise<void>
}
