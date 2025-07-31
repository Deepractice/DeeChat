/**
 * 🔌 MCP服务协调器
 * 统一管理所有MCP服务，简化复杂的服务间通信
 * 
 * 核心改进：
 * 1. 简化服务发现和管理
 * 2. 统一进程生命周期
 * 3. 智能服务重连
 * 4. 资源共享和缓存
 */

import log from 'electron-log'
import { EventEmitter } from 'events'
import { ProcessPoolManager, ProcessConfig } from './ProcessPoolManager'
import { MCPServerEntity } from '../../shared/entities/MCPServerEntity'
import { MCPToolEntity } from '../../shared/entities/MCPToolEntity'

export interface MCPServerConnection {
  serverId: string
  server: MCPServerEntity
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  processId?: string
  connectedAt?: Date
  lastError?: string
  tools: MCPToolEntity[]
}

export class MCPServiceCoordinator extends EventEmitter {
  private processPool: ProcessPoolManager
  private connections: Map<string, MCPServerConnection> = new Map()
  private isInitialized = false

  // 内置服务器配置
  private builtinServers: MCPServerEntity[] = []

  constructor(processPool: ProcessPoolManager) {
    super()
    this.processPool = processPool
  }

  /**
   * 初始化MCP服务协调器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    log.info('🔌 [MCPCoordinator] 初始化MCP服务协调器...')

    // 初始化内置服务器
    await this.initializeBuiltinServers()

    // 启动所有启用的服务器
    await this.startEnabledServers()

    this.isInitialized = true
    log.info('✅ [MCPCoordinator] MCP服务协调器初始化完成')
  }

  /**
   * 初始化内置服务器（PromptX）
   * 🔥 重要：确保MCPIntegrationService被正确初始化
   */
  private async initializeBuiltinServers(): Promise<void> {
    log.info('🔧 [MCPCoordinator] 检查内置PromptX服务器配置...')

    // 🔥 直接触发MCPIntegrationService初始化，确保所有配置的服务器都被连接
    try {
      log.info('🚀 [MCPCoordinator] 触发MCPIntegrationService初始化...')
      const { MCPIntegrationService } = await import('../services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 强制初始化MCPIntegrationService，这会自动连接所有已启用的服务器
      await mcpService.initialize()
      log.info('✅ [MCPCoordinator] MCPIntegrationService初始化完成')
      
      // 检查MCPConfigService中是否已有PromptX配置
      const { MCPConfigService } = await import('../services/mcp/MCPConfigService')
      const configService = new MCPConfigService()
      
      const existingPromptX = await configService.getServerConfig('promptx-builtin')
      if (existingPromptX) {
        log.info('✅ [MCPCoordinator] PromptX已由MCPConfigService管理，跳过内置服务器创建')
        return
      }
    } catch (error) {
      log.error('❌ [MCPCoordinator] MCPIntegrationService初始化失败:', error)
      log.info('🔍 [MCPCoordinator] MCPConfigService中无PromptX配置，继续创建内置服务器')
    }

    // 如果MCPConfigService中没有配置，才创建内置服务器（备用逻辑）
    log.info('🔧 [MCPCoordinator] 创建备用PromptX内置服务器...')
    const promptxServer = await this.createBuiltinPromptXServer()
    this.builtinServers.push(promptxServer)

    log.info('✅ [MCPCoordinator] 内置服务器初始化完成')
  }

  /**
   * 创建内置PromptX服务器配置
   */
  private async createBuiltinPromptXServer(): Promise<MCPServerEntity> {
    const { app } = require('electron')
    const path = require('path')
    const fs = require('fs')

    // 创建PromptX工作空间
    const promptxWorkspace = path.join(app.getPath('userData'), 'promptx-workspace')
    
    if (!fs.existsSync(promptxWorkspace)) {
      fs.mkdirSync(promptxWorkspace, { recursive: true, mode: 0o755 })
      log.info(`📁 [MCPCoordinator] 创建PromptX工作空间: ${promptxWorkspace}`)
    }

    // 🔥 智能选择PromptX启动方式（使用Electron内置Node.js环境）
    let command: string
    let args: string[]

    const isDev = process.env.NODE_ENV === 'development'
    
    // 🚀 获取Electron内置的Node.js路径（避免启动新的Electron实例）
    const getElectronNodePath = () => {
      const electronPath = process.execPath
      if (process.platform === 'darwin') {
        // macOS: Electron.app/Contents/MacOS/Electron -> Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/node
        return path.join(path.dirname(electronPath), '..', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Resources', 'node')
      } else if (process.platform === 'win32') {
        // Windows: electron.exe 同目录下应该有 node.exe
        return path.join(path.dirname(electronPath), 'node.exe')
      } else {
        // Linux: 通常与electron在同目录
        return path.join(path.dirname(electronPath), 'node')
      }
    }

    const electronNodePath = getElectronNodePath()
    log.info(`🔍 [MCPCoordinator] Electron Node.js路径: ${electronNodePath}`)
    
    if (isDev) {
      // 开发模式：使用项目内置的PromptX + Electron Node.js
      const projectPromptxPath = path.resolve(__dirname, '../../../../resources/promptx/package/src/bin/promptx.js')
      log.info(`🔍 [MCPCoordinator] 检查PromptX路径: ${projectPromptxPath}`)
      
      if (fs.existsSync(projectPromptxPath)) {
        // 🎯 优先尝试使用Electron内置Node.js
        if (fs.existsSync(electronNodePath)) {
          command = electronNodePath
          args = [projectPromptxPath, 'mcp-server']
          log.info(`✅ [MCPCoordinator] 使用Electron内置Node.js: ${electronNodePath}`)
        } else {
          // 回退：使用系统Node.js（通过which node查找）
          command = 'node'
          args = [projectPromptxPath, 'mcp-server']
          log.info(`⚠️ [MCPCoordinator] 回退到系统Node.js`)
        }
        log.info(`✅ [MCPCoordinator] 找到PromptX文件: ${projectPromptxPath}`)
      } else {
        log.info(`❌ [MCPCoordinator] 找不到PromptX文件: ${projectPromptxPath}`)
        command = 'node'
        args = ['-e', 'log.info("PromptX服务器启动失败：找不到PromptX可执行文件")']
      }
    } else {
      // 生产模式：使用内置资源 + Electron Node.js
      const promptxPath = path.join(process.resourcesPath, 'resources/promptx/package/src/bin/promptx.js')
      if (fs.existsSync(promptxPath)) {
        command = fs.existsSync(electronNodePath) ? electronNodePath : process.execPath
        args = [promptxPath, 'mcp-server']
      } else {
        // 回退方案：使用项目内置
        const projectPromptxPath = path.join(__dirname, '../../../resources/promptx/package/src/bin/promptx.js')
        command = fs.existsSync(electronNodePath) ? electronNodePath : process.execPath
        args = [projectPromptxPath, 'mcp-server']
      }
    }

    log.info(`🔧 [MCPCoordinator] PromptX启动配置: ${command} ${args.join(' ')}`)

    const server = new MCPServerEntity({
      id: 'promptx-builtin',
      name: 'PromptX (内置)',
      description: 'PromptX AI专业能力增强框架 - 提供角色激活、记忆管理和专业工具',
      type: 'stdio',
      isEnabled: true,
      command,
      args,
      workingDirectory: promptxWorkspace,
      env: {
        NODE_OPTIONS: '--max-old-space-size=2048',
        MCP_DEBUG: isDev ? 'true' : 'false'
      },
      timeout: 15000,
      retryCount: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    return server
  }

  /**
   * 启动所有启用的服务器
   */
  private async startEnabledServers(): Promise<void> {
    log.info('🚀 [MCPCoordinator] 启动启用的MCP服务器...')

    // 启动内置服务器
    for (const server of this.builtinServers) {
      if (server.isEnabled) {
        try {
          await this.connectServer(server)
        } catch (error) {
          log.error(`❌ [MCPCoordinator] 内置服务器连接失败: ${server.name}`, error)
        }
      }
    }

    // TODO: 加载用户配置的服务器
    // const userServers = await this.loadUserServers()
    // ...

    log.info('✅ [MCPCoordinator] 启用的服务器启动完成')
  }

  /**
   * 连接MCP服务器
   */
  public async connectServer(server: MCPServerEntity): Promise<void> {
    const serverId = server.id
    log.info(`🔌 [MCPCoordinator] 连接服务器: ${server.name}`)

    // 检查是否已连接
    const existingConnection = this.connections.get(serverId)
    if (existingConnection && existingConnection.status === 'connected') {
      log.info(`✅ [MCPCoordinator] 服务器已连接: ${server.name}`)
      return
    }

    // 创建连接记录
    const connection: MCPServerConnection = {
      serverId,
      server,
      status: 'connecting',
      tools: []
    }
    this.connections.set(serverId, connection)

    try {
      // 通过进程池创建进程
      const processConfig: ProcessConfig = {
        processId: `mcp-${serverId}`,
        command: server.command || 'node',
        args: server.args || [],
        workingDirectory: server.workingDirectory,
        env: server.env,
        timeout: server.timeout || 15000,
        autoRestart: true,
        maxRestarts: server.retryCount || 3
      }

      const managedProcess = await this.processPool.getOrCreateProcess(processConfig)
      connection.processId = managedProcess.processId
      connection.status = 'connected'
      connection.connectedAt = new Date()

      log.info(`✅ [MCPCoordinator] 服务器连接成功: ${server.name}`)

      // 发现工具
      await this.discoverServerTools(serverId)

      // 如果是PromptX服务器，进行初始化
      if (serverId === 'promptx-builtin') {
        await this.initializePromptXServer(serverId)
      }

      this.emit('server-connected', { serverId, serverName: server.name })

    } catch (error) {
      connection.status = 'error'
      connection.lastError = error instanceof Error ? error.message : String(error)
      
      log.error(`❌ [MCPCoordinator] 服务器连接失败: ${server.name}`, error)
      this.emit('server-error', { serverId, error: connection.lastError })
      
      throw error
    }
  }

  /**
   * 断开MCP服务器
   */
  public async disconnectServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      log.info(`⚠️ [MCPCoordinator] 服务器连接不存在: ${serverId}`)
      return
    }

    log.info(`🔌 [MCPCoordinator] 断开服务器: ${connection.server.name}`)

    try {
      // 终止进程
      if (connection.processId) {
        await this.processPool.terminateProcess(connection.processId)
      }

      connection.status = 'disconnected'
      this.connections.delete(serverId)

      log.info(`✅ [MCPCoordinator] 服务器已断开: ${connection.server.name}`)
      this.emit('server-disconnected', { serverId })

    } catch (error) {
      log.error(`❌ [MCPCoordinator] 服务器断开失败: ${connection.server.name}`, error)
      throw error
    }
  }

  /**
   * 发现服务器工具 - 桥接到真实MCP服务
   */
  private async discoverServerTools(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`服务器连接不存在: ${serverId}`)
    }

    log.info(`🔍 [MCPCoordinator] 发现服务器工具: ${connection.server.name}`)

    try {
      // 🔥 桥接到旧版真实MCP服务
      const { MCPIntegrationService } = await import('../services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 确保MCP服务已初始化
      await mcpService.initialize()
      
      // 使用真实的工具发现 - 让MCPIntegrationService处理完整的发现流程
      log.info(`🔍 [MCPCoordinator] 调用真实MCP服务发现工具: ${serverId}`)
      const realTools = await mcpService.discoverServerTools(serverId)
      connection.tools = realTools

      log.info(`✅ [MCPCoordinator] 发现 ${realTools.length} 个工具: ${connection.server.name}`)
      
      // 详细日志工具列表
      realTools.forEach(tool => {
        log.info(`🔧 [MCPCoordinator] 工具: ${tool.name} - ${tool.description || '无描述'}`)
      })
      
      this.emit('tools-discovered', { serverId, tools: realTools })

    } catch (error) {
      log.error(`❌ [MCPCoordinator] 工具发现失败: ${connection.server.name}`, error)
      log.error(`💥 [MCPCoordinator] 错误详情:`, error)
      
      // 不再回退到模拟，让错误向上传播
      throw error
    }
  }


  /**
   * 初始化PromptX服务器
   */
  private async initializePromptXServer(serverId: string): Promise<void> {
    log.info(`🎯 [MCPCoordinator] 初始化PromptX服务器: ${serverId}`)

    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`PromptX服务器连接不存在: ${serverId}`)
    }

