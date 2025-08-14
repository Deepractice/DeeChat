/**
 * 🏗️ DeeChat 核心服务管理器
 * 负责应用的整体生命周期管理和服务协调
 * 
 * 设计原则：
 * 1. 单例模式 + 初始化锁
 * 2. 顺序初始化，避免并发竞争
 * 3. 统一生命周期管理
 * 4. 清晰的错误处理和恢复机制
 */

import { EventEmitter } from 'events'
import { ProcessPoolManager } from './ProcessPoolManager'
import { MCPServiceCoordinator } from './MCPServiceCoordinator'
// SystemRoleManager已移除，统一使用PromptX角色系统
import { QuickDatabaseManager } from '../services/core/QuickDatabaseManager'
import { FileService } from '../services/FileService'
import { FileOperationService } from '../services/FileOperationService'
import { PromptXResourceService } from '../services/promptx/PromptXResourceService'
import { ReferenceWorkspaceService } from '../services/workspace/ReferenceWorkspaceService'

export interface ServiceStatus {
  name: string
  status: 'initializing' | 'ready' | 'error' | 'stopping'
  message: string
  lastUpdate: Date
}

export class ServiceManager extends EventEmitter {
  private static instance: ServiceManager | null = null
  private isInitialized = false
  private isInitializing = false
  private isShuttingDown = false

  // 核心服务组件
  private databaseManager: QuickDatabaseManager
  private processPool: ProcessPoolManager
  private mcpCoordinator: MCPServiceCoordinator
  // systemRoleManager已移除，统一使用PromptX角色系统
  
  // 业务服务组件
  private fileService: FileService
  private fileOperationService: FileOperationService
  private promptxResourceService: PromptXResourceService
  private workspaceService: ReferenceWorkspaceService

  // 服务状态跟踪
  private serviceStatuses: Map<string, ServiceStatus> = new Map()

