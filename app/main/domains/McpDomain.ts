/**
 * McpDomain - MCP协议域服务
 *
 * 核心职责:
 * - 管理MCP服务器配置和连接生命周期
 * - 处理MCP工具调用和资源访问
 * - 提供MCP服务发现和状态监控
 *
 * 设计原则:
 * - 简单实用，遵循奥卡姆剃刀定律
 * - 用户需求到简单接口的直接映射
 * - 基于@deepracticex/mcp-client包构建
 */

import { Service } from 'typedi'
import {
  McpClient,
  McpServerConfig,
  ConnectionStatus,
  ToolInfo,
  ResourceInfo,
  ToolCallResult,
  ResourceContent
} from '@deepracticex/mcp-client'
import { IDomain } from '../ipc/ipc-registry.js'

// ==================== 扩展类型定义 ====================

/**
 * 带状态信息的服务器(用于前端显示)
 */
export interface McpServerWithStatus extends McpServerConfig {
  /** 连接状态 */
  connectionStatus: ConnectionStatus
  /** 工具数量(仅连接时可用) */
  toolCount?: number
  /** 资源数量(仅连接时可用) */
  resourceCount?: number
  /** 最后错误信息 */
  lastError?: string
}

// ==================== McpDomain 实现 ====================

@Service()
export class McpDomain implements IDomain {
  private mcpClient: McpClient

  constructor() {
    // 使用默认配置路径初始化MCP客户端
    this.mcpClient = new McpClient({
      autoSaveConfig: true
    })
  }

  // ============== 初始化 ==============

  /**
   * 初始化MCP域服务
   */
  async initialize(): Promise<void> {
    console.log('🔌 Initializing MCP domain service...')

    try {
      await this.mcpClient.initialize()
      console.log('✅ MCP domain service initialized successfully')
    } catch (error) {
      console.error('❌ MCP domain service initialization failed:', error)
      throw error
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    console.log('🧹 Cleaning up MCP domain service...')

    try {
      await this.mcpClient.dispose()
      console.log('✅ MCP domain service cleanup completed')
    } catch (error) {
      console.error('❌ MCP domain service cleanup failed:', error)
    }
  }

  // ============== 服务器管理 ==============

  /**
   * 获取所有服务器及状态信息
   */
  async listServers(): Promise<McpServerWithStatus[]> {
    try {
      const servers = this.mcpClient.listServers()

      // 为每个服务器添加状态信息
      const serversWithStatus: McpServerWithStatus[] = await Promise.all(
        servers.map(async (server) => {
          const connectionStatus = this.mcpClient.getConnectionStatus(server.id)

          let toolCount: number | undefined
          let resourceCount: number | undefined
          let lastError: string | undefined

          // 如果已连接，获取工具和资源数量
          if (connectionStatus === ConnectionStatus.CONNECTED) {
            try {
              const [tools, resources] = await Promise.all([
                this.mcpClient.listTools(server.id),
                this.mcpClient.listResources(server.id)
              ])
              toolCount = tools.length
              resourceCount = resources.length
            } catch (error) {
              lastError = error instanceof Error ? error.message : String(error)
            }
          }

          return {
            ...server,
            connectionStatus,
            toolCount,
            resourceCount,
            lastError
          }
        })
      )

      return serversWithStatus
    } catch (error) {
      console.error('Failed to get server list:', error)
      throw new Error(`Failed to get server list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 添加服务器
   */
  async addServer(config: McpServerConfig): Promise<void> {
    try {
      await this.mcpClient.addServer(config)
      console.log(`✅ Server added: ${config.name} (${config.id})`)
    } catch (error) {
      console.error('Failed to add server:', error)
      throw new Error(`Failed to add server: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 更新服务器配置
   */
  async updateServer(serverId: string, updates: Partial<McpServerConfig>): Promise<void> {
    try {
      await this.mcpClient.updateServer(serverId, updates)
      console.log(`✅ Server updated: ${serverId}`)
    } catch (error) {
      console.error('Failed to update server:', error)
      throw new Error(`Failed to update server: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 删除服务器
   */
  async removeServer(serverId: string): Promise<void> {
    try {
      await this.mcpClient.removeServer(serverId)
      console.log(`✅ Server removed: ${serverId}`)
    } catch (error) {
      console.error('Failed to remove server:', error)
      throw new Error(`Failed to remove server: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ============== 连接管理 ==============

  /**
   * 连接到服务器
   */
  async connect(serverId: string): Promise<void> {
    try {
      await this.mcpClient.connect(serverId)
      console.log(`✅ Connected to server: ${serverId}`)
    } catch (error) {
      console.error(`Failed to connect to server (${serverId}):`, error)
      throw new Error(`Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnect(serverId: string): Promise<void> {
    try {
      await this.mcpClient.disconnect(serverId)
      console.log(`✅ Disconnected from server: ${serverId}`)
    } catch (error) {
      console.error(`Failed to disconnect from server (${serverId}):`, error)
      throw new Error(`Failed to disconnect from server: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ============== MCP 功能调用 ==============

  /**
   * 从服务器获取工具列表
   */
  async listTools(serverId: string): Promise<ToolInfo[]> {
    try {
      return await this.mcpClient.listTools(serverId)
    } catch (error) {
      console.error(`Failed to get tool list (${serverId}):`, error)
      throw new Error(`Failed to get tool list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 调用工具
   */
  async callTool(serverId: string, toolName: string, args?: any): Promise<ToolCallResult> {
    try {
      console.log(`🔧 Calling tool: ${toolName} @ ${serverId}`, args)
      const result = await this.mcpClient.callTool(serverId, toolName, args)
      console.log(`✅ Tool call successful: ${toolName}`)
      return result
    } catch (error) {
      console.error(`Tool call failed (${toolName} @ ${serverId}):`, error)
      throw new Error(`Tool call failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 从服务器获取资源列表
   */
  async listResources(serverId: string): Promise<ResourceInfo[]> {
    try {
      return await this.mcpClient.listResources(serverId)
    } catch (error) {
      console.error(`Failed to get resource list (${serverId}):`, error)
      throw new Error(`Failed to get resource list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 读取资源
   */
  async readResource(serverId: string, uri: string): Promise<ResourceContent> {
    try {
      console.log(`📄 Reading resource: ${uri} @ ${serverId}`)
      const result = await this.mcpClient.readResource(serverId, uri)
      console.log(`✅ Resource read successful: ${uri}`)
      return result
    } catch (error) {
      console.error(`Resource read failed (${uri} @ ${serverId}):`, error)
      throw new Error(`Resource read failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ============== IPC 接口暴露 ==============

  /**
   * 向前端暴露IPC接口
   * 遵循简单实用原则，直接映射用户需求
   */
  exposeToIPC(): Record<string, Function> {
    return {
      // 服务器管理 - 4个基本CRUD操作
      'mcp:list-servers': this.listServers.bind(this),
      'mcp:add-server': this.addServer.bind(this),
      'mcp:update-server': this.updateServer.bind(this),
      'mcp:remove-server': this.removeServer.bind(this),

      // 连接管理 - 2个基本操作
      'mcp:connect': this.connect.bind(this),
      'mcp:disconnect': this.disconnect.bind(this),

      // MCP功能调用 - 4个核心功能
      'mcp:list-tools': this.listTools.bind(this),
      'mcp:call-tool': this.callTool.bind(this),
      'mcp:list-resources': this.listResources.bind(this),
      'mcp:read-resource': this.readResource.bind(this)
    }
  }
}