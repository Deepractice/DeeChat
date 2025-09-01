/**
 * Electron主进程适配器
 * 统一管理Electron应用的生命周期和IPC通信
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { DIContainer } from '../../../infrastructure/container/DIContainer'
import { Logger } from '../../../infrastructure/logging/Logger'
import { EventBus } from '../../../infrastructure/messaging/EventBus'
import { IPCRouter } from '../ipc/router/IPCRouter'
import { ConversationIPCHandler } from '../ipc/handlers/ConversationIPCHandler'
import { IntelligenceIPCHandler } from '../ipc/handlers/IntelligenceIPCHandler'
import { ToolIPCHandler } from '../ipc/handlers/ToolIPCHandler'
import { ConversationApplicationService } from '../../../application/services/ConversationApplicationService'
import { IntelligenceApplicationService } from '../../../application/services/IntelligenceApplicationService'
import { ToolApplicationService } from '../../../application/services/ToolApplicationService'

export interface IElectronConfig {
  isDevelopment: boolean
  devServerUrl?: string
  windowConfig: {
    width: number
    height: number
    minWidth: number
    minHeight: number
    webPreferences: {
      nodeIntegration: boolean
      contextIsolation: boolean
      enableRemoteModule: boolean
    }
  }
}

export class ElectronMainAdapter {
  private container: DIContainer
  private logger: Logger
  private eventBus: EventBus
  private ipcRouter: IPCRouter
  private mainWindow: BrowserWindow | null = null
  private isInitialized = false
  private config: IElectronConfig

  constructor(config: IElectronConfig) {
    this.config = config
    this.container = new DIContainer()
  }

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('🔄 [ElectronMainAdapter] 初始化Electron主进程适配器')

      // 初始化依赖注入容器
      await this.container.initialize()

      // 获取基础服务
      this.logger = this.container.resolve<Logger>('logger')
      this.eventBus = this.container.resolve<EventBus>('eventBus')

      // 初始化IPC路由器
      await this.initializeIPCRouter()

      // 设置Electron事件处理
      this.setupElectronEvents()

      // 初始化菜单
      this.initializeMenu()

      this.isInitialized = true
      this.logger.info('✅ [ElectronMainAdapter] Electron主进程适配器初始化完成', 'ElectronMainAdapter')
    } catch (error) {
      console.error('❌ [ElectronMainAdapter] 初始化失败:', error)
      throw error
    }
  }

  /**
   * 启动应用
   */
  async start(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize()
      }

      this.logger.info('🚀 [ElectronMainAdapter] 启动Electron应用', 'ElectronMainAdapter')

      // 创建主窗口
      await this.createMainWindow()

      // 发布应用启动事件
      await this.eventBus.publish({
        eventType: 'application',
        eventName: 'started',
        payload: {
          timestamp: new Date().toISOString(),
          config: this.config
        },
        timestamp: new Date()
      })

      this.logger.info('✅ [ElectronMainAdapter] Electron应用启动完成', 'ElectronMainAdapter')
    } catch (error) {
      this.logger.error('❌ [ElectronMainAdapter] 启动失败', error, 'ElectronMainAdapter')
      throw error
    }
  }

  /**
   * 初始化IPC路由器
   */
  private async initializeIPCRouter(): Promise<void> {
    try {
      // 获取应用服务
      const conversationService = this.container.resolve<ConversationApplicationService>('conversationAppService')
      const intelligenceService = this.container.resolve<IntelligenceApplicationService>('intelligenceAppService')
      const toolService = this.container.resolve<ToolApplicationService>('toolAppService')

      // 创建IPC处理器
      const conversationHandler = new ConversationIPCHandler(
        conversationService,
        intelligenceService,
        toolService,
        this.logger,
        this.eventBus
      )

      const intelligenceHandler = new IntelligenceIPCHandler(
        conversationService,
        intelligenceService,
        toolService,
        this.logger,
        this.eventBus
      )

      const toolHandler = new ToolIPCHandler(
        conversationService,
        intelligenceService,
        toolService,
        this.logger,
        this.eventBus
      )

      // 创建路由器
      this.ipcRouter = new IPCRouter(
        conversationHandler,
        intelligenceHandler,
        toolHandler,
        this.logger,
        this.eventBus
      )

      this.logger.info('✅ [ElectronMainAdapter] IPC路由器初始化完成', 'ElectronMainAdapter')
    } catch (error) {
      this.logger.error('❌ [ElectronMainAdapter] IPC路由器初始化失败', error, 'ElectronMainAdapter')
      throw error
    }
  }

  /**
   * 创建主窗口
   */
  private async createMainWindow(): Promise<void> {
    try {
      this.logger.info('🪟 [ElectronMainAdapter] 创建主窗口', 'ElectronMainAdapter')

      this.mainWindow = new BrowserWindow({
        width: this.config.windowConfig.width,
        height: this.config.windowConfig.height,
        minWidth: this.config.windowConfig.minWidth,
        minHeight: this.config.windowConfig.minHeight,
        webPreferences: {
          ...this.config.windowConfig.webPreferences,
          preload: join(__dirname, '../preload/index.js')
        },
        titleBarStyle: 'hiddenInset',
        show: false,
        icon: join(__dirname, '../../assets/icon.png')
      })

      // 加载页面
      await this.loadMainPage()

      // 初始化IPC路由器
      await this.ipcRouter.initialize(this.mainWindow)

      // 设置窗口事件
      this.setupWindowEvents()

      // 显示窗口
      this.mainWindow.show()

      this.logger.info('✅ [ElectronMainAdapter] 主窗口创建完成', 'ElectronMainAdapter')
    } catch (error) {
      this.logger.error('❌ [ElectronMainAdapter] 创建主窗口失败', error, 'ElectronMainAdapter')
      throw error
    }
  }

  /**
   * 加载主页面
   */
  private async loadMainPage(): Promise<void> {
    if (!this.mainWindow) return

    const url = this.config.isDevelopment && this.config.devServerUrl
      ? this.config.devServerUrl
      : `file://${join(__dirname, '../renderer/index.html')}`

    this.logger.info(`📄 [ElectronMainAdapter] 加载页面: ${url}`, 'ElectronMainAdapter')

    try {
      await this.mainWindow.loadURL(url)
      this.logger.info('✅ [ElectronMainAdapter] 页面加载完成', 'ElectronMainAdapter')
    } catch (error) {
      this.logger.error('❌ [ElectronMainAdapter] 页面加载失败', error, 'ElectronMainAdapter')
      throw error
    }
  }

  /**
   * 设置窗口事件
   */
  private setupWindowEvents(): void {
    if (!this.mainWindow) return

    // 窗口关闭事件
    this.mainWindow.on('closed', () => {
      this.logger.info('🪟 [ElectronMainAdapter] 主窗口已关闭', 'ElectronMainAdapter')
      this.mainWindow = null
    })

    // 窗口最小化事件
    this.mainWindow.on('minimize', () => {
      this.logger.debug('🪟 [ElectronMainAdapter] 主窗口最小化', 'ElectronMainAdapter')
    })

    // 窗口最大化事件
    this.mainWindow.on('maximize', () => {
      this.logger.debug('🪟 [ElectronMainAdapter] 主窗口最大化', 'ElectronMainAdapter')
    })

    // 窗口焦点事件
    this.mainWindow.on('focus', () => {
      this.logger.debug('🪟 [ElectronMainAdapter] 主窗口获得焦点', 'ElectronMainAdapter')
    })

    this.mainWindow.on('blur', () => {
      this.logger.debug('🪟 [ElectronMainAdapter] 主窗口失去焦点', 'ElectronMainAdapter')
    })

    // 页面DOM准备完成
    this.mainWindow.webContents.on('dom-ready', () => {
      this.logger.info('📄 [ElectronMainAdapter] 页面DOM准备完成', 'ElectronMainAdapter')
    })

    // 页面完全加载完成
    this.mainWindow.webContents.on('did-finish-load', () => {
      this.logger.info('📄 [ElectronMainAdapter] 页面加载完成', 'ElectronMainAdapter')
    })

    // 页面加载失败
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      this.logger.error('❌ [ElectronMainAdapter] 页面加载失败', new Error(errorDescription), 'ElectronMainAdapter', {
        errorCode,
        errorDescription
      })
    })
  }

  /**
   * 设置Electron事件
   */
  private setupElectronEvents(): void {
    // 所有窗口关闭
    app.on('window-all-closed', () => {
      this.logger.info('🪟 [ElectronMainAdapter] 所有窗口已关闭', 'ElectronMainAdapter')
      
      // 在macOS上，通常应用保持活跃状态直到用户明确退出
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // 应用激活（macOS）
    app.on('activate', async () => {
      this.logger.info('🚀 [ElectronMainAdapter] 应用激活', 'ElectronMainAdapter')
      
      // 在macOS上，点击dock图标时重新创建窗口
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createMainWindow()
      }
    })

    // 应用准备退出
    app.on('before-quit', async () => {
      this.logger.info('🛑 [ElectronMainAdapter] 应用准备退出', 'ElectronMainAdapter')

      try {
        // 发布应用关闭事件
        await this.eventBus.publish({
          eventType: 'application',
          eventName: 'shutdown',
          payload: {
            timestamp: new Date().toISOString()
          },
          timestamp: new Date()
        })

        // 清理资源
        await this.cleanup()
      } catch (error) {
        this.logger.error('❌ [ElectronMainAdapter] 应用退出清理失败', error, 'ElectronMainAdapter')
      }
    })

    // 第二个实例启动
    app.on('second-instance', () => {
      this.logger.info('🔄 [ElectronMainAdapter] 检测到第二个实例', 'ElectronMainAdapter')
      
      // 聚焦到主窗口
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore()
        }
        this.mainWindow.focus()
      }
    })

    // 证书错误
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      if (this.config.isDevelopment) {
        // 开发环境忽略证书错误
        event.preventDefault()
        callback(true)
      } else {
        callback(false)
      }
    })
  }

  /**
   * 初始化菜单
   */
  private initializeMenu(): void {
    if (process.platform === 'darwin') {
      // macOS菜单
      const template = [
        {
          label: 'DeeChat',
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideothers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        },
        {
          label: '编辑',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'selectall' }
          ]
        },
        {
          label: '视图',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
          ]
        },
        {
          label: '窗口',
          submenu: [
            { role: 'minimize' },
            { role: 'close' }
          ]
        }
      ]

      const menu = Menu.buildFromTemplate(template as any)
      Menu.setApplicationMenu(menu)
    } else {
      // Windows/Linux - 移除菜单栏
      Menu.setApplicationMenu(null)
    }

    this.logger.debug('🍎 [ElectronMainAdapter] 菜单初始化完成', 'ElectronMainAdapter')
  }

  /**
   * 获取主窗口
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  /**
   * 获取容器
   */
  getContainer(): DIContainer {
    return this.container
  }

  /**
   * 发送通知到渲染进程
   */
  async sendNotification(title: string, body: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): Promise<void> {
    try {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('system:notification', {
          title,
          body,
          type,
          timestamp: new Date().toISOString()
        })
      }
    } catch (error) {
      this.logger.error('❌ [ElectronMainAdapter] 发送通知失败', error, 'ElectronMainAdapter')
    }
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    try {
      this.logger.info('🧹 [ElectronMainAdapter] 开始清理资源', 'ElectronMainAdapter')

      // 清理IPC路由器
      if (this.ipcRouter) {
        this.ipcRouter.dispose()
      }

      // 清理依赖注入容器
      if (this.container) {
        this.container.dispose()
      }

      this.logger.info('✅ [ElectronMainAdapter] 资源清理完成', 'ElectronMainAdapter')
    } catch (error) {
      this.logger.error('❌ [ElectronMainAdapter] 资源清理失败', error, 'ElectronMainAdapter')
    }
  }
}