  private constructor() {
    super()
    
    // 初始化核心组件
    this.databaseManager = new QuickDatabaseManager()
    this.processPool = new ProcessPoolManager()
    this.mcpCoordinator = new MCPServiceCoordinator(this.processPool)
    // systemRoleManager已移除，统一使用PromptX角色系统
    
    // 初始化业务服务组件
    this.fileService = new FileService()
    this.fileOperationService = new FileOperationService()
    this.promptxResourceService = new PromptXResourceService(this.fileService)
    this.workspaceService = new ReferenceWorkspaceService()

    // 监听组件事件
    this.setupEventHandlers()
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager()
    }
    return ServiceManager.instance
  }

  /**
   * 🚀 启动所有服务（顺序初始化）
   */
  public async initialize(): Promise<void> {
    const instanceId = Math.random().toString(36).substr(2, 6)
    console.log(`🎯 [ServiceManager-${instanceId}] initialize被调用`)
    console.log(`🎯 [ServiceManager-${instanceId}] 当前状态: isInitialized=${this.isInitialized}, isInitializing=${this.isInitializing}`)
    
    if (this.isInitialized) {
      console.log(`✅ [ServiceManager-${instanceId}] 服务已初始化，直接返回`)
      return
    }

    if (this.isInitializing) {
      console.log(`⏳ [ServiceManager-${instanceId}] 正在初始化中，等待完成...`)
      return new Promise((resolve) => {
        console.log(`⏳ [ServiceManager-${instanceId}] 注册initialized事件监听器`)
        this.once('initialized', () => {
          console.log(`✅ [ServiceManager-${instanceId}] initialized事件触发，等待结束`)
          resolve()
        })
      })
    }

    console.log(`🚀 [ServiceManager-${instanceId}] 开始初始化核心服务...`)
    console.log(`🔒 [ServiceManager-${instanceId}] 设置isInitializing=true`)
    this.isInitializing = true

    try {
      // 🔥 Phase 1: 基础设施初始化
      console.log(`📁 [ServiceManager-${instanceId}] Phase 1: 开始基础设施初始化`)
      await this.initializeInfrastructure()
      console.log(`✅ [ServiceManager-${instanceId}] Phase 1: 基础设施初始化完成`)

      // 🔥 Phase 2: 进程池初始化
      console.log(`⚙️ [ServiceManager-${instanceId}] Phase 2: 开始进程池初始化`)
      await this.initializeProcessPool()
      console.log(`✅ [ServiceManager-${instanceId}] Phase 2: 进程池初始化完成`)

      // 🔥 Phase 3: MCP服务协调器初始化
      console.log(`🔌 [ServiceManager-${instanceId}] Phase 3: 开始MCP服务初始化`)
      await this.initializeMCPServices()
      console.log(`✅ [ServiceManager-${instanceId}] Phase 3: MCP服务初始化完成`)

      // 🔥 Phase 4: 系统角色管理器初始化 (已移除，使用PromptX角色系统)
      console.log(`🎭 [ServiceManager-${instanceId}] Phase 4: 跳过SystemRoleManager初始化，使用PromptX角色系统`)

      // 🔥 Phase 5: 业务服务初始化
      console.log(`🏢 [ServiceManager-${instanceId}] Phase 5: 开始业务服务初始化`)
      await this.initializeBusinessServices()
      console.log(`✅ [ServiceManager-${instanceId}] Phase 5: 业务服务初始化完成`)

      console.log(`🔒 [ServiceManager-${instanceId}] 设置isInitialized=true, isInitializing=false`)
      this.isInitialized = true
      this.isInitializing = false

      console.log(`✅ [ServiceManager-${instanceId}] 所有服务初始化完成`)
      console.log(`📡 [ServiceManager-${instanceId}] 发射initialized事件`)
      this.emit('initialized')
      this.emit('status-change', this.getAllServiceStatuses())

    } catch (error) {
      console.error(`❌ [ServiceManager-${instanceId}] 服务初始化失败:`, error)
      console.log(`🔓 [ServiceManager-${instanceId}] 异常设置isInitializing=false`)
      this.isInitializing = false
      
      // 尝试清理已初始化的服务
      console.log(`🧹 [ServiceManager-${instanceId}] 开始清理已初始化的服务`)
      await this.cleanup()
      throw error
    }
  }

  /**
   * 🛑 关闭所有服务
   */
  public async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⏳ [ServiceManager] 正在关闭中...')
      return
    }

    console.log('🛑 [ServiceManager] 开始关闭所有服务...')
    this.isShuttingDown = true

    try {
      // 逆序关闭服务
      await this.shutdownBusinessServices()
      // await this.shutdownSystemRoles() // 已移除SystemRoleManager
      await this.shutdownMCPServices()
      await this.shutdownProcessPool()
      await this.shutdownInfrastructure()

      this.isInitialized = false
      this.isShuttingDown = false

      console.log('✅ [ServiceManager] 所有服务已关闭')
      this.emit('shutdown-complete')

    } catch (error) {
      console.error('❌ [ServiceManager] 服务关闭过程中出错:', error)
      throw error
    }
  }

  /**
   * 获取所有服务状态
   */
  public getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values())
  }

  /**
   * 获取特定服务状态
   */
  public getServiceStatus(serviceName: string): ServiceStatus | null {
    return this.serviceStatuses.get(serviceName) || null
  }

  /**
   * 获取MCP协调器
   */
  public getMCPCoordinator(): MCPServiceCoordinator {
    if (!this.isInitialized) {
      throw new Error('ServiceManager未初始化，无法获取MCP协调器')
    }
    return this.mcpCoordinator
  }

  /**
   * 获取系统角色管理器 (已废弃，统一使用PromptX角色系统)
   */
  public getSystemRoleManager(): never {
    throw new Error('SystemRoleManager已移除，请使用PromptX角色系统 (promptx:getAvailableRoles)')
  }

  /**
   * 获取数据库管理器
   */
  public getDatabaseManager(): QuickDatabaseManager {
    if (!this.isInitialized) {
      throw new Error('ServiceManager未初始化，无法获取数据库管理器')
    }
    return this.databaseManager
  }

  /**
   * 获取文件服务
   */
  public getFileService(): FileService {
    if (!this.isInitialized) {
      throw new Error('ServiceManager未初始化，无法获取文件服务')
    }
    return this.fileService
  }

  /**
   * 获取文件操作服务
   */
  public getFileOperationService(): FileOperationService {
    if (!this.isInitialized) {
      throw new Error('ServiceManager未初始化，无法获取文件操作服务')
    }
    return this.fileOperationService
  }

  /**
   * 获取PromptX资源服务
   */
  public getPromptXResourceService(): PromptXResourceService {
    if (!this.isInitialized) {
      throw new Error('ServiceManager未初始化，无法获取PromptX资源服务')
    }
    return this.promptxResourceService
  }

  /**
   * 获取工作区服务
   */
  public getWorkspaceService(): ReferenceWorkspaceService {
    if (!this.isInitialized) {
      throw new Error('ServiceManager未初始化，无法获取工作区服务')
    }
    return this.workspaceService
  }

  /**
   * 检查ServiceManager是否已初始化
   */
  public isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Phase 1: 基础设施初始化
   */
  private async initializeInfrastructure(): Promise<void> {
    this.updateServiceStatus('infrastructure', 'initializing', '初始化基础设施...')
    
    try {
      // 创建必要的目录
      const { app } = require('electron')
      const fs = require('fs')
      const path = require('path')

      const userDataPath = app.getPath('userData')
      const requiredDirs = [
        path.join(userDataPath, 'logs'),
        path.join(userDataPath, 'cache'),
        path.join(userDataPath, 'promptx-workspace'),
        path.join(userDataPath, 'temp')
      ]

      for (const dir of requiredDirs) {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o755 })
          console.log(`📁 [ServiceManager] 创建目录: ${dir}`)
        }
      }

      // 🗄️ 数据库初始化和迁移
      console.log(`🗄️ [ServiceManager] 开始数据库初始化...`)
      await this.databaseManager.initialize()
      console.log(`✅ [ServiceManager] 数据库初始化完成`)

      // 基础设施初始化完成（文件服务已在主进程中独立初始化）
      console.log(`📁 [ServiceManager] 基础设施初始化完成`)

      this.updateServiceStatus('infrastructure', 'ready', '基础设施就绪')
    } catch (error) {
      this.updateServiceStatus('infrastructure', 'error', `基础设施初始化失败: ${error}`)
      throw error
    }
  }

  /**
   * Phase 2: 进程池初始化
   */
  private async initializeProcessPool(): Promise<void> {
    this.updateServiceStatus('process-pool', 'initializing', '初始化进程池...')
    
    try {
      await this.processPool.initialize()
      this.updateServiceStatus('process-pool', 'ready', '进程池就绪')
    } catch (error) {
      this.updateServiceStatus('process-pool', 'error', `进程池初始化失败: ${error}`)
      throw error
    }
  }

  /**
   * Phase 3: MCP服务初始化
   */
  private async initializeMCPServices(): Promise<void> {
    this.updateServiceStatus('mcp', 'initializing', '初始化MCP服务...')
    
    try {
      await this.mcpCoordinator.initialize()
      this.updateServiceStatus('mcp', 'ready', 'MCP服务就绪')
    } catch (error) {
      this.updateServiceStatus('mcp', 'error', `MCP服务初始化失败: ${error}`)
      throw error
    }
  }

  // Phase 4: 系统角色初始化已移除，统一使用PromptX角色系统

  /**
   * Phase 5: 业务服务初始化
   */
  private async initializeBusinessServices(): Promise<void> {
    try {
      // 初始化文件服务
      this.updateServiceStatus('file-service', 'initializing', '初始化文件服务...')
      await this.fileService.initialize()
      this.updateServiceStatus('file-service', 'ready', '文件服务就绪')

      // 初始化文件操作服务
      this.updateServiceStatus('file-operation', 'initializing', '初始化文件操作服务...')
      await this.fileOperationService.initialize()
      this.updateServiceStatus('file-operation', 'ready', '文件操作服务就绪')

      // 初始化PromptX资源服务
      this.updateServiceStatus('promptx-resource', 'initializing', '初始化PromptX资源服务...')
      await this.promptxResourceService.initialize()
      this.updateServiceStatus('promptx-resource', 'ready', 'PromptX资源服务就绪')

      // 初始化工作区服务
      this.updateServiceStatus('workspace-service', 'initializing', '初始化工作区服务...')
      await this.workspaceService.initialize()
      this.updateServiceStatus('workspace-service', 'ready', '工作区服务就绪')

    } catch (error) {
      throw new Error(`业务服务初始化失败: ${error}`)
    }
  }

  // 关闭系统角色已移除，统一使用PromptX角色系统

  /**
   * 关闭MCP服务
   */
  private async shutdownMCPServices(): Promise<void> {
    this.updateServiceStatus('mcp', 'stopping', '关闭MCP服务...')
    try {
      await this.mcpCoordinator.shutdown()
      this.serviceStatuses.delete('mcp')
    } catch (error) {
      console.error('❌ [ServiceManager] MCP服务关闭失败:', error)
    }
  }

  /**
   * 关闭进程池
   */
  private async shutdownProcessPool(): Promise<void> {
    this.updateServiceStatus('process-pool', 'stopping', '关闭进程池...')
    try {
      await this.processPool.shutdown()
      this.serviceStatuses.delete('process-pool')
    } catch (error) {
      console.error('❌ [ServiceManager] 进程池关闭失败:', error)
    }
  }

  /**
   * 关闭基础设施
   */
  private async shutdownInfrastructure(): Promise<void> {
    this.updateServiceStatus('infrastructure', 'stopping', '关闭基础设施...')
    try {
      // 关闭数据库连接
      console.log(`🗄️ [ServiceManager] 关闭数据库连接...`)
      this.databaseManager.close()
      console.log(`✅ [ServiceManager] 数据库连接已关闭`)
      
      // 清理临时文件等
      this.serviceStatuses.delete('infrastructure')
    } catch (error) {
      console.error('❌ [ServiceManager] 基础设施关闭失败:', error)
    }
  }

  /**
   * 关闭业务服务
   */
  private async shutdownBusinessServices(): Promise<void> {
    try {
      // 关闭工作区服务
      this.updateServiceStatus('workspace-service', 'stopping', '关闭工作区服务...')
      await this.workspaceService.shutdown()
      this.serviceStatuses.delete('workspace-service')

      // 关闭PromptX资源服务
      this.updateServiceStatus('promptx-resource', 'stopping', '关闭PromptX资源服务...')
      await this.promptxResourceService.shutdown()
      this.serviceStatuses.delete('promptx-resource')

      // 关闭文件服务
      this.updateServiceStatus('file-service', 'stopping', '关闭文件服务...')
      await this.fileService.shutdown()
      this.serviceStatuses.delete('file-service')

      console.log('✅ [ServiceManager] 业务服务已关闭')
    } catch (error) {
      console.error('❌ [ServiceManager] 业务服务关闭失败:', error)
    }
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    // 监听进程池事件
    this.processPool.on('process-created', (data) => {
      console.log(`🔧 [ServiceManager] 进程已创建: ${data.processId}`)
      this.emit('process-event', { type: 'created', ...data })
    })

    this.processPool.on('process-terminated', (data) => {
      console.log(`🔴 [ServiceManager] 进程已终止: ${data.processId}`)
      this.emit('process-event', { type: 'terminated', ...data })
    })

    // 监听MCP协调器事件
    this.mcpCoordinator.on('server-connected', (data) => {
      console.log(`🔌 [ServiceManager] MCP服务器已连接: ${data.serverId}`)
      this.emit('mcp-event', { type: 'connected', ...data })
    })

    this.mcpCoordinator.on('server-disconnected', (data) => {
      console.log(`🔌 [ServiceManager] MCP服务器已断开: ${data.serverId}`)
      this.emit('mcp-event', { type: 'disconnected', ...data })
    })
  }

  /**
   * 更新服务状态
   */
  private updateServiceStatus(serviceName: string, status: ServiceStatus['status'], message: string): void {
    const serviceStatus: ServiceStatus = {
      name: serviceName,
      status,
      message,
      lastUpdate: new Date()
    }

    this.serviceStatuses.set(serviceName, serviceStatus)
    console.log(`📊 [ServiceManager] ${serviceName}: ${status} - ${message}`)
    
    // 发送状态更新事件
    this.emit('service-status-change', serviceStatus)
  }

  /**
   * 清理资源（兼容性方法）
   */
  public async cleanup(): Promise<void> {
    await this.shutdown()
  }
}