/**
 * 进程内MCP服务器适配器
 * 直接在Electron主进程中运行PromptX MCP Server，避免双进程开销
 */

import log from 'electron-log'
import { MCPServerEntity } from '../../../../shared/entities/MCPServerEntity'
import * as path from 'path'
import { app } from 'electron'

export class InProcessMCPServer {
  private promptxServer: any = null
  private deechatServer: any = null // 🔥 添加DeeChat服务器实例
  private isRunning: boolean = false
  private workingDirectory: string
  
  constructor(private server: MCPServerEntity) {
    // 🔥 动态设置PromptX工作目录
    this.workingDirectory = server.workingDirectory || path.join(app.getPath('userData'), 'promptx-workspace')
    log.info(`[InProcess MCP] 初始化进程内MCP服务器: ${server.name}`)
    log.info(`[InProcess MCP] 工作目录: ${this.workingDirectory}`)
  }

  /**
   * 启动进程内MCP服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn(`[InProcess MCP] 服务器已在运行: ${this.server.name}`)
      return
    }

    try {
      // 🔥 根据服务器ID选择不同的启动逻辑
      if (this.server.id === 'promptx-builtin') {
        await this.startPromptXServer()
      } else if (this.server.id === 'deechat-workspace-builtin') {
        await this.startDeeChatWorkspaceServer()
      } else {
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
    // 🔥 设置环境变量
    process.env.MCP_DEBUG = 'true'
    process.env.PROMPTX_WORKSPACE = this.workingDirectory

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

    // 🔥 动态加载PromptX MCP服务器
    const promptxPath = this.getPromptXPath()
    log.info(`[InProcess MCP] 📦 加载PromptX模块: ${promptxPath}`)

    // 清除require缓存以确保重新加载
    delete require.cache[require.resolve(promptxPath)]

    const { MCPServerStdioCommand } = require(promptxPath)

    // 创建服务器实例
    this.promptxServer = new MCPServerStdioCommand()

    log.info(`[InProcess MCP] ✅ PromptX MCP服务器实例创建成功`)

    // 🔥 恢复原工作目录，让Electron正常运行
    process.chdir(originalCwd)
    log.info(`[InProcess MCP] 🔄 恢复工作目录: ${process.cwd()}`)
  }

  /**
   * 启动DeeChat工作区服务器
   */
  private async startDeeChatWorkspaceServer(): Promise<void> {
    log.info(`[InProcess MCP] 🚀 启动进程内DeeChat工作区MCP服务器...`)

    // 🔥 动态加载DeeChat工作区MCP服务器
    const deechatPath = this.getDeeChatWorkspacePath()
    log.info(`[InProcess MCP] 📦 加载DeeChat工作区模块: ${deechatPath}`)

    // 清除require缓存以确保重新加载
    delete require.cache[require.resolve(deechatPath)]

    const { DeeChatWorkspaceMCPServer } = require(deechatPath)

    // 创建服务器实例（但不启动transport，因为我们在进程内使用）
    this.deechatServer = new DeeChatWorkspaceMCPServer()

    log.info(`[InProcess MCP] ✅ DeeChat工作区MCP服务器实例创建成功`)
  }

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
      } else if (this.server.id === 'deechat-workspace-builtin' && this.deechatServer) {
        return await this.callDeeChatTool(toolName, args)
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

    // 🎯 设置环境变量确保PromptX正确识别工作目录
    const originalPromptXWorkspace = process.env.PROMPTX_WORKSPACE
    process.env.PROMPTX_WORKSPACE = this.workingDirectory

    try {
      // 直接调用PromptX的工具方法
      const result = await this.promptxServer.callTool(toolName, args)

      log.info(`[InProcess MCP] ✅ PromptX工具调用完成: ${toolName}`)
      return result

    } finally {
      // 恢复环境变量和工作目录
      if (originalPromptXWorkspace !== undefined) {
        process.env.PROMPTX_WORKSPACE = originalPromptXWorkspace
      } else {
        delete process.env.PROMPTX_WORKSPACE
      }
      process.chdir(originalCwd)
    }
  }

  /**
   * 调用DeeChat工具
   */
  private async callDeeChatTool(toolName: string, args: any): Promise<any> {
    // DeeChat工具调用不需要切换工作目录
    const result = await this.deechatServer.callTool(toolName, args)

    log.info(`[InProcess MCP] ✅ DeeChat工具调用完成: ${toolName}`)
    return result
  }

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
      } else if (this.server.id === 'deechat-workspace-builtin' && this.deechatServer) {
        tools = this.deechatServer.getToolDefinitions()
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
    } else if (this.server.id === 'deechat-workspace-builtin') {
      return this.deechatServer !== null
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
      return path.resolve(__dirname, '../../../../../../dist/main/resources/promptx/package/src/lib/mcp/MCPServerStdioCommand.js')
    } else {
      // 生产环境
      return path.join(process.resourcesPath, 'resources/promptx/package/src/lib/mcp/MCPServerStdioCommand.js')
    }
  }

  /**
   * 获取DeeChat工作区模块路径
   */
  private getDeeChatWorkspacePath(): string {
    const isDev = process.env.NODE_ENV === 'development'

    if (isDev) {
      // 开发环境：从编译后的dist目录
      return path.resolve(__dirname, '../DeeChatWorkspaceMCPServer.js')
    } else {
      // 生产环境：使用打包后的资源
      return path.join(process.resourcesPath, 'dist/main/main/services/mcp/DeeChatWorkspaceMCPServer.js')
    }
  }
}