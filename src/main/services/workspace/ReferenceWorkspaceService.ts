import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { createHash } from 'crypto'
import { BaseService, ServiceEvent } from '../../core/BaseService'
import {
  WorkspaceFileReference,
  WorkspaceFileStatus,
  WorkspaceFileSourceType,
  WorkspaceFileInfo,
  AddFileToWorkspaceRequest,
  CreateAIFileRequest,
  WorkspaceConfig,
  AIGeneratedFileInfo
} from './WorkspaceTypes'

/**
 * 基于引用模式的工作区服务
 * 不复制文件，只保存文件路径引用，节省存储空间和提升性能
 */
export class ReferenceWorkspaceService extends BaseService {
  private dataPath: string
  private aiGeneratedPath: string
  private tempPath: string
  private referencesFilePath: string
  private references: Map<string, WorkspaceFileReference> = new Map()
  private config: WorkspaceConfig

  constructor() {
    super('ReferenceWorkspaceService')
    
    // 使用deechat-workspace作为数据目录名
    this.dataPath = path.join(app.getPath('userData'), 'deechat-workspace')
    this.aiGeneratedPath = path.join(this.dataPath, 'ai-generated')
    this.tempPath = path.join(this.dataPath, 'temp')
    this.referencesFilePath = path.join(this.dataPath, 'file-references.json')
    
    this.config = {
      dataPath: this.dataPath,
      aiGeneratedPath: this.aiGeneratedPath,
      tempPath: this.tempPath,
      maxFileReferences: 1000,
      autoCleanup: {
        enabled: true,
        maxAgeDays: 30,
        cleanupMissingFiles: true,
        tempFileCleanup: {
          enabled: true,
          maxAgeHours: 24
        }
      },
      aiFiles: {
        maxFileSizeMB: 50,
        maxAIFiles: 500,
        enableVersioning: false
      }
    }
  }

  async initialize(): Promise<void> {
    this.logger.info('🚀 初始化引用模式工作区服务')
    
    try {
      // 确保数据目录存在
      await this.ensureDataDirectories()
      
      // 加载现有引用
      await this.loadFileReferences()
      
      // 验证引用状态
      await this.validateReferences()
      
      // 启动定时清理任务
      this.startCleanupTask()
      
      this.emit(ServiceEvent.READY)
      this.logger.info(`✅ 引用模式工作区初始化完成，当前引用: ${this.references.size} 个文件`)
      
    } catch (error) {
      this.logger.error('❌ 引用模式工作区初始化失败:', error)
      throw error
    }
  }

  /**
   * 添加文件到工作区(引用模式)
   */
  async addFileReference(request: AddFileToWorkspaceRequest): Promise<WorkspaceFileReference> {
    try {
      const { filePath, sourceType, displayName, tags, note, aiGeneratedInfo } = request
      
      // 验证文件是否存在
      const fileInfo = await this.getFileInfo(filePath)
      if (!fileInfo.exists) {
        throw new Error(`文件不存在: ${filePath}`)
      }
      
      if (!fileInfo.readable) {
        throw new Error(`文件无法读取: ${filePath}`)
      }
      
      // 生成引用ID
      const referenceId = this.generateReferenceId(filePath)
      
      // 检查是否已存在
      if (this.references.has(referenceId)) {
        const existing = this.references.get(referenceId)!
        existing.lastAccessed = new Date()
        await this.saveReferences()
        this.logger.info(`📄 文件引用已存在，更新访问时间: ${existing.displayName}`)
        return existing
      }
      
      // 创建新引用
      const reference: WorkspaceFileReference = {
        id: referenceId,
        sourceType: sourceType,
        originalPath: path.resolve(filePath),
        displayName: displayName || path.basename(filePath),
        fileName: path.basename(filePath),
        fileSize: fileInfo.size,
        mimeType: this.getMimeType(filePath),
        extension: path.extname(filePath),
        addedAt: new Date(),
        lastAccessed: new Date(),
        status: WorkspaceFileStatus.AVAILABLE,
        contentHash: fileInfo.contentHash,
        tags: tags || [],
        note: note,
        aiGeneratedInfo: aiGeneratedInfo
      }
      
      // 保存引用
      this.references.set(referenceId, reference)
      await this.saveReferences()
      
      this.logger.info(`✅ 文件引用已添加: ${reference.displayName} (${this.formatFileSize(reference.fileSize)})`)
      return reference
      
    } catch (error) {
      this.logger.error(`❌ 添加文件引用失败: ${request.filePath}`, error)
      throw error
    }
  }

