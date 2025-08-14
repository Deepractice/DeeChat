import { message } from 'antd'
import { WorkspaceFile } from '../../../shared/types/WorkspaceFile'

// 工作区文件管理器
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

  // 初始化工作区目录结构
  private async initializeWorkspaceDirectories() {
    try {
      // 直接通过Electron API确保workspace目录结构存在
      const promptxWorkspacePath = await this.getPromptXWorkspacePath()
      
      await window.electronAPI.file.ensureDir(`${promptxWorkspacePath}/workspace`)
      await window.electronAPI.file.ensureDir(`${promptxWorkspacePath}/workspace/temp`)
      await window.electronAPI.file.ensureDir(`${promptxWorkspacePath}/workspace/saved`)
      
      console.log('✅ 工作区目录结构初始化完成')
    } catch (error) {
      console.error('初始化工作区目录失败:', error)
    }
  }

  // 将用户上传的文件直接保存到PromptX工作区目录
  async addUserFile(file: File): Promise<WorkspaceFile> {
    try {
      const fileId = this.generateFileId()
      const fileName = file.name
      const fileExtension = '.' + fileName.split('.').pop()?.toLowerCase()
      
      // 读取文件内容
      const content = await file.text()
      
      console.log(`添加用户文件: ${fileName}, 大小: ${file.size} bytes`)

      // 创建工作区文件对象
      const workspaceFile: WorkspaceFile = {
        id: fileId,
        name: fileName,
        path: `workspace/temp/${fileId}_${fileName}`, // PromptX中的相对路径
        type: 'temp',
        fileType: fileExtension,
        size: file.size,
        createdAt: new Date(),
        lastAccessed: new Date(),
        autoCleanup: true,
        source: 'user-upload',
        content: content
      }

      // 通过Electron API直接保存到PromptX工作区目录
      // 这样用户和AI都能访问同一个物理文件
      const promptxWorkspacePath = await this.getPromptXWorkspacePath()
      const fullFilePath = `${promptxWorkspacePath}/workspace/temp/${fileId}_${fileName}`
      
      // 确保目录存在
      await window.electronAPI.file.ensureDir(`${promptxWorkspacePath}/workspace/temp`)
      
      // 保存文件到物理磁盘
      await window.electronAPI.file.write(fullFilePath, content)
      
      // 添加到内存缓存
      this.files.set(fileId, workspaceFile)
      
      message.success(`文件已加载到工作区: ${fileName}`)
      console.log(`✅ 文件 ${fileName} 已直接保存到PromptX目录，用户和AI都可访问`)
      
      return workspaceFile

    } catch (error) {
      console.error('添加用户文件失败:', error)
      message.error(`加载文件失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  // 获取PromptX工作区路径
  private async getPromptXWorkspacePath(): Promise<string> {
    // 从环境变量或默认路径获取PromptX工作区路径
    return window.electronAPI.file.getPromptXWorkspacePath?.() || 
           `${await window.electronAPI.file.getAppDataPath()}/.promptx`
  }



  // 读取工作区文件内容（优先从内存缓存）
  async readFile(workspaceFile: WorkspaceFile): Promise<string> {
    try {
      // 优先返回内存中的内容
      if (workspaceFile.content) {
        workspaceFile.lastAccessed = new Date()
        return workspaceFile.content
      }

      // 如果内存中没有，直接从物理文件读取
      const promptxWorkspacePath = await this.getPromptXWorkspacePath()
      const fullFilePath = `${promptxWorkspacePath}/${workspaceFile.path}`
      
      const content = await window.electronAPI.file.readFile(fullFilePath)

      // 更新内存缓存
      workspaceFile.lastAccessed = new Date()
      workspaceFile.content = content
      
      return content

    } catch (error) {
      console.error('读取文件失败:', error)
      throw error
    }
  }

  // 保存文件内容到PromptX工作区
  async saveFile(workspaceFile: WorkspaceFile, content: string): Promise<void> {
    try {
      // 直接写入物理文件到PromptX目录
      const promptxWorkspacePath = await this.getPromptXWorkspacePath()
      const fullFilePath = `${promptxWorkspacePath}/${workspaceFile.path}`
      
      await window.electronAPI.file.write(fullFilePath, content)

      // 更新缓存
      workspaceFile.content = content
      workspaceFile.lastAccessed = new Date()
      
      message.success(`文件已保存: ${workspaceFile.name}`)
      console.log(`✅ 文件已直接保存到: ${fullFilePath}`)

    } catch (error) {
      console.error('保存文件失败:', error)
      message.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
      throw error
    }
  }

  // 将临时文件标记为已保存（移动到saved目录）
  async markFileAsSaved(fileId: string): Promise<void> {
    const file = this.files.get(fileId)
    if (!file) {
      throw new Error('文件不存在')
    }

    const savedPath = `workspace/saved/${file.id}_${file.name}`
    
    try {
      const promptxWorkspacePath = await this.getPromptXWorkspacePath()
      const oldFilePath = `${promptxWorkspacePath}/${file.path}`
      const newFilePath = `${promptxWorkspacePath}/${savedPath}`
      
      // 确保saved目录存在
      await window.electronAPI.file.ensureDir(`${promptxWorkspacePath}/workspace/saved`)
      
      // 读取原文件内容
      const content = file.content || await window.electronAPI.file.readFile(oldFilePath)
      
      // 写入新位置
      await window.electronAPI.file.write(newFilePath, content)
      
      // 删除旧文件（如果有直接移动文件的API，可以用那个）
      // 这里暂时用读取-写入-删除的方式
      
      // 更新文件信息
      file.path = savedPath
      file.type = 'saved'
      file.autoCleanup = false
      file.content = content

      message.success(`文件已保存到永久目录: ${file.name}`)

    } catch (error) {
      console.error('标记文件为已保存失败:', error)
      throw error
    }
  }

  // 删除工作区文件
  async deleteFile(fileId: string): Promise<void> {
    const file = this.files.get(fileId)
    if (!file) {
      return
    }

    try {
      // 删除物理文件（如果有删除API的话）
      // 暂时只从内存中移除，物理文件可以通过清理过期文件的机制处理
      
      // 从内存缓存中移除
      this.files.delete(fileId)
      
      message.success(`文件已从工作区移除: ${file.name}`)

    } catch (error) {
      console.error('删除文件失败:', error)
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 获取所有工作区文件
  getAllFiles(): WorkspaceFile[] {
    return Array.from(this.files.values())
  }

  // 根据ID获取文件
  getFile(fileId: string): WorkspaceFile | undefined {
    return this.files.get(fileId)
  }

  // 清理过期的临时文件
  async cleanupExpiredFiles(maxAgeInDays: number = 7): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeInDays)

    const expiredFiles = Array.from(this.files.values()).filter(file => 
      file.type === 'temp' && 
      file.autoCleanup && 
      file.lastAccessed < cutoffDate
    )

    for (const file of expiredFiles) {
      await this.deleteFile(file.id)
    }

    if (expiredFiles.length > 0) {
      message.info(`已清理 ${expiredFiles.length} 个过期文件`)
    }
  }

  // 生成唯一文件ID
  private generateFileId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}