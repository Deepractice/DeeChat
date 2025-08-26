/**
 * 进程内MCP服务器适配器
 * 直接在Electron主进程中运行PromptX MCP Server，避免双进程开销
 */

import log from 'electron-log'
import { MCPServerEntity } from '../../../../shared/entities/MCPServerEntity'
import * as path from 'path'
import { DEECHAT_PROJECT_DIR, setPromptXEnvironmentVariables } from '../../../../shared/constants/promptx'

export class InProcessMCPServer {
  private promptxServer: any = null
  // private deechatServer: any = null // 🚫 DeeChat工作区MCP已移除
  private isRunning: boolean = false
  private workingDirectory: string
  
  constructor(private server: MCPServerEntity) {
    // 🔥 使用DeeChat项目目录作为MCP服务器工作目录
    this.workingDirectory = server.workingDirectory || DEECHAT_PROJECT_DIR
    log.info(`[InProcess MCP] 初始化进程内MCP服务器: ${server.name}`)
    log.info(`[InProcess MCP] DeeChat项目工作目录: ${this.workingDirectory}`)
  }

  /**
   * 启动进程内MCP服务器
   */
  async start(): Promise<void> {
    log.info(`[InProcess MCP] 🚀 开始启动进程内MCP服务器: ${this.server.name}, ID: ${this.server.id}`)
    
    if (this.isRunning) {
      log.warn(`[InProcess MCP] 服务器已在运行: ${this.server.name}`)
      return
    }

    try {
      // 🔥 根据服务器ID选择不同的启动逻辑
      log.info(`[InProcess MCP] 🔍 检查服务器ID: ${this.server.id}`)
      
      if (this.server.id === 'promptx-builtin') {
        log.info(`[InProcess MCP] ✅ 匹配到PromptX服务器，开始启动...`)
        await this.startPromptXServer()
      } else {
        log.error(`[InProcess MCP] ❌ 不支持的进程内服务器类型: ${this.server.id}`)
        throw new Error(`不支持的进程内服务器类型: ${this.server.id}`)
      }

      this.isRunning = true
      log.info(`[InProcess MCP] 🎉 进程内MCP服务器启动完成: ${this.server.name}`)

    } catch (error) {
      log.error(`[InProcess MCP] ❌ 启动失败: ${this.server.name}`, error)
      throw error
    }
  }

