import { ModelConfigEntity, TestResult, ChatSessionEntity, UserPreferenceEntity, LLMRequest, LLMResponse, ModelConfigTemplate, ApiResponse } from './index'

// IPC事件类型定义
export interface IpcEvents {
  // 模型管理相关
  'model:getAll': () => Promise<ApiResponse<ModelConfigEntity[]>>
  'model:getById': (id: string) => Promise<ApiResponse<ModelConfigEntity | null>>
  'model:save': (config: ModelConfigEntity) => Promise<ApiResponse<void>>
  'model:delete': (id: string) => Promise<ApiResponse<void>>
  'model:test': (id: string) => Promise<ApiResponse<TestResult>>
  'model:testAll': () => Promise<ApiResponse<Map<string, TestResult>>>
  'model:toggleEnabled': (id: string) => Promise<ApiResponse<boolean>>
  
  // 会话管理相关
  'session:getAll': () => Promise<ApiResponse<ChatSessionEntity[]>>
  'session:getById': (id: string) => Promise<ApiResponse<ChatSessionEntity | null>>
  'session:save': (session: ChatSessionEntity) => Promise<ApiResponse<void>>
  'session:delete': (id: string) => Promise<ApiResponse<void>>
  'session:switchModel': (sessionId: string, modelId: string) => Promise<ApiResponse<void>>
  'session:getModel': (sessionId: string) => Promise<ApiResponse<ModelConfigEntity | null>>
  'session:create': (title?: string) => Promise<ApiResponse<ChatSessionEntity>>
  
  // 消息发送相关
  'message:send': (sessionId: string, request: LLMRequest, modelId?: string) => Promise<ApiResponse<LLMResponse>>
  
  // 用户偏好相关
  'preference:get': () => Promise<ApiResponse<UserPreferenceEntity>>
  'preference:save': (preferences: Partial<UserPreferenceEntity>) => Promise<ApiResponse<void>>
  'preference:setStrategy': (strategy: 'remember_last' | 'priority' | 'manual') => Promise<ApiResponse<void>>
  'preference:setDefaultModel': (modelId: string) => Promise<ApiResponse<void>>
  
  // 提供商相关
  'provider:getTemplates': () => Promise<ApiResponse<Map<string, ModelConfigTemplate>>>
  'provider:getSupportedModels': (provider: string) => Promise<ApiResponse<string[]>>
  'provider:getStrategies': () => Promise<ApiResponse<Array<{ name: string; description: string }>>>
  'provider:validateConfig': (config: ModelConfigEntity) => Promise<ApiResponse<boolean>>
  
  // 数据管理相关
  'data:backup': () => Promise<ApiResponse<string>>
  'data:clear': () => Promise<ApiResponse<void>>
  'data:getInfo': () => Promise<ApiResponse<{
    configs: { exists: boolean; size: number; lastModified: Date | null }
    sessions: { exists: boolean; size: number; lastModified: Date | null }
    preferences: { exists: boolean; size: number; lastModified: Date | null }
  }>>
}

// 渲染进程API接口
export interface ElectronAPI {
  model: {
    getAll: () => Promise<ApiResponse<ModelConfigEntity[]>>
    getById: (id: string) => Promise<ApiResponse<ModelConfigEntity | null>>
    save: (config: ModelConfigEntity) => Promise<ApiResponse<void>>
    delete: (id: string) => Promise<ApiResponse<void>>
    test: (id: string) => Promise<ApiResponse<TestResult>>
    testAll: () => Promise<ApiResponse<Map<string, TestResult>>>
    toggleEnabled: (id: string) => Promise<ApiResponse<boolean>>
  }
  
  session: {
    getAll: () => Promise<ApiResponse<ChatSessionEntity[]>>
    getById: (id: string) => Promise<ApiResponse<ChatSessionEntity | null>>
    save: (session: ChatSessionEntity) => Promise<ApiResponse<void>>
    delete: (id: string) => Promise<ApiResponse<void>>
    switchModel: (sessionId: string, modelId: string) => Promise<ApiResponse<void>>
    getModel: (sessionId: string) => Promise<ApiResponse<ModelConfigEntity | null>>
    create: (title?: string) => Promise<ApiResponse<ChatSessionEntity>>
  }
  
  message: {
    send: (sessionId: string, request: LLMRequest, modelId?: string) => Promise<ApiResponse<LLMResponse>>
  }
  
  preference: {
    get: () => Promise<ApiResponse<UserPreferenceEntity>>
    save: (preferences: Partial<UserPreferenceEntity>) => Promise<ApiResponse<void>>
    setStrategy: (strategy: 'remember_last' | 'priority' | 'manual') => Promise<ApiResponse<void>>
    setDefaultModel: (modelId: string) => Promise<ApiResponse<void>>
  }
  
  provider: {
    getTemplates: () => Promise<ApiResponse<Map<string, ModelConfigTemplate>>>
    getSupportedModels: (provider: string) => Promise<ApiResponse<string[]>>
    getStrategies: () => Promise<ApiResponse<Array<{ name: string; description: string }>>>
    validateConfig: (config: ModelConfigEntity) => Promise<ApiResponse<boolean>>
  }
  
  data: {
    backup: () => Promise<ApiResponse<string>>
    clear: () => Promise<ApiResponse<void>>
    getInfo: () => Promise<ApiResponse<{
      configs: { exists: boolean; size: number; lastModified: Date | null }
      sessions: { exists: boolean; size: number; lastModified: Date | null }
      preferences: { exists: boolean; size: number; lastModified: Date | null }
    }>>
  }
}

// Window接口扩展已在 src/renderer/src/types/global.d.ts 中定义
// 避免重复声明

// IPC处理器类型
export type IpcHandler<T extends keyof IpcEvents> = (
  event: any, // 暂时使用any类型避免Electron命名空间问题
  ...args: Parameters<IpcEvents[T]>
) => ReturnType<IpcEvents[T]>

// IPC错误类型
export class IpcError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message)
    this.name = 'IpcError'
  }
}

// IPC响应包装器
export function createApiResponse<T>(data?: T, error?: string): ApiResponse<T> {
  return {
    success: !error,
    data,
    error,
    message: error ? `操作失败: ${error}` : '操作成功'
  }
}

// IPC错误处理器
export function handleIpcError(error: unknown): ApiResponse<undefined> {
  if (error instanceof Error) {
    return createApiResponse(undefined, error.message)
  }
  return createApiResponse(undefined, '未知错误')
}
