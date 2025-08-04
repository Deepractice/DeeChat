import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import { BaseService, ServiceEvent } from '../core/BaseService'
import db from '../db'
import log from 'electron-log'

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
  private promptxResourceDir: string

  constructor() {
    super('FileService')
    this.storageDir = path.join(app.getPath('userData'), 'attachments')
    this.promptxResourceDir = path.join(app.getPath('userData'), 'promptx-workspace', '.promptx', 'resource')
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
   * 扫描PromptX资源目录
   */
  async scanPromptXResources(category?: string): Promise<BaseFileMetadata[]> {
    try {
      log.info(`📁 [FileService] 开始扫描PromptX资源目录: ${this.promptxResourceDir}`)
      
      // 检查PromptX资源目录是否存在
      try {
        await fs.access(this.promptxResourceDir)
      } catch {
        log.warn(`⚠️ [FileService] PromptX资源目录不存在: ${this.promptxResourceDir}`)
        return []
      }

      const resources: BaseFileMetadata[] = []
      await this.scanDirectory(this.promptxResourceDir, [], resources)
      
      // 根据category过滤
      const filteredResources = category 
        ? resources.filter(resource => resource.category === category)
        : resources
      
      log.info(`✅ [FileService] 扫描完成，找到 ${filteredResources.length} 个资源文件`)
      return filteredResources
    } catch (error) {
      log.error('❌ [FileService] 扫描PromptX资源失败:', error)
      return []
    }
  }

  /**
   * 递归扫描目录
   */
  private async scanDirectory(dirPath: string, folderPath: string[], resources: BaseFileMetadata[]): Promise<void> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name)
        
        if (item.isDirectory()) {
          // 递归扫描子目录
          await this.scanDirectory(itemPath, [...folderPath, item.name], resources)
        } else if (item.isFile()) {
          // 处理文件
          const fileStats = await fs.stat(itemPath)
          const protocol = this.extractProtocolFromPath(folderPath, item.name)
          const source = this.determineSource(folderPath)
          
          const resource: PromptXResource = {
            id: this.generateFileId(Buffer.from(itemPath)),
            name: item.name,
            path: itemPath,
            size: fileStats.size,
            type: this.getMimeTypeFromExtension(path.extname(item.name)),
            category: 'promptx',
            protocol,
            source,
            reference: `@${protocol}://${folderPath.slice(1).join('/')}//${item.name}`,
            folderPath,
            parentFolder: folderPath[folderPath.length - 1],
            depth: folderPath.length,
            isLeaf: true,
            createdAt: fileStats.birthtime.toISOString(),
            updatedAt: fileStats.mtime.toISOString(),
            description: await this.extractDescription(itemPath)
          }
          
          resources.push(resource)
        }
      }
    } catch (error) {
      log.error(`❌ [FileService] 扫描目录失败: ${dirPath}`, error)
    }
  }

  /**
   * 从路径提取协议类型
   */
  private extractProtocolFromPath(folderPath: string[], fileName: string): 'role' | 'thought' | 'execution' | 'tool' | 'manual' {
    if (folderPath.length === 0) return 'role'
    
    const firstFolder = folderPath[0]
    
    // 根据文件夹结构和文件名判断协议
    if (firstFolder === 'role') {
      // 在role文件夹下，根据文件名和子文件夹判断协议
      if (fileName.includes('.thought.')) return 'thought'
      if (fileName.includes('.execution.')) return 'execution'
      if (fileName.includes('.role.')) return 'role'
      
      // 根据子文件夹判断（如 role/deechat-architect/execution/xxx.md）
      if (folderPath.length >= 3) {
        const subFolder = folderPath[2] // role/角色名/子文件夹
        if (subFolder === 'thought') return 'thought'
        if (subFolder === 'execution') return 'execution'
      }
      
      // 默认情况下，直接在角色文件夹下的文件认为是角色定义文件
      return 'role'
    }
    
    if (firstFolder === 'tool') return fileName.includes('manual') ? 'manual' : 'tool'
    if (fileName.includes('thought')) return 'thought'
    if (fileName.includes('execution')) return 'execution'
    if (fileName.includes('manual')) return 'manual'
    
    return 'role' // 默认
  }

  /**
   * 确定资源来源
   */
  private determineSource(folderPath: string[]): 'system' | 'project' | 'user' {
    // 根据路径特征判断来源
    if (folderPath.includes('system')) return 'system'
    if (folderPath.includes('user')) return 'user'
    return 'project' // 默认为项目级别
  }

  /**
   * 提取文件描述
   */
  private async extractDescription(filePath: string): Promise<string | undefined> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      // 提取第一行作为描述（如果是markdown格式）
      const lines = content.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          return trimmed.substring(0, 100) // 限制长度
        }
      }
    } catch (error) {
      // 忽略读取错误
    }
    return undefined
  }

  /**
   * 根据扩展名获取MIME类型
   */
  private getMimeTypeFromExtension(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript'
    }
    return mimeTypes[ext.toLowerCase()] || 'text/plain'
  }

  /**
   * 构建文件树结构
   */
  async buildFileTree(category?: string): Promise<TreeNode[]> {
    try {
      log.info(`🌳 [FileService] 构建文件树，分类: ${category || '全部'}`)
      
      const resources = await this.scanPromptXResources(category)
      const tree: TreeNode[] = []
      const nodeMap = new Map<string, TreeNode>()
      
      // 创建根节点映射
      const rootFolders = new Set<string>()
      resources.forEach(resource => {
        const promptxResource = resource as PromptXResource
        if (promptxResource.folderPath.length > 0) {
          rootFolders.add(promptxResource.folderPath[0])
        }
      })
      
      // 为每个根文件夹创建节点
      for (const rootFolder of rootFolders) {
        const rootNode: TreeNode = {
          key: rootFolder,
          title: this.getFolderDisplayName(rootFolder),
          isLeaf: false,
          type: 'folder',
          children: []
        }
        tree.push(rootNode)
        nodeMap.set(rootFolder, rootNode)
      }
      
      // 添加文件到对应的文件夹
      for (const resource of resources) {
        const promptxResource = resource as PromptXResource
        if (promptxResource.folderPath.length > 0) {
          const rootFolder = promptxResource.folderPath[0]
          const parentNode = nodeMap.get(rootFolder)
          
          if (parentNode) {
            const fileNode: TreeNode = {
              key: `file_${resource.id}`,
              title: resource.name,
              isLeaf: true,
              type: 'file',
              protocol: promptxResource.protocol,
              size: resource.size,
              createdAt: resource.createdAt,
              description: resource.description,
              fileData: promptxResource
            }
            
            if (!parentNode.children) {
              parentNode.children = []
            }
            parentNode.children.push(fileNode)
          }
        }
      }
      
      log.info(`✅ [FileService] 文件树构建完成，根节点数: ${tree.length}`)
      return tree
    } catch (error) {
      log.error('❌ [FileService] 构建文件树失败:', error)
      return []
    }
  }

  /**
   * 获取文件夹显示名称
   */
  private getFolderDisplayName(folderName: string): string {
    const displayNames: Record<string, string> = {
      'role': '角色 (Roles)',
      'tool': '工具 (Tools)',
      'thought': '思维 (Thoughts)',
      'execution': '执行 (Executions)',
      'knowledge': '知识 (Knowledge)'
    }
    return displayNames[folderName] || folderName
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(): Promise<FileStats> {
    try {
      log.info('📊 [FileService] 计算文件统计信息')
      
      const resources = await this.scanPromptXResources()
      
      const stats: FileStats = {
        totalFiles: resources.length,
        totalSize: resources.reduce((sum, file) => sum + file.size, 0),
        byCategory: {},
        byType: {}
      }
      
      // 按分类统计
      resources.forEach(resource => {
        stats.byCategory[resource.category] = (stats.byCategory[resource.category] || 0) + 1
        stats.byType[resource.type] = (stats.byType[resource.type] || 0) + 1
      })
      
      log.info(`✅ [FileService] 统计完成: 总计 ${stats.totalFiles} 个文件`)
      return stats
    } catch (error) {
      log.error('❌ [FileService] 计算统计信息失败:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        byCategory: {},
        byType: {}
      }
    }
  }

  /**
   * 读取文件内容
   */
  async readFileContent(fileId: string): Promise<string> {
    try {
      const resources = await this.scanPromptXResources()
      const resource = resources.find(r => r.id === fileId)
      
      if (!resource) {
        throw new Error(`文件未找到: ${fileId}`)
      }
      
      const content = await fs.readFile(resource.path, 'utf-8')
      return content
    } catch (error) {
      log.error(`❌ [FileService] 读取文件内容失败: ${fileId}`, error)
      throw error
    }
  }

  /**
   * 更新文件内容
   */
  async updateFileContent(fileId: string, content: string): Promise<void> {
    try {
      const resources = await this.scanPromptXResources()
      const resource = resources.find(r => r.id === fileId)
      
      if (!resource) {
        throw new Error(`文件未找到: ${fileId}`)
      }
      
      await fs.writeFile(resource.path, content, 'utf-8')
      log.info(`✅ [FileService] 文件内容已更新: ${resource.name}`)
    } catch (error) {
      log.error(`❌ [FileService] 更新文件内容失败: ${fileId}`, error)
      throw error
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down FileService')
    // 清理资源
  }
}