/**
 * DeeChat应用程序主类
 * 替代原有的 src/main/index.ts，提供清晰的应用启动和生命周期管理
 */

import { app, BrowserWindow } from 'electron'
import { DIContainer } from './DIContainer'
import { LifecycleManager, LifecycleService } from './LifecycleManager'
import { Configuration } from './Configuration'

export class DeeChatApplication {
  private container: DIContainer
  private lifecycleManager: LifecycleManager
  private config: Configuration
  private mainWindow?: BrowserWindow

  constructor() {
    console.log('🚀 [Application] DeeChat应用程序启动')
    
    this.container = new DIContainer()
    this.config = new Configuration()
    this.lifecycleManager = new LifecycleManager(this.container)
  }

  /**
   * 应用程序主入口
   */
  async start(): Promise<void> {
    try {
      console.log('⚡ [Application] 开始应用程序启动流程')

      // 1. 加载配置
      await this.loadConfiguration()

      // 2. 配置依赖注入
      this.configureContainer()

      // 3. 初始化基础设施
      await this.lifecycleManager.initializeInfrastructure()

      // 4. 启动适配器
      await this.lifecycleManager.startAdapters()

      // 5. 创建主窗口
      await this.lifecycleManager.createMainWindow()

      // 6. 设置应用事件处理
      this.setupApplicationEventHandlers()

      console.log('✅ [Application] DeeChat应用程序启动完成')

    } catch (error) {
      console.error('❌ [Application] 应用程序启动失败:', error)
      await this.shutdown()
      throw error
    }
  }

  /**
   * 加载应用配置
   */
  private async loadConfiguration(): Promise<void> {
    console.log('📋 [Application] 加载应用配置')
    
    await this.config.load()
    
    // 注册配置到容器
    this.container.registerFactory('config', () => this.config)
    
    console.log('✅ [Application] 配置加载完成')
  }

  /**
   * 配置依赖注入容器
   */
  private configureContainer(): void {
    console.log('🔧 [Application] 配置依赖注入容器')

    // 基础设施层服务
    this.registerInfrastructureServices()
    
    // 领域层服务  
    this.registerDomainServices()
    
    // 应用层服务
    this.registerApplicationServices()
    
    // 适配器层服务
    this.registerAdapterServices()

    console.log('✅ [Application] 依赖注入配置完成')
    console.log('📊 [Application] 容器状态:', this.container.getStatus())
  }

  /**
   * 注册基础设施层服务
   */
  private registerInfrastructureServices(): void {
    // 日志服务
    this.container.registerFactory('logger', () => {
      return {
        info: console.log,
        error: console.error,
        debug: console.debug,
        warn: console.warn,
        initialize: async () => console.log('✅ Logger initialized')
      }
    })

    // 事件总线
    this.container.registerFactory('eventBus', () => {
      return {
        publish: (event: any) => console.log('📢 Event:', event),
        subscribe: (handler: Function) => console.log('📝 Subscribed'),
        initialize: async () => console.log('✅ EventBus initialized')
      }
    })

    // 数据库管理器（占位符）
    this.container.registerFactory('databaseManager', (logger) => {
      return {
        connect: async () => console.log('🔌 Database connected'),
        disconnect: async () => console.log('🔌 Database disconnected'),
        initialize: async () => {
          logger.info('✅ DatabaseManager initialized')
          await this.connect?.()
        }
      }
    }, { dependencies: ['logger'] })
  }

  /**
   * 注册领域层服务（占位符）
   */
  private registerDomainServices(): void {
    // 领域服务将在 Phase 2 中实现
    console.log('📝 [Application] 领域层服务注册（待Phase 2实现）')
  }

  /**
   * 注册应用层服务（占位符）
   */
  private registerApplicationServices(): void {
    // 应用服务将在 Phase 3 中实现
    console.log('📝 [Application] 应用层服务注册（待Phase 3实现）')
  }

  /**
   * 注册适配器层服务（占位符）
   */
  private registerAdapterServices(): void {
    // 聊天服务（临时实现，保持向后兼容）
    this.container.registerFactory('chatService', (logger, eventBus) => {
      return {
        streamMessage: async (request: any, onChunk?: Function) => {
          logger.info('💬 处理流式消息:', request)
          // 这里暂时保留原有逻辑的调用
          return 'Message processed'
        },
        initialize: async () => logger.info('✅ ChatService initialized'),
        start: async () => logger.info('✅ ChatService started')
      }
    }, { dependencies: ['logger', 'eventBus'] })

    // IPC服务（占位符）
    this.container.registerFactory('ipcService', (logger) => {
      return {
        registerHandlers: () => logger.info('🔗 IPC handlers registered'),
        initialize: async () => logger.info('✅ IPCService initialized')
      }
    }, { dependencies: ['logger'] })
  }

  /**
   * 设置应用事件处理
   */
  private setupApplicationEventHandlers(): void {
    // 应用准备就绪
    app.whenReady().then(() => {
      console.log('🎯 [Application] Electron应用就绪')
    })

    // 窗口全部关闭
    app.on('window-all-closed', async () => {
      console.log('🪟 [Application] 所有窗口已关闭')
      if (process.platform !== 'darwin') {
        await this.shutdown()
      }
    })

    // macOS激活
    app.on('activate', () => {
      console.log('🍎 [Application] 应用被激活')
      if (BrowserWindow.getAllWindows().length === 0) {
        this.lifecycleManager.createMainWindow()
      }
    })

    // 应用退出前
    app.on('before-quit', async () => {
      console.log('👋 [Application] 应用即将退出')
      await this.shutdown()
    })
  }

  /**
   * 优雅关闭应用
   */
  async shutdown(): Promise<void> {
    try {
      console.log('🛑 [Application] 开始应用关闭流程')
      
      await this.lifecycleManager.shutdown()
      
      console.log('✅ [Application] 应用关闭完成')
    } catch (error) {
      console.error('❌ [Application] 应用关闭时出错:', error)
    }
  }

  /**
   * 获取应用状态
   */
  getStatus() {
    return {
      container: this.container.getStatus(),
      lifecycle: this.lifecycleManager.getStatus(),
      config: this.config.getStatus()
    }
  }
}