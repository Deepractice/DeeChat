/**
 * MCP客户端管理器
 * 基于官方MCP SDK的标准化客户端管理实现
 */

import log from 'electron-log'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
// 🔥 新增传输协议导入
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { MCPServerEntity } from '../../../../shared/entities/MCPServerEntity'
import { MCPToolEntity } from '../../../../shared/entities/MCPToolEntity'
import {
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPEvent,
  MCPEventType
} from '../../../../shared/interfaces/IMCPProvider'
import { InProcessMCPServer } from '../servers/InProcessMCPServer'
// 🎯 文件操作服务器已移除，功能已整合到PromptX

/**
 * MCP客户端管理器
 * 支持多种传输协议的统一客户端管理
 */
export class SimpleMCPClientManager {
  private clients: Map<string, Client> = new Map()
  private pendingClients: Map<string, Promise<Client>> = new Map()
  private eventListeners: ((event: MCPEvent) => void)[] = []
  private inProcessServers: Map<string, InProcessMCPServer> = new Map()
  // 内置服务器已简化为只有PromptX

  constructor() {
    log.info('[Simple MCP] 🚀 智能客户端管理器初始化完成 (进程内 > Electron内置)')
  }

  /**
   * 获取服务器唯一键
   */
  private getServerKey(server: MCPServerEntity): string {
    return JSON.stringify({
      id: server.id,
      name: server.name,
      type: server.type,
      command: server.command,
      args: server.args
    })
  }

