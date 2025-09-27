/**
 * MCP领域IPC适配器
 *
 * 职责：
 * - 为前端暴露MCP相关的IPC接口
 * - 处理IPC请求和响应格式转换
 * - 协调各个服务的调用
 */

import { ServerService } from '../services/ServerService.js'
import { FunctionService } from '../services/FunctionService.js'
import {
  McpServerConfig,
  McpServerWithStatus,
  ToolInfo,
  ToolCallResult,
  ResourceInfo,
  ResourceContent,
  PromptInfo,
  PromptResult,
  ConnectionStatus
} from '../types/McpTypes.js'

export class IPCAdapter {
  constructor(
    private serverService: ServerService,
    private functionService: FunctionService
  ) {}

  /**
   * 暴露给IPC的接口映射
   * 遵循简单实用原则，直接映射用户需求
   */
  exposeToIPC(): Record<string, Function> {
    return {
      // 服务器管理 - 5个基本CRUD操作
      'mcp:list-servers': this.listServers.bind(this),
      'mcp:add-server': this.addServer.bind(this),
      'mcp:update-server': this.updateServer.bind(this),
      'mcp:remove-server': this.removeServer.bind(this),
      'mcp:get-server': this.getServer.bind(this),

      // 连接管理 - 4个连接操作
      'mcp:connect': this.connect.bind(this),
      'mcp:disconnect': this.disconnect.bind(this),
      'mcp:is-connected': this.isConnected.bind(this),
      'mcp:list-connections': this.listConnections.bind(this),

      // MCP功能调用 - 6个核心功能
      'mcp:list-tools': this.listTools.bind(this),
      'mcp:call-tool': this.callTool.bind(this),
      'mcp:list-resources': this.listResources.bind(this),
      'mcp:read-resource': this.readResource.bind(this),
      'mcp:list-prompts': this.listPrompts.bind(this),
      'mcp:get-prompt': this.getPrompt.bind(this)
    }
  }

  // ============ 服务器管理接口 ============

  /**
   * 获取所有服务器列表
   */
  private async listServers(): Promise<McpServerWithStatus[]> {
    console.log('📨 IPC请求: mcp:list-servers')

    try {
      const result = await this.serverService.listServersWithStatus()
      console.log('✅ IPC响应: mcp:list-servers')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:list-servers', error)
      throw error
    }
  }

  /**
   * 添加服务器
   */
  private async addServer(config: McpServerConfig): Promise<void> {
    console.log('📨 IPC请求: mcp:add-server', config)

    try {
      await this.serverService.addServer(config)
      console.log('✅ IPC响应: mcp:add-server')
    } catch (error) {
      console.error('❌ IPC错误: mcp:add-server', error)
      throw error
    }
  }

  /**
   * 更新服务器配置
   */
  private async updateServer(serverId: string, updates: Partial<McpServerConfig>): Promise<void> {
    console.log('📨 IPC请求: mcp:update-server', { serverId, updates })

    try {
      await this.serverService.updateServer(serverId, updates)
      console.log('✅ IPC响应: mcp:update-server')
    } catch (error) {
      console.error('❌ IPC错误: mcp:update-server', error)
      throw error
    }
  }

  /**
   * 删除服务器
   */
  private async removeServer(serverId: string): Promise<void> {
    console.log('📨 IPC请求: mcp:remove-server', serverId)

    try {
      await this.serverService.removeServer(serverId)
      console.log('✅ IPC响应: mcp:remove-server')
    } catch (error) {
      console.error('❌ IPC错误: mcp:remove-server', error)
      throw error
    }
  }

  /**
   * 获取服务器配置
   */
  private getServer(serverId: string): McpServerConfig | null {
    console.log('📨 IPC请求: mcp:get-server', serverId)

    try {
      const result = this.serverService.getServer(serverId)
      console.log('✅ IPC响应: mcp:get-server')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:get-server', error)
      throw error
    }
  }

