import { ipcMain } from 'electron'
import { ApplicationBootstrapper } from '../infrastructure/application-bootstrapper.js'

export interface IDomain {
  exposeToIPC(): Record<string, Function>
}

export class IPCRegistry {
  private registeredChannels = new Set<string>()

  constructor(private container: ApplicationBootstrapper) {}

  async registerAllDomains(): Promise<void> {
    console.log('📡 注册IPC处理器...')

    // 注册所有Domain的IPC处理器
    await this.registerDomainHandlers('AIConfigurationDomain')
    await this.registerDomainHandlers('ConversationDomain')
    await this.registerDomainHandlers('RoleManagementDomain')
    await this.registerDomainHandlers('McpDomain')

    // 未来可以自动发现并注册更多Domain
    // await this.registerDomainHandlers('FileManagementDomain')

    console.log('✅ IPC处理器注册完成')
  }

  private async registerDomainHandlers(domainName: string): Promise<void> {
    try {
      const domain = this.container.resolve<IDomain>(domainName)
      const handlers = domain.exposeToIPC()

      let registeredCount = 0
      let skippedCount = 0

      Object.entries(handlers).forEach(([channel, handler]) => {
        // 检查是否已经注册过
        if (this.registeredChannels.has(channel)) {
          console.log(`🔄 IPC频道已注册，跳过: ${channel}`)
          skippedCount++
          return
        }

        // 先移除可能存在的旧处理器
        ipcMain.removeHandler(channel)

        ipcMain.handle(channel, async (event, ...args) => {
          try {
            console.log(`📨 IPC请求: ${channel}`, args.length > 0 ? `(${args.length} 参数)` : '')

            // 特殊处理流式方法，传递event对象
            let result
            if (channel === 'conversation:send-message-stream') {
              result = await handler(...args, event)
            } else {
              result = await handler(...args)
            }

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

        // 标记为已注册
        this.registeredChannels.add(channel)
        registeredCount++
      })

      console.log(`  ✅ ${domainName}: 注册了 ${registeredCount} 个处理器${skippedCount > 0 ? `，跳过 ${skippedCount} 个已注册频道` : ''}`)
    } catch (error: any) {
      console.error(`❌ 注册${domainName}失败:`, error.message)
    }
  }

  // 动态注册新的Domain
  registerDomain(domainName: string, domain: IDomain): void {
    const handlers = domain.exposeToIPC()
    let registeredCount = 0
    let skippedCount = 0

    Object.entries(handlers).forEach(([channel, handler]) => {
      // 检查是否已经注册过
      if (this.registeredChannels.has(channel)) {
        console.log(`🔄 动态注册时跳过已注册频道: ${channel}`)
        skippedCount++
        return
      }

      // 先移除可能存在的旧处理器
      ipcMain.removeHandler(channel)

      ipcMain.handle(channel, async (event, ...args) => {
        try {
          const result = await handler(...args)
          return { success: true, data: result }
        } catch (error: any) {
          return { success: false, error: error?.message || String(error) }
        }
      })

      // 标记为已注册
      this.registeredChannels.add(channel)
      registeredCount++
    })

    console.log(`📡 动态注册Domain: ${domainName}，注册了 ${registeredCount} 个处理器${skippedCount > 0 ? `，跳过 ${skippedCount} 个已注册频道` : ''}`)
  }

  // 注销IPC处理器 (用于热重载等场景)
  unregisterChannel(channel: string): void {
    ipcMain.removeHandler(channel)
    this.registeredChannels.delete(channel)
    console.log(`🗑️  注销IPC处理器: ${channel}`)
  }

  // 获取所有已注册的频道
  getRegisteredChannels(): string[] {
    return Array.from(this.registeredChannels)
  }

  // 清除所有注册
  clearAll(): void {
    for (const channel of this.registeredChannels) {
      ipcMain.removeHandler(channel)
    }
    this.registeredChannels.clear()
    console.log('🧹 清除所有IPC处理器')
  }
}