/**
 * DeeChat流式系统核心类型定义
 * 
 * 设计原则：
 * - 极简类型系统，只保留核心概念
 * - 统一数据流，从后端到前端一致
 * - 高性能，零冗余
 */

export interface BaseStreamChunk {
  id: string
  sessionId: string
  timestamp: number
}

/**
 * 文本流式块
 */
export interface TextStreamChunk extends BaseStreamChunk {
  type: 'text'
  content: string
  incremental: boolean
}

/**
 * 工具调用开始块
 */
export interface ToolStartChunk extends BaseStreamChunk {
  type: 'tool_start'
  toolName: string
  toolId: string
  args: Record<string, any>
}

/**
 * 工具调用结果块
 */
export interface ToolResultChunk extends BaseStreamChunk {
  type: 'tool_result'
  toolName: string
  toolId: string
  result: any
  success: boolean
  error?: string
  duration?: number
}

/**
 * 流式完成块
 */
export interface CompleteChunk extends BaseStreamChunk {
  type: 'complete'
  finalContent: string
  toolExecutions: ToolResultChunk[]
}

/**
 * 错误块
 */
export interface ErrorChunk extends BaseStreamChunk {
  type: 'error'
  error: string
  message: string
}

/**
 * 统一流式块类型
 */
export type StreamChunk = 
  | TextStreamChunk 
  | ToolStartChunk 
  | ToolResultChunk 
  | CompleteChunk 
  | ErrorChunk

/**
 * 流式回调接口
 */
export interface StreamCallbacks {
  onText?: (chunk: TextStreamChunk) => void
  onToolStart?: (chunk: ToolStartChunk) => void
  onToolResult?: (chunk: ToolResultChunk) => void
  onComplete?: (chunk: CompleteChunk) => void
  onError?: (chunk: ErrorChunk) => void
}

/**
 * 流式处理选项
 */
export interface StreamOptions {
  sessionId: string
  enableSmoothRendering?: boolean
  textChunkSize?: number
  renderInterval?: number
}

/**
 * 流式处理执行选项
 */
export interface ProcessOptions extends StreamOptions {
  onChunk?: (chunk: StreamChunk) => void
  signal?: AbortSignal
}