/**
 * DeeChat目录服务
 * 管理DeeChat专属的目录结构，完全独立于PromptX
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { existsSync } from 'fs'

export class DeeChatDirectoryService {
  private static instance: DeeChatDirectoryService
  private baseDir: string
  private workspaceDir: string
  private documentsDir: string
  private exportsDir: string
  private tempDir: string

  private constructor() {
    // 使用用户数据目录下的.deechat文件夹
    this.baseDir = path.join(app.getPath('userData'), '.deechat')
    this.workspaceDir = path.join(this.baseDir, 'workspace')
    this.documentsDir = path.join(this.workspaceDir, 'documents')
    this.exportsDir = path.join(this.workspaceDir, 'exports')
    this.tempDir = path.join(this.workspaceDir, 'temp')
  }

  static getInstance(): DeeChatDirectoryService {
    if (!DeeChatDirectoryService.instance) {
      DeeChatDirectoryService.instance = new DeeChatDirectoryService()
    }
    return DeeChatDirectoryService.instance
  }

  /**
   * 初始化DeeChat目录结构
   */
  async initialize(): Promise<void> {
    try {
      console.log('🏗️ [DeeChat] 初始化独立目录结构...')
      
      const directories = [
        this.baseDir,
        this.workspaceDir,
        this.documentsDir,
        this.exportsDir,
        this.tempDir
      ]

      // 创建所有必需的目录
      for (const dir of directories) {
        if (!existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true })
          console.log(`📁 [DeeChat] 创建目录: ${dir}`)
        }
      }

      // 创建.gitignore文件
      const gitignorePath = path.join(this.baseDir, '.gitignore')
      if (!existsSync(gitignorePath)) {
        await fs.writeFile(gitignorePath, `# DeeChat工作区
temp/
*.log
*.tmp
`)
        console.log('📝 [DeeChat] 创建.gitignore文件')
      }

      console.log('✅ [DeeChat] 目录结构初始化完成')
      console.log(`📍 [DeeChat] 基础目录: ${this.baseDir}`)
      console.log(`📍 [DeeChat] 工作区目录: ${this.workspaceDir}`)
      
    } catch (error) {
      console.error('❌ [DeeChat] 目录初始化失败:', error)
      throw new Error(`DeeChat目录初始化失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取各种目录路径
   */
  getBaseDir(): string {
    return this.baseDir
  }

  getWorkspaceDir(): string {
    return this.workspaceDir
  }

  getDocumentsDir(): string {
    return this.documentsDir
  }

  getExportsDir(): string {
    return this.exportsDir
  }

  getTempDir(): string {
    return this.tempDir
  }

  /**
   * 生成文档文件的完整路径
   */
  getDocumentPath(filename: string): string {
    return path.join(this.documentsDir, filename)
  }

  /**
   * 生成导出文件的完整路径
   */
  getExportPath(filename: string): string {
    return path.join(this.exportsDir, filename)
  }

  /**
   * 生成临时文件的完整路径
   */
  getTempPath(filename: string): string {
    return path.join(this.tempDir, filename)
  }

  /**
   * 检查文件是否存在于工作区
   */
  async isFileInWorkspace(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(filePath)
      const resolvedWorkspace = path.resolve(this.workspaceDir)
      return resolvedPath.startsWith(resolvedWorkspace)
    } catch {
      return false
    }
  }

  /**
   * 获取工作区相对路径
   */
  getRelativePathInWorkspace(absolutePath: string): string {
    return path.relative(this.workspaceDir, absolutePath)
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.tempDir)
      for (const file of files) {
        const filePath = path.join(this.tempDir, file)
        const stat = await fs.stat(filePath)
        
        // 删除超过24小时的临时文件
        const age = Date.now() - stat.mtime.getTime()
        if (age > 24 * 60 * 60 * 1000) {
          await fs.unlink(filePath)
          console.log(`🗑️ [DeeChat] 清理临时文件: ${file}`)
        }
      }
    } catch (error) {
      console.warn('⚠️ [DeeChat] 清理临时文件失败:', error)
    }
  }

  /**
   * 获取目录统计信息
   */
  async getDirectoryStats(): Promise<{
    totalFiles: number
    totalSize: number
    documentsCount: number
    tempFilesCount: number
  }> {
    try {
      const stats = {
        totalFiles: 0,
        totalSize: 0,
        documentsCount: 0,
        tempFilesCount: 0
      }

      // 统计文档目录
      if (existsSync(this.documentsDir)) {
        const documentFiles = await fs.readdir(this.documentsDir)
        stats.documentsCount = documentFiles.length
        
        for (const file of documentFiles) {
          const filePath = path.join(this.documentsDir, file)
          const stat = await fs.stat(filePath)
          if (stat.isFile()) {
            stats.totalFiles++
            stats.totalSize += stat.size
          }
        }
      }

      // 统计临时目录
      if (existsSync(this.tempDir)) {
        const tempFiles = await fs.readdir(this.tempDir)
        stats.tempFilesCount = tempFiles.length
      }

      return stats
    } catch (error) {
      console.error('❌ [DeeChat] 获取目录统计失败:', error)
      return {
        totalFiles: 0,
        totalSize: 0,
        documentsCount: 0,
        tempFilesCount: 0
      }
    }
  }
}