  /**
   * 启动PromptX服务器
   */
  private async startPromptXServer(): Promise<void> {
    log.info(`[InProcess MCP] 🚀 启动进程内PromptX MCP服务器...`)
    log.info(`[InProcess MCP] 🔧 PromptX启动参数: 工作目录=${this.workingDirectory}`)
    
    // 🔥 设置统一的PromptX环境变量
    setPromptXEnvironmentVariables()
    process.env.MCP_DEBUG = 'true'

    // 🎯 🔥 CRITICAL: 直接设置ProjectManager项目路径，确保初始化目录与角色发现目录一致
    try {
      // 动态require PromptX的ProjectManager
      const promptxPath = this.getPromptXPath()
      const promptxDir = path.dirname(promptxPath)
      const ProjectManagerPath = path.resolve(promptxDir, '../../../utils/ProjectManager.js')
      
      log.info(`[InProcess MCP] 🎯 直接设置ProjectManager项目路径: ${ProjectManagerPath}`)
      const ProjectManager = require(ProjectManagerPath)
      
      // 直接调用静态方法设置当前项目，确保@project://协议指向正确目录
      ProjectManager.setCurrentProject(
        this.workingDirectory,  // 使用DeeChat项目目录
        'electron-mcp',         // MCP ID
        'electron',             // IDE类型
        'stdio'                 // 传输协议
      )
      
      log.info(`[InProcess MCP] ✅ ProjectManager项目路径设置成功，初始化目录与角色发现目录现已统一为: ${this.workingDirectory}`)
    } catch (error) {
      log.error(`[InProcess MCP] ❌ 设置ProjectManager项目路径失败:`, error)
      // 不中断启动流程，继续使用环境变量方式
    }

    // 🔥 切换到PromptX工作目录
    const originalCwd = process.cwd()
    log.info(`[InProcess MCP] 🔄 切换工作目录: ${originalCwd} -> ${this.workingDirectory}`)

    // 确保工作目录存在
    const fs = require('fs')
    if (!fs.existsSync(this.workingDirectory)) {
      fs.mkdirSync(this.workingDirectory, { recursive: true })
      log.info(`[InProcess MCP] 📁 创建工作目录: ${this.workingDirectory}`)
    }

    process.chdir(this.workingDirectory)

    // 🔥 动态加载PromptX MCP服务器（支持ES模块）
    const promptxPath = this.getPromptXPath()
    log.info(`[InProcess MCP] 📦 加载PromptX模块: ${promptxPath}`)

    // 🌐 添加Web API polyfill for undici兼容性
    if (typeof (global as any).File === 'undefined') {
      log.info(`[InProcess MCP] 🔧 添加File API polyfill for undici兼容性...`)
      // 简单的File构造函数polyfill
      ;(global as any).File = class File {
        name: string
        size: number
        type: string
        lastModified: number
        
        constructor(_fileBits: any, fileName: string, options: any = {}) {
          this.name = fileName
          this.size = 0
          this.type = options.type || ''
          this.lastModified = options.lastModified || Date.now()
        }
      }
      // 也确保globalThis也有这些
      if (typeof (globalThis as any).File === 'undefined') {
        (globalThis as any).File = (global as any).File
      }
    }

    try {
      // 🚀 使用动态import()加载ES模块兼容的PromptX服务器
      log.info(`[InProcess MCP] 🔄 使用动态import()加载ES模块...`)
      
      // 动态import支持ES模块，使用Function构造器确保TypeScript不会转换它
      const dynamicImport = new Function('modulePath', 'return import(modulePath)') as (path: string) => Promise<any>
      const FastMCPStdioServerModule = await dynamicImport(promptxPath)
      
      // 处理ES模块的默认导出或具名导出
      const FastMCPStdioServer = FastMCPStdioServerModule.default || FastMCPStdioServerModule
      
      // 创建服务器实例
      this.promptxServer = new FastMCPStdioServer()
      
      // 🔥 启动服务器以初始化工具注册
      await this.promptxServer.start()
      
      log.info(`[InProcess MCP] ✅ PromptX MCP服务器实例创建并启动成功（ES模块模式）`)
    } catch (error) {
      log.error(`[InProcess MCP] ❌ ES模块加载失败，尝试CommonJS回退:`, error)
      
      try {
        // 🔄 回退到CommonJS模式（为了兼容性）
        const FastMCPStdioServer = require(promptxPath)
        this.promptxServer = new FastMCPStdioServer()
        
        // 🔥 启动服务器以初始化工具注册
        await this.promptxServer.start()
        
        log.info(`[InProcess MCP] ✅ PromptX MCP服务器实例创建并启动成功（CommonJS回退模式）`)
      } catch (fallbackError) {
        log.error(`[InProcess MCP] ❌ CommonJS回退也失败:`, fallbackError)
        throw fallbackError
      }
    }

    // 🔥 恢复原工作目录，让Electron正常运行
    process.chdir(originalCwd)
    log.info(`[InProcess MCP] 🔄 恢复工作目录: ${process.cwd()}`)
  }

  // 🚫 DeeChat工作区MCP已移除
  // /**
  //  * 启动DeeChat工作区服务器
  //  */
  // private async startDeeChatWorkspaceServer(): Promise<void> {
  //   log.info(`[InProcess MCP] 🚀 启动进程内DeeChat工作区MCP服务器...`)
  //   // ... 实现已移除
  // }

