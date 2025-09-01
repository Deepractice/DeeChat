/**
 * PromptX构建时打包存储服务
 * 优先使用构建时预打包的PromptX，提供零延迟启动
 */

import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'

export class PromptXBuildStorage {
  private buildResourcesDir: string // 🔥 改为可修改，支持动态路径修正
  private promptxBuildDir: string   // 🔥 改为可修改，支持动态路径修正

  constructor() {
    // 构建时打包的资源目录 - 多重策略确保路径解析成功
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // 开发环境：使用项目根目录下的resources
      // __dirname 在开发环境指向 dist/main/main/services/mcp
      // 需要回到项目根目录 ../../../../.. 
      this.buildResourcesDir = join(__dirname, '..', '..', '..', '..', '..', 'resources')
    } else {
      // 生产环境：使用多重策略确保路径正确
      // 🔥 策略1: 使用process.resourcesPath（最可靠）
      if (process.resourcesPath) {
        this.buildResourcesDir = join(process.resourcesPath, 'resources')
        console.log(`🔧 [PromptX构建] 策略1成功 - process.resourcesPath: ${process.resourcesPath}`)
      }
      // 🔥 策略2: 使用app.getAppPath()
      else if (app.isReady()) {
        const appPath = app.getAppPath()
        if (appPath.endsWith('.asar')) {
          // asar包：app.asar同级的Resources下
          this.buildResourcesDir = join(appPath, '..', 'Resources', 'resources')
        } else {
          // 非asar：相对路径
          this.buildResourcesDir = join(appPath, '..', 'resources')
        }
        console.log(`🔧 [PromptX构建] 策略2成功 - app.getAppPath(): ${appPath}`)
      }
      // 🔥 策略3: 基于__dirname推断（兜底方案）
      else {
        // 在打包后__dirname通常指向app.asar内部
        // 尝试多个可能的相对路径
        const possiblePaths = [
          join(__dirname, '..', '..', '..', '..', 'Resources', 'resources'), // asar内部到Resources
          join(__dirname, '..', '..', '..', '..', 'resources'), // 普通打包
          join(__dirname, '..', '..', '..', 'resources'), // 备用路径1
          join(__dirname, '..', '..', 'resources'), // 备用路径2
        ]
        
        // 选择第一个存在的路径
        this.buildResourcesDir = possiblePaths[0] // 默认使用第一个
        console.warn(`⚠️ [PromptX构建] 策略3启用 - 使用__dirname推断: ${this.buildResourcesDir}`)
      }
    }
    
    this.promptxBuildDir = join(this.buildResourcesDir, 'promptx', 'package')
    
    // 显示路径信息（开发和生产环境都显示，用于调试）
    console.log(`🔧 [PromptX构建] 环境: ${isDev ? '开发' : '生产'}`)
    console.log(`🔧 [PromptX构建] 资源目录: ${this.buildResourcesDir}`)
    console.log(`🔧 [PromptX构建] PromptX目录: ${this.promptxBuildDir}`)
    console.log(`🔧 [PromptX构建] process.resourcesPath: ${process.resourcesPath || 'undefined'}`)
    console.log(`🔧 [PromptX构建] __dirname: ${__dirname}`)
  }

  /**
   * 检查是否有构建时打包的版本（增强版：支持动态路径探测）
   */
  async hasBuildVersion(): Promise<boolean> {
    // 🔥 如果初始路径不存在，尝试动态探测正确路径
    if (!await this.verifyPath(this.promptxBuildDir)) {
      console.log(`🔄 [PromptX构建] 初始路径无效，开始动态探测: ${this.promptxBuildDir}`)
      
      const correctedPath = await this.dynamicPathDetection()
      if (correctedPath) {
        // 更新内部路径
        this.buildResourcesDir = correctedPath.replace('/promptx/package', '')
        this.promptxBuildDir = correctedPath
        console.log(`✅ [PromptX构建] 路径修正成功: ${correctedPath}`)
      } else {
        console.log(`❌ [PromptX构建] 动态探测失败，无法找到PromptX资源`)
        return false
      }
    }

    try {
      console.log(`🔍 [PromptX构建] 检查构建版本: ${this.promptxBuildDir}`)
      const stat = await fs.stat(this.promptxBuildDir)
      if (!stat.isDirectory()) {
        console.log('❌ [PromptX构建] 路径不是目录')
        return false
      }

      // 验证入口文件是否存在
      try {
        const entryPath = await this.findPromptXEntry()
        console.log(`✅ [PromptX构建] 发现构建版本，入口: ${entryPath}`)
        return true
      } catch (error) {
        console.log(`❌ [PromptX构建] 未找到入口文件: ${error}`)
        return false
      }
    } catch (error) {
      console.log(`❌ [PromptX构建] 未发现构建时打包版本: ${error}`)
      return false
    }
  }

  /**
   * 验证路径是否存在
   */
  private async verifyPath(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * 动态路径探测 - 在多个可能位置搜索PromptX资源
   */
  private async dynamicPathDetection(): Promise<string | null> {
    console.log(`🔍 [PromptX构建] 开始动态路径探测...`)
    
    // 🔥 基于不同策略生成可能的路径
    const possiblePaths: string[] = []
    
    // 策略1: 基于process.resourcesPath
    if (process.resourcesPath) {
      possiblePaths.push(join(process.resourcesPath, 'resources', 'promptx', 'package'))
    }
    
    // 策略2: 基于app.getAppPath()
    if (app.isReady()) {
      const appPath = app.getAppPath()
      if (appPath.endsWith('.asar')) {
        possiblePaths.push(join(appPath, '..', 'Resources', 'resources', 'promptx', 'package'))
      } else {
        possiblePaths.push(join(appPath, '..', 'resources', 'promptx', 'package'))
      }
    }
    
    // 策略3: 基于__dirname的多层回溯
    const baseDirLevels = ['..', '..', '..', '..', '..', '..'] // 最多回溯6层
    for (let i = 4; i <= baseDirLevels.length; i++) {
      const levels = baseDirLevels.slice(0, i)
      possiblePaths.push(join(__dirname, ...levels, 'resources', 'promptx', 'package'))
      possiblePaths.push(join(__dirname, ...levels, 'Resources', 'resources', 'promptx', 'package'))
    }
    
    // 策略4: 基于工作目录
    possiblePaths.push(join(process.cwd(), 'resources', 'promptx', 'package'))
    possiblePaths.push(join(process.cwd(), '..', 'resources', 'promptx', 'package'))
    
    console.log(`🔍 [PromptX构建] 探测路径列表 (${possiblePaths.length}个):`)
    possiblePaths.forEach((path, index) => {
      console.log(`   ${index + 1}. ${path}`)
    })
    
    // 验证每个路径
    for (const path of possiblePaths) {
      if (await this.verifyPath(path)) {
        console.log(`✅ [PromptX构建] 找到有效路径: ${path}`)
        return path
      }
    }
    
    console.log(`❌ [PromptX构建] 所有路径探测失败`)
    return null
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
      command: 'node', // MCP stdio协议确实需要独立的Node.js进程
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