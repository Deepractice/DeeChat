/**
 * MCP服务器管理服务
 *
 * 职责：
 * - 管理MCP服务器配置的增删改查
 * - 处理服务器连接和断开
 * - 监控服务器状态和统计信息
 */

import { McpClient } from '@deepracticex/mcp-client'
import {
  McpServerConfig,
  McpServerWithStatus,
  ConnectionStatus
} from '../types/McpTypes.js'

export class ServerService {
  constructor(private mcpClient: McpClient) {}

  /**
   * 获取所有服务器及状态信息
   */
  async listServersWithStatus(): Promise<McpServerWithStatus[]> {
    try {
      const servers = this.mcpClient.listServers()
      const connections = this.mcpClient.listConnections()

      // 为每个服务器添加状态信息
      const serversWithStatus: McpServerWithStatus[] = await Promise.all(
        servers.map(async (server) => {
          const connectionStatus = this.mcpClient.getConnectionStatus(server.id)
          const connectionInfo = connections.find(conn => conn.serverId === server.id)

          let toolCount: number | undefined
          let resourceCount: number | undefined
          let promptCount: number | undefined
          let error: string | undefined

          // 如果已连接，获取工具、资源和提示词数量
          if (connectionStatus === ConnectionStatus.CONNECTED) {
            try {
              const [tools, resources, prompts] = await Promise.all([
                this.mcpClient.listTools(server.id),
                this.mcpClient.listResources(server.id),
                this.mcpClient.listPrompts(server.id)
              ])
              toolCount = tools.length
              resourceCount = resources.length
              promptCount = prompts.length
              // 连接成功且获取数据成功，清除错误信息
              error = undefined
            } catch (err) {
              error = err instanceof Error ? err.message : String(err)
            }
          } else {
            // 连接失败时，使用连接层的错误信息
            error = connectionInfo?.error
          }

          return {
            ...server,
            connectionStatus,
            toolCount,
            resourceCount,
            promptCount,
            error,
            connectedAt: connectionInfo?.connectedAt
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

  /**
   * 获取单个服务器配置
   */
  getServer(serverId: string): McpServerConfig | null {
    try {
      return this.mcpClient.getServer(serverId)
    } catch (error) {
      console.error(`Failed to get server config (${serverId}):`, error)
      return null
    }
  }

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

  /**
   * 检查服务器是否已连接
   */
  isConnected(serverId: string): boolean {
    return this.mcpClient.isConnected(serverId)
  }

  /**
   * 获取所有连接信息
   */
  listConnections(): Array<{ serverId: string; status: ConnectionStatus; connectedAt?: Date; lastError?: string }> {
    return this.mcpClient.listConnections()
  }

  /**
   * 自动连接所有已配置的服务器
   */
  async autoConnectServers(): Promise<void> {
    try {
      const servers = this.mcpClient.listServers()

      if (servers.length === 0) {
        console.log('📝 No MCP servers configured for auto-connection')
        return
      }

      console.log(`🔗 Auto-connecting to ${servers.length} configured MCP server(s)...`)

      // 并行连接所有服务器
      const connectionPromises = servers
        .filter(server => server.enabled !== false) // 只连接启用的服务器
        .map(async (server) => {
          try {
            console.log(`🔌 Connecting to server: ${server.name} (${server.id})`)
            await this.mcpClient.connect(server.id)
            console.log(`✅ Auto-connected to server: ${server.name}`)
          } catch (error) {
            console.warn(`⚠️ Auto-connection failed for server ${server.name}:`, error instanceof Error ? error.message : String(error))
            // 不抛出错误，继续连接其他服务器
          }
        })

      await Promise.allSettled(connectionPromises)
      console.log('🎯 Auto-connection process completed')
    } catch (error) {
      console.warn('⚠️ Auto-connection process failed:', error)
      // 不抛出错误，以免影响应用启动
    }
  }
}