/**
 * 适配器工厂和注册机制 - AI服务差异化处理的核心组件
 *
 * 这是一个关键的架构组件，解决了不同AI服务商在工具调用格式上的差异问题。
 * 通过适配器模式，将各种AI服务的不同格式统一转换为标准格式。
 *
 * 核心功能：
 * - 适配器注册和管理：动态注册不同AI服务的适配器
 * - 自动选择合适的适配器：基于优先级和能力匹配
 * - 批量处理工具调用：高效处理多个工具调用
 * - 性能统计和监控：实时监控各适配器的工作状态
 * - 降级处理：当适配器失败时提供备用方案
 *
 * 设计模式：
 * - 单例模式：确保全局唯一的适配器工厂
 * - 策略模式：不同适配器实现不同的处理策略
 * - 责任链模式：按优先级依次尝试适配器
 * - 工厂模式：统一创建和管理适配器实例
 *
 * 主要解决的问题：
 * 1. OpenAI格式差异：不同版本API的微小差异
 * 2. Kimi特殊格式：参数可能是字符串而非对象
 * 3. Claude兼容性：Anthropic的特殊要求
 * 4. 错误恢复：解析失败时的降级策略
 *
 * @author DeeChat Team
 * @since v0.5.0
 * @example
 * ```typescript
 * // 获取工厂实例并注册适配器
 * const factory = AdapterFactory.getInstance();
 * factory.register(new OpenAIAdapter(), 10);
 * factory.register(new KimiAdapter(), 20);
 *
 * // 处理工具调用
 * const result = await factory.processToolCall(rawToolCall, context);
 * if (result.success) {
 *   console.log('标准化的工具调用:', result.data);
 * }
 * ```
 */

import {
  AIServiceAdapter,
  AdapterConfig,
  AdapterContext,
  AdapterStats,
  RawToolCall,
  StandardToolCall,
  BatchProcessResult,
  ParseResult,
  ParseError
} from './types.js'

/**
 * 适配器注册信息
 */
interface AdapterRegistration {
  adapter: AIServiceAdapter
  priority: number  // 优先级，数字越小优先级越高
  enabled: boolean
}

/**
 * 适配器工厂类 - 采用单例模式确保全局一致性
 *
 * 这个类是整个适配器系统的控制中心，负责管理所有已注册的适配器，
 * 并提供智能的适配器选择和工具调用处理能力。
 *
 * 关键特性：
 * - 单例模式：确保应用中只有一个工厂实例
 * - 动态注册：运行时注册和管理适配器
 * - 优先级调度：按优先级选择最合适的适配器
 * - 性能监控：实时收集各适配器的性能数据
 * - 错误恢复：提供多种降级策略
 */
export class AdapterFactory {
  /** 单例实例 */
  private static instance: AdapterFactory

  /** 已注册的适配器映射表：name -> 注册信息 */
  private adapters: Map<string, AdapterRegistration> = new Map()

  /** 适配器性能统计数据：name -> 统计信息 */
  private stats: Map<string, AdapterStats> = new Map()

  /** 工厂配置选项 */
  private config: Required<AdapterConfig>

  /**
   * 私有构造函数 - 单例模式要求
   */
  private constructor() {
    // 默认配置 - 保守且安全的设置
    this.config = {
      enableDebugLog: false,        // 默认关闭调试日志，提升性能
      fallbackBehavior: 'empty_args', // 使用空参数作为降级策略
      maxRetries: 1,                // 默认重试一次
      customValidators: []          // 无自定义验证器
    }
  }

  /**
   * 获取工厂单例
   */
  static getInstance(): AdapterFactory {
    if (!AdapterFactory.instance) {
      AdapterFactory.instance = new AdapterFactory()
    }
    return AdapterFactory.instance
  }

  /**
   * 配置工厂选项
   */
  configure(config: Partial<AdapterConfig>): void {
    this.config = { ...this.config, ...config }
    this.log('配置已更新:', config)
  }

  /**
   * 注册适配器
   * @param adapter 适配器实例
   * @param priority 优先级（可选，默认为50）
   */
  register(adapter: AIServiceAdapter, priority: number = 50): void {
    if (this.adapters.has(adapter.name)) {
      console.warn(`适配器 "${adapter.name}" 已存在，将被覆盖`)
    }

    this.adapters.set(adapter.name, {
      adapter,
      priority,
      enabled: true
    })

    // 初始化统计信息
    this.stats.set(adapter.name, {
      adapterName: adapter.name,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageProcessingTime: 0,
      commonErrors: []
    })

    this.log(`适配器 "${adapter.name}" 注册成功，优先级：${priority}`)
  }

