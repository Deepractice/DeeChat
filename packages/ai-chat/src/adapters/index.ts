/**
 * 工具调用格式适配器模块入口
 *
 * 导出所有适配器相关的类型和实现
 */

// 类型定义
export * from './types.js'

// 核心组件
export { SafeJsonParser } from './SafeJsonParser.js'
export { AdapterFactory } from './AdapterFactory.js'
export { BaseAdapter } from './BaseAdapter.js'

// 具体适配器实现
export { OpenAIAdapter } from './OpenAIAdapter.js'
export { GenericAdapter } from './GenericAdapter.js'

// 便利的工厂函数
import { AdapterFactory } from './AdapterFactory.js'
import { OpenAIAdapter } from './OpenAIAdapter.js'
import { GenericAdapter } from './GenericAdapter.js'

/**
 * 获取配置好的适配器工厂实例
 * 已预注册常用适配器
 */
export function createConfiguredAdapterFactory(): AdapterFactory {
  const factory = AdapterFactory.getInstance()

  // 注册内置适配器（按优先级顺序）
  factory.register(new OpenAIAdapter(), 10)     // 最高优先级 - 标准格式
  factory.register(new GenericAdapter(), 100)   // 最低优先级 - 兜底处理

  return factory
}

/**
 * 便利函数：处理单个工具调用
 */
export async function processToolCall(rawToolCall: any, context?: any) {
  const factory = createConfiguredAdapterFactory()
  return factory.processToolCall(rawToolCall, context)
}

/**
 * 便利函数：批量处理工具调用
 */
export async function batchProcessToolCalls(rawToolCalls: any[], context?: any) {
  const factory = createConfiguredAdapterFactory()
  return factory.batchProcess(rawToolCalls, context)
}

/**
 * 便利函数：配置适配器工厂
 */
export function configureAdapters(config: {
  enableDebugLog?: boolean
  fallbackBehavior?: 'empty_args' | 'skip_call' | 'throw_error'
  maxRetries?: number
}) {
  const factory = AdapterFactory.getInstance()
  factory.configure(config)
  return factory
}