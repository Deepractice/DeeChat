import { ipcMain } from 'electron'
import { ApplicationBootstrapper } from '../infrastructure/application-bootstrapper.js'

export interface IDomain {
  exposeToIPC(): Record<string, Function>
}

export class IPCRegistry {
  constructor(private container: ApplicationBootstrapper) {}

  async registerAllDomains(): Promise<void> {
    console.log('📡 注册IPC处理器...')

    // 注册所有Domain的IPC处理器
    await this.registerDomainHandlers('AIConfigurationDomain')
    await this.registerDomainHandlers('ConversationDomain')
    
    // 未来可以自动发现并注册更多Domain
    // await this.registerDomainHandlers('FileManagementDomain')

    console.log('✅ IPC处理器注册完成')
  }

  private async registerDomainHandlers(domainName: string): Promise<void> {
    try {
      const domain = this.container.resolve<IDomain>(domainName)
      const handlers = domain.exposeToIPC()

      let registeredCount = 0
      
      Object.entries(handlers).forEach(([channel, handler]) => {
        ipcMain.handle(channel, async (event, ...args) => {
          try {
            console.log(`📨 IPC请求: ${channel}`, args.length > 0 ? `(${args.length} 参数)` : '')
            const result = await handler(...args)
            console.log(`✅ IPC响应: ${channel}`)
            return { success: true, data: result }
          } catch (error: any) {
            console.error(`❌ IPC错误: ${channel}`, error.message)
            return { 
              success: false, 
              error: error?.message || String(error) 
            }
          }
        })
        registeredCount++
      })

      console.log(`  ✅ ${domainName}: 注册了 ${registeredCount} 个处理器`)
    } catch (error: any) {
      console.error(`❌ 注册${domainName}失败:`, error.message)
    }
  }

  // 动态注册新的Domain
  registerDomain(domainName: string, domain: IDomain): void {
    const handlers = domain.exposeToIPC()
    
    Object.entries(handlers).forEach(([channel, handler]) => {
      ipcMain.handle(channel, async (event, ...args) => {
        try {
          const result = await handler(...args)
          return { success: true, data: result }
        } catch (error: any) {
          return { success: false, error: error?.message || String(error) }
        }
      })
    })

    console.log(`📡 动态注册Domain: ${domainName}`)
  }

  // 注销IPC处理器 (用于热重载等场景)
  unregisterChannel(channel: string): void {
    ipcMain.removeHandler(channel)
    console.log(`🗑️  注销IPC处理器: ${channel}`)
  }

  // 获取所有已注册的频道
  getRegisteredChannels(): string[] {
    // 这个功能需要Electron更新版本支持
    // 目前只能通过内部记录来实现
    return []
  }
}