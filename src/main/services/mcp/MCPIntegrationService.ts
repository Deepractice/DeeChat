/**
 * MCP集成服务 - 简化重构版
 * 参考Cherry Studio设计，使用官方MCP SDK
 */

import log from 'electron-log'
import { MCPServerEntity } from '../../../shared/entities/MCPServerEntity'
import { MCPToolEntity } from '../../../shared/entities/MCPToolEntity'
import {
  IMCPProvider,
  MCPConnectionStatus,
  MCPServerStatus,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPEvent,
  MCPEventType
} from '../../../shared/interfaces/IMCPProvider'
import { SimpleMCPClientManager } from './SimpleMCPClientManager'
import { MCPConfigService } from './MCPConfigService'
import { MCPCacheService } from './MCPCacheService'

export class MCPIntegrationService implements IMCPProvider {
  private static instance: MCPIntegrationService | null = null
  private clientManager: SimpleMCPClientManager
  private configService: MCPConfigService
  private cacheService: MCPCacheService
  private eventListeners: ((event: MCPEvent) => void)[] = []
  private isInitialized: boolean = false

  private constructor() {
    this.clientManager = new SimpleMCPClientManager()
    this.configService = new MCPConfigService()
    this.cacheService = new MCPCacheService()

    // 注入配置服务
    this.clientManager.setConfigService(this.configService)

    // 监听客户端事件
    this.clientManager.onEvent((event) => {
      this.emitEvent(event)
    })

    log.info('[MCP] 简化版集成服务已创建')
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MCPIntegrationService {
    if (!MCPIntegrationService.instance) {
      MCPIntegrationService.instance = new MCPIntegrationService()
    }
    return MCPIntegrationService.instance
  }

  /**
   * 初始化服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      log.info('[MCP] 服务已初始化，跳过重复初始化')
      return
    }

    // 🔒 防止并发初始化
    if (MCPIntegrationService._initializing) {
      log.info('[MCP] 正在初始化中，等待完成...')
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!MCPIntegrationService._initializing) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
      })
    }

    MCPIntegrationService._initializing = true

    try {
      log.info('[MCP] 🚀 开始初始化服务...')

      // 🔍 调试：检查配置服务状态
      log.info('[MCP] 🔍 检查配置服务状态...')
      const allServers = await this.configService.getAllServerConfigs()
      log.info(`[MCP] 📋 找到 ${allServers.length} 个服务器配置:`)
      allServers.forEach((server, index) => {
        log.info(`[MCP]   ${index + 1}. ${server.name} (${server.id}) - 启用: ${server.isEnabled}`)
      })

      // 自动连接已启用的服务器
      await this.initializeEnabledServers()

      this.isInitialized = true
      MCPIntegrationService._initializing = false
      
      log.info('[MCP] ✅ 服务初始化完成')
    } catch (error) {
      MCPIntegrationService._initializing = false
      log.error('[MCP] ❌ 服务初始化失败:', error)
      throw error
    }
  }

  // 🔒 静态初始化标志
  private static _initializing = false

  /**
   * 初始化已启用的服务器
   */
  private async initializeEnabledServers(): Promise<void> {
    try {
      const servers = await this.configService.getAllServerConfigs()
      const enabledServers = servers.filter(server => server.isEnabled)
      
      log.info(`[MCP] 🔍 发现 ${enabledServers.length} 个已启用服务器`)

      if (enabledServers.length === 0) {
        log.warn(`[MCP] ⚠️ 没有找到已启用的服务器`)
        return
      }

      // 🔥 打印每个服务器的详细信息
      enabledServers.forEach((server, index) => {
        log.info(`[MCP] 📋 服务器 ${index + 1}: ${server.name}`)
        log.info(`[MCP]   - ID: ${server.id}`)
        log.info(`[MCP]   - 类型: ${server.type}`)
        log.info(`[MCP]   - 命令: ${server.command}`)
        log.info(`[MCP]   - 参数: ${server.args?.join(' ') || '无'}`)
        log.info(`[MCP]   - 工作目录: ${server.workingDirectory || '未设置'}`)
        log.info(`[MCP]   - 启用状态: ${server.isEnabled}`)
      })

      // 🔥 顺序连接服务器（避免并发问题）
      const results = []
      for (let i = 0; i < enabledServers.length; i++) {
        const server = enabledServers[i]
        try {
          log.info(`[MCP] 🔌 开始连接服务器 ${i + 1}/${enabledServers.length}: ${server.name} (${server.id})`)
          
          // 🔥 强制执行连接，忽略缓存
          log.info(`[MCP] 🚀 执行连接重试逻辑...`)
          await this.connectServerWithRetry(server)
          
          log.info(`[MCP] ✅ 服务器 ${server.name} 连接成功`)
          results.push({ success: true, server: server.name })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          log.error(`[MCP] ❌ 服务器 ${server.name} 连接失败: ${errorMessage}`)
          log.error(`[MCP] 详细错误:`, error)
          results.push({ success: false, server: server.name, error: errorMessage })
        }
      }

      const successful = results.filter(r => r.success).length
      log.info(`[MCP] 🎉 服务器初始化完成: ${successful}/${enabledServers.length} 成功`)
      
      if (successful === 0) {
        log.error(`[MCP] 💥 所有服务器连接都失败了！`)
        log.error(`[MCP] 失败结果:`, results.filter(r => !r.success))
      }
    } catch (error) {
      log.error('[MCP] 服务器初始化过程失败:', error)
      throw error
    }
  }

  /**
   * 带重试的服务器连接
   */
  private async connectServerWithRetry(server: MCPServerEntity, maxRetries = 3): Promise<void> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.info(`[MCP] 🔄 连接尝试 ${attempt}/${maxRetries}: ${server.name}`)
        log.info(`[MCP] 📋 服务器配置详情:`, {
          id: server.id,
          command: server.command,
          args: server.args,
          workingDirectory: server.workingDirectory,
          type: server.type
        })
        
        // 🔥 详细的连接过程日志
        log.info(`[MCP] 🚀 开始初始化客户端...`)
        await this.clientManager.initClient(server)
        log.info(`[MCP] ✅ 客户端初始化完成`)
        
        // 🔥 关键：等待客户端稳定后再发现工具
        log.info(`[MCP] ⏳ 等待客户端稳定...`)
        await new Promise(resolve => setTimeout(resolve, 2000)) // 增加到2秒
        
        // 发现工具
        log.info(`[MCP] 🔍 开始发现工具...`)
        const tools = await this.clientManager.discoverTools(server)
        log.info(`[MCP] 📦 工具发现完成，数量: ${tools.length}`)
        
        // 打印工具详情
        if (tools.length > 0) {
          log.info(`[MCP] 🔧 发现的工具列表:`)
          tools.forEach((tool, index) => {
            log.info(`[MCP]   ${index + 1}. ${tool.name} - ${tool.description || '无描述'}`)
          })
        } else {
          log.warn(`[MCP] ⚠️ 没有发现任何工具，这可能表示连接有问题`)
        }
        
        this.cacheService.cacheServerTools(server.id, tools)
        
        log.info(`[MCP] ✅ ${server.name} 连接成功，发现 ${tools.length} 个工具`)
        
        // 发送连接成功事件
        this.emitEvent({
          type: MCPEventType.SERVER_CONNECTED,
          serverId: server.id,
          timestamp: new Date(),
          data: { toolCount: tools.length }
        })
        
        return // 成功连接，退出重试循环
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        log.error(`[MCP] ❌ 连接尝试 ${attempt} 失败: ${server.name}`)
        log.error(`[MCP] 错误详情:`, {
          message: lastError.message,
          stack: lastError.stack?.split('\n').slice(0, 3).join('\n')
        })
        
        if (attempt < maxRetries) {
          // 等待后重试
          const delay = attempt * 2000 // 递增延迟：2s, 4s, 6s
          log.info(`[MCP] ⏳ ${delay/1000}秒后重试...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // 所有重试都失败
    if (lastError) {
      log.error(`[MCP] 💥 ${server.name} 所有连接尝试都失败了`)
      
      // 发送连接失败事件
      this.emitEvent({
        type: MCPEventType.SERVER_ERROR,
        serverId: server.id,
        timestamp: new Date(),
        error: lastError.message
      })
      throw lastError
    }
  }

  /**
   * 添加服务器
   */
  async addServer(server: MCPServerEntity): Promise<void> {
    log.info(`[MCP] 添加服务器: ${server.name}`)

    // 验证配置
    const validation = server.validate()
    if (!validation.isValid) {
      throw new Error(`配置无效: ${validation.errors.join(', ')}`)
    }

    // 保存配置
    await this.configService.saveServerConfig(server)

    // 如果启用，立即连接
    if (server.isEnabled) {
      try {
        await this.clientManager.initClient(server)
        const tools = await this.clientManager.discoverTools(server)
        this.cacheService.cacheServerTools(server.id, tools)
        log.info(`[MCP] ✅ ${server.name} 连接成功`)
      } catch (error) {
        log.warn(`[MCP] ⚠️ ${server.name} 连接失败:`, error)
      }
    }

    this.emitEvent({
      type: MCPEventType.SERVER_CONNECTED,
      serverId: server.id,
      timestamp: new Date()
    })
  }

  /**
   * 移除服务器
   */
  async removeServer(serverId: string): Promise<void> {
    log.info(`[MCP] 移除服务器: ${serverId}`)

    // 断开连接
    await this.clientManager.closeClient(serverId)

    // 删除配置和缓存
    await this.configService.deleteServerConfig(serverId)
    this.cacheService.invalidateServer(serverId)

    this.emitEvent({
      type: MCPEventType.SERVER_DISCONNECTED,
      serverId,
      timestamp: new Date()
    })
  }

  /**
   * 获取所有服务器
   */
  async getAllServers(): Promise<MCPServerEntity[]> {
    return await this.configService.getAllServerConfigs()
  }

  /**
   * 更新服务器
   */
  async updateServer(serverId: string, updates: any): Promise<void> {
    log.info(`[MCP] 更新服务器: ${serverId}`)

    const server = await this.configService.getServerConfig(serverId)
    if (!server) {
      throw new Error(`服务器不存在: ${serverId}`)
    }

    const wasEnabled = server.isEnabled
    server.update(updates)
    await this.configService.saveServerConfig(server)

    // 处理启用状态变化
    if (updates.hasOwnProperty('isEnabled')) {
      if (updates.isEnabled && !wasEnabled) {
        // 启用服务器
        try {
          await this.clientManager.initClient(server)
          const tools = await this.clientManager.discoverTools(server)
          this.cacheService.cacheServerTools(serverId, tools)
          log.info(`[MCP] ✅ 服务器已启用: ${serverId}`)
        } catch (error) {
          log.error(`[MCP] ❌ 启用失败: ${serverId}`, error)
          server.isEnabled = false
          await this.configService.saveServerConfig(server)
          throw error
        }
      } else if (!updates.isEnabled && wasEnabled) {
        // 禁用服务器
        await this.clientManager.closeClient(serverId)
        this.cacheService.invalidateServerTools(serverId)
        log.info(`[MCP] ⏸️ 服务器已禁用: ${serverId}`)
      }
    }
  }

  /**
   * 获取服务器状态
   */
  async getServerStatus(serverId: string): Promise<MCPServerStatus> {
    const server = await this.configService.getServerConfig(serverId)
    if (!server) {
      throw new Error(`服务器不存在: ${serverId}`)
    }

    const cachedTools = this.cacheService.getCachedServerTools(serverId)
    
    return {
      serverId,
      status: server.isEnabled ? MCPConnectionStatus.CONNECTED : MCPConnectionStatus.DISCONNECTED,
      toolCount: cachedTools?.length || 0,
      lastConnected: new Date()
    }
  }

  /**
   * 测试服务器连接
   */
  async testServerConnection(serverId: string): Promise<boolean> {
    try {
      const server = await this.configService.getServerConfig(serverId)
      if (!server) return false

      const client = await this.clientManager.initClient(server)
      await client.ping()
      return true
    } catch (error) {
      log.error(`[MCP] 连接测试失败: ${serverId}`, error)
      return false
    }
  }

  /**
   * 发现服务器工具
   */
  async discoverServerTools(serverId: string): Promise<MCPToolEntity[]> {
    log.info(`[MCP] 发现工具: ${serverId}`)

    // 检查缓存
    const cached = this.cacheService.getCachedServerTools(serverId)
    if (cached) {
      log.info(`[MCP] 使用缓存: ${serverId} (${cached.length} 个工具)`)
      return cached
    }

    // 从服务器发现
    const server = await this.configService.getServerConfig(serverId)
    if (!server) {
      throw new Error(`服务器不存在: ${serverId}`)
    }

    try {
      const tools = await this.clientManager.discoverTools(server)
      this.cacheService.cacheServerTools(serverId, tools)
      
      this.emitEvent({
        type: MCPEventType.TOOL_DISCOVERED,
        serverId,
        timestamp: new Date(),
        data: { toolCount: tools.length }
      })

      return tools
    } catch (error) {
      log.error(`[MCP] 工具发现失败: ${serverId}`, error)
      throw error
    }
  }

  /**
   * 获取所有工具 - 采用Cherry Studio的简单方式
   */
  async getAllTools(): Promise<MCPToolEntity[]> {
    console.log('[MCP Integration] 🔍 开始获取所有工具...')
    
    // 直接从缓存获取，如果缓存为空则先发现工具
    const cachedTools = this.cacheService.getAllCachedTools()
    console.log(`[MCP Integration] 📦 缓存中有 ${cachedTools.length} 个工具`)
    
    if (cachedTools.length > 0) {
      return cachedTools
    }
    
    // 缓存为空，先确保已初始化并发现工具
    console.log('[MCP Integration] 🔄 缓存为空，重新发现工具...')
    
    try {
      // 获取所有启用的服务器
      const servers = await this.configService.getAllServerConfigs()
      const enabledServers = servers.filter(server => server.isEnabled)
      
      console.log(`[MCP Integration] 📋 发现 ${enabledServers.length} 个启用的服务器`)
      
      // 并行发现所有服务器的工具
      const discoveryPromises = enabledServers.map(async (server) => {
        try {
          console.log(`[MCP Integration] 🔍 发现服务器工具: ${server.name}`)
          const tools = await this.clientManager.discoverTools(server)
          this.cacheService.cacheServerTools(server.id, tools)
          console.log(`[MCP Integration] ✅ ${server.name} 发现 ${tools.length} 个工具`)
          return tools
        } catch (error) {
          console.error(`[MCP Integration] ❌ ${server.name} 工具发现失败:`, error)
          return []
        }
      })
      
      const allToolArrays = await Promise.all(discoveryPromises)
      const allTools = allToolArrays.flat()
      
      console.log(`[MCP Integration] 🎯 总共发现 ${allTools.length} 个工具`)
      return allTools
      
    } catch (error) {
      console.error('[MCP Integration] ❌ 工具发现过程失败:', error)
      return []
    }
  }

  /**
   * 调用工具
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    log.info(`[MCP] 调用工具: ${request.serverId}:${request.toolName}`)

    const startTime = Date.now()

    try {
      // 直接使用客户端管理器调用工具
      const response = await this.clientManager.callTool(request)
      const duration = Date.now() - startTime

      // 更新工具使用统计
      const tools = this.cacheService.getCachedServerTools(request.serverId) || []
      const tool = tools.find(t => t.name === request.toolName)
      if (tool) {
        tool.recordUsage()
      }

      this.emitEvent({
        type: MCPEventType.TOOL_CALLED,
        serverId: request.serverId,
        timestamp: new Date(),
        data: {
          toolName: request.toolName,
          duration,
          success: response.success
        }
      })

      return { ...response, duration }
    } catch (error) {
      const duration = Date.now() - startTime

      this.emitEvent({
        type: MCPEventType.TOOL_ERROR,
        serverId: request.serverId,
        timestamp: new Date(),
        data: { toolName: request.toolName, duration },
        error: error instanceof Error ? error.message : '未知错误'
      })

      throw error
    }
  }

  /**
   * 搜索工具
   */
  async searchTools(query: string): Promise<MCPToolEntity[]> {
    const allTools = await this.getAllTools()
    return allTools.filter(tool => tool.matches(query))
  }

  /**
   * 获取工具使用统计
   */
  async getToolUsageStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {}
    const allTools = this.cacheService.getAllCachedTools()

    for (const tool of allTools) {
      stats[tool.id] = tool.usageCount
    }

    return stats
  }

  /**
   * 事件监听
   */
  onEvent(callback: (event: MCPEvent) => void): void {
    this.eventListeners.push(callback)
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    log.info('[MCP] 清理资源')
    
    await this.clientManager.cleanup()
    this.cacheService.destroy()
    this.eventListeners.length = 0
    this.isInitialized = false
  }

  /**
   * 发送事件
   */
  private emitEvent(event: MCPEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        log.error('[MCP] 事件监听器错误:', error)
      }
    }
  }
}