  /**
   * 取消注册适配器
   */
  unregister(adapterName: string): boolean {
    const removed = this.adapters.delete(adapterName)
    this.stats.delete(adapterName)

    if (removed) {
      this.log(`适配器 "${adapterName}" 已取消注册`)
    }

    return removed
  }

  /**
   * 启用/禁用适配器
   */
  setAdapterEnabled(adapterName: string, enabled: boolean): boolean {
    const registration = this.adapters.get(adapterName)
    if (registration) {
      registration.enabled = enabled
      this.log(`适配器 "${adapterName}" ${enabled ? '已启用' : '已禁用'}`)
      return true
    }
    return false
  }

  /**
   * 获取所有已注册的适配器信息
   */
  getRegisteredAdapters(): Array<{ name: string; priority: number; enabled: boolean }> {
    return Array.from(this.adapters.entries()).map(([name, reg]) => ({
      name,
      priority: reg.priority,
      enabled: reg.enabled
    }))
  }

  /**
   * 选择最佳适配器处理工具调用
   * @param raw 原始工具调用数据
   * @param context 上下文信息
   * @returns 选中的适配器或null
   */
  selectAdapter(raw: RawToolCall, context?: AdapterContext): AIServiceAdapter | null {
    // 获取启用的适配器，按优先级排序
    const enabledAdapters = Array.from(this.adapters.values())
      .filter(reg => reg.enabled)
      .sort((a, b) => a.priority - b.priority)

    // 1. 优先使用context中指定的服务
    if (context?.aiService?.name) {
      const contextAdapter = enabledAdapters.find(reg =>
        reg.adapter.supportedServices.includes(context.aiService!.name.toLowerCase())
      )
      if (contextAdapter && contextAdapter.adapter.canHandle(raw)) {
        this.log(`使用上下文指定的适配器: ${contextAdapter.adapter.name}`)
        return contextAdapter.adapter
      }
    }

    // 2. 按优先级顺序查找能处理该数据的适配器
    for (const registration of enabledAdapters) {
      if (registration.adapter.canHandle(raw)) {
        this.log(`选择适配器: ${registration.adapter.name}`)
        return registration.adapter
      }
    }

    this.log('未找到合适的适配器')
    return null
  }

  /**
   * 处理单个工具调用
   * @param raw 原始工具调用数据
   * @param context 上下文信息
   * @returns 处理结果
   */
  async processToolCall(
    raw: RawToolCall,
    context?: AdapterContext
  ): Promise<ParseResult<StandardToolCall>> {
    const startTime = Date.now()

    try {
      // 选择适配器
      const adapter = this.selectAdapter(raw, context)
      if (!adapter) {
        return this.createFallbackResult(raw, 'NO_ADAPTER_FOUND')
      }

      // 记录统计
      const stats = this.stats.get(adapter.name)!
      stats.totalCalls++

      // 处理工具调用
      let result: ParseResult<StandardToolCall>
      let retries = 0

      do {
        result = adapter.normalizeToolCall(raw)

        if (result.success) {
          // 验证结果
          const validationResult = adapter.validate(result.data)
          if (validationResult.success) {
            // 应用自定义验证器
            const customValidationResult = this.applyCustomValidators(result.data)
            if (customValidationResult.success) {
              stats.successfulCalls++
              this.updateProcessingTime(adapter.name, Date.now() - startTime)
              return result
            } else {
              result = {
                success: false,
                data: result.data,
                error: customValidationResult.error
              }
            }
          } else {
            result = validationResult
          }
        }

        retries++
      } while (!result.success && retries < this.config.maxRetries)

      // 处理失败情况
      stats.failedCalls++
      this.recordError(adapter.name, result.error!)
      this.updateProcessingTime(adapter.name, Date.now() - startTime)

      return this.handleFailure(result, raw)

    } catch (error) {
      return {
        success: false,
        data: this.createEmptyToolCall(),
        error: {
          type: 'VALIDATION_ERROR',
          message: `处理异常: ${error instanceof Error ? error.message : 'Unknown error'}`,
          originalValue: raw
        }
      }
    }
  }