  /**
   * 读取工作区文件内容
   */
  async readFileContent(referenceId: string): Promise<string> {
    try {
      const reference = this.references.get(referenceId)
      if (!reference) {
        throw new Error(`文件引用未找到: ${referenceId}`)
      }
      
      // 检查文件状态
      const fileInfo = await this.getFileInfo(reference.originalPath)
      if (!fileInfo.exists) {
        reference.status = WorkspaceFileStatus.MISSING
        await this.saveReferences()
        throw new Error(`源文件不存在: ${reference.originalPath}`)
      }
      
      // 检查文件是否已变更
      if (reference.contentHash && fileInfo.contentHash !== reference.contentHash) {
        reference.status = WorkspaceFileStatus.CHANGED
        reference.contentHash = fileInfo.contentHash
        this.logger.info(`📝 检测到文件变更: ${reference.displayName}`)
      } else {
        reference.status = WorkspaceFileStatus.AVAILABLE
      }
      
      // 更新访问时间
      reference.lastAccessed = new Date()
      await this.saveReferences()
      
      // 读取文件内容
      const content = await fs.readFile(reference.originalPath, 'utf-8')
      return content
      
    } catch (error) {
      this.logger.error(`❌ 读取文件内容失败: ${referenceId}`, error)
      throw error
    }
  }

  /**
   * 列出所有工作区文件引用
   */
  async listFileReferences(): Promise<WorkspaceFileReference[]> {
    const references = Array.from(this.references.values())
    
    // 按最后访问时间倒序排列
    return references.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
  }

  /**
   * 移除文件引用
   */
  async removeFileReference(referenceId: string): Promise<void> {
    try {
      const reference = this.references.get(referenceId)
      if (!reference) {
        throw new Error(`文件引用未找到: ${referenceId}`)
      }
      
      this.references.delete(referenceId)
      await this.saveReferences()
      
      this.logger.info(`🗑️ 文件引用已移除: ${reference.displayName}`)
      
    } catch (error) {
      this.logger.error(`❌ 移除文件引用失败: ${referenceId}`, error)
      throw error
    }
  }

  /**
   * 清理无效引用
   */
  async cleanupInvalidReferences(): Promise<{ removed: number; updated: number }> {
    let removedCount = 0
    let updatedCount = 0
    
    try {
      const toRemove: string[] = []
      
      for (const [id, reference] of Array.from(this.references.entries())) {
        const fileInfo = await this.getFileInfo(reference.originalPath)
        
        if (!fileInfo.exists) {
          if (this.config.autoCleanup.cleanupMissingFiles) {
            toRemove.push(id)
            removedCount++
          } else {
            reference.status = WorkspaceFileStatus.MISSING
            updatedCount++
          }
        } else if (reference.contentHash && fileInfo.contentHash !== reference.contentHash) {
          reference.status = WorkspaceFileStatus.CHANGED
          reference.contentHash = fileInfo.contentHash
          updatedCount++
        } else {
          reference.status = WorkspaceFileStatus.AVAILABLE
          updatedCount++
        }
      }
      
      // 移除无效引用
      toRemove.forEach(id => this.references.delete(id))
      
      if (removedCount > 0 || updatedCount > 0) {
        await this.saveReferences()
      }
      
      this.logger.info(`🧹 清理完成: 移除 ${removedCount} 个无效引用，更新 ${updatedCount} 个引用状态`)
      return { removed: removedCount, updated: updatedCount }
      
    } catch (error) {
      this.logger.error('❌ 清理无效引用失败:', error)
      throw error
    }
  }

