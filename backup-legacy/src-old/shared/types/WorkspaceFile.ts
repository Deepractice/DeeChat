/**
 * 工作区文件类型定义
 * 用于main和renderer进程之间共享
 */

// 工作区文件接口定义
export interface WorkspaceFile {
  id: string
  name: string
  path: string // PromptX中的相对路径
  type: 'temp' | 'saved' | 'ai-generated'
  fileType: string // 文件扩展名
  size: number
  createdAt: Date
  lastAccessed: Date
  autoCleanup: boolean
  source: 'user-upload' | 'ai-creation'
  content?: string
}