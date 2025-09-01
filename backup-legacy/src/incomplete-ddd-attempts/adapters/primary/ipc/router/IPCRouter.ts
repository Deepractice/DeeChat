/**
 * IPC路由器
 * 统一管理所有IPC消息的路由和分发
 */

import { ipcMain, BrowserWindow } from 'electron'
import { ConversationIPCHandler } from '../handlers/ConversationIPCHandler'
import { IntelligenceIPCHandler } from '../handlers/IntelligenceIPCHandler'
import { ToolIPCHandler } from '../handlers/ToolIPCHandler'
import { Logger } from '../../../../infrastructure/logging/Logger'
import { EventBus } from '../../../../infrastructure/messaging/EventBus'

export interface IIPCRoute {
  channel: string
  handler: string
  description?: string
}

export interface IIPCRequest {
  channel: string
  action: string
  payload: any
  correlationId?: string
  timestamp: number
}

export interface IIPCResponse {
  success: boolean
  data?: any
  error?: string
  correlationId?: string
  duration: number
}

export class IPCRouter {
  private conversationHandler: ConversationIPCHandler
  private intelligenceHandler: IntelligenceIPCHandler
  private toolHandler: ToolIPCHandler
  private logger: Logger
  private eventBus: EventBus
  private mainWindow?: BrowserWindow
  private isInitialized = false

  // 定义路由表
  private routes: IIPCRoute[] = [
    // 对话相关路由
    { channel: 'conversation:createSession', handler: 'conversation', description: '创建新会话' },
    { channel: 'conversation:sendMessage', handler: 'conversation', description: '发送消息' },
    { channel: 'conversation:getSession', handler: 'conversation', description: '获取会话信息' },
    { channel: 'conversation:listSessions', handler: 'conversation', description: '获取会话列表' },
    { channel: 'conversation:archiveSession', handler: 'conversation', description: '归档会话' },
    { channel: 'conversation:deleteSession', handler: 'conversation', description: '删除会话' },
    { channel: 'conversation:getSessionMessages', handler: 'conversation', description: '获取会话消息' },

    // AI智能相关路由
    { channel: 'intelligence:activateRole', handler: 'intelligence', description: '激活AI角色' },
    { channel: 'intelligence:createRole', handler: 'intelligence', description: '创建AI角色' },
    { channel: 'intelligence:listRoles', handler: 'intelligence', description: '获取角色列表' },
    { channel: 'intelligence:getRole', handler: 'intelligence', description: '获取角色信息' },
    { channel: 'intelligence:recommendRoles', handler: 'intelligence', description: '推荐角色' },
    { channel: 'intelligence:intelligentRoleSwitch', handler: 'intelligence', description: '智能角色切换' },
    { channel: 'intelligence:updateRoleCapabilities', handler: 'intelligence', description: '更新角色能力' },

    // 工具相关路由
    { channel: 'tool:executeTool', handler: 'tool', description: '执行工具' },
    { channel: 'tool:registerTool', handler: 'tool', description: '注册工具' },
    { channel: 'tool:listTools', handler: 'tool', description: '获取工具列表' },
    { channel: 'tool:getTool', handler: 'tool', description: '获取工具信息' },
    { channel: 'tool:toggleToolStatus', handler: 'tool', description: '切换工具状态' },
    { channel: 'tool:discoverAndRegisterTools', handler: 'tool', description: '发现并注册工具' },
    { channel: 'tool:performHealthCheck', handler: 'tool', description: '执行健康检查' },
    { channel: 'tool:recommendTools', handler: 'tool', description: '推荐工具' }
  ]

  constructor(
    conversationHandler: ConversationIPCHandler,
    intelligenceHandler: IntelligenceIPCHandler,
    toolHandler: ToolIPCHandler,
    logger: Logger,
    eventBus: EventBus
  ) {
    this.conversationHandler = conversationHandler
    this.intelligenceHandler = intelligenceHandler
    this.toolHandler = toolHandler
    this.logger = logger
    this.eventBus = eventBus
  }