  /**
   * 创建AI生成文件
   */
  async createAIFile(request: CreateAIFileRequest): Promise<WorkspaceFileReference> {
    try {
      const { fileName, content, generatedInfo, displayName, tags, note } = request
      
      // 决定存储路径
      const targetDir = generatedInfo.isTemporary ? this.tempPath : this.aiGeneratedPath
      const uniqueFileName = await this.generateUniqueFileName(targetDir, fileName)
      const filePath = path.join(targetDir, uniqueFileName)
      
      // 验证文件大小
      const contentSizeBytes = Buffer.byteLength(content, 'utf-8')
      const contentSizeMB = contentSizeBytes / (1024 * 1024)
      if (contentSizeMB > this.config.aiFiles.maxFileSizeMB) {
        throw new Error(`文件大小 ${contentSizeMB.toFixed(1)}MB 超过限制 ${this.config.aiFiles.maxFileSizeMB}MB`)
      }
      
      // 检查AI文件数量限制
      const aiFileCount = Array.from(this.references.values())
        .filter(ref => ref.sourceType === WorkspaceFileSourceType.AI_GENERATED).length
      if (aiFileCount >= this.config.aiFiles.maxAIFiles) {
        throw new Error(`AI生成文件数量已达到限制: ${this.config.aiFiles.maxAIFiles}`)
      }
      
      // 写入文件
      await fs.writeFile(filePath, content, 'utf-8')
      this.logger.info(`✅ AI文件已创建: ${uniqueFileName} (${this.formatFileSize(contentSizeBytes)})`)
      
      // 准备AI生成信息
      const aiGeneratedInfo: AIGeneratedFileInfo = {
        generatedBy: generatedInfo.generatedBy,
        prompt: generatedInfo.prompt,
        modelInfo: generatedInfo.modelInfo,
        isTemporary: generatedInfo.isTemporary || false,
        expiresAt: generatedInfo.isTemporary && generatedInfo.expiresHours 
          ? new Date(Date.now() + generatedInfo.expiresHours * 60 * 60 * 1000)
          : undefined,
        generationId: this.generateGenerationId()
      }
      
      // 添加到工作区引用
      const addRequest: AddFileToWorkspaceRequest = {
        filePath,
        sourceType: generatedInfo.isTemporary 
          ? WorkspaceFileSourceType.TEMPORARY 
          : WorkspaceFileSourceType.AI_GENERATED,
        displayName: displayName || uniqueFileName,
        tags,
        note,
        aiGeneratedInfo
      }
      
      return await this.addFileReference(addRequest)
      
    } catch (error) {
      this.logger.error(`❌ 创建AI文件失败: ${request.fileName}`, error)
      throw error
    }
  }

  /**
   * 快速添加用户拖拽文件(引用模式)
   */
  async addUserFile(filePath: string, displayName?: string): Promise<WorkspaceFileReference> {
    return this.addFileReference({
      filePath,
      sourceType: WorkspaceFileSourceType.USER_REFERENCE,
      displayName,
      tags: ['用户文件']
    })
  }

  /**
   * 快速创建AI生成文件(便捷方法)
   */
  async createQuickAIFile(fileName: string, content: string, options?: {
    prompt?: string
    modelId?: string
    modelName?: string
    isTemporary?: boolean
    expiresHours?: number
  }): Promise<WorkspaceFileReference> {
    return this.createAIFile({
      fileName,
      content,
      generatedInfo: {
        generatedBy: 'ai_chat',
        prompt: options?.prompt,
        modelInfo: options?.modelId ? {
          modelId: options.modelId,
          modelName: options.modelName || options.modelId
        } : undefined,
        isTemporary: options?.isTemporary || false,
        expiresHours: options?.expiresHours || 24
      },
      tags: ['AI生成']
    })
  }