  /**
   * 停止进程内MCP服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }

    try {
      log.info(`[InProcess MCP] 🛑 停止进程内MCP服务器: ${this.server.name}`)
      
      if (this.promptxServer && this.promptxServer.cleanup) {
        this.promptxServer.cleanup()
      }
      
      this.promptxServer = null
      this.isRunning = false
      
      log.info(`[InProcess MCP] ✅ 进程内MCP服务器已停止: ${this.server.name}`)
    } catch (error) {
      log.error(`[InProcess MCP] ❌ 停止失败: ${this.server.name}`, error)
    }
  }

  /**
   * 调用工具
   */
  async callTool(toolName: string, args: any = {}): Promise<any> {
    if (!this.isRunning) {
      throw new Error('MCP服务器未运行')
    }

    try {
      log.info(`[InProcess MCP] 🔧 调用工具: ${toolName}`)

      // 🔥 根据服务器类型选择不同的工具调用逻辑
      if (this.server.id === 'promptx-builtin' && this.promptxServer) {
        return await this.callPromptXTool(toolName, args)
      } else {
        throw new Error(`服务器未就绪或不支持的服务器类型: ${this.server.id}`)
      }

    } catch (error) {
      log.error(`[InProcess MCP] ❌ 工具调用失败: ${toolName}`, error)
      throw error
    }
  }

  /**
   * 调用PromptX工具
   */
  private async callPromptXTool(toolName: string, args: any): Promise<any> {
    // 🔥 切换到PromptX工作目录进行工具调用
    const originalCwd = process.cwd()
    process.chdir(this.workingDirectory)

    // 🎯 确保使用统一的PromptX环境变量
    setPromptXEnvironmentVariables()

    try {
      // 直接调用PromptX的工具方法
      const result = await this.promptxServer.callTool(toolName, args)

      log.info(`[InProcess MCP] ✅ PromptX工具调用完成: ${toolName}`)
      return result

    } finally {
      // 恢复工作目录
      process.chdir(originalCwd)
    }
  }

  // 🚫 DeeChat工作区MCP已移除
  // /**
  //  * 调用DeeChat工具
  //  */
  // private async callDeeChatTool(toolName: string, args: any): Promise<any> {
  //   // ... 实现已移除
  // }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<any[]> {
    if (!this.isRunning) {
      throw new Error('MCP服务器未运行')
    }

    try {
      let tools: any[] = []

      // 🔥 根据服务器类型获取工具列表
      if (this.server.id === 'promptx-builtin' && this.promptxServer) {
        tools = this.promptxServer.getToolDefinitions()
      } else {
        throw new Error(`服务器未就绪或不支持的服务器类型: ${this.server.id}`)
      }

      log.info(`[InProcess MCP] 📋 获取工具列表: ${tools.length} 个工具`)
      return tools
    } catch (error) {
      log.error(`[InProcess MCP] ❌ 获取工具列表失败`, error)
      throw error
    }
  }

  /**
   * 检查服务器状态
   */
  isReady(): boolean {
    if (!this.isRunning) return false

    // 🔥 根据服务器类型检查状态
    if (this.server.id === 'promptx-builtin') {
      return this.promptxServer !== null
    }

    return false
  }

  /**
   * 获取PromptX模块路径
   */
  private getPromptXPath(): string {
    const isDev = process.env.NODE_ENV === 'development'

    if (isDev) {
      // 开发环境
      return path.resolve(__dirname, '../../../../../../dist/main/resources/promptx/package/src/lib/mcp/server/FastMCPStdioServer.js')
    } else {
      // 生产环境
      return path.join(process.resourcesPath, 'resources/promptx/package/src/lib/mcp/server/FastMCPStdioServer.js')
    }
  }

  // 🚫 DeeChat工作区MCP已移除
  // /**
  //  * 获取DeeChat工作区模块路径
  //  */
  // private getDeeChatWorkspacePath(): string {
  //   // ... 实现已移除
  // }
}