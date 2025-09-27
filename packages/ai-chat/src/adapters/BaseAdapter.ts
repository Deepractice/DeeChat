/**
 * 基础适配器抽象类
 *
 * 提供通用的适配器实现和工具方法
 * 具体的AI服务适配器继承此类
 */

import {
  AIServiceAdapter,
  RawToolCall,
  StandardToolCall,
  ParseResult,
  ParseError
} from './types.js'
import { SafeJsonParser } from './SafeJsonParser.js'

/**
 * 适配器基类 - 提供通用实现
 */
export abstract class BaseAdapter implements AIServiceAdapter {
  abstract readonly name: string
  abstract readonly supportedServices: string[]

  /**
   * 默认的canHandle实现 - 基于supportedServices
   * 子类可以重写以提供更精确的检测
   */
  canHandle(raw: any): boolean {
    // 基础检查：必须有基本的工具调用结构
    if (!raw || typeof raw !== 'object') {
      return false
    }

    // 检查是否有function字段
    if (!raw.function || typeof raw.function !== 'object') {
      return false
    }

    // 检查是否有function.name
    if (!raw.function.name || typeof raw.function.name !== 'string') {
      return false
    }

    return true
  }

  /**
   * 通用的参数清理逻辑
   * 子类可以重写以处理特定服务的特殊情况
   */
  cleanArguments(argumentsStr: string): string {
    if (typeof argumentsStr !== 'string') {
      return '{}'
    }

    let cleaned = argumentsStr.trim()

    // 如果是空字符串，返回空对象
    if (cleaned === '') {
      return '{}'
    }

    // 移除通用的特殊标记
    const commonTokens = [
      '<|tool_calls_section_end|>',
      '<|end_of_turn|>',
      '<|im_end|>',
      '```json',
      '```',
      '<json>',
      '</json>'
    ]

    for (const token of commonTokens) {
      cleaned = cleaned.replace(new RegExp(token, 'gi'), '')
    }

    cleaned = cleaned.trim()

    // 如果清理后为空，返回空对象
    if (cleaned === '') {
      return '{}'
    }

    return cleaned
  }

  /**
   * 通用的标准化实现
   * 子类通常只需要重写cleanArguments方法
   */
  normalizeToolCall(raw: RawToolCall): ParseResult<StandardToolCall> {
    try {
      // 1. 基础验证
      const validationResult = this.validateRawToolCall(raw)
      if (!validationResult.success) {
        return {
          success: false,
          data: this.createEmptyStandardToolCall('unknown', 'unknown'),
          error: validationResult.error
        }
      }

      // 2. 生成或验证ID
      const id = this.generateOrValidateId(raw)

      // 3. 提取函数名
      const functionName = raw.function!.name!

      // 4. 处理参数
      let parsedArguments: Record<string, any> = {}

      if (raw.function!.arguments) {
        if (typeof raw.function!.arguments === 'object') {
          // 已经是对象，直接使用
          parsedArguments = raw.function!.arguments as Record<string, any>
        } else {
          // 是字符串，需要解析
          const cleanedArgs = this.cleanArguments(raw.function!.arguments as string)
          const parseResult = SafeJsonParser.parse(cleanedArgs, {
            allowEmptyString: true,
            allowNonObject: false,
            defaultValue: {}
          })

          if (!parseResult.success) {
            return {
              success: false,
              data: this.createEmptyStandardToolCall(id, functionName),
              error: parseResult.error
            }
          }

          parsedArguments = parseResult.data
        }
      }

      // 5. 构造标准格式
      const standardToolCall: StandardToolCall = {
        id,
        type: 'function',
        function: {
          name: functionName,
          arguments: parsedArguments
        }
      }

      return {
        success: true,
        data: standardToolCall,
        warnings: this.getProcessingWarnings(raw)
      }

    } catch (error) {
      return {
        success: false,
        data: this.createEmptyStandardToolCall('unknown', 'unknown'),
        error: {
          type: 'VALIDATION_ERROR',
          message: `标准化过程异常: ${error instanceof Error ? error.message : 'Unknown error'}`,
          originalValue: raw
        }
      }
    }
  }

  /**
   * 基础验证逻辑
   * 子类可以扩展此方法添加特定验证
   */
  validate(toolCall: StandardToolCall): ParseResult<StandardToolCall> {
    const errors: string[] = []

    // ID检查
    if (!toolCall.id || typeof toolCall.id !== 'string') {
      errors.push('工具调用ID缺失或无效')
    }

    // type检查
    if (toolCall.type !== 'function') {
      errors.push(`不支持的工具调用类型: ${toolCall.type}`)
    }

    // function检查
    if (!toolCall.function || typeof toolCall.function !== 'object') {
      errors.push('function字段缺失或无效')
    } else {
      // function.name检查
      if (!toolCall.function.name || typeof toolCall.function.name !== 'string') {
        errors.push('function.name缺失或无效')
      }

      // function.arguments检查
      if (typeof toolCall.function.arguments !== 'object' || toolCall.function.arguments === null) {
        errors.push('function.arguments必须是对象')
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        data: toolCall,
        error: {
          type: 'VALIDATION_ERROR',
          message: `验证失败: ${errors.join('; ')}`,
          originalValue: toolCall
        }
      }
    }

    return { success: true, data: toolCall }
  }

  // ============== 受保护的辅助方法 ==============

  /**
   * 验证原始工具调用数据
   */
  protected validateRawToolCall(raw: RawToolCall): ParseResult<boolean> {
    if (!raw || typeof raw !== 'object') {
      return {
        success: false,
        data: false,
        error: {
          type: 'INVALID_JSON',
          message: '工具调用数据不是有效对象',
          originalValue: raw
        }
      }
    }

    if (!raw.function || typeof raw.function !== 'object') {
      return {
        success: false,
        data: false,
        error: {
          type: 'MISSING_FIELD',
          message: 'function字段缺失或无效',
          field: 'function',
          originalValue: raw
        }
      }
    }

    if (!raw.function.name || typeof raw.function.name !== 'string') {
      return {
        success: false,
        data: false,
        error: {
          type: 'MISSING_FIELD',
          message: 'function.name字段缺失或无效',
          field: 'function.name',
          originalValue: raw
        }
      }
    }

    return { success: true, data: true }
  }

  /**
   * 生成或验证工具调用ID
   */
  protected generateOrValidateId(raw: RawToolCall): string {
    if (raw.id && typeof raw.id === 'string' && raw.id.trim() !== '') {
      return raw.id
    }

    // 生成默认ID
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `call_${timestamp}_${random}`
  }

  /**
   * 创建空的标准工具调用
   */
  protected createEmptyStandardToolCall(id: string, name: string): StandardToolCall {
    return {
      id,
      type: 'function',
      function: {
        name,
        arguments: {}
      }
    }
  }

  /**
   * 获取处理过程中的警告信息
   * 子类可以重写以添加特定警告
   */
  protected getProcessingWarnings(raw: RawToolCall): string[] | undefined {
    const warnings: string[] = []

    // 检查是否生成了新的ID
    if (!raw.id) {
      warnings.push('原始数据缺少ID，已自动生成')
    }

    // 检查参数是否为空
    if (!raw.function?.arguments || raw.function.arguments === '' || raw.function.arguments === '{}') {
      warnings.push('工具调用参数为空')
    }

    return warnings.length > 0 ? warnings : undefined
  }

  /**
   * 记录调试信息
   */
  protected log(message: string, data?: any): void {
    // 可以在子类中重写以实现特定的日志策略
    console.debug(`[${this.name}] ${message}`, data || '')
  }
}