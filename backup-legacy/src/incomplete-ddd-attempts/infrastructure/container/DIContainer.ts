/**
 * 依赖注入容器
 * 管理应用中所有服务的依赖关系和生命周期
 */

import { Result } from '../../domain/shared/primitives/Result'

export type ServiceFactory<T = any> = (...dependencies: any[]) => T
export type ServiceConstructor<T = any> = new (...dependencies: any[]) => T

export interface IServiceDefinition<T = any> {
  factory?: ServiceFactory<T>
  constructor?: ServiceConstructor<T>
  dependencies: string[]
  singleton: boolean
  initialized: boolean
}

export interface IServiceRegistration {
  name: string
  definition: IServiceDefinition
}

export class DIContainer {
  private services: Map<string, IServiceDefinition> = new Map()
  private instances: Map<string, any> = new Map()
  private isInitialized = false

  /**
   * 初始化容器
   */
  async initialize(): Promise<Result<void, Error>> {
    try {
      if (this.isInitialized) {
        return Result.success()
      }

      console.log('🔄 [DIContainer] 初始化依赖注入容器')

      // 注册基础设施服务
      await this.registerInfrastructureServices()

      // 预初始化单例服务
      await this.preInitializeSingletons()

      this.isInitialized = true
      console.log('✅ [DIContainer] 依赖注入容器初始化完成')

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to initialize DI container: ${error.message}`))
    }
  }

  /**
   * 注册服务（使用构造函数）
   */
  register<T>(
    name: string,
    constructor: ServiceConstructor<T>,
    dependencies: string[] = [],
    singleton: boolean = true
  ): DIContainer {
    this.services.set(name, {
      constructor,
      dependencies,
      singleton,
      initialized: false
    })

    console.log(`📦 [DIContainer] 注册服务: ${name} (单例: ${singleton})`)
    return this
  }

  /**
   * 注册服务（使用工厂函数）
   */
  registerFactory<T>(
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = [],
    singleton: boolean = true
  ): DIContainer {
    this.services.set(name, {
      factory,
      dependencies,
      singleton,
      initialized: false
    })

    console.log(`📦 [DIContainer] 注册工厂服务: ${name} (单例: ${singleton})`)
    return this
  }

  /**
   * 注册实例
   */
  registerInstance<T>(name: string, instance: T): DIContainer {
    this.services.set(name, {
      dependencies: [],
      singleton: true,
      initialized: true
    })
    this.instances.set(name, instance)

    console.log(`📦 [DIContainer] 注册实例: ${name}`)
    return this
  }

  /**
   * 解析服务
   */
  resolve<T>(name: string): T {
    // 检查是否有缓存的实例
    if (this.instances.has(name)) {
      return this.instances.get(name)
    }

    // 获取服务定义
    const definition = this.services.get(name)
    if (!definition) {
      throw new Error(`Service not registered: ${name}`)
    }

    console.log(`🔍 [DIContainer] 解析服务: ${name}`)

    // 解析依赖
    const dependencies = definition.dependencies.map(dep => {
      if (dep === name) {
        throw new Error(`Circular dependency detected: ${name} -> ${dep}`)
      }
      return this.resolve(dep)
    })

    // 创建实例
    let instance: T

    if (definition.factory) {
      instance = definition.factory(...dependencies)
    } else if (definition.constructor) {
      instance = new definition.constructor(...dependencies)
    } else {
      throw new Error(`No factory or constructor defined for service: ${name}`)
    }

    // 缓存单例
    if (definition.singleton) {
      this.instances.set(name, instance)
    }

    definition.initialized = true
    console.log(`✅ [DIContainer] 服务解析完成: ${name}`)

    return instance
  }

  /**
   * 检查服务是否已注册
   */
  has(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * 获取所有注册的服务名称
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * 获取服务统计信息
   */
  getStats(): {
    totalServices: number
    initializedServices: number
    singletonServices: number
    instancedServices: number
  } {
    const totalServices = this.services.size
    let initializedServices = 0
    let singletonServices = 0

    for (const definition of this.services.values()) {
      if (definition.initialized) initializedServices++
      if (definition.singleton) singletonServices++
    }

    return {
      totalServices,
      initializedServices,
      singletonServices,
      instancedServices: this.instances.size
    }
  }

  /**
   * 清理容器
   */
  dispose(): void {
    console.log('🧹 [DIContainer] 清理依赖注入容器')

    // 清理实例
    for (const [name, instance] of this.instances) {
      if (instance && typeof instance.dispose === 'function') {
        try {
          instance.dispose()
          console.log(`🗑️ [DIContainer] 清理服务实例: ${name}`)
        } catch (error) {
          console.error(`❌ [DIContainer] 清理服务实例失败: ${name}`, error)
        }
      }
    }

    this.instances.clear()
    this.services.clear()
    this.isInitialized = false
  }

  /**
   * 注册基础设施服务
   */
  private async registerInfrastructureServices(): Promise<void> {
    // 导入所需的类
    const { Logger } = await import('../logging/Logger')
    const { EventBus } = await import('../messaging/EventBus')
    const { DomainEventPublisher } = await import('../messaging/DomainEventPublisher')
    const { HttpClientService } = await import('../external-services/HttpClientService')
    const { MCPClientService } = await import('../external-services/MCPClientService')
    const { DatabaseMigrationRunner } = await import('../persistence/migrations/DatabaseMigrationRunner')

    // 注册基础服务
    this.register('logger', Logger, [], true)
    this.register('eventBus', EventBus, [], true)
    this.register('domainEventPublisher', DomainEventPublisher, ['eventBus'], true)
    this.register('httpClient', HttpClientService, [], true)
    this.register('mcpClient', MCPClientService, [], true)

    // 注册数据库相关服务
    this.registerFactory('database', () => {
      // 这里应该创建SQLite数据库连接
      const sqlite3 = require('sqlite3')
      return new sqlite3.Database(':memory:') // 临时使用内存数据库
    }, [], true)

    this.register('migrationRunner', DatabaseMigrationRunner, ['database'], true)

    // 注册仓储服务
    const { SqliteConversationRepository } = await import('../persistence/repositories/SqliteConversationRepository')
    const { SqliteIntelligenceRepository } = await import('../persistence/repositories/SqliteIntelligenceRepository')
    const { SqliteToolRepository } = await import('../persistence/repositories/SqliteToolRepository')

    this.register('conversationRepository', SqliteConversationRepository, ['database'], true)
    this.register('intelligenceRepository', SqliteIntelligenceRepository, ['database'], true)
    this.register('toolRepository', SqliteToolRepository, ['database'], true)

    // 注册应用服务
    const { ConversationApplicationService } = await import('../../application/services/ConversationApplicationService')
    const { IntelligenceApplicationService } = await import('../../application/services/IntelligenceApplicationService')
    const { ToolApplicationService } = await import('../../application/services/ToolApplicationService')

    this.register('conversationAppService', ConversationApplicationService, [
      'conversationRepository',
      'domainEventPublisher',
      'logger'
    ], true)

    this.register('intelligenceAppService', IntelligenceApplicationService, [
      'intelligenceRepository',
      'domainEventPublisher',
      'logger'
    ], true)

    this.register('toolAppService', ToolApplicationService, [
      'toolRepository',
      'mcpClient',
      'domainEventPublisher',
      'logger'
    ], true)
  }

  /**
   * 预初始化单例服务
   */
  private async preInitializeSingletons(): Promise<void> {
    // 需要预初始化的关键服务
    const criticalServices = ['logger', 'eventBus', 'database', 'migrationRunner']

    for (const serviceName of criticalServices) {
      try {
        const service = this.resolve(serviceName)
        
        // 如果服务有初始化方法，调用它
        if (service && typeof service.initialize === 'function') {
          await service.initialize()
        }
      } catch (error) {
        console.error(`❌ [DIContainer] 预初始化服务失败: ${serviceName}`, error)
        throw error
      }
    }
  }

  /**
   * 检测循环依赖
   */
  private detectCircularDependencies(): string[] {
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const cycles: string[] = []

    const visit = (serviceName: string, path: string[]): void => {
      if (visiting.has(serviceName)) {
        cycles.push(`Circular dependency: ${path.join(' -> ')} -> ${serviceName}`)
        return
      }

      if (visited.has(serviceName)) {
        return
      }

      visiting.add(serviceName)
      
      const definition = this.services.get(serviceName)
      if (definition) {
        for (const dependency of definition.dependencies) {
          visit(dependency, [...path, serviceName])
        }
      }

      visiting.delete(serviceName)
      visited.add(serviceName)
    }

    for (const serviceName of this.services.keys()) {
      if (!visited.has(serviceName)) {
        visit(serviceName, [])
      }
    }

    return cycles
  }

  /**
   * 验证容器配置
   */
  validateConfiguration(): Result<void, Error> {
    try {
      // 检测循环依赖
      const cycles = this.detectCircularDependencies()
      if (cycles.length > 0) {
        return Result.error(new Error(`Circular dependencies detected:\n${cycles.join('\n')}`))
      }

      // 检查未注册的依赖
      const missingDependencies: string[] = []
      
      for (const [serviceName, definition] of this.services) {
        for (const dependency of definition.dependencies) {
          if (!this.services.has(dependency)) {
            missingDependencies.push(`Service ${serviceName} depends on unregistered service: ${dependency}`)
          }
        }
      }

      if (missingDependencies.length > 0) {
        return Result.error(new Error(`Missing dependencies:\n${missingDependencies.join('\n')}`))
      }

      console.log('✅ [DIContainer] 容器配置验证通过')
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Configuration validation failed: ${error.message}`))
    }
  }
}