  /**
   * 初始化客户端（智能模式：进程内跳过客户端创建）
   */
  async initClient(server: MCPServerEntity): Promise<Client> {
    const executionMode = this.getExecutionMode(server)
    
    // 🎯 进程内模式：不需要创建外部客户端，直接创建进程内服务器
    if (executionMode === 'inprocess') {
      log.info(`[Simple MCP] 🎯 进程内模式，跳过外部客户端创建: ${server.name}`)
      
      const serverKey = this.getServerKey(server)
      let inProcessServer = this.inProcessServers.get(serverKey)
      
      if (!inProcessServer) {
        log.info(`[Simple MCP] 🎯 创建进程内服务器用于初始化: ${server.name}`)
        inProcessServer = new InProcessMCPServer(server)
        await inProcessServer.start()
        this.inProcessServers.set(serverKey, inProcessServer)
      }
      
      // 返回一个假的客户端对象（避免调用方出错）
      return {} as Client
    }

    // 🎯 内置服务器已简化：现在只支持PromptX
    if (executionMode === 'native-builtin') {
      log.error(`[Simple MCP] ❌ 内置服务器已停用: ${server.name}`)
      log.error(`[Simple MCP] 💡 建议: 使用PromptX工具替代，功能更强大且统一`)
      throw new Error(`内置服务器已停用: ${server.id}，请使用PromptX工具`)
    }
    
    // 🚀 标准模式：创建外部客户端
    const serverKey = this.getServerKey(server)

    // 如果有pending初始化，等待它完成
    const pendingClient = this.pendingClients.get(serverKey)
    if (pendingClient) {
      log.debug(`[Simple MCP] 等待pending客户端: ${server.name}`)
      try {
        return await pendingClient
      } catch (error) {
        // 如果pending失败，清理后重新尝试
        log.warn(`[Simple MCP] Pending客户端失败，重新尝试: ${server.name}`, error)
        this.pendingClients.delete(serverKey)
        this.clients.delete(serverKey)
      }
    }

    // 检查现有客户端是否还有效
    const existingClient = this.clients.get(serverKey)
    if (existingClient) {
      try {
        // 🔥 改进ping检查 - 使用更短的超时
        const pingPromise = existingClient.ping()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ping超时')), 3000) // 3秒超时
        })
        
        await Promise.race([pingPromise, timeoutPromise])
        
        log.debug(`[Simple MCP] ✅ 使用现有客户端: ${server.name}`)
        return existingClient
      } catch (error) {
        log.warn(`[Simple MCP] 客户端ping失败，移除: ${server.name}`, error)
        this.clients.delete(serverKey)
        // 清理可能的pending状态
        this.pendingClients.delete(serverKey)
      }
    }

    // 创建初始化Promise
    const initPromise = this.createClientPromise(server, serverKey)
    this.pendingClients.set(serverKey, initPromise)

    return initPromise
  }

  /**
   * 创建客户端Promise
   */
  private async createClientPromise(server: MCPServerEntity, serverKey: string): Promise<Client> {
    try {
      log.info(`[Simple MCP] 🔨 创建新客户端: ${server.name}`)
      
      // 🔥 添加详细的调试信息
      log.info(`[Simple MCP] 服务器配置:`, {
        id: server.id,
        name: server.name,
        type: server.type,
        command: server.command,
        args: server.args,
        workingDirectory: server.workingDirectory
      })
      
      // 创建官方SDK客户端
      const client = new Client(
        { name: 'DeeChat', version: '1.0.0' },
        { capabilities: {} }
      )

      // 创建传输层
      log.info(`[Simple MCP] 🔌 创建传输层: ${server.type}`)
      const transport = await this.createTransport(server)
      
      // 🔥 添加连接超时保护
      log.info(`[Simple MCP] 🚀 开始连接客户端...`)
      const connectPromise = client.connect(transport)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`连接超时: ${server.name}`)), 15000) // 15秒超时
      })
      
      await Promise.race([connectPromise, timeoutPromise])
      
      // 🔥 验证连接是否真正成功
      log.info(`[Simple MCP] 🔍 验证连接状态...`)
      try {
        await client.ping()
        log.info(`[Simple MCP] ✅ 连接验证成功: ${server.name}`)
      } catch (pingError) {
        log.warn(`[Simple MCP] ⚠️ 连接验证失败，但继续: ${server.name}`, pingError)
        // 不抛出错误，有些服务器可能不支持ping
      }
      
      // 缓存客户端
      this.clients.set(serverKey, client)
      
      // 发送连接成功事件
      this.emitEvent({
        type: MCPEventType.SERVER_CONNECTED,
        serverId: server.id,
        timestamp: new Date()
      })

      log.info(`[Simple MCP] ✅ 客户端连接成功: ${server.name}`)
      return client

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      log.error(`[Simple MCP] ❌ 客户端连接失败: ${server.name}`, error)
      
      // 🔥 详细的错误日志
      if (error instanceof Error) {
        log.error(`[Simple MCP] 错误详情:`, {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n') // 只显示前5行堆栈
        })
      }
      
      // 发送连接失败事件
      this.emitEvent({
        type: MCPEventType.SERVER_ERROR,
        serverId: server.id,
        timestamp: new Date(),
        error: errorMessage
      })
      
      throw error
    } finally {
      // 清理pending状态
      this.pendingClients.delete(serverKey)
    }
  }

  /**
   * 创建传输层（支持5种协议）
   * 🔥 标准传输协议适配，支持官方MCP SDK所有传输方式
   */
  private async createTransport(server: MCPServerEntity) {
    switch (server.type) {
      case 'sse':
        // SSE传输
        if (!server.url) {
          throw new Error('SSE服务器缺少URL配置')
        }
        return new SSEClientTransport(new URL(server.url), {
          requestInit: {
            headers: server.headers
          }
        })
        
      case 'websocket':
        // 🔥 新增：WebSocket传输
        if (!server.url) {
          throw new Error('WebSocket服务器缺少URL配置')
        }
        return new WebSocketClientTransport(new URL(server.url))
        
      case 'streamable-http':
        // 🔥 新增：StreamableHTTP传输
        if (!server.url) {
          throw new Error('StreamableHTTP服务器缺少URL配置')
        }
        return new StreamableHTTPClientTransport(new URL(server.url), {
          requestInit: {
            headers: server.headers
          },
          // TODO: 支持OAuth认证
          // authProvider: server.auth ? new OAuthClientProvider(server.auth) : undefined,
          reconnectionOptions: {
            maxRetries: 3,
            initialReconnectionDelay: 1000,
            maxReconnectionDelay: 30000,
            reconnectionDelayGrowFactor: 1.5
          }
        })
        
      default:
        // stdio传输 - 支持沙箱
        return this.createStdioTransport(server)
    }
  }

  /**
   * 创建Stdio传输（Electron内置Node.js优化）
   */
  private async createStdioTransport(server: MCPServerEntity) {
    if (!server.command) {
      throw new Error('Stdio服务器缺少命令配置')
    }

    // 🔥 优化：直接使用Electron内置Node.js运行时
    let actualCommand = server.command
    let actualArgs = server.args || []
    
    // 如果是Node.js脚本，直接使用Electron的Node.js
    if (server.command === 'node' || server.command?.endsWith('node') || server.command?.endsWith('node.exe')) {
      actualCommand = process.execPath  // 使用Electron的Node.js
      // args保持不变，第一个参数就是要执行的脚本
      log.info(`[Simple MCP] ⚡ 使用Electron内置Node.js: ${actualCommand}`)
    } else {
      log.info(`[Simple MCP] 🚀 使用原始命令: ${actualCommand}`)
    }
    
    log.info(`[Simple MCP] 启动命令: ${actualCommand} ${actualArgs.join(' ')}`)
    
    // 标准启动配置
    let transportConfig: any = {
      command: actualCommand,
      args: actualArgs,
      env: { 
        ...process.env as Record<string, string>, 
        ...server.env 
      }
    }
    
    // 🔥 如果有工作目录，添加到配置中
    if (server.workingDirectory) {
      log.info(`[Simple MCP] 设置工作目录: ${server.workingDirectory}`)
      transportConfig.cwd = server.workingDirectory
    }
    
    return new StdioClientTransport(transportConfig)
  }

  /**
   * 🔥 智能执行模式检测：进程内 > Electron内置
   */
  private getExecutionMode(server: MCPServerEntity): 'inprocess' | 'builtin' | 'native-builtin' {
    // 🔧 检查是否是DeeChat内置服务器
    if (server.type === 'builtin' || server.command === 'internal') {
      log.info(`[Simple MCP] 🔧 DeeChat内置服务器 -> 原生内置模式: ${server.name}`)
      return 'native-builtin'
    }
    
    if (!server.command) return 'builtin'

    const command = server.command
    const args = server.args || []
    
    // 🎯 检查是否是PromptX服务器 - 优先使用进程内模式（解决双进程问题）
    const isPromptXServer = (
      command === 'node' &&
      args.some(arg => arg.includes('promptx.js') || arg.includes('dpml-prompt')) &&
      args.includes('mcp-server')
    )
    
    if (isPromptXServer) {
      log.info(`[Simple MCP] 🎯 PromptX服务器 -> 进程内模式 (单进程): ${server.name}`)
      return 'inprocess'
    }
    
    // 🚀 其他所有脚本都用Electron内置运行时
    log.info(`[Simple MCP] ⚡ 标准服务器 -> Electron内置运行时: ${server.name}`)
    return 'builtin'
  }

  /**
   * 调用工具（智能模式：进程内 > 客户端）
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    log.info(`[Simple MCP] 调用工具: ${request.serverId}:${request.toolName}`)

    try {
      // 获取服务器配置
      const server = await this.getServerConfig(request.serverId)
      if (!server) {
        throw new Error(`服务器配置不存在: ${request.serverId}`)
      }

      const executionMode = this.getExecutionMode(server)
      
      // 🎯 PromptX优先使用进程内调用（单进程，零开销）
      if (executionMode === 'inprocess') {
        return await this.callToolInProcess(server, request)
      }

      // 🔧 DeeChat内置服务器调用
      if (executionMode === 'native-builtin') {
        return await this.callToolNativeBuiltin(server, request)
      }
      
      // 🚀 其他情况用客户端调用（自动用Electron内置Node.js）
      return await this.callToolViaClient(server, request)

    } catch (error) {
      log.error(`[Simple MCP] 工具调用失败: ${request.toolName}`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具调用失败',
        duration: 0
      }
    }
  }

  /**
   * 进程内工具调用（PromptX专用，单进程解决方案）
   */
  private async callToolInProcess(server: MCPServerEntity, request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const serverKey = this.getServerKey(server)
    
    // 获取或创建进程内服务器
    let inProcessServer = this.inProcessServers.get(serverKey)
    if (!inProcessServer) {
      log.info(`[Simple MCP] 🎯 创建进程内PromptX服务器: ${server.name}`)
      inProcessServer = new InProcessMCPServer(server)
      await inProcessServer.start()
      this.inProcessServers.set(serverKey, inProcessServer)
      
      // 发送连接成功事件
      this.emitEvent({
        type: MCPEventType.SERVER_CONNECTED,
        serverId: server.id,
        timestamp: new Date()
      })
    }
    
    // 直接调用工具（同进程，零开销）
    const startTime = Date.now()
    const result = await inProcessServer.callTool(request.toolName, request.arguments || {})
    const duration = Date.now() - startTime
    
    log.info(`[Simple MCP] ✅ 进程内工具调用成功: ${request.toolName} (${duration}ms)`)
    
    return {
      success: true,
      result: result.content || [result],
      duration
    }
  }

  /**
   * DeeChat内置服务器工具调用
   */
  private async callToolNativeBuiltin(server: MCPServerEntity, _request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    log.error(`[Simple MCP] ❌ 内置服务器已停用: ${server.name}`)
    log.error(`[Simple MCP] 💡 建议: 使用PromptX工具替代，功能更强大且统一`)
    
    throw new Error(`内置服务器已停用: ${server.id}，请使用PromptX工具`)
  }

  /**
   * 客户端工具调用（其他MCP服务器）
   */
  private async callToolViaClient(server: MCPServerEntity, request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    // 初始化客户端（自动用Electron内置Node.js）
    const client = await this.initClient(server)
    
    // 调用工具
    const result = await client.callTool({
      name: request.toolName,
      arguments: request.arguments || {}
    })

    return {
      success: true,
      result: result.content || [],
      duration: 0
    }
  }

  /**
   * 发现工具（智能模式：进程内 > 客户端）
   */
  async discoverTools(server: MCPServerEntity): Promise<MCPToolEntity[]> {
    try {
      const executionMode = this.getExecutionMode(server)
      let tools: any[] = []
      
      if (executionMode === 'inprocess') {
        // 🎯 进程内服务器
        const serverKey = this.getServerKey(server)
        let inProcessServer = this.inProcessServers.get(serverKey)
        
        if (!inProcessServer) {
          log.info(`[Simple MCP] 🎯 为工具发现创建进程内服务器: ${server.name}`)
          inProcessServer = new InProcessMCPServer(server)
          await inProcessServer.start()
          this.inProcessServers.set(serverKey, inProcessServer)
        }
        
        tools = await inProcessServer.listTools()
      } else if (executionMode === 'native-builtin') {
        // 🔧 内置服务器已停用，使用PromptX替代
        log.error(`[Simple MCP] ❌ 内置服务器已停用: ${server.name}`)
        log.error(`[Simple MCP] 💡 建议: 使用PromptX的@file://协议替代，功能更强大且统一`)
        
        throw new Error(`内置服务器已停用: ${server.id}，请使用PromptX工具`)
      } else {
        // 🚀 标准客户端
        const client = await this.initClient(server)
        const { tools: clientTools } = await client.listTools()
        tools = clientTools
      }

      return tools.map(tool => MCPToolEntity.create({
        name: tool.name,
        description: tool.description || '',
        serverId: server.id,
        serverName: server.name,
        inputSchema: tool.inputSchema
      }))

    } catch (error) {
      log.error(`[Simple MCP] 工具发现失败: ${server.name}`, error)
      return []
    }
  }


  /**
   * 添加事件监听器
   */
  onEvent(listener: (event: MCPEvent) => void): void {
    this.eventListeners.push(listener)
  }

  /**
   * 发送事件
   */
  private emitEvent(event: MCPEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        log.error('[Simple MCP] 事件监听器异常:', error)
      }
    }
  }

  /**
   * 设置配置服务（依赖注入）
   */
  private configService: any = null

  setConfigService(configService: any): void {
    this.configService = configService
  }

  /**
   * 获取服务器配置
   */
  private async getServerConfig(serverId: string): Promise<MCPServerEntity | null> {
    if (!this.configService) {
      log.error('[Simple MCP] 配置服务未注入')
      return null
    }
    return await this.configService.getServerConfig(serverId)
  }

  /**
   * 关闭特定客户端
   */
  async closeClient(serverId: string): Promise<void> {
    log.info(`[Simple MCP] 关闭客户端: ${serverId}`)
    
    // 查找并关闭所有匹配的客户端
    const keysToRemove: string[] = []
    
    for (const [key, client] of this.clients.entries()) {
      // 检查key是否包含serverId（key格式: serverId::toolName）
      if (key.startsWith(serverId)) {
        keysToRemove.push(key)
        try {
          await client.close()
          log.info(`[Simple MCP] 已关闭客户端: ${key}`)
        } catch (error) {
          log.error(`[Simple MCP] 关闭客户端失败: ${key}`, error)
        }
      }
    }
    
    // 从缓存中移除
    keysToRemove.forEach(key => this.clients.delete(key))
    
    // 清理pending客户端
    for (const key of this.pendingClients.keys()) {
      if (key.startsWith(serverId)) {
        this.pendingClients.delete(key)
      }
    }
    
    log.info(`[Simple MCP] 已清理服务器 ${serverId} 的所有客户端 (${keysToRemove.length}个)`)
  }

  /**
   * 清理所有客户端
   */
  async cleanup(): Promise<void> {
    const closePromises = Array.from(this.clients.keys()).map(serverKey => 
      this.closeClient(serverKey)
    )
    
    await Promise.allSettled(closePromises)
    this.clients.clear()
    this.pendingClients.clear()
    
    // 清理进程内服务器
    for (const [serverKey, inProcessServer] of this.inProcessServers.entries()) {
      try {
        await inProcessServer.stop()
        log.info(`[Simple MCP] 已停止进程内服务器: ${serverKey}`)
      } catch (error) {
        log.error(`[Simple MCP] 停止进程内服务器失败: ${serverKey}`, error)
      }
    }
    this.inProcessServers.clear()
    
    log.info('[Simple MCP] 所有客户端和服务器已清理')
  }

}