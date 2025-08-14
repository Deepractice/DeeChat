/**
 * 工作区文件引用模式类型定义
 * 采用引用模式，不复制文件，只记录路径信息
 */

export interface WorkspaceFileReference {
  /** 工作区唯一标识符 */
  id: string
  
  /** 文件来源类型 */
  sourceType: WorkspaceFileSourceType
  
  /** 源文件的绝对路径 */
  originalPath: string
  
  /** 在工作区中显示的名称 */
  displayName: string
  
  /** 源文件名称 */
  fileName: string
  
  /** 文件大小(字节) */
  fileSize: number
  
  /** 文件MIME类型 */
  mimeType: string
  
  /** 文件扩展名 */
  extension: string
  
  /** 添加到工作区的时间 */
  addedAt: Date
  
  /** 最后访问时间 */
  lastAccessed: Date
  
  /** 文件状态 */
  status: WorkspaceFileStatus
  
  /** 文件内容哈希(用于检测变更) */
  contentHash?: string
  
  /** 用户添加的标签 */
  tags?: string[]
  
  /** 用户备注 */
  note?: string
  
  /** AI生成文件的额外信息 */
  aiGeneratedInfo?: AIGeneratedFileInfo
}

export enum WorkspaceFileSourceType {
  /** 用户拖拽的文件(引用模式) */
  USER_REFERENCE = 'user_reference',
  
  /** AI生成的文件(存储模式) */
  AI_GENERATED = 'ai_generated',
  
  /** 临时文件(存储模式，自动清理) */
  TEMPORARY = 'temporary'
}

export enum WorkspaceFileStatus {
  /** 文件可用 */
  AVAILABLE = 'available',
  
  /** 文件不存在或已移动 */
  MISSING = 'missing',
  
  /** 文件已被修改 */
  CHANGED = 'changed',
  
  /** 无权限访问 */
  ACCESS_DENIED = 'access_denied',
  
  /** 生成中(仅限AI生成文件) */
  GENERATING = 'generating'
}

export interface AIGeneratedFileInfo {
  /** 生成来源 */
  generatedBy: 'ai_chat' | 'mcp_tool' | 'manual_create'
  
  /** 生成时的提示词或指令 */
  prompt?: string
  
  /** 生成时的模型信息 */
  modelInfo?: {
    modelId: string
    modelName: string
  }
  
  /** 是否为临时文件 */
  isTemporary: boolean
  
  /** 临时文件的过期时间 */
  expiresAt?: Date
  
  /** 生成过程ID（用于追溯） */
  generationId?: string
}

export interface WorkspaceFileInfo {
  /** 文件路径 */
  path: string
  
  /** 文件是否存在 */
  exists: boolean
  
  /** 文件大小 */
  size: number
  
  /** 最后修改时间 */
  modifiedAt: Date
  
  /** 是否可读 */
  readable: boolean
  
  /** 内容哈希 */
  contentHash: string
}

export interface AddFileToWorkspaceRequest {
  /** 源文件路径 */
  filePath: string
  
  /** 文件来源类型 */
  sourceType: WorkspaceFileSourceType
  
  /** 工作区显示名称(可选，默认使用文件名) */
  displayName?: string
  
  /** 用户标签 */
  tags?: string[]
  
  /** 用户备注 */
  note?: string
  
  /** AI生成文件的额外信息(仅当sourceType为AI_GENERATED时) */
  aiGeneratedInfo?: AIGeneratedFileInfo
}

export interface CreateAIFileRequest {
  /** 文件名称 */
  fileName: string
  
  /** 文件内容 */
  content: string
  
  /** 文件类型 */
  fileType?: string
  
  /** 生成信息 */
  generatedInfo: {
    generatedBy: 'ai_chat' | 'mcp_tool' | 'manual_create'
    prompt?: string
    modelInfo?: {
      modelId: string
      modelName: string
    }
    isTemporary?: boolean
    expiresHours?: number
  }
  
  /** 工作区显示名称 */
  displayName?: string
  
  /** 标签 */
  tags?: string[]
  
  /** 备注 */
  note?: string
}

export interface WorkspaceConfig {
  /** 工作区数据存储路径 */
  dataPath: string
  
  /** AI生成文件存储路径 */
  aiGeneratedPath: string
  
  /** 临时文件存储路径 */
  tempPath: string
  
  /** 最大文件引用数量 */
  maxFileReferences: number
  
  /** 自动清理策略 */
  autoCleanup: {
    /** 是否启用自动清理 */
    enabled: boolean
    
    /** 最大保留天数 */
    maxAgeDays: number
    
    /** 清理缺失文件的引用 */
    cleanupMissingFiles: boolean
    
    /** 临时文件清理策略 */
    tempFileCleanup: {
      /** 是否启用临时文件自动清理 */
      enabled: boolean
      
      /** 临时文件最大保留小时数 */
      maxAgeHours: number
    }
  }
  
  /** AI生成文件配置 */
  aiFiles: {
    /** 单个文件最大大小(MB) */
    maxFileSizeMB: number
    
    /** 最大AI生成文件数量 */
    maxAIFiles: number
    
    /** 是否启用版本控制 */
    enableVersioning: boolean
  }
}