  /**
   * 初始化路由器
   */
  async initialize(mainWindow: BrowserWindow): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      this.logger.info('🔄 [IPCRouter] 初始化IPC路由器', 'IPCRouter')

      this.mainWindow = mainWindow
      
      // 设置处理器的主窗口引用
      this.conversationHandler.setMainWindow(mainWindow)
      this.intelligenceHandler.setMainWindow(mainWindow)
      this.toolHandler.setMainWindow(mainWindow)

      // 注册所有路由
      this.registerRoutes()

      // 注册系统级路由
      this.registerSystemRoutes()

      // 设置错误处理
      this.setupErrorHandling()

      // 订阅应用事件
      this.subscribeToApplicationEvents()

      this.isInitialized = true
      this.logger.info('✅ [IPCRouter] IPC路由器初始化完成', 'IPCRouter', {
        routesCount: this.routes.length
      })
    } catch (error) {
      this.logger.error('❌ [IPCRouter] IPC路由器初始化失败', error, 'IPCRouter')
      throw error
    }
  }

  /**
   * 注册所有路由
   */
  private registerRoutes(): void {
    for (const route of this.routes) {
      this.registerRoute(route)
    }
  }

  /**
   * 注册单个路由
   */
  private registerRoute(route: IIPCRoute): void {
    ipcMain.handle(route.channel, async (event, request: any) => {
      const startTime = Date.now()
      const correlationId = request?.correlationId || this.generateCorrelationId()

      try {
        this.logger.debug(`📨 [IPCRouter] 接收IPC请求: ${route.channel}`, 'IPCRouter', {
          correlationId,
          channel: route.channel
        })

        // 构造标准化请求
        const ipcRequest: IIPCRequest = {
          channel: route.channel,
          action: this.extractActionFromChannel(route.channel),
          payload: request || {},
          correlationId,
          timestamp: Date.now()
        }

        // 路由到相应的处理器
        const response = await this.routeToHandler(route.handler, ipcRequest)

        const duration = Date.now() - startTime
        const finalResponse: IIPCResponse = {
          ...response,
          duration,
          correlationId
        }

        this.logger.debug(`📤 [IPCRouter] IPC响应: ${route.channel} (${duration}ms)`, 'IPCRouter', {
          correlationId,
          success: response.success,
          duration
        })

        return finalResponse
      } catch (error) {
        const duration = Date.now() - startTime
        this.logger.error(`💥 [IPCRouter] IPC处理异常: ${route.channel} (${duration}ms)`, error, 'IPCRouter', {
          correlationId,
          duration
        })

        return {
          success: false,
          error: error.message || 'Unknown error',
          correlationId,
          duration
        }
      }
    })

    this.logger.debug(`🔗 [IPCRouter] 注册路由: ${route.channel} -> ${route.handler}`, 'IPCRouter')
  }

  /**
   * 注册系统级路由
   */
  private registerSystemRoutes(): void {
    // 健康检查
    ipcMain.handle('system:health', async () => {
      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          routes: this.routes.length,
          uptime: process.uptime()
        }
      }
    })

    // 获取路由信息
    ipcMain.handle('system:routes', async () => {
      return {
        success: true,
        data: {
          routes: this.routes,
          total: this.routes.length
        }
      }
    })

    // 重启应用
    ipcMain.handle('system:restart', async () => {
      this.logger.info('🔄 [IPCRouter] 应用重启请求', 'IPCRouter')
      
      setTimeout(() => {
        const { app } = require('electron')
        app.relaunch()
        app.quit()
      }, 1000)

      return {
        success: true,
        data: { message: 'Application will restart in 1 second' }
      }
    })

    this.logger.debug('🔗 [IPCRouter] 注册系统路由完成', 'IPCRouter')
  }

  /**
   * 路由到相应处理器
   */
  private async routeToHandler(handlerName: string, request: IIPCRequest): Promise<IIPCResponse> {
    switch (handlerName) {
      case 'conversation':
        return await this.conversationHandler.handleIPCMessage({
          action: request.action as any,
          payload: request.payload,
          correlationId: request.correlationId
        })

      case 'intelligence':
        return await this.intelligenceHandler.handleIPCMessage({
          action: request.action as any,
          payload: request.payload,
          correlationId: request.correlationId
        })

      case 'tool':
        return await this.toolHandler.handleIPCMessage({
          action: request.action as any,
          payload: request.payload,
          correlationId: request.correlationId
        })

      default:
        throw new Error(`Unknown handler: ${handlerName}`)
    }
  }

  /**
   * 从频道名提取动作
   */
  private extractActionFromChannel(channel: string): string {
    const parts = channel.split(':')
    return parts.length > 1 ? parts[1] : channel
  }

  /**
   * 生成关联ID
   */
  private generateCorrelationId(): string {
    return `ipc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 处理未捕获的IPC错误
    ipcMain.on('error', (error) => {
      this.logger.error('🚨 [IPCRouter] IPC系统错误', error, 'IPCRouter')
    })

    // 处理渲染进程崩溃
    if (this.mainWindow) {
      this.mainWindow.webContents.on('crashed', () => {
        this.logger.error('💥 [IPCRouter] 渲染进程崩溃', null, 'IPCRouter')
      })

      this.mainWindow.webContents.on('unresponsive', () => {
        this.logger.warn('⚠️ [IPCRouter] 渲染进程无响应', 'IPCRouter')
      })

      this.mainWindow.webContents.on('responsive', () => {
        this.logger.info('✅ [IPCRouter] 渲染进程恢复响应', 'IPCRouter')
      })
    }
  }

  /**
   * 订阅应用事件
   */
  private subscribeToApplicationEvents(): void {
    // 订阅领域事件并转发到渲染进程
    this.eventBus.subscribe({
      eventType: 'domain',
      handler: {
        handle: async (event) => {
          try {
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('domain-event', {
                eventName: event.eventName,
                payload: event.payload,
                timestamp: event.timestamp
              })
            }
            return { success: true, data: undefined } as any
          } catch (error) {
            this.logger.error('❌ [IPCRouter] 转发领域事件失败', error, 'IPCRouter')
            return { success: false, data: undefined, error: error.message } as any
          }
        }
      },
      priority: 10
    })

    this.logger.debug('📡 [IPCRouter] 应用事件订阅完成', 'IPCRouter')
  }

  /**
   * 发送事件到渲染进程
   */
  async sendToRenderer(eventName: string, data: any): Promise<void> {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(eventName, data)
        this.logger.debug(`📤 [IPCRouter] 发送事件到渲染进程: ${eventName}`, 'IPCRouter')
      }
    } catch (error) {
      this.logger.error('❌ [IPCRouter] 发送事件到渲染进程失败', error, 'IPCRouter', {
        eventName
      })
    }
  }

  /**
   * 获取路由统计
   */
  getStats(): {
    totalRoutes: number
    systemRoutes: number
    businessRoutes: number
    isInitialized: boolean
  } {
    return {
      totalRoutes: this.routes.length,
      systemRoutes: 3, // health, routes, restart
      businessRoutes: this.routes.length,
      isInitialized: this.isInitialized
    }
  }

  /**
   * 清理路由器
   */
  dispose(): void {
    try {
      this.logger.info('🧹 [IPCRouter] 清理IPC路由器', 'IPCRouter')

      // 移除所有IPC监听器
      ipcMain.removeAllListeners()

      this.isInitialized = false
      this.logger.info('✅ [IPCRouter] IPC路由器清理完成', 'IPCRouter')
    } catch (error) {
      this.logger.error('❌ [IPCRouter] 清理IPC路由器失败', error, 'IPCRouter')
    }
  }
}