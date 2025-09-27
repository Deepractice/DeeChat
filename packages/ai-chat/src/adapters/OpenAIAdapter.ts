/**
 * OpenAI标准格式适配器
 *
 * 处理标准OpenAI API格式的工具调用
 * 作为其他适配器的参考实现
 */

import { BaseAdapter } from './BaseAdapter.js'
import { RawToolCall } from './types.js'

/**
 * OpenAI适配器 - 处理标准OpenAI格式
 */
export class OpenAIAdapter extends BaseAdapter {
  readonly name = 'openai'
  readonly supportedServices = ['openai', 'gpt', 'chatgpt']

  /**
   * 检查是否是标准OpenAI格式
   */
  canHandle(raw: any): boolean {
    // 先调用基础检查
    if (!super.canHandle(raw)) {
      return false
    }

    // OpenAI特征检查
    // 1. 必须有id字段
    if (!raw.id || typeof raw.id !== 'string') {
      return false
    }

    // 2. type字段必须是'function'
    if (raw.type !== 'function') {
      return false
    }

    // 3. arguments通常是JSON字符串
    if (raw.function.arguments && typeof raw.function.arguments !== 'string') {
      return false
    }

    return true
  }

  /**
   * OpenAI格式的参数清理相对简单
   * 主要处理空字符串情况
   */
  cleanArguments(argumentsStr: string): string {
    if (typeof argumentsStr !== 'string') {
      return '{}'
    }

    const cleaned = argumentsStr.trim()

    // OpenAI通常不会有特殊标记，主要处理空字符串
    if (cleaned === '') {
      return '{}'
    }

    return cleaned
  }

  /**
   * 获取OpenAI特定的处理警告
   */
  protected getProcessingWarnings(raw: RawToolCall): string[] | undefined {
    const warnings = super.getProcessingWarnings(raw) || []

    // 检查arguments格式
    if (raw.function?.arguments && typeof raw.function.arguments !== 'string') {
      warnings.push('OpenAI格式的arguments应该是JSON字符串，当前是对象')
    }

    // 检查type字段
    if (raw.type && raw.type !== 'function') {
      warnings.push(`OpenAI格式的type应该是'function'，当前是'${raw.type}'`)
    }

    return warnings.length > 0 ? warnings : undefined
  }
}