  /**
   * 快速创建临时文件
   */
  async createTempFile(fileName: string, content: string, expiresHours: number = 24): Promise<WorkspaceFileReference> {
    return this.createAIFile({
      fileName,
      content,
      generatedInfo: {
        generatedBy: 'mcp_tool',
        isTemporary: true,
        expiresHours
      },
      tags: ['临时文件']
    })
  }

  /**
   * 按类型获取文件引用
   */
  getFilesByType(sourceType: WorkspaceFileSourceType): WorkspaceFileReference[] {
    return Array.from(this.references.values())
      .filter(ref => ref.sourceType === sourceType)
      .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
  }

  /**
   * 获取用户引用文件
   */
  getUserFiles(): WorkspaceFileReference[] {
    return this.getFilesByType(WorkspaceFileSourceType.USER_REFERENCE)
  }

  /**
   * 获取AI生成文件
   */
  getAIFiles(): WorkspaceFileReference[] {
    return this.getFilesByType(WorkspaceFileSourceType.AI_GENERATED)
  }

  /**
   * 获取临时文件
   */
  getTempFiles(): WorkspaceFileReference[] {
    return this.getFilesByType(WorkspaceFileSourceType.TEMPORARY)
  }

  /**
   * 获取AI生成文件的推荐路径
   */
  getAIGeneratedPath(): string {
    return this.aiGeneratedPath
  }

  /**
   * 获取临时文件路径
   */
  getTempPath(): string {
    return this.tempPath
  }

