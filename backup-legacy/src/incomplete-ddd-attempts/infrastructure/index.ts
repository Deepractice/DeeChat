/**
 * 基础设施层统一导出
 * 提供所有基础设施组件的统一访问入口
 */

// 持久化层
export * from './persistence/repositories/SqliteConversationRepository'
export * from './persistence/repositories/SqliteIntelligenceRepository'
export * from './persistence/repositories/SqliteToolRepository'
export * from './persistence/migrations/DatabaseMigrationRunner'

// 消息传递系统
export * from './messaging/EventBus'
export * from './messaging/DomainEventPublisher'

// 外部服务集成
export * from './external-services/HttpClientService'
export * from './external-services/MCPClientService'

// 日志系统
export * from './logging/Logger'

// 依赖注入容器
export * from './container/DIContainer'

// 基础设施配置
export interface IInfrastructureConfig {
  database: {
    path: string
    enableWAL: boolean
    busyTimeout: number
  }
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error'
    enableConsole: boolean
    enableFile: boolean
    logDirectory?: string
  }
  eventBus: {
    maxHistorySize: number
  }
  httpClient: {
    timeout: number
    retries: number
    baseURL?: string
  }
  mcp: {
    servers: Array<{
      name: string
      command: string
      args?: string[]
      env?: Record<string, string>
    }>
  }
}

// 默认配置
export const DEFAULT_INFRASTRUCTURE_CONFIG: IInfrastructureConfig = {
  database: {
    path: './data/deechat.db',
    enableWAL: true,
    busyTimeout: 10000
  },
  logging: {
    level: 'info',
    enableConsole: true,
    enableFile: true,
    logDirectory: './logs'
  },
  eventBus: {
    maxHistorySize: 1000
  },
  httpClient: {
    timeout: 30000,
    retries: 3
  },
  mcp: {
    servers: []
  }
}