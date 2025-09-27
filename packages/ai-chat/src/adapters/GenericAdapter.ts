/**
 * 通用适配器 - 兜底处理
 *
 * 当没有专门的适配器能处理时，使用此适配器
 * 提供最宽松的解析策略
 */

import { BaseAdapter } from './BaseAdapter.js'
import { RawToolCall, ParseResult, StandardToolCall } from './types.js'

/**
 * 通用适配器 - 兜底解决方案
 */
export class GenericAdapter extends BaseAdapter {
  readonly name = 'generic'
  readonly supportedServices = ['*']  // 支持所有服务

  /**
   * 通用适配器接受任何格式
   * 只要有最基本的结构就尝试处理
   */
  canHandle(raw: any): boolean {
    // 非常宽松的检查 - 只要是对象且有某些可能的字段就尝试处理
    if (!raw || typeof raw !== 'object') {
      return false
    }

    // 检查是否有任何可能的函数相关字段
    return !!(
      raw.function ||
      raw.tool_name ||
      raw.name ||
      raw.function_name ||
      (raw.call && raw.call.function)
    )
  }

  /**
   * 通用的参数清理 - 处理各种可能的格式
   */
  cleanArguments(argumentsStr: string): string {
    if (typeof argumentsStr !== 'string') {
      return '{}'
    }

    let cleaned = argumentsStr.trim()

    // 移除各种可能的特殊标记
    const specialTokens = [
      // OpenAI相关
      '<|tool_calls_section_end|>',
      '<|end_of_turn|>',
      '<|im_end|>',

      // Claude相关
      '<|assistant|>',
      '<|user|>',
      '<|system|>',

      // 通用标记
      '```json',
      '```',
      '<json>',
      '</json>',
      '<data>',
      '</data>',

      // 其他可能的标记
      '[TOOL_CALL]',
      '[/TOOL_CALL]',
      '<!-- tool call -->',
      '<!-- /tool call -->',
    ]

    for (const token of specialTokens) {
      cleaned = cleaned.replace(new RegExp(token, 'gi'), '')
    }

    // 移除多余的换行和空格
    cleaned = cleaned.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

    // 如果清理后为空，返回空对象
    if (cleaned === '') {
      return '{}'
    }

    return cleaned
  }

  /**
   * 通用标准化 - 尝试从各种格式中提取信息
   */
  normalizeToolCall(raw: RawToolCall): ParseResult<StandardToolCall> {
    try {
      // 1. 提取ID
      const id = this.extractId(raw)

      // 2. 提取函数名
      const functionName = this.extractFunctionName(raw)
      if (!functionName) {
        return {
          success: false,
          data: this.createEmptyStandardToolCall('unknown', 'unknown'),
          error: {
            type: 'MISSING_FIELD',
            message: '无法提取函数名',
            originalValue: raw
          }
        }
      }

      // 3. 提取参数
      const extractResult = this.extractArguments(raw)
      if (!extractResult.success) {
        return {
          success: false,
          data: this.createEmptyStandardToolCall(id, functionName),
          error: extractResult.error
        }
      }

      // 4. 构造标准格式
      const standardToolCall: StandardToolCall = {
        id,
        type: 'function',
        function: {
          name: functionName,
          arguments: extractResult.data
        }
      }

      return {
        success: true,
        data: standardToolCall,
        warnings: this.getGenericWarnings(raw)
      }

    } catch (error) {
      return {
        success: false,
        data: this.createEmptyStandardToolCall('unknown', 'unknown'),
        error: {
          type: 'VALIDATION_ERROR',
          message: `通用适配器处理异常: ${error instanceof Error ? error.message : 'Unknown error'}`,
          originalValue: raw
        }
      }
    }
  }

  // ============== 私有辅助方法 ==============

