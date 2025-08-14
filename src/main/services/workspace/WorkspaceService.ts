import { app } from 'electron'
import * as path from 'path'
import { createHash } from 'crypto'
import { BaseService, ServiceEvent } from '../../core/BaseService'
import { FileService } from '../FileService'
import log from 'electron-log'

export interface WorkspaceDocument {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  extension: string
  createdAt: string
  updatedAt: string
}

/**
 * 工作区文档管理服务
 * 专门处理用户在工作区中的文档文件
 */
export class WorkspaceService extends BaseService {
  private workspaceDir: string
  private fileService: FileService

  constructor(fileService: FileService) {
    super('WorkspaceService')
    this.fileService = fileService
    this.workspaceDir = path.join(app.getPath('userData'), 'workspace')
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing WorkspaceService')
    
    // 确保工作区目录存在
    await this.ensureWorkspaceDir()
    
    this.emit(ServiceEvent.READY)
    this.logger.info('WorkspaceService initialized')
  }

  private async ensureWorkspaceDir(): Promise<void> {
    try {
      const fs = require('fs/promises')
      await fs.access(this.workspaceDir)
    } catch {
      const fs = require('fs/promises')
      await fs.mkdir(this.workspaceDir, { recursive: true })
      this.logger.info(`Created workspace directory: ${this.workspaceDir}`)
    }
  }

  /**
   * 保存工作区文档
   */
  async saveWorkspaceDocument(file: File): Promise<string> {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const documentId = this.generateDocumentId(file.name, buffer)
      const fileName = this.sanitizeFileName(file.name)
      const filePath = path.join(this.workspaceDir, fileName)

      // 使用FileService的基础文件操作
      await this.fileService.saveFile(buffer, filePath)
      
      log.info(`✅ [WorkspaceService] 工作区文档已保存: ${fileName}`)
      return documentId
    } catch (error) {
      log.error(`❌ [WorkspaceService] 保存工作区文档失败: ${file.name}`, error)
      throw error
    }
  }

  /**
   * 读取工作区文档内容
   */
  async readWorkspaceDocument(documentId: string): Promise<string> {
    try {
      const document = await this.findDocumentById(documentId)
      if (!document) {
        throw new Error(`工作区文档未找到: ${documentId}`)
      }

      const content = await this.fileService.readFile(document.path)
      return content
    } catch (error) {
      log.error(`❌ [WorkspaceService] 读取工作区文档失败: ${documentId}`, error)
      throw error
    }
  }

  /**
   * 列出所有工作区文档
   */
  async listWorkspaceDocuments(): Promise<WorkspaceDocument[]> {
    try {
      const fs = require('fs/promises')
      const files = await fs.readdir(this.workspaceDir, { withFileTypes: true })
      const documents: WorkspaceDocument[] = []

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(this.workspaceDir, file.name)
          const stats = await fs.stat(filePath)
          
          const document: WorkspaceDocument = {
            id: this.generateDocumentId(file.name, Buffer.from(filePath)),
            name: file.name,
            path: filePath,
            size: stats.size,
            mimeType: this.getMimeTypeFromExtension(path.extname(file.name)),
            extension: path.extname(file.name),
            createdAt: stats.birthtime.toISOString(),
            updatedAt: stats.mtime.toISOString()
          }

          documents.push(document)
        }
      }

      return documents.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch (error) {
      log.error('❌ [WorkspaceService] 列出工作区文档失败:', error)
      return []
    }
  }

  /**
   * 删除工作区文档
   */
  async deleteWorkspaceDocument(documentId: string): Promise<void> {
    try {
      const document = await this.findDocumentById(documentId)
      if (!document) {
        throw new Error(`工作区文档未找到: ${documentId}`)
      }

      await this.fileService.deleteFile(document.path)
      log.info(`✅ [WorkspaceService] 工作区文档已删除: ${document.name}`)
    } catch (error) {
      log.error(`❌ [WorkspaceService] 删除工作区文档失败: ${documentId}`, error)
      throw error
    }
  }

  /**
   * 根据文档ID查找文档
   */
  private async findDocumentById(documentId: string): Promise<WorkspaceDocument | null> {
    const documents = await this.listWorkspaceDocuments()
    return documents.find(doc => doc.id === documentId) || null
  }

  /**
   * 生成文档ID
   */
  private generateDocumentId(fileName: string, buffer: Buffer): string {
    const hash = createHash('sha256')
    hash.update(fileName)
    hash.update(buffer)
    return `workspace_${hash.digest('hex').substring(0, 12)}`
  }

  /**
   * 清理文件名，移除不安全字符
   */
  private sanitizeFileName(fileName: string): string {
    // 移除或替换不安全的字符
    return fileName.replace(/[<>:"/\\|?*]/g, '_')
  }

  /**
   * 根据扩展名获取MIME类型
   */
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.markdown': 'text/markdown',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.rtf': 'application/rtf'
    }
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream'
  }

  /**
   * 获取工作区统计信息
   */
  async getWorkspaceStats(): Promise<{ totalFiles: number; totalSize: number; byType: Record<string, number> }> {
    try {
      const documents = await this.listWorkspaceDocuments()
      const stats = {
        totalFiles: documents.length,
        totalSize: documents.reduce((sum, doc) => sum + doc.size, 0),
        byType: {} as Record<string, number>
      }

      documents.forEach(doc => {
        const type = doc.extension || 'unknown'
        stats.byType[type] = (stats.byType[type] || 0) + 1
      })

      return stats
    } catch (error) {
      log.error('❌ [WorkspaceService] 获取工作区统计信息失败:', error)
      return { totalFiles: 0, totalSize: 0, byType: {} }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down WorkspaceService')
  }
}