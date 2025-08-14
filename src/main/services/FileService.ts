import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import { BaseService, ServiceEvent } from '../core/BaseService'
import db from '../db'
// import log from 'electron-log' // 暂时注释，未使用

export interface FileMetadata {
  id: string
  name: string
  size: number
  mimeType: string
  ext: string
  createdAt: number
}

export interface FileData extends FileMetadata {
  content?: string
  base64?: string
  path: string
}

// ResourcesPage需要的接口定义
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

export interface PromptXResource extends BaseFileMetadata {
  category: 'promptx'
  protocol: 'role' | 'thought' | 'execution' | 'tool' | 'manual'
  source: 'system' | 'project' | 'user'
  reference: string
  folderPath: string[] // 文件夹路径数组
  parentFolder?: string // 直接父文件夹
  depth: number // 层级深度
  isLeaf: boolean // 是否是叶子节点
}

export interface TreeNode {
  key: string
  title: string
  isLeaf: boolean
  children?: TreeNode[]
  type: 'folder' | 'file'
  protocol?: string
  size?: number
  createdAt?: string
  description?: string
  fileData?: PromptXResource
}

export interface FileStats {
  totalFiles: number
  totalSize: number
  byCategory: Record<string, number>
  byType: Record<string, number>
}

export class FileService extends BaseService {
  private storageDir: string

  constructor() {
    super('FileService')
    this.storageDir = path.join(app.getPath('userData'), 'attachments')
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing FileService')
    
    // 确保存储目录存在
    await this.ensureStorageDir()
    
    // 创建文件表
    await this.createFileTable()
    
    this.emit(ServiceEvent.READY)
    this.logger.info('FileService initialized')
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir)
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true })
      this.logger.info(`Created storage directory: ${this.storageDir}`)
    }
  }

  private async createFileTable(): Promise<void> {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        mimeType TEXT NOT NULL,
        ext TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `)
  }

  /**
   * 保存附件
   */
  async saveAttachment(fileData: Buffer, metadata: {
    name: string
    mimeType: string
  }): Promise<string> {
    try {
      // 生成文件ID
      const fileId = this.generateFileId(fileData)
      const ext = path.extname(metadata.name) || this.getExtFromMimeType(metadata.mimeType)
      const fileName = `${Date.now()}_${fileId}${ext}`
      const filePath = path.join(this.storageDir, fileName)

      // 保存文件
      await fs.writeFile(filePath, fileData)

      // 保存元数据
      const fileMetadata: FileMetadata = {
        id: fileId,
        name: metadata.name,
        size: fileData.length,
        mimeType: metadata.mimeType,
        ext,
        createdAt: Date.now()
      }

      await db.run(
        'INSERT INTO files (id, name, size, mimeType, ext, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [fileMetadata.id, fileMetadata.name, fileMetadata.size, fileMetadata.mimeType, fileMetadata.ext, fileMetadata.createdAt]
      )

      this.logger.info(`Saved attachment: ${fileMetadata.name} (${fileId})`)
      return fileId
    } catch (error) {
      this.logger.error('Failed to save attachment:', error)
      throw error
    }
  }

  /**
   * 获取附件信息
   */
  async getAttachment(fileId: string): Promise<FileData | null> {
    try {
      const row = await db.get(
        'SELECT * FROM files WHERE id = ?',
        [fileId]
      )

      if (!row) {
        return null
      }

      // 查找实际文件
      const files = await fs.readdir(this.storageDir)
      const targetFile = files.find(f => f.includes(fileId))
      
      if (!targetFile) {
        this.logger.warn(`File not found in storage: ${fileId}`)
        return null
      }

      const filePath = path.join(this.storageDir, targetFile)
      
      return {
        ...row,
        path: filePath
      }
    } catch (error) {
      this.logger.error('Failed to get attachment:', error)
      throw error
    }
  }

  /**
   * 获取附件内容（用于AI理解）
   */
  async getAttachmentContent(fileId: string): Promise<string> {
    try {
      const fileData = await this.getAttachment(fileId)
      if (!fileData) {
        throw new Error(`Attachment not found: ${fileId}`)
      }

      const buffer = await fs.readFile(fileData.path)

      // 文本文件直接返回内容
      if (this.isTextFile(fileData.mimeType, fileData.name)) {
        return buffer.toString('utf-8')
      }

      // 图片文件返回base64
      if (fileData.mimeType.startsWith('image/')) {
        return `data:${fileData.mimeType};base64,${buffer.toString('base64')}`
      }

      // 其他文件返回描述
      return `[File: ${fileData.name} (${fileData.mimeType}, ${this.formatFileSize(fileData.size)})]`
    } catch (error) {
      this.logger.error('Failed to get attachment content:', error)
      throw error
    }
  }

  /**
   * 删除附件
   */
  async deleteAttachment(fileId: string): Promise<void> {
    try {
      const fileData = await this.getAttachment(fileId)
      if (!fileData) {
        return
      }

      // 删除文件
      await fs.unlink(fileData.path)

      // 删除元数据
      await db.run('DELETE FROM files WHERE id = ?', [fileId])

      this.logger.info(`Deleted attachment: ${fileId}`)
    } catch (error) {
      this.logger.error('Failed to delete attachment:', error)
      throw error
    }
  }

  /**
   * 清理过期文件（30天）
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
      
      // 获取过期文件
      const oldFiles = await db.all(
        'SELECT * FROM files WHERE createdAt < ?',
        [thirtyDaysAgo]
      )

      for (const file of oldFiles) {
        await this.deleteAttachment(file.id)
      }

      this.logger.info(`Cleaned up ${oldFiles.length} old files`)
    } catch (error) {
      this.logger.error('Failed to cleanup old files:', error)
    }
  }

  private generateFileId(buffer: Buffer): string {
    const hash = createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex').substring(0, 16)
  }

  private getExtFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'text/plain': '.txt',
      'text/markdown': '.md',
      'application/json': '.json',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
    }
    
    return mimeToExt[mimeType] || '.bin'
  }

  private isTextFile(mimeType: string, fileName: string): boolean {
    const textMimeTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/typescript',
      'application/xml',
      'application/x-yaml'
    ]

    const textExtensions = [
      '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
      '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go',
      '.rs', '.swift', '.kt', '.rb', '.php', '.sh', '.bat',
      '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf',
      '.html', '.css', '.scss', '.less'
    ]

    const ext = path.extname(fileName).toLowerCase()
    
    return textMimeTypes.some(type => mimeType.startsWith(type)) ||
           textExtensions.includes(ext)
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`
  }


  /**
   * 基础文件保存操作
   */
  async saveFile(buffer: Buffer, filePath: string): Promise<void> {
    try {
      await fs.writeFile(filePath, buffer)
      this.logger.info(`File saved: ${filePath}`)
    } catch (error) {
      this.logger.error('Failed to save file:', error)
      throw error
    }
  }

  /**
   * 基础文件读取操作
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      this.logger.error('Failed to read file:', error)
      throw error
    }
  }

  /**
   * 基础文件删除操作
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath)
      this.logger.info(`File deleted: ${filePath}`)
    } catch (error) {
      this.logger.error('Failed to delete file:', error)
      throw error
    }
  }




  async shutdown(): Promise<void> {
    this.logger.info('Shutting down FileService')
    // 清理资源
  }
}