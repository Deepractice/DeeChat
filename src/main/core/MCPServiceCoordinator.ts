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

  // 内置服务器配置 - 未使用
  // private builtinServers: MCPServerEntity[] = []

  constructor(processPool: ProcessPoolManager) {
    super()
    this.processPool = processPool
  }

  /**
   * 初始化MCP服务协调器
   */
  public async initialize(): Promise<void> {
    const coordId = Math.random().toString(36).substr(2, 6)
    log.info(`🔌 [MCPCoordinator-${coordId}] initialize被调用`)
    log.info(`🔌 [MCPCoordinator-${coordId}] 当前状态: isInitialized=${this.isInitialized}`)
    
    if (this.isInitialized) {
      log.info(`✅ [MCPCoordinator-${coordId}] 已初始化，直接返回`)
      return
    }

    log.info(`🔌 [MCPCoordinator-${coordId}] 开始初始化MCP服务协调器...`)

    // 初始化内置服务器
    log.info(`🔧 [MCPCoordinator-${coordId}] 开始初始化内置服务器...`)
    await this.initializeBuiltinServers()
    log.info(`✅ [MCPCoordinator-${coordId}] 内置服务器初始化完成`)

    // 启动所有启用的服务器
    log.info(`🚀 [MCPCoordinator-${coordId}] 开始启动已启用的服务器...`)
    await this.startEnabledServers()
    log.info(`✅ [MCPCoordinator-${coordId}] 已启用的服务器启动完成`)

    this.isInitialized = true
    log.info(`✅ [MCPCoordinator-${coordId}] MCP服务协调器初始化完成`)
  }

  /**
   * 初始化内置服务器（PromptX）
   * 🔥 简化：直接委托给MCPIntegrationService，避免重复逻辑
   */
  private async initializeBuiltinServers(): Promise<void> {
    log.info('🔧 [MCPCoordinator] 委托MCPIntegrationService初始化服务器...')

    try {
      // 🔥 直接委托给MCPIntegrationService，它负责所有服务器的初始化
      const { MCPIntegrationService } = await import('../services/mcp/client/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 让MCPIntegrationService处理所有服务器的初始化
      await mcpService.initialize()
      
      log.info('✅ [MCPCoordinator] MCPIntegrationService接管服务器管理')
    } catch (error) {
      log.error('❌ [MCPCoordinator] 委托初始化失败:', error)
      throw error
    }
  }

  // 未使用的方法已删除

  /**
   * 启动所有启用的服务器
   * 🔥 简化：MCPIntegrationService已经处理了所有服务器启动
   */
  private async startEnabledServers(): Promise<void> {
    log.info('🚀 [MCPCoordinator] 服务器启动已由MCPIntegrationService处理')
    
    // MCPIntegrationService.initialize() 已经连接了所有启用的服务器
    // 这里不需要重复操作
    
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
      const { MCPIntegrationService } = await import('../services/mcp/client/MCPIntegrationService')
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
   * 获取所有可用工具 - 委托给MCPIntegrationService
   */
  public async getAllAvailableTools(): Promise<MCPToolEntity[]> {
    try {
      const { MCPIntegrationService } = await import('../services/mcp/client/MCPIntegrationService')
      const mcpService = MCPIntegrationService.getInstance()
      
      // 确保服务已初始化
      await mcpService.initialize()
      
      return await mcpService.getAllTools()
    } catch (error) {
      log.error('[MCPCoordinator] 获取工具失败:', error)
      return []
    }
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
      const { MCPIntegrationService } = await import('../services/mcp/client/MCPIntegrationService')
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
    // this.builtinServers = []  // 未使用

    log.info('✅ [MCPCoordinator] MCP服务协调器已关闭')
  }
}