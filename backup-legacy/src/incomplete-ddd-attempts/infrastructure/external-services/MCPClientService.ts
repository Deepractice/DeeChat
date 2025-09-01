/**
 * MCP客户端服务实现
 * 提供与MCP服务器通信的统一接口
 */

import { IMCPClient } from '../../application/ports/outbound/services/IExternalService'
import { Result } from '../../domain/shared/primitives/Result'
import { EventEmitter } from 'events'

export interface IMCPServer {
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
  status: 'connected' | 'disconnected' | 'error'
  lastError?: string
}

export interface IMCPTool {
  name: string
  description?: string
  inputSchema: any
}

export interface IMCPResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface IMCPPrompt {
  name: string
  description?: string
  arguments?: any[]
}

export interface IMCPRequest {
  method: string
  params?: any
}

export interface IMCPResponse {
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export class MCPClientService extends EventEmitter implements IMCPClient {
  private servers: Map<string, IMCPServer> = new Map()
  private connections: Map<string, any> = new Map()
  private isInitialized = false

  constructor() {
    super()
  }

  /**
   * 初始化MCP客户端
   */
  async initialize(): Promise<Result<void, Error>> {
    try {
      if (this.isInitialized) {
        return Result.success()
      }

      console.log('🔄 [MCPClient] 初始化MCP客户端')

      // 设置错误处理
      this.on('error', (error) => {
        console.error('❌ [MCPClient] MCP客户端错误:', error)
      })

      this.isInitialized = true
      console.log('✅ [MCPClient] MCP客户端初始化完成')

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to initialize MCP client: ${error.message}`))
    }
  }

  /**
   * 连接到MCP服务器
   */
  async connectServer(serverConfig: Omit<IMCPServer, 'status'>): Promise<Result<void, Error>> {
    try {
      console.log(`🔄 [MCPClient] 连接服务器: ${serverConfig.name}`)

      const server: IMCPServer = {
        ...serverConfig,
        status: 'disconnected'
      }

      this.servers.set(serverConfig.name, server)

      // 这里应该实现实际的MCP连接逻辑
      // 由于MCP协议的复杂性，这里简化处理
      const connection = await this.establishConnection(server)
      
      if (connection) {
        this.connections.set(serverConfig.name, connection)
        server.status = 'connected'
        
        console.log(`✅ [MCPClient] 已连接到服务器: ${serverConfig.name}`)
        this.emit('serverConnected', serverConfig.name)
        
        return Result.success()
      } else {
        server.status = 'error'
        server.lastError = 'Connection failed'
        return Result.error(new Error(`Failed to connect to server: ${serverConfig.name}`))
      }
    } catch (error) {
      console.error(`❌ [MCPClient] 连接服务器失败: ${serverConfig.name}`, error)
      return Result.error(new Error(`Failed to connect server: ${error.message}`))
    }
  }

  /**
   * 断开MCP服务器连接
   */
  async disconnectServer(serverName: string): Promise<Result<void, Error>> {
    try {
      const server = this.servers.get(serverName)
      if (!server) {
        return Result.error(new Error(`Server not found: ${serverName}`))
      }

      console.log(`🔄 [MCPClient] 断开服务器: ${serverName}`)

      const connection = this.connections.get(serverName)
      if (connection) {
        await this.closeConnection(connection)
        this.connections.delete(serverName)
      }

      server.status = 'disconnected'
      console.log(`✅ [MCPClient] 已断开服务器: ${serverName}`)
      this.emit('serverDisconnected', serverName)

      return Result.success()
    } catch (error) {
      console.error(`❌ [MCPClient] 断开服务器失败: ${serverName}`, error)
      return Result.error(new Error(`Failed to disconnect server: ${error.message}`))
    }
  }

  /**
   * 获取服务器列表
   */
  async listServers(): Promise<Result<IMCPServer[], Error>> {
    try {
      const servers = Array.from(this.servers.values())
      return Result.success(servers)
    } catch (error) {
      return Result.error(new Error(`Failed to list servers: ${error.message}`))
    }
  }

  /**
   * 获取可用工具
   */
  async listTools(serverName?: string): Promise<Result<IMCPTool[], Error>> {
    try {
      const tools: IMCPTool[] = []

      if (serverName) {
        const serverTools = await this.getToolsFromServer(serverName)
        if (serverTools.isSuccess()) {
          tools.push(...serverTools.getValue())
        }
      } else {
        // 获取所有服务器的工具
        for (const [name] of this.servers) {
          const serverTools = await this.getToolsFromServer(name)
          if (serverTools.isSuccess()) {
            tools.push(...serverTools.getValue())
          }
        }
      }

      return Result.success(tools)
    } catch (error) {
      return Result.error(new Error(`Failed to list tools: ${error.message}`))
    }
  }

  /**
   * 调用工具
   */
  async callTool(
    serverName: string,
    toolName: string,
    parameters: any
  ): Promise<Result<any, Error>> {
    try {
      console.log(`🔧 [MCPClient] 调用工具: ${serverName}.${toolName}`)

      const server = this.servers.get(serverName)
      if (!server) {
        return Result.error(new Error(`Server not found: ${serverName}`))
      }

      if (server.status !== 'connected') {
        return Result.error(new Error(`Server not connected: ${serverName}`))
      }

      const connection = this.connections.get(serverName)
      if (!connection) {
        return Result.error(new Error(`No connection to server: ${serverName}`))
      }

      const request: IMCPRequest = {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: parameters
        }
      }

      const response = await this.sendRequest(connection, request)
      
      if (response.error) {
        console.error(`❌ [MCPClient] 工具调用失败: ${serverName}.${toolName}`, response.error)
        return Result.error(new Error(`Tool call failed: ${response.error.message}`))
      }

      console.log(`✅ [MCPClient] 工具调用成功: ${serverName}.${toolName}`)
      return Result.success(response.result)
    } catch (error) {
      console.error(`❌ [MCPClient] 工具调用异常: ${serverName}.${toolName}`, error)
      return Result.error(new Error(`Tool call exception: ${error.message}`))
    }
  }

  /**
   * 获取资源列表
   */
  async listResources(serverName?: string): Promise<Result<IMCPResource[], Error>> {
    try {
      const resources: IMCPResource[] = []

      if (serverName) {
        const serverResources = await this.getResourcesFromServer(serverName)
        if (serverResources.isSuccess()) {
          resources.push(...serverResources.getValue())
        }
      } else {
        for (const [name] of this.servers) {
          const serverResources = await this.getResourcesFromServer(name)
          if (serverResources.isSuccess()) {
            resources.push(...serverResources.getValue())
          }
        }
      }

      return Result.success(resources)
    } catch (error) {
      return Result.error(new Error(`Failed to list resources: ${error.message}`))
    }
  }

  /**
   * 读取资源
   */
  async readResource(
    serverName: string,
    resourceUri: string
  ): Promise<Result<any, Error>> {
    try {
      console.log(`📖 [MCPClient] 读取资源: ${serverName}:${resourceUri}`)

      const connection = this.connections.get(serverName)
      if (!connection) {
        return Result.error(new Error(`No connection to server: ${serverName}`))
      }

      const request: IMCPRequest = {
        method: 'resources/read',
        params: {
          uri: resourceUri
        }
      }

      const response = await this.sendRequest(connection, request)
      
      if (response.error) {
        return Result.error(new Error(`Resource read failed: ${response.error.message}`))
      }

      return Result.success(response.result)
    } catch (error) {
      return Result.error(new Error(`Resource read exception: ${error.message}`))
    }
  }

  /**
   * 获取服务器状态
   */
  getServerStatus(serverName: string): IMCPServer['status'] | null {
    const server = this.servers.get(serverName)
    return server ? server.status : null
  }

  /**
   * 建立连接（简化实现）
   */
  private async establishConnection(server: IMCPServer): Promise<any> {
    // 这里应该实现实际的MCP连接逻辑
    // 包括启动子进程、建立stdio通信等
    console.log(`🔗 [MCPClient] 建立连接到: ${server.name}`)
    
    // 模拟连接成功
    return {
      serverName: server.name,
      connected: true,
      process: null // 实际应该是子进程实例
    }
  }

  /**
   * 关闭连接
   */
  private async closeConnection(connection: any): Promise<void> {
    console.log(`🔗 [MCPClient] 关闭连接: ${connection.serverName}`)
    // 实际应该关闭子进程和清理资源
  }

  /**
   * 发送请求到MCP服务器
   */
  private async sendRequest(connection: any, request: IMCPRequest): Promise<IMCPResponse> {
    // 这里应该实现实际的MCP协议通信
    console.log(`📤 [MCPClient] 发送请求: ${request.method}`)
    
    // 模拟响应
    return {
      result: {
        success: true,
        data: `Mock response for ${request.method}`
      }
    }
  }

  /**
   * 从服务器获取工具列表
   */
  private async getToolsFromServer(serverName: string): Promise<Result<IMCPTool[], Error>> {
    try {
      const connection = this.connections.get(serverName)
      if (!connection) {
        return Result.error(new Error(`No connection to server: ${serverName}`))
      }

      const request: IMCPRequest = {
        method: 'tools/list'
      }

      const response = await this.sendRequest(connection, request)
      
      if (response.error) {
        return Result.error(new Error(`Failed to get tools: ${response.error.message}`))
      }

      return Result.success(response.result?.tools || [])
    } catch (error) {
      return Result.error(new Error(`Exception getting tools: ${error.message}`))
    }
  }

  /**
   * 从服务器获取资源列表
   */
  private async getResourcesFromServer(serverName: string): Promise<Result<IMCPResource[], Error>> {
    try {
      const connection = this.connections.get(serverName)
      if (!connection) {
        return Result.error(new Error(`No connection to server: ${serverName}`))
      }

      const request: IMCPRequest = {
        method: 'resources/list'
      }

      const response = await this.sendRequest(connection, request)
      
      if (response.error) {
        return Result.error(new Error(`Failed to get resources: ${response.error.message}`))
      }

      return Result.success(response.result?.resources || [])
    } catch (error) {
      return Result.error(new Error(`Exception getting resources: ${error.message}`))
    }
  }
}