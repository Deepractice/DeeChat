/**
 * 🏛️ McpDomain - MCP协议领域聚合根 (模块入口)
 *
 * 📍 这是MCP功能的统一入口和协调者，采用Python风格的模块组织
 * 📂 具体实现分布在当前目录的子文件夹中
 *
 * 核心职责:
 * - 作为MCP领域的统一入口和协调者
 * - 管理MCP服务器配置和连接生命周期
 * - 处理MCP工具调用和资源访问
 * - 提供MCP服务发现和状态监控
 *
 * 设计原则:
 * - 简单实用，遵循奥卡姆剃刀定律
 * - 用户需求到简单接口的直接映射
 * - 基于@deepracticex/mcp-client包构建
 *
 * 🔗 依赖组件:
 *   - ./services/     业务服务层
 *   - ./adapters/     接口适配层
 *   - ./types/        类型定义层
 */

import { Service } from 'typedi'
import {
  McpClient,
  McpClientOptions
} from '@deepracticex/mcp-client'
import { McpClientAdapter } from '@deepracticex/ai-chat/dist/types/mcp.js'
import { IDomain } from '../../ipc/ipc-registry.js'

// 导入各个领域服务和组件
import { ServerService } from './services/ServerService.js'
import { FunctionService } from './services/FunctionService.js'
import { IPCAdapter } from './adapters/IPCAdapter.js'

// 导入类型定义
import type {
  ToolCallResult,
  McpServerWithStatus
} from './types/McpTypes.js'

/**
 * McpDomain类 - 聚合根实现
 *
 * 作为MCP领域的聚合根，负责：
 * - 初始化和管理所有领域服务
 * - 提供统一的业务接口
 * - 协调各服务间的交互
 * - 管理领域资源的生命周期
 * - 实现McpClientAdapter接口供AI系统调用
 */
@Service()
export class McpDomain implements IDomain, McpClientAdapter {
  // ============ 私有字段 ============

  /** MCP客户端实例 */
  private mcpClient: McpClient

  /** 服务器管理服务 */
  private serverService: ServerService | null = null

  /** 功能调用服务 */
  private functionService: FunctionService | null = null

  /** IPC适配器 - 暴露IPC接口 */
  private ipcAdapter: IPCAdapter | null = null

  // ============ 构造函数 ============

  constructor() {
    // 使用新的 McpClientOptions 初始化MCP客户端
    const options: McpClientOptions = {
      autoSaveConfig: true,
      defaultTimeout: 30000,
      defaultAutoReconnect: true
    }
    // 强制使用普通构造函数，避免TypeDI干扰
    this.mcpClient = new McpClient(options)

    // 调试信息：检查实例创建结果
    console.log('🔍 McpDomain构造函数 - 创建McpClient:', {
      instanceType: typeof this.mcpClient,
      constructor: this.mcpClient?.constructor?.name,
      hasCallTool: typeof this.mcpClient?.callTool,
      isFunction: typeof this.mcpClient?.callTool === 'function',
      keys: Object.keys(this.mcpClient || {}).slice(0, 5)
    })

    // 确保实例创建成功
    if (!this.mcpClient || typeof this.mcpClient.callTool !== 'function') {
      throw new Error(`McpClient实例创建失败或接口不匹配: ${typeof this.mcpClient}, callTool: ${typeof this.mcpClient?.callTool}`)
    }

    // 设置事件监听器
    this.setupEventListeners()
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.mcpClient.on('connection-status-changed', (serverId: string, newStatus: string, oldStatus: string) => {
      console.log(`🔄 Server ${serverId} status changed: ${oldStatus} -> ${newStatus}`)
    })

    this.mcpClient.on('error', (error: Error) => {
      console.error('❌ MCP Client error:', error)
    })
  }

  // ============ 领域初始化 ============

