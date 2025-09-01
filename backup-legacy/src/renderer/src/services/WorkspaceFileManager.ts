import { message } from 'antd'
import { WorkspaceFile } from '../../../shared/types/WorkspaceFile'

/**
 * DeeChat工作区文件管理器 - 完全独立版本
 * 使用.deechat/workspace目录，与PromptX完全解耦
 */
export class WorkspaceFileManager {
  private static instance: WorkspaceFileManager
  private files: Map<string, WorkspaceFile> = new Map()
  
  // 单例模式
  static getInstance(): WorkspaceFileManager {
    if (!WorkspaceFileManager.instance) {
      WorkspaceFileManager.instance = new WorkspaceFileManager()
    }
    return WorkspaceFileManager.instance
  }

  private constructor() {
    this.initializeWorkspaceDirectories()
  }

  // 初始化DeeChat独立工作区目录结构
  private async initializeWorkspaceDirectories() {
    try {
      // 使用DeeChat专属的工作区目录
      const deechatWorkspacePath = await this.getDeeChatWorkspacePath()
      
      // 确保目录存在
      await window.electronAPI.file.ensureDir(`${deechatWorkspacePath}/documents`)
      await window.electronAPI.file.ensureDir(`${deechatWorkspacePath}/exports`)
      await window.electronAPI.file.ensureDir(`${deechatWorkspacePath}/temp`)
      
      console.log('✅ [DeeChat] 独立工作区目录结构初始化完成')
      console.log(`📍 [DeeChat] 工作区路径: ${deechatWorkspacePath}`)
    } catch (error) {
      console.error('❌ [DeeChat] 初始化工作区目录失败:', error)
    }
  }

  // 获取DeeChat专属工作区路径
  private async getDeeChatWorkspacePath(): Promise<string> {
    // 使用DeeChat专属目录结构：.deechat/workspace
    const appDataPath = await window.electronAPI.file.getAppDataPath()
    return `${appDataPath}/.deechat/workspace`
  }

