import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import { BaseService, ServiceEvent } from '../../core/BaseService'
import { FileService } from '../FileService'
import log from 'electron-log'

// 重用原有的接口定义
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
  folderPath: string[]
  parentFolder?: string
  depth: number
  isLeaf: boolean
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

/**
 * PromptX资源管理服务
 * 专门处理PromptX相关的资源扫描、解析和管理
 */
export class PromptXResourceService extends BaseService {
  private promptxResourceDir: string
  // private fileService: FileService // 预留，未来可能需要

  constructor(_fileService: FileService) {
    super('PromptXResourceService')
    // this.fileService = fileService // 预留，未来可能需要
    this.promptxResourceDir = path.join(app.getPath('userData'), 'promptx-workspace', '.promptx', 'resource')
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing PromptXResourceService')
    this.emit(ServiceEvent.READY)
    this.logger.info('PromptXResourceService initialized')
  }

  /**
   * 扫描PromptX资源目录
   */
  async scanPromptXResources(category?: string): Promise<BaseFileMetadata[]> {
    try {
      log.info(`📁 [PromptXResourceService] 开始扫描PromptX资源目录: ${this.promptxResourceDir}`)
      
      // 检查PromptX资源目录是否存在
      try {
        await fs.access(this.promptxResourceDir)
      } catch {
        log.warn(`⚠️ [PromptXResourceService] PromptX资源目录不存在: ${this.promptxResourceDir}`)
        return []
      }

      const resources: BaseFileMetadata[] = []
      await this.scanDirectory(this.promptxResourceDir, [], resources)
      
      // 根据category过滤
      const filteredResources = category 
        ? resources.filter(resource => resource.category === category)
        : resources
      
      log.info(`✅ [PromptXResourceService] 扫描完成，找到 ${filteredResources.length} 个资源文件`)
      return filteredResources
    } catch (error) {
      log.error('❌ [PromptXResourceService] 扫描PromptX资源失败:', error)
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
      log.error(`❌ [PromptXResourceService] 扫描目录失败: ${dirPath}`, error)
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
    
    return 'role'
  }

  /**
   * 确定资源来源
   */
  private determineSource(folderPath: string[]): 'system' | 'project' | 'user' {
    // 简单的来源判断逻辑，可以根据实际需求调整
    if (folderPath.includes('system')) return 'system'
    if (folderPath.includes('user')) return 'user'
    return 'project'
  }

  /**
   * 生成文件ID
   */
  private generateFileId(buffer: Buffer): string {
    const hash = createHash('sha256')
    hash.update(buffer)
    return hash.digest('hex').substring(0, 16)
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
      '.ts': 'application/typescript',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml'
    }
    return mimeTypes[ext.toLowerCase()] || 'text/plain'
  }

  /**
   * 提取文件描述信息
   */
  private async extractDescription(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      // 提取文件的前几行作为描述
      const lines = content.split('\n').slice(0, 3)
      return lines.join(' ').substring(0, 200) + '...'
    } catch {
      return ''
    }
  }

  /**
   * 读取PromptX资源文件内容
   */
  async readPromptXResource(fileId: string): Promise<string> {
    try {
      const resources = await this.scanPromptXResources()
      const resource = resources.find(r => r.id === fileId)
      
      if (!resource) {
        throw new Error(`PromptX资源文件未找到: ${fileId}`)
      }
      
      const content = await fs.readFile(resource.path, 'utf-8')
      return content
    } catch (error) {
      log.error(`❌ [PromptXResourceService] 读取资源文件失败: ${fileId}`, error)
      throw error
    }
  }

  /**
   * 更新PromptX资源文件内容
   */
  async updatePromptXResource(fileId: string, content: string): Promise<void> {
    try {
      const resources = await this.scanPromptXResources()
      const resource = resources.find(r => r.id === fileId)
      
      if (!resource) {
        throw new Error(`PromptX资源文件未找到: ${fileId}`)
      }
      
      await fs.writeFile(resource.path, content, 'utf-8')
      log.info(`✅ [PromptXResourceService] 资源文件内容已更新: ${resource.name}`)
    } catch (error) {
      log.error(`❌ [PromptXResourceService] 更新资源文件失败: ${fileId}`, error)
      throw error
    }
  }

  /**
   * 构建PromptX资源的树形结构
   */
  async getPromptXResourceTree(category?: string): Promise<TreeNode[]> {
    try {
      const resources = await this.scanPromptXResources(category) as PromptXResource[]
      return this.buildTreeFromResources(resources)
    } catch (error) {
      log.error('❌ [PromptXResourceService] 构建资源树失败:', error)
      return []
    }
  }

  /**
   * 从资源列表构建树形结构
   */
  private buildTreeFromResources(resources: PromptXResource[]): TreeNode[] {
    const tree: TreeNode[] = []
    const folderMap = new Map<string, TreeNode>()

    resources.forEach(resource => {
      // 构建文件节点
      const fileNode: TreeNode = {
        key: resource.id,
        title: resource.name,
        isLeaf: true,
        type: 'file',
        protocol: resource.protocol,
        size: resource.size,
        createdAt: resource.createdAt,
        description: resource.description,
        fileData: resource
      }

      // 构建文件夹层级
      let currentPath = ''
      let currentLevel = tree
      
      resource.folderPath.forEach((folder, _index) => {
        currentPath = currentPath ? `${currentPath}/${folder}` : folder
        
        let folderNode = folderMap.get(currentPath)
        if (!folderNode) {
          folderNode = {
            key: currentPath,
            title: folder,
            isLeaf: false,
            type: 'folder',
            children: []
          }
          folderMap.set(currentPath, folderNode)
          currentLevel.push(folderNode)
        }
        
        currentLevel = folderNode.children!
      })

      // 将文件添加到最后一级文件夹
      currentLevel.push(fileNode)
    })

    return tree
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down PromptXResourceService')
  }
}