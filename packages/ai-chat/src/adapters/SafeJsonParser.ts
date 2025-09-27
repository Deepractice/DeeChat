/**
 * 安全JSON解析工具类
 *
 * 功能：
 * - 提供多种JSON解析策略
 * - 处理各种边界情况和错误格式
 * - 支持降级处理和错误恢复
 */

import { ParseResult, ParseError } from './types.js'

/**
 * JSON解析选项
 */
export interface JsonParseOptions {
  /** 是否允许空字符串，默认true */
  allowEmptyString?: boolean

  /** 是否允许非对象结果，默认false */
  allowNonObject?: boolean

  /** 解析失败时的默认值 */
  defaultValue?: any

  /** 是否启用宽松模式（尝试修复常见错误） */
  strictMode?: boolean

  /** 最大字符串长度限制 */
  maxLength?: number
}

/**
 * 安全JSON解析器
 */
export class SafeJsonParser {
  private static readonly DEFAULT_OPTIONS: Required<JsonParseOptions> = {
    allowEmptyString: true,
    allowNonObject: false,
    defaultValue: {},
    strictMode: false,
    maxLength: 100000
  }

  /**
   * 安全解析JSON字符串
   * @param input 输入字符串
   * @param options 解析选项
   * @returns 解析结果
   */
  static parse(input: any, options: JsonParseOptions = {}): ParseResult<any> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }

    // 1. 基础类型检查
    if (input === null || input === undefined) {
      return {
        success: true,
        data: opts.defaultValue,
        warnings: ['Input is null or undefined, using default value']
      }
    }

    // 2. 如果已经是对象，直接返回
    if (typeof input === 'object') {
      return {
        success: true,
        data: input
      }
    }

    // 3. 转换为字符串
    const str = String(input).trim()

    // 4. 处理空字符串
    if (str === '') {
      if (opts.allowEmptyString) {
        return {
          success: true,
          data: opts.defaultValue,
          warnings: ['Empty string input, using default value']
        }
      } else {
        return {
          success: false,
          data: opts.defaultValue,
          error: {
            type: 'INVALID_JSON',
            message: 'Empty string is not allowed',
            originalValue: input
          }
        }
      }
    }

    // 5. 长度检查
    if (str.length > opts.maxLength) {
      return {
        success: false,
        data: opts.defaultValue,
        error: {
          type: 'INVALID_JSON',
          message: `Input too long: ${str.length} > ${opts.maxLength}`,
          originalValue: input
        }
      }
    }

    // 6. 预处理和清理
    const cleaned = this.preprocessInput(str)

    // 7. 尝试解析
    return this.attemptParse(cleaned, opts)
  }

  /**
   * 预处理输入字符串
   * @param input 原始输入
   * @returns 清理后的字符串
   */
  private static preprocessInput(input: string): string {
    let cleaned = input.trim()

    // 移除常见的AI服务特殊标记
    const specialTokens = [
      '<|tool_calls_section_end|>',
      '<|end_of_turn|>',
      '<|im_end|>',
      '```json',
      '```',
      '<json>',
      '</json>'
    ]

    for (const token of specialTokens) {
      cleaned = cleaned.replace(new RegExp(token, 'gi'), '')
    }

    // 移除前后的引号（如果整个字符串被引号包围）
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1)
    }

    return cleaned.trim()
  }

  /**
   * 尝试解析JSON
   * @param input 预处理后的输入
   * @param options 解析选项
   * @returns 解析结果
   */
  private static attemptParse(input: string, options: Required<JsonParseOptions>): ParseResult<any> {
    const strategies = [
      // 策略1：标准JSON解析
      () => this.standardParse(input),

      // 策略2：宽松模式解析（修复常见错误）
      () => options.strictMode ? null : this.lenientParse(input),

      // 策略3：提取JSON片段
      () => options.strictMode ? null : this.extractJsonPart(input),
    ]

    const errors: ParseError[] = []

    for (const strategy of strategies) {
      if (!strategy) continue

      const result = strategy()
      if (result && result.success) {
        // 类型验证
        const validationResult = this.validateResult(result.data, options)
        if (validationResult.success) {
          return result
        } else if (validationResult.error) {
          errors.push(validationResult.error)
        }
      } else if (result && result.error) {
        errors.push(result.error)
      }
    }

    // 所有策略都失败，返回默认值
    return {
      success: false,
      data: options.defaultValue,
      error: {
        type: 'INVALID_JSON',
        message: `All parsing strategies failed. Errors: ${errors.map(e => e.message).join('; ')}`,
        originalValue: input
      }
    }
  }

  /**
   * 策略1：标准JSON解析
   */
  private static standardParse(input: string): ParseResult<any> {
    try {
      const result = JSON.parse(input)
      return { success: true, data: result }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: {
          type: 'INVALID_JSON',
          message: error instanceof Error ? error.message : 'JSON parse failed',
          originalValue: input
        }
      }
    }
  }

  /**
   * 策略2：宽松解析（修复常见错误）
   */
  private static lenientParse(input: string): ParseResult<any> {
    try {
      let fixed = input

      // 修复常见的JSON错误
      // 1. 单引号替换为双引号
      fixed = fixed.replace(/'/g, '"')

      // 2. 修复未引用的键名
      fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

      // 3. 移除尾随逗号
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

      // 4. 修复布尔值大小写
      fixed = fixed.replace(/\bTrue\b/g, 'true').replace(/\bFalse\b/g, 'false')

      const result = JSON.parse(fixed)
      return {
        success: true,
        data: result,
        warnings: ['Applied lenient parsing fixes']
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: {
          type: 'INVALID_JSON',
          message: `Lenient parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          originalValue: input
        }
      }
    }
  }

  /**
   * 策略3：提取JSON片段
   */
  private static extractJsonPart(input: string): ParseResult<any> {
    try {
      // 寻找可能的JSON开始和结束位置
      const jsonStartPattern = /[{[]/
      const jsonEndPattern = /[}\]]/

      const startMatch = input.match(jsonStartPattern)
      if (!startMatch) {
        throw new Error('No JSON start marker found')
      }

      const startIndex = startMatch.index!
      let braceCount = 0
      let endIndex = -1

      for (let i = startIndex; i < input.length; i++) {
        const char = input[i]
        if (char === '{' || char === '[') {
          braceCount++
        } else if (char === '}' || char === ']') {
          braceCount--
          if (braceCount === 0) {
            endIndex = i
            break
          }
        }
      }

      if (endIndex === -1) {
        throw new Error('No matching end marker found')
      }

      const jsonPart = input.substring(startIndex, endIndex + 1)
      const result = JSON.parse(jsonPart)

      return {
        success: true,
        data: result,
        warnings: ['Extracted JSON fragment from larger text']
      }
    } catch (error) {
      return {
        success: false,
        data: {},
        error: {
          type: 'INVALID_JSON',
          message: `JSON extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          originalValue: input
        }
      }
    }
  }

  /**
   * 验证解析结果
   */
  private static validateResult(data: any, options: Required<JsonParseOptions>): ParseResult<any> {
    // 检查是否允许非对象类型
    if (!options.allowNonObject && typeof data !== 'object') {
      return {
        success: false,
        data: options.defaultValue,
        error: {
          type: 'TYPE_MISMATCH',
          message: `Expected object, got ${typeof data}`,
          originalValue: data
        }
      }
    }

    return { success: true, data }
  }

  /**
   * 批量解析多个输入
   */
  static parseBatch(inputs: any[], options: JsonParseOptions = {}): Array<ParseResult<any>> {
    return inputs.map(input => this.parse(input, options))
  }

  /**
   * 检查字符串是否可能是JSON
   */
  static looksLikeJson(input: string): boolean {
    if (typeof input !== 'string') return false

    const trimmed = input.trim()
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'))
  }
}