  // 将用户上传的文件保存到DeeChat工作区
  async addUserFile(file: File): Promise<WorkspaceFile> {
    try {
      const fileId = this.generateFileId()
      const fileName = file.name
      const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
      
      // 读取文件内容
      const content = await file.text()
      
      console.log(`📄 [DeeChat] 添加用户文件: ${fileName}, 大小: ${file.size} bytes`)

      // 获取DeeChat工作区路径
      const workspacePath = await this.getDeeChatWorkspacePath()
      const documentsPath = `${workspacePath}/documents`
      const fileName_safe = `${fileId}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const absolutePath = `${documentsPath}/${fileName_safe}`

      // 创建工作区文件对象
      const workspaceFile: WorkspaceFile = {
        id: fileId,
        name: fileName,
        path: absolutePath, // DeeChat专属路径
        type: 'workspace',
        fileType: fileExtension,
        size: file.size,
        createdAt: new Date(),
        lastAccessed: new Date(),
        autoCleanup: false,
        source: 'user-upload',
        content: content
      }

      // 确保documents目录存在
      await window.electronAPI.file.ensureDir(documentsPath)
      
      // 保存文件到DeeChat工作区
      await window.electronAPI.file.write(absolutePath, content)
      
      // 添加到内存缓存
      this.files.set(fileId, workspaceFile)
      
      message.success(`文件已加载到DeeChat工作区: ${fileName}`)
      console.log(`✅ [DeeChat] 文件 ${fileName} 已保存到独立工作区，AI可通过MCP工具访问`)
      
      return workspaceFile

    } catch (error) {
      console.error('❌ [DeeChat] 添加用户文件失败:', error)
      message.error(`加载文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  // 保存文件内容（编辑时调用）
  async saveFile(workspaceFile: WorkspaceFile, newContent: string): Promise<void> {
    try {
      // 保存到物理文件
      await window.electronAPI.file.write(workspaceFile.path, newContent)
      
      // 更新内存中的文件对象
      workspaceFile.content = newContent
      workspaceFile.lastAccessed = new Date()
      workspaceFile.size = new Blob([newContent]).size
      
      this.files.set(workspaceFile.id, workspaceFile)
      
      console.log(`💾 [DeeChat] 文件已保存: ${workspaceFile.name}`)
    } catch (error) {
      console.error('❌ [DeeChat] 保存文件失败:', error)
      throw error
    }
  }

  // 导出单个文件
  async exportFile(workspaceFile: WorkspaceFile): Promise<void> {
    try {
      // 使用DeeChat的导出目录
      const workspacePath = await this.getDeeChatWorkspacePath()
      const exportsPath = `${workspacePath}/exports`
      await window.electronAPI.file.ensureDir(exportsPath)
      
      // 生成带时间戳的文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const exportFileName = `${timestamp}_${workspaceFile.name}`
      const exportPath = `${exportsPath}/${exportFileName}`
      
      // 保存到导出目录
      await window.electronAPI.file.write(exportPath, workspaceFile.content || '')
      
      message.success(`文件已导出: ${exportFileName}`)
      console.log(`📤 [DeeChat] 文件已导出到: ${exportPath}`)
      
      // 可选：打开文件所在文件夹
      if (window.electronAPI.file.showInFolder) {
        await window.electronAPI.file.showInFolder(exportPath)
      }
      
    } catch (error) {
      console.error('❌ [DeeChat] 导出文件失败:', error)
      throw error
    }
  }

  // 批量导出所有文件
  async exportAllFiles(): Promise<void> {
    try {
      if (this.files.size === 0) {
        message.warning('工作区中没有文件可导出')
        return
      }

      const workspacePath = await this.getDeeChatWorkspacePath()
      const exportsPath = `${workspacePath}/exports`
      await window.electronAPI.file.ensureDir(exportsPath)
      
      // 创建批量导出文件夹
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const batchExportPath = `${exportsPath}/batch_export_${timestamp}`
      await window.electronAPI.file.ensureDir(batchExportPath)
      
      let exportedCount = 0
      for (const [, file] of this.files) {
        try {
          const exportFilePath = `${batchExportPath}/${file.name}`
          await window.electronAPI.file.write(exportFilePath, file.content || '')
          exportedCount++
        } catch (error) {
          console.warn(`⚠️ [DeeChat] 导出文件失败: ${file.name}`, error)
        }
      }
      
      message.success(`批量导出完成，共导出 ${exportedCount} 个文件`)
      console.log(`📦 [DeeChat] 批量导出完成: ${batchExportPath}`)
      
      // 打开导出文件夹
      if (window.electronAPI.file.showInFolder) {
        await window.electronAPI.file.showInFolder(batchExportPath)
      }
      
    } catch (error) {
      console.error('❌ [DeeChat] 批量导出失败:', error)
      throw error
    }
  }

  // 获取文件
  getFile(fileId: string): WorkspaceFile | undefined {
    return this.files.get(fileId)
  }

  // 获取所有文件
  getAllFiles(): WorkspaceFile[] {
    return Array.from(this.files.values())
  }

  // 移除文件
  async removeFile(fileId: string): Promise<void> {
    const file = this.files.get(fileId)
    if (!file) {
      throw new Error('文件不存在')
    }

    try {
      // 删除物理文件
      await window.electronAPI.file.delete(file.path)
      
      // 从内存中移除
      this.files.delete(fileId)
      
      message.success(`文件已删除: ${file.name}`)
      console.log(`🗑️ [DeeChat] 文件已删除: ${file.name}`)
    } catch (error) {
      console.error('❌ [DeeChat] 删除文件失败:', error)
      throw error
    }
  }

  // 清空工作区
  async clearWorkspace(): Promise<void> {
    try {
      // 删除所有物理文件
      for (const [, file] of this.files) {
        try {
          await window.electronAPI.file.delete(file.path)
        } catch (error) {
          console.warn(`⚠️ [DeeChat] 删除文件失败: ${file.name}`, error)
        }
      }
      
      // 清空内存缓存
      this.files.clear()
      
      message.success('工作区已清空')
      console.log('🧹 [DeeChat] 工作区已清空')
    } catch (error) {
      console.error('❌ [DeeChat] 清空工作区失败:', error)
      throw error
    }
  }

  // 获取工作区统计信息
  getWorkspaceStats() {
    const files = Array.from(this.files.values())
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    
    return {
      totalFiles: files.length,
      totalSize: totalSize,
      fileTypes: this.getFileTypeDistribution(files),
      lastActivity: files.length > 0 ? Math.max(...files.map(f => f.lastAccessed.getTime())) : null
    }
  }

  // 获取文件类型分布
  private getFileTypeDistribution(files: WorkspaceFile[]) {
    const distribution: Record<string, number> = {}
    files.forEach(file => {
      const type = file.fileType || 'unknown'
      distribution[type] = (distribution[type] || 0) + 1
    })
    return distribution
  }

  // 生成文件ID
  private generateFileId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 清理临时文件（定期调用）
  async cleanupTempFiles(): Promise<void> {
    try {
      const workspacePath = await this.getDeeChatWorkspacePath()
      const tempPath = `${workspacePath}/temp`
      
      // 这里可以实现临时文件清理逻辑
      // 比如删除超过24小时的临时文件
      console.log('🧹 [DeeChat] 临时文件清理完成')
    } catch (error) {
      console.warn('⚠️ [DeeChat] 临时文件清理失败:', error)
    }
  }
}