    try {
      const { app } = require('electron')
      const path = require('path')
      
      const workingDirectory = path.join(app.getPath('userData'), 'promptx-workspace')

      // TODO: 调用PromptX初始化工具
      log.info(`🔧 [MCPCoordinator] PromptX工作目录: ${workingDirectory}`)
      log.info(`✅ [MCPCoordinator] PromptX服务器初始化完成: ${serverId}`)

    } catch (error) {
      log.error(`❌ [MCPCoordinator] PromptX服务器初始化失败: ${serverId}`, error)
      throw error
    }
  }

  /**
   * 获取所有连接的服务器
   */
  public getConnectedServers(): MCPServerConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.status === 'connected')
  }

  /**
   * 获取所有可用工具
   */
  public getAllAvailableTools(): MCPToolEntity[] {
    const allTools: MCPToolEntity[] = []
    
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        allTools.push(...connection.tools)
      }
    }

    return allTools
  }

  /**
   * 获取服务器连接状态
   */
  public getServerConnection(serverId: string): MCPServerConnection | null {
    return this.connections.get(serverId) || null
  }

  /**
   * 调用工具 - 桥接到真实MCP服务
   */
  public async callTool(serverId: string, toolName: string, parameters: any): Promise<any> {
    const connection = this.connections.get(serverId)
    if (!connection || connection.status !== 'connected') {
      throw new Error(`服务器未连接: ${serverId}`)
    }

    log.info(`🔧 [MCPCoordinator] 调用工具: ${serverId}:${toolName}`)

    try {
      // 🔥 桥接到旧版真实MCP服务
      const { MCPIntegrationService } = await import('../services/mcp/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 使用真实的工具调用
      const result = await mcpService.callTool({
        serverId,
        toolName,
        arguments: parameters
      })
      
      log.info(`✅ [MCPCoordinator] 工具调用成功: ${toolName}`)
      return result

    } catch (error) {
      log.error(`❌ [MCPCoordinator] 工具调用失败: ${toolName}`, error)
      log.error(`💥 [MCPCoordinator] 调用错误详情:`, error)
      
      // 不再回退到模拟，让错误向上传播
      throw error
    }
  }


  /**
   * 关闭MCP服务协调器
   */
  public async shutdown(): Promise<void> {
    log.info('🛑 [MCPCoordinator] 关闭MCP服务协调器...')

    // 断开所有服务器连接
    const disconnectPromises = Array.from(this.connections.keys()).map(serverId =>
      this.disconnectServer(serverId)
    )

    await Promise.allSettled(disconnectPromises)

    this.connections.clear()
    this.builtinServers = []

    log.info('✅ [MCPCoordinator] MCP服务协调器已关闭')
  }
}