  /**
   * 批量处理工具调用
   * @param rawCalls 原始工具调用列表
   * @param context 上下文信息
   * @returns 批量处理结果
   */
  async batchProcess(
    rawCalls: RawToolCall[],
    context?: AdapterContext
  ): Promise<BatchProcessResult> {
    const startTime = Date.now()
    const successful: StandardToolCall[] = []
    const failed: Array<{ raw: RawToolCall; error: ParseError; adapterUsed?: string }> = []

    for (const raw of rawCalls) {
      const result = await this.processToolCall(raw, context)

      if (result.success) {
        successful.push(result.data)
      } else {
        failed.push({
          raw,
          error: result.error!,
          adapterUsed: this.selectAdapter(raw, context)?.name
        })
      }
    }

    return {
      successful,
      failed,
      stats: {
        total: rawCalls.length,
        successful: successful.length,
        failed: failed.length,
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * 获取适配器统计信息
   */
  getStats(adapterName?: string): AdapterStats | AdapterStats[] {
    if (adapterName) {
      return this.stats.get(adapterName) || this.createEmptyStats(adapterName)
    }
    return Array.from(this.stats.values())
  }

  /**
   * 重置统计信息
   */
  resetStats(adapterName?: string): void {
    if (adapterName) {
      const stats = this.stats.get(adapterName)
      if (stats) {
        Object.assign(stats, this.createEmptyStats(adapterName))
      }
    } else {
      for (const [name, stats] of this.stats) {
        Object.assign(stats, this.createEmptyStats(name))
      }
    }
  }

  // ============== 私有辅助方法 ==============

  private applyCustomValidators(toolCall: StandardToolCall): ParseResult<boolean> {
    for (const validator of this.config.customValidators) {
      const result = validator(toolCall)
      if (!result.success) {
        return result
      }
    }
    return { success: true, data: true }
  }

  private createFallbackResult(raw: RawToolCall, reason: string): ParseResult<StandardToolCall> {
    switch (this.config.fallbackBehavior) {
      case 'empty_args':
        return {
          success: true,
          data: this.createEmptyToolCall(raw),
          warnings: [`使用降级处理: ${reason}`]
        }

      case 'skip_call':
        return {
          success: false,
          data: this.createEmptyToolCall(),
          error: {
            type: 'VALIDATION_ERROR',
            message: `跳过工具调用: ${reason}`,
            originalValue: raw
          }
        }

      case 'throw_error':
      default:
        return {
          success: false,
          data: this.createEmptyToolCall(),
          error: {
            type: 'VALIDATION_ERROR',
            message: reason,
            originalValue: raw
          }
        }
    }
  }

  private handleFailure(result: ParseResult<StandardToolCall>, raw: RawToolCall): ParseResult<StandardToolCall> {
    if (this.config.fallbackBehavior === 'empty_args') {
      return {
        success: true,
        data: this.createEmptyToolCall(raw),
        warnings: [`解析失败，使用空参数: ${result.error?.message}`]
      }
    }
    return result
  }

  private createEmptyToolCall(raw?: RawToolCall): StandardToolCall {
    return {
      id: raw?.id || 'unknown',
      type: 'function',
      function: {
        name: raw?.function?.name || 'unknown',
        arguments: {}
      }
    }
  }

  private createEmptyStats(adapterName: string): AdapterStats {
    return {
      adapterName,
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageProcessingTime: 0,
      commonErrors: []
    }
  }

  private updateProcessingTime(adapterName: string, processingTime: number): void {
    const stats = this.stats.get(adapterName)!
    const total = stats.averageProcessingTime * (stats.totalCalls - 1) + processingTime
    stats.averageProcessingTime = total / stats.totalCalls
  }

  private recordError(adapterName: string, error: ParseError): void {
    const stats = this.stats.get(adapterName)!
    const existingError = stats.commonErrors.find(e => e.error === error.message)

    if (existingError) {
      existingError.count++
    } else {
      stats.commonErrors.push({ error: error.message, count: 1 })
    }

    // 保持错误列表不超过10个
    stats.commonErrors.sort((a, b) => b.count - a.count)
    if (stats.commonErrors.length > 10) {
      stats.commonErrors = stats.commonErrors.slice(0, 10)
    }
  }

  private log(message: string, data?: any): void {
    if (this.config.enableDebugLog) {
      if (data) {
        console.log(`[AdapterFactory] ${message}`, data)
      } else {
        console.log(`[AdapterFactory] ${message}`)
      }
    }
  }
}