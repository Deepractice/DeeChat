/**
 * AI工具调用格式适配器类型定义
 *
 * 设计目标：
 * - 统一不同AI服务的工具调用格式
 * - 提供安全的JSON解析机制
 * - 支持格式验证和错误降级
 */

// ============== 标准化工具调用格式 ==============

/**
 * 标准化的工具调用格式 - 内部统一使用
 */
export interface StandardToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: Record<string, any>  // 注意：标准化为对象，不是JSON字符串
  }
}

/**
 * 原始工具调用数据 - 来自AI服务的原始格式
 */
export interface RawToolCall {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string | Record<string, any>  // 可能是字符串也可能是对象
  }
  [key: string]: any  // 允许其他AI服务的额外字段
}

// ============== 解析结果类型 ==============

/**
 * 安全解析结果
 */
export interface ParseResult<T = any> {
  success: boolean
  data: T
  error?: ParseError
  warnings?: string[]
}

/**
 * 解析错误详情
 */
export interface ParseError {
  type: 'INVALID_JSON' | 'MISSING_FIELD' | 'TYPE_MISMATCH' | 'VALIDATION_ERROR'
  message: string
  originalValue?: any
  field?: string
}

// ============== 适配器接口 ==============

/**
 * AI服务适配器接口 - 所有适配器必须实现
 */
export interface AIServiceAdapter {
  /** 适配器名称，如 'openai', 'kimi', 'claude' */
  readonly name: string

  /** 支持的AI服务标识符，用于自动匹配 */
  readonly supportedServices: string[]

  /**
   * 检测原始数据是否由该适配器处理
   * @param raw 原始工具调用数据
   * @returns 是否应该由该适配器处理
   */
  canHandle(raw: any): boolean

  /**
   * 预处理：清理原始参数字符串
   * @param argumentsStr 原始参数字符串
   * @returns 清理后的字符串
   */
  cleanArguments(argumentsStr: string): string

  /**
   * 标准化：将原始工具调用转换为标准格式
   * @param raw 原始工具调用数据
   * @returns 解析结果
   */
  normalizeToolCall(raw: RawToolCall): ParseResult<StandardToolCall>

  /**
   * 验证：检查标准化结果的有效性
   * @param toolCall 标准化的工具调用
   * @returns 验证结果
   */
  validate(toolCall: StandardToolCall): ParseResult<StandardToolCall>
}

// ============== 适配器配置 ==============

/**
 * 适配器配置选项
 */
export interface AdapterConfig {
  /** 是否启用详细日志 */
  enableDebugLog?: boolean

  /** 解析失败时的默认处理 */
  fallbackBehavior?: 'empty_args' | 'skip_call' | 'throw_error'

  /** 最大重试次数 */
  maxRetries?: number

  /** 自定义验证规则 */
  customValidators?: Array<(toolCall: StandardToolCall) => ParseResult<boolean>>
}

/**
 * 适配器上下文信息
 */
export interface AdapterContext {
  /** AI服务配置信息 */
  aiService?: {
    name: string
    model: string
    version?: string
  }

  /** 请求上下文 */
  requestContext?: {
    messageId?: string
    conversationId?: string
    timestamp: number
  }

  /** 调试选项 */
  debug?: boolean
}

// ============== 工具调用统计 ==============

/**
 * 适配器性能统计
 */
export interface AdapterStats {
  adapterName: string
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  averageProcessingTime: number
  commonErrors: Array<{
    error: string
    count: number
  }>
}

// ============== 批量处理类型 ==============

/**
 * 批量工具调用处理结果
 */
export interface BatchProcessResult {
  successful: StandardToolCall[]
  failed: Array<{
    raw: RawToolCall
    error: ParseError
    adapterUsed?: string
  }>
  stats: {
    total: number
    successful: number
    failed: number
    processingTime: number
  }
}