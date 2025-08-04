import { EventEmitter } from 'events'

export enum ServiceEvent {
  READY = 'ready',
  ERROR = 'error',
  STATUS_CHANGE = 'status-change'
}

export abstract class BaseService extends EventEmitter {
  protected serviceName: string
  protected logger: {
    info: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    debug: (message: string, ...args: any[]) => void
  }

  constructor(serviceName: string) {
    super()
    this.serviceName = serviceName
    
    // 简单的日志实现
    this.logger = {
      info: (message: string, ...args: any[]) => {
        console.log(`[${this.serviceName}] ${message}`, ...args)
      },
      error: (message: string, ...args: any[]) => {
        console.error(`[${this.serviceName}] ${message}`, ...args)
      },
      warn: (message: string, ...args: any[]) => {
        console.warn(`[${this.serviceName}] ${message}`, ...args)
      },
      debug: (message: string, ...args: any[]) => {
        console.debug(`[${this.serviceName}] ${message}`, ...args)
      }
    }
  }

  abstract initialize(): Promise<void>
  abstract shutdown(): Promise<void>
}