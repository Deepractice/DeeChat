/**
 * 应用生命周期管理器
 * 统一管理服务启动顺序和生命周期
 */

import { DIContainer } from './DIContainer'

export type LifecyclePhase = 
  | 'infrastructure'
  | 'persistence' 
  | 'external-services'
  | 'messaging'
  | 'adapters'

export interface LifecycleService {
  initialize?(): Promise<void>
  start?(): Promise<void>
  stop?(): Promise<void>
  destroy?(): Promise<void>
}

export class LifecycleManager {
  private readonly initializationPhases: LifecyclePhase[] = [
    'infrastructure',
    'persistence', 
    'external-services',
    'messaging',
    'adapters'
  ]

  private phaseServices: Map<LifecyclePhase, string[]> = new Map([
    ['infrastructure', ['logger', 'eventBus']],
    ['persistence', ['databaseManager', 'migrationService']],
    ['external-services', ['llmService', 'promptXService']],
    ['messaging', ['ipcService', 'messageRouter']],
    ['adapters', ['chatService', 'uiService']]
  ])

  private initializedPhases = new Set<LifecyclePhase>()
  private startedServices = new Set<string>()

  constructor(private container: DIContainer) {}

  /**
   * 初始化所有基础设施服务
   */
  async initializeInfrastructure(): Promise<void> {
    console.log('🚀 [LifecycleManager] 开始初始化应用基础设施')
    
    for (const phase of this.initializationPhases) {
      await this.executePhase(phase)
    }
    
    console.log('✅ [LifecycleManager] 应用基础设施初始化完成')
  }

  /**
   * 执行特定初始化阶段
   */
  private async executePhase(phase: LifecyclePhase): Promise<void> {
    if (this.initializedPhases.has(phase)) {
      console.log(`⏭️ [LifecycleManager] 阶段已初始化: ${phase}`)
      return
    }

    console.log(`🔄 [LifecycleManager] 开始执行阶段: ${phase}`)
    
    const services = this.phaseServices.get(phase) || []
    
    for (const serviceName of services) {
      await this.initializeService(serviceName)
    }
    
    this.initializedPhases.add(phase)
    console.log(`✅ [LifecycleManager] 完成阶段: ${phase}`)
  }

  /**
   * 初始化单个服务
   */
  private async initializeService(serviceName: string): Promise<void> {
    try {
      if (!this.container.has(serviceName)) {
        console.log(`⚠️ [LifecycleManager] 服务未注册，跳过: ${serviceName}`)
        return
      }

      console.log(`🔧 [LifecycleManager] 初始化服务: ${serviceName}`)
      
      const service = this.container.resolve<LifecycleService>(serviceName)
      
      if (service.initialize) {
        await service.initialize()
      }
      
      if (service.start) {
        await service.start()
        this.startedServices.add(serviceName)
      }
      
      console.log(`✅ [LifecycleManager] 服务启动成功: ${serviceName}`)
      
    } catch (error) {
      console.error(`❌ [LifecycleManager] 服务启动失败: ${serviceName}`, error)
      throw new Error(`服务 ${serviceName} 启动失败: ${error.message}`)
    }
  }

  /**
   * 启动适配器层服务
   */
  async startAdapters(): Promise<void> {
    console.log('🔌 [LifecycleManager] 启动适配器层服务')
    
    const adapterServices = this.phaseServices.get('adapters') || []
    
    for (const serviceName of adapterServices) {
      await this.initializeService(serviceName)
    }
    
    console.log('✅ [LifecycleManager] 适配器层服务启动完成')
  }

  /**
   * 创建主窗口
   */
  async createMainWindow(): Promise<void> {
    console.log('🖥️ [LifecycleManager] 创建应用主窗口')
    
    // 这里暂时保留原有的窗口创建逻辑
    // 在后续重构中会移动到合适的适配器中
    const { BrowserWindow, app } = await import('electron')
    
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: require.resolve('../preload/index.js')
      }
    })

    // 加载应用页面
    const isDev = process.env.NODE_ENV === 'development'
    if (isDev) {
      mainWindow.loadURL('http://localhost:5173')
      mainWindow.webContents.openDevTools()
    } else {
      mainWindow.loadFile('dist/renderer/index.html')
    }

    console.log('✅ [LifecycleManager] 主窗口创建完成')
  }

  /**
   * 优雅关闭应用
   */
  async shutdown(): Promise<void> {
    console.log('🛑 [LifecycleManager] 开始应用关闭流程')
    
    // 反向顺序停止服务
    const servicesToStop = Array.from(this.startedServices).reverse()
    
    for (const serviceName of servicesToStop) {
      await this.stopService(serviceName)
    }
    
    console.log('✅ [LifecycleManager] 应用关闭完成')
  }

  /**
   * 停止单个服务
   */
  private async stopService(serviceName: string): Promise<void> {
    try {
      console.log(`🔄 [LifecycleManager] 停止服务: ${serviceName}`)
      
      const service = this.container.resolve<LifecycleService>(serviceName)
      
      if (service.stop) {
        await service.stop()
      }
      
      if (service.destroy) {
        await service.destroy()
      }
      
      this.startedServices.delete(serviceName)
      console.log(`✅ [LifecycleManager] 服务停止成功: ${serviceName}`)
      
    } catch (error) {
      console.error(`❌ [LifecycleManager] 服务停止失败: ${serviceName}`, error)
      // 继续停止其他服务，不抛出异常
    }
  }

  /**
   * 注册阶段服务
   */
  registerPhaseServices(phase: LifecyclePhase, services: string[]): void {
    this.phaseServices.set(phase, services)
    console.log(`📝 [LifecycleManager] 注册阶段服务 ${phase}:`, services)
  }

  /**
   * 获取生命周期状态
   */
  getStatus() {
    return {
      initializedPhases: Array.from(this.initializedPhases),
      startedServices: Array.from(this.startedServices),
      totalPhases: this.initializationPhases.length,
      phaseServices: Object.fromEntries(this.phaseServices)
    }
  }
}