  /**
   * 获取工作区统计信息
   */
  getWorkspaceStats() {
    const references = Array.from(this.references.values())
    const total = this.references.size
    const available = references.filter(r => r.status === WorkspaceFileStatus.AVAILABLE).length
    const missing = references.filter(r => r.status === WorkspaceFileStatus.MISSING).length
    const changed = references.filter(r => r.status === WorkspaceFileStatus.CHANGED).length
    
    // 按类型统计
    const userFiles = references.filter(r => r.sourceType === WorkspaceFileSourceType.USER_REFERENCE).length
    const aiFiles = references.filter(r => r.sourceType === WorkspaceFileSourceType.AI_GENERATED).length
    const tempFiles = references.filter(r => r.sourceType === WorkspaceFileSourceType.TEMPORARY).length
    
    return {
      total,
      available,
      missing,
      changed,
      byType: {
        userFiles,
        aiFiles,
        tempFiles
      },
      paths: {
        dataPath: this.dataPath,
        aiGeneratedPath: this.aiGeneratedPath,
        tempPath: this.tempPath
      }
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('🛑 关闭引用模式工作区服务')
    
    try {
      // 保存当前引用状态
      await this.saveReferences()
      
      // 清理资源
      this.references.clear()
      
      this.logger.info('✅ 引用模式工作区服务已关闭')
    } catch (error) {
      this.logger.error('❌ 关闭引用模式工作区服务失败:', error)
      throw error
    }
  }

  // === 私有方法 ===

  private async ensureDataDirectories(): Promise<void> {
    const directories = [this.dataPath, this.aiGeneratedPath, this.tempPath]
    
    for (const dir of directories) {
      try {
        await fs.access(dir)
      } catch {
        await fs.mkdir(dir, { recursive: true })
        this.logger.info(`📁 创建目录: ${dir}`)
      }
    }
  }

  private async loadFileReferences(): Promise<void> {
    try {
      await fs.access(this.referencesFilePath)
      const data = await fs.readFile(this.referencesFilePath, 'utf-8')
      const references = JSON.parse(data)
      
      this.references.clear()
      for (const ref of references) {
        // 恢复Date对象
        ref.addedAt = new Date(ref.addedAt)
        ref.lastAccessed = new Date(ref.lastAccessed)
        this.references.set(ref.id, ref)
      }
      
      this.logger.info(`📂 加载文件引用: ${this.references.size} 个`)
      
    } catch {
      this.logger.info('📂 未找到现有引用文件，从空开始')
    }
  }

  private async saveReferences(): Promise<void> {
    const references = Array.from(this.references.values())
    const data = JSON.stringify(references, null, 2)
    await fs.writeFile(this.referencesFilePath, data, 'utf-8')
  }

  private async validateReferences(): Promise<void> {
    this.logger.info('🔍 验证文件引用状态...')
    await this.cleanupInvalidReferences()
  }

  private async getFileInfo(filePath: string): Promise<WorkspaceFileInfo> {
    try {
      const stats = await fs.stat(filePath)
      const contentHash = await this.calculateFileHash(filePath)
      
      return {
        path: filePath,
        exists: true,
        size: stats.size,
        modifiedAt: stats.mtime,
        readable: true,
        contentHash
      }
    } catch (error) {
      return {
        path: filePath,
        exists: false,
        size: 0,
        modifiedAt: new Date(0),
        readable: false,
        contentHash: ''
      }
    }
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath)
      return createHash('md5').update(content).digest('hex')
    } catch {
      return ''
    }
  }

  private generateReferenceId(filePath: string): string {
    const normalized = path.resolve(filePath)
    return createHash('md5').update(normalized).digest('hex')
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.py': 'text/x-python',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-chdr',
      '.cs': 'text/x-csharp',
      '.php': 'application/x-httpd-php',
      '.rb': 'application/x-ruby',
      '.go': 'text/x-go',
      '.rs': 'text/x-rust',
      '.swift': 'text/x-swift',
      '.kt': 'text/x-kotlin',
      '.scala': 'text/x-scala',
      '.sh': 'application/x-sh',
      '.bat': 'application/x-bat',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.zip': 'application/zip',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip'
    }
    
    return mimeTypes[ext] || 'application/octet-stream'
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

  private async generateUniqueFileName(directory: string, fileName: string): Promise<string> {
    const baseName = path.parse(fileName).name
    const extension = path.parse(fileName).ext
    let counter = 0
    let uniqueName = fileName
    
    while (true) {
      const fullPath = path.join(directory, uniqueName)
      try {
        await fs.access(fullPath)
        // 文件存在，生成新名称
        counter++
        uniqueName = `${baseName}_${counter}${extension}`
      } catch {
        // 文件不存在，可以使用
        break
      }
    }
    
    return uniqueName
  }

  private generateGenerationId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private startCleanupTask(): void {
    if (!this.config.autoCleanup.enabled) {
      return
    }
    
    // 每小时执行一次清理任务
    setInterval(async () => {
      try {
        await this.cleanupExpiredTempFiles()
        await this.cleanupInvalidReferences()
      } catch (error) {
        this.logger.error('⚠️ 定时清理任务失败:', error)
      }
    }, 60 * 60 * 1000) // 1小时
    
    this.logger.info('🕒 定时清理任务已启动 (每小时执行)')
  }

  private async cleanupExpiredTempFiles(): Promise<void> {
    if (!this.config.autoCleanup.tempFileCleanup.enabled) {
      return
    }
    
    const now = new Date()
    let cleanupCount = 0
    
    for (const [id, reference] of Array.from(this.references.entries())) {
      if (reference.sourceType === WorkspaceFileSourceType.TEMPORARY && 
          reference.aiGeneratedInfo?.expiresAt && 
          reference.aiGeneratedInfo.expiresAt < now) {
        
        try {
          // 删除物理文件
          await fs.unlink(reference.originalPath)
          // 删除引用
          this.references.delete(id)
          cleanupCount++
          
          this.logger.info(`🧹 清理过期临时文件: ${reference.displayName}`)
        } catch (error) {
          this.logger.error(`❌ 清理临时文件失败: ${reference.displayName}`, error)
        }
      }
    }
    
    if (cleanupCount > 0) {
      await this.saveReferences()
      this.logger.info(`✅ 临时文件清理完成，共清理 ${cleanupCount} 个文件`)
    }
  }
}