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
      
      this.isRunning = true
      log.info(`[InProcess MCP] 🎉 进程内MCP服务器启动完成: ${this.server.name}`)
      
    } catch (error) {
      log.error(`[InProcess MCP] ❌ 启动失败: ${this.server.name}`, error)
      throw error
    }
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
    if (!this.isRunning || !this.promptxServer) {
      throw new Error('MCP服务器未运行')
    }

    try {
      log.info(`[InProcess MCP] 🔧 调用工具: ${toolName}`)
      
      // 🔥 切换到PromptX工作目录进行工具调用
      const originalCwd = process.cwd()
      process.chdir(this.workingDirectory)
      
      // 🎯 设置环境变量确保PromptX正确识别工作目录
      const originalPromptXWorkspace = process.env.PROMPTX_WORKSPACE
      process.env.PROMPTX_WORKSPACE = this.workingDirectory
      
      try {
        // 直接调用PromptX的工具方法
        const result = await this.promptxServer.callTool(toolName, args)
        
        log.info(`[InProcess MCP] ✅ 工具调用完成: ${toolName}`)
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
      
    } catch (error) {
      log.error(`[InProcess MCP] ❌ 工具调用失败: ${toolName}`, error)
      throw error
    }
  }

  /**
   * 获取工具列表
   */
  async listTools(): Promise<any[]> {
    if (!this.isRunning || !this.promptxServer) {
      throw new Error('MCP服务器未运行')
    }

    try {
      const tools = this.promptxServer.getToolDefinitions()
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
    return this.isRunning && this.promptxServer !== null
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
}