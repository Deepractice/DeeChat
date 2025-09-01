// 文件类型定义
export interface BaseFileMetadata {
  id: string
  name: string
  path: string
  size: number
  type: string
  category: 'chat' | 'promptx' | 'knowledge'
  createdAt: string
  updatedAt: string
  tags?: string[]
  description?: string
}

export interface ChatFileMetadata extends BaseFileMetadata {
  category: 'chat'
  subType: 'image' | 'document' | 'video' | 'audio' | 'other'
  preview?: string
  sessionIds?: string[]
}

export interface PromptXResource extends BaseFileMetadata {
  category: 'promptx'
  protocol: 'role' | 'thought' | 'execution' | 'tool'
  source: 'system' | 'project' | 'user'
  reference: string
  dependencies?: string[]
  metadata?: {
    author?: string
    version?: string
  }
}

export type FileMetadata = ChatFileMetadata | PromptXResource | BaseFileMetadata

export interface FileFilters {
  category?: string
  type?: string
  tags?: string[]
  dateRange?: { start: Date; end: Date }
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  byCategory: Record<string, number>
  byType: Record<string, number>
}