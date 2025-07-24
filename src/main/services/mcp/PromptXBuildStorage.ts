/**
 * PromptX构建时打包存储服务
 * 优先使用构建时预打包的PromptX，提供零延迟启动
 */

import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

export class PromptXBuildStorage {
  private readonly buildResourcesDir: string
  private readonly promptxBuildDir: string

  constructor() {
    // 构建时打包的资源目录 - 根据electron环境确定正确路径
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // 开发环境：使用项目根目录下的resources
      // __dirname 在开发环境指向 dist/main/main/services/mcp
      // 需要回到项目根目录 ../../../../.. 
      this.buildResourcesDir = join(__dirname, '..', '..', '..', '..', '..', 'resources')
    } else {
      // 生产环境：使用electron app的resources目录
      // 确保app已准备就绪
      if (!app.isReady()) {
        console.warn('⚠️ [PromptX构建] Electron app未准备就绪，使用备用路径')
        this.buildResourcesDir = join(process.resourcesPath || __dirname, 'resources')
      } else {
        this.buildResourcesDir = join(app.getAppPath(), '..', 'resources')
      }
    }
    
    this.promptxBuildDir = join(this.buildResourcesDir, 'promptx', 'package')
    
    // 开发环境显示路径信息
    if (isDev) {
      console.log(`🔧 [PromptX构建] 资源目录: ${this.buildResourcesDir}`)
    }
  }

  /**
   * 检查是否有构建时打包的版本
   */
  async hasBuildVersion(): Promise<boolean> {
    try {
      const stat = await fs.stat(this.promptxBuildDir)
      if (!stat.isDirectory()) {
        return false
      }

      // 验证入口文件是否存在
      try {
        await this.findPromptXEntry()
        return true
      } catch (error) {
        return false
      }
    } catch (error) {
      console.log('🔍 [PromptX构建] 未发现构建时打包版本')
      return false
    }
  }

  /**
   * 使用构建时打包版本启动PromptX MCP服务器
   */
  async startFromBuild(): Promise<{ command: string; args: string[]; workingDirectory: string }> {
    if (!await this.hasBuildVersion()) {
      throw new Error('构建时打包版本不存在')
    }

    // 🔥 动态查找正确的入口文件
    const entryPath = await this.findPromptXEntry()
    
    return {
      command: 'node',
      args: [entryPath, 'mcp-server'],
      workingDirectory: this.promptxBuildDir
    }
  }

  /**
   * 动态查找PromptX的入口文件
   */
  private async findPromptXEntry(): Promise<string> {
    // 可能的入口文件路径
    const possibleEntries = [
      join(this.promptxBuildDir, 'dist', 'mcp-server.js'),
      join(this.promptxBuildDir, 'src', 'bin', 'promptx.js'),
      join(this.promptxBuildDir, 'bin', 'promptx.js'),
      join(this.promptxBuildDir, 'lib', 'mcp-server.js'),
      join(this.promptxBuildDir, 'index.js')
    ]

    for (const entryPath of possibleEntries) {
      try {
        await fs.access(entryPath)
        return entryPath
      } catch (error) {
        // 继续查找下一个路径
      }
    }

    throw new Error(`未找到PromptX入口文件，搜索目录: ${this.promptxBuildDir}`)
  }

  /**
   * 获取构建版本信息
   */
  async getBuildVersionInfo(): Promise<{ version: string; buildTime: string } | null> {
    try {
      const packageJsonPath = join(this.promptxBuildDir, 'package.json')
      const packageData = await fs.readFile(packageJsonPath, 'utf-8')
      const packageInfo = JSON.parse(packageData)
      
      return {
        version: packageInfo.version || 'unknown',
        buildTime: new Date().toISOString() // 可以从文件修改时间获取
      }
    } catch (error) {
      console.warn('⚠️ [PromptX构建] 无法获取版本信息:', error)
      return null
    }
  }

  /**
   * 获取构建资源路径（用于调试）
   */
  getBuildPath(): string {
    return this.promptxBuildDir
  }
}