  /**
   * 初始化MCP领域服务
   *
   * 执行必要的初始化步骤：
   * 1. 初始化MCP客户端
   * 2. 创建各个领域服务
   * 3. 建立服务间的依赖关系
   * 4. 自动连接已配置的服务器
   */
  async initialize(): Promise<void> {
    console.log('🔌 Initializing MCP domain service...')

    try {
      // 1. 初始化MCP客户端
      await this.mcpClient.initialize()
      console.log('✅ MCP client initialized successfully')

      // 2. 创建各个领域服务
      this.serverService = new ServerService(this.mcpClient)
      console.log('✅ ServerService 初始化完成')

      this.functionService = new FunctionService(this.mcpClient)
      console.log('✅ FunctionService 初始化完成')

      // 3. 创建IPC适配器（依赖所有服务）
      this.ipcAdapter = new IPCAdapter(
        this.serverService,
        this.functionService
      )
      console.log('✅ IPCAdapter 初始化完成')

      console.log('✅ MCP domain service initialized successfully')

      // 4. 自动连接所有已配置的服务器
      await this.serverService.autoConnectServers()
    } catch (error) {
      console.error('❌ MCP domain service initialization failed:', error)
      throw error
    }
  }

  // ============ IPC接口暴露 ============

  /**
   * 暴露MCP领域的IPC接口
   *
   * 将领域服务的方法暴露给IPC层，供渲染进程调用
   * 通过IPCAdapter统一管理所有IPC接口
   *
   * @returns IPC方法映射表
   */
  exposeToIPC(): Record<string, Function> {
    console.log('🔧 McpDomain聚合根注册IPC接口...')

    if (!this.ipcAdapter) {
      throw new Error('IPCAdapter未初始化，请先调用initialize方法')
    }

    const ipcHandlers = this.ipcAdapter.exposeToIPC()

    console.log(`✅ McpDomain聚合根IPC接口注册完成: ${Object.keys(ipcHandlers).length}个方法`)
    console.log('📋 注册的IPC方法:', Object.keys(ipcHandlers).join(', '))

    return ipcHandlers
  }

  // ============ McpClientAdapter接口实现 ============

  /**
   * 调用工具 - 实现McpClientAdapter接口
   * 同时满足原有IPC接口和ai-chat集成的需求
   */
  async callTool(serverId: string, toolName: string, args?: any): Promise<ToolCallResult> {
    if (!this.functionService) {
      throw new Error('FunctionService未初始化，请先调用initialize方法')
    }

    return await this.functionService.callTool(serverId, toolName, args)
  }

  /**
   * 检查服务器是否已连接 - 实现McpClientAdapter接口
   */
  isConnected(serverId: string): boolean {
    if (!this.serverService) {
      throw new Error('ServerService未初始化，请先调用initialize方法')
    }

    return this.serverService.isConnected(serverId)
  }

  // ============ 领域业务接口（可选，用于内部调用）============

  /**
   * 获取服务器管理服务实例
   * 用于其他领域需要访问服务器管理功能时
   */
  getServerService(): ServerService {
    if (!this.serverService) {
      throw new Error('ServerService未初始化，请先调用initialize方法')
    }
    return this.serverService
  }

  /**
   * 获取功能调用服务实例
   * 用于其他领域需要访问MCP功能时
   */
  getFunctionService(): FunctionService {
    if (!this.functionService) {
      throw new Error('FunctionService未初始化，请先调用initialize方法')
    }
    return this.functionService
  }

  // ============ 系统监控方法 ============

  /**
   * 系统健康检查
   *
   * @returns 健康状态报告
   */
  healthCheck(): any {
    return {
      mcp_client_initialized: !!this.mcpClient,
      server_service_initialized: !!this.serverService,
      function_service_initialized: !!this.functionService,
      ipc_adapter_initialized: !!this.ipcAdapter
    }
  }

  // ============ 资源管理方法 ============

  /**
   * 清理资源
   *
   * 应用关闭时调用，确保资源正确释放：
   * - 断开所有MCP连接
   * - 清理各服务实例
   */
  async dispose(): Promise<void> {
    console.log('🧹 Cleaning up MCP domain service...')

    try {
      // 清理MCP客户端
      if (this.mcpClient) {
        await this.mcpClient.dispose()
        console.log('✅ MCP client cleanup completed')
      }

      // 清理服务实例引用
      this.serverService = null
      this.functionService = null
      this.ipcAdapter = null

      console.log('✅ MCP domain service cleanup completed')
    } catch (error) {
      console.error('❌ MCP domain service cleanup failed:', error)
    }
  }
}