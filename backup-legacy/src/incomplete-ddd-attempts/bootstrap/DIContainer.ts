/**
 * 依赖注入容器
 * 解决循环依赖，管理服务生命周期
 */

export interface ServiceDefinition<T = any> {
  constructor: new (...args: any[]) => T
  singleton: boolean
  dependencies: string[]
  factory?: (...deps: any[]) => T
}

export interface ContainerOptions {
  singleton?: boolean
  dependencies?: string[]
  factory?: (...deps: any[]) => any
}

export class DIContainer {
  private services = new Map<string, ServiceDefinition>()
  private instances = new Map<string, any>()
  private resolving = new Set<string>() // 防止循环依赖

  /**
   * 注册服务到容器
   */
  register<T>(
    name: string, 
    constructor: new (...args: any[]) => T,
    options: ContainerOptions = {}
  ): DIContainer {
    this.services.set(name, {
      constructor,
      singleton: options.singleton ?? true,
      dependencies: options.dependencies ?? [],
      factory: options.factory
    })
    
    console.log(`🔧 [DIContainer] 注册服务: ${name}`)
    return this
  }

  /**
   * 注册工厂函数
   */
  registerFactory<T>(
    name: string,
    factory: (...deps: any[]) => T,
    options: Omit<ContainerOptions, 'factory'> = {}
  ): DIContainer {
    this.services.set(name, {
      constructor: Object as any, // 工厂模式不需要构造函数
      singleton: options.singleton ?? true,
      dependencies: options.dependencies ?? [],
      factory
    })
    
    console.log(`🏭 [DIContainer] 注册工厂: ${name}`)
    return this
  }

  /**
   * 解析服务实例
   */
  resolve<T>(name: string): T {
    // 检查单例缓存
    if (this.instances.has(name) && this.services.get(name)?.singleton) {
      return this.instances.get(name)
    }

    // 检查循环依赖
    if (this.resolving.has(name)) {
      throw new Error(`🚨 [DIContainer] 检测到循环依赖: ${Array.from(this.resolving).join(' -> ')} -> ${name}`)
    }

    const definition = this.services.get(name)
    if (!definition) {
      throw new Error(`🚨 [DIContainer] 服务未注册: ${name}`)
    }

    this.resolving.add(name)
    
    try {
      let instance: T

      if (definition.factory) {
        // 使用工厂函数创建实例
        const dependencies = definition.dependencies.map(dep => this.resolve(dep))
        instance = definition.factory(...dependencies)
      } else {
        // 使用构造函数创建实例
        const dependencies = definition.dependencies.map(dep => this.resolve(dep))
        instance = new definition.constructor(...dependencies)
      }

      // 缓存单例
      if (definition.singleton) {
        this.instances.set(name, instance)
      }

      console.log(`✅ [DIContainer] 解析服务成功: ${name}`)
      return instance

    } finally {
      this.resolving.delete(name)
    }
  }

  /**
   * 检查服务是否已注册
   */
  has(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * 获取所有已注册的服务名称
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * 清理容器（主要用于测试）
   */
  clear(): void {
    this.services.clear()
    this.instances.clear()
    this.resolving.clear()
    console.log('🧹 [DIContainer] 容器已清理')
  }

  /**
   * 获取容器状态信息
   */
  getStatus() {
    return {
      totalServices: this.services.size,
      singletonInstances: this.instances.size,
      currentlyResolving: Array.from(this.resolving),
      registeredServices: this.getRegisteredServices()
    }
  }
}