  /**
   * 从各种格式中提取ID
   */
  private extractId(raw: any): string {
    // 尝试多个可能的ID字段
    const possibleIdFields = [
      'id',
      'tool_call_id',
      'call_id',
      'function_call_id',
      'request_id'
    ]

    for (const field of possibleIdFields) {
      if (raw[field] && typeof raw[field] === 'string') {
        return raw[field]
      }
    }

    // 如果都没有，生成一个
    return this.generateOrValidateId(raw)
  }

  /**
   * 从各种格式中提取函数名
   */
  private extractFunctionName(raw: any): string | null {
    // 标准OpenAI格式
    if (raw.function?.name) {
      return raw.function.name
    }

    // 直接的name字段
    if (raw.name && typeof raw.name === 'string') {
      return raw.name
    }

    // tool_name字段
    if (raw.tool_name && typeof raw.tool_name === 'string') {
      return raw.tool_name
    }

    // function_name字段
    if (raw.function_name && typeof raw.function_name === 'string') {
      return raw.function_name
    }

    // 嵌套的call.function格式
    if (raw.call?.function?.name) {
      return raw.call.function.name
    }

    return null
  }

  /**
   * 从各种格式中提取参数
   */
  private extractArguments(raw: any): ParseResult<Record<string, any>> {
    let argumentsData: any = null

    // 1. 标准OpenAI格式
    if (raw.function?.arguments !== undefined) {
      argumentsData = raw.function.arguments
    }
    // 2. 直接的arguments字段
    else if (raw.arguments !== undefined) {
      argumentsData = raw.arguments
    }
    // 3. params字段
    else if (raw.params !== undefined) {
      argumentsData = raw.params
    }
    // 4. parameters字段
    else if (raw.parameters !== undefined) {
      argumentsData = raw.parameters
    }
    // 5. data字段
    else if (raw.data !== undefined) {
      argumentsData = raw.data
    }
    // 6. input字段
    else if (raw.input !== undefined) {
      argumentsData = raw.input
    }
    // 7. 嵌套格式
    else if (raw.call?.function?.arguments !== undefined) {
      argumentsData = raw.call.function.arguments
    }

    // 如果没找到任何参数，返回空对象
    if (argumentsData === null || argumentsData === undefined) {
      return { success: true, data: {} }
    }

    // 如果已经是对象，直接返回
    if (typeof argumentsData === 'object' && argumentsData !== null) {
      return { success: true, data: argumentsData }
    }

    // 如果是字符串，尝试解析
    if (typeof argumentsData === 'string') {
      const cleaned = this.cleanArguments(argumentsData)
      const parseResult = this.parseArgumentString(cleaned)
      return parseResult
    }

    // 其他类型，尝试转换
    try {
      const stringified = JSON.stringify(argumentsData)
      const parseResult = this.parseArgumentString(stringified)
      return parseResult
    } catch (error) {
      return {
        success: false,
        data: {},
        error: {
          type: 'INVALID_JSON',
          message: `无法处理参数类型: ${typeof argumentsData}`,
          originalValue: argumentsData
        }
      }
    }
  }

  /**
   * 解析参数字符串
   */
  private parseArgumentString(argumentsString: string): ParseResult<Record<string, any>> {
    const { SafeJsonParser } = require('./SafeJsonParser.js')

    return SafeJsonParser.parse(argumentsString, {
      allowEmptyString: true,
      allowNonObject: false,
      defaultValue: {},
      strictMode: false  // 通用适配器使用宽松模式
    })
  }

  /**
   * 获取通用适配器特定的警告
   */
  private getGenericWarnings(raw: any): string[] | undefined {
    const warnings: string[] = []

    warnings.push('使用通用适配器处理，建议为该AI服务创建专门的适配器')

    // 检查格式特殊性
    if (!raw.function && raw.name) {
      warnings.push('检测到非标准格式：使用name字段而非function.name')
    }

    if (raw.tool_name) {
      warnings.push('检测到非标准格式：使用tool_name字段')
    }

    if (raw.params || raw.parameters) {
      warnings.push('检测到非标准格式：使用params/parameters字段而非arguments')
    }

    return warnings.length > 0 ? warnings : undefined
  }
}