  // ============ 连接管理接口 ============

  /**
   * 连接到服务器
   */
  private async connect(serverId: string): Promise<void> {
    console.log('📨 IPC请求: mcp:connect', serverId)

    try {
      await this.serverService.connect(serverId)
      console.log('✅ IPC响应: mcp:connect')
    } catch (error) {
      console.error('❌ IPC错误: mcp:connect', error)
      throw error
    }
  }

  /**
   * 断开服务器连接
   */
  private async disconnect(serverId: string): Promise<void> {
    console.log('📨 IPC请求: mcp:disconnect', serverId)

    try {
      await this.serverService.disconnect(serverId)
      console.log('✅ IPC响应: mcp:disconnect')
    } catch (error) {
      console.error('❌ IPC错误: mcp:disconnect', error)
      throw error
    }
  }

  /**
   * 检查连接状态
   */
  private isConnected(serverId: string): boolean {
    console.log('📨 IPC请求: mcp:is-connected', serverId)

    try {
      const result = this.serverService.isConnected(serverId)
      console.log('✅ IPC响应: mcp:is-connected')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:is-connected', error)
      throw error
    }
  }

  /**
   * 获取连接列表
   */
  private listConnections(): Array<{ serverId: string; status: ConnectionStatus; connectedAt?: Date; lastError?: string }> {
    console.log('📨 IPC请求: mcp:list-connections')

    try {
      const result = this.serverService.listConnections()
      console.log('✅ IPC响应: mcp:list-connections')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:list-connections', error)
      throw error
    }
  }

  // ============ MCP功能调用接口 ============

  /**
   * 获取工具列表
   */
  private async listTools(serverId: string): Promise<ToolInfo[]> {
    console.log('📨 IPC请求: mcp:list-tools', serverId)

    try {
      const result = await this.functionService.listTools(serverId)
      console.log('✅ IPC响应: mcp:list-tools')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:list-tools', error)
      throw error
    }
  }

  /**
   * 调用工具
   */
  private async callTool(serverId: string, toolName: string, args?: any): Promise<ToolCallResult> {
    console.log('📨 IPC请求: mcp:call-tool', { serverId, toolName, args })

    try {
      const result = await this.functionService.callTool(serverId, toolName, args)
      console.log('✅ IPC响应: mcp:call-tool')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:call-tool', error)
      throw error
    }
  }

  /**
   * 获取资源列表
   */
  private async listResources(serverId: string): Promise<ResourceInfo[]> {
    console.log('📨 IPC请求: mcp:list-resources', serverId)

    try {
      const result = await this.functionService.listResources(serverId)
      console.log('✅ IPC响应: mcp:list-resources')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:list-resources', error)
      throw error
    }
  }

  /**
   * 读取资源
   */
  private async readResource(serverId: string, uri: string): Promise<ResourceContent> {
    console.log('📨 IPC请求: mcp:read-resource', { serverId, uri })

    try {
      const result = await this.functionService.readResource(serverId, uri)
      console.log('✅ IPC响应: mcp:read-resource')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:read-resource', error)
      throw error
    }
  }

  /**
   * 获取提示词列表
   */
  private async listPrompts(serverId: string): Promise<PromptInfo[]> {
    console.log('📨 IPC请求: mcp:list-prompts', serverId)

    try {
      const result = await this.functionService.listPrompts(serverId)
      console.log('✅ IPC响应: mcp:list-prompts')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:list-prompts', error)
      throw error
    }
  }

  /**
   * 获取提示词
   */
  private async getPrompt(serverId: string, name: string, args?: any): Promise<PromptResult> {
    console.log('📨 IPC请求: mcp:get-prompt', { serverId, name, args })

    try {
      const result = await this.functionService.getPrompt(serverId, name, args)
      console.log('✅ IPC响应: mcp:get-prompt')
      return result
    } catch (error) {
      console.error('❌ IPC错误: mcp:get-prompt', error)
      throw error
    }
  }
}