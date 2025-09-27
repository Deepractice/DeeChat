/**
 * 流式响应处理工具
 * 
 * 提供流式响应的通用处理方法
 */

import { ChatStreamChunk } from '../types/index.js'

/**
 * 创建错误chunk
 * 
 * @param error - 错误对象或未知类型
 * @returns ChatStreamChunk - 错误chunk
 */
export function createErrorChunk(error: unknown): ChatStreamChunk {
  const errorMessage = error instanceof Error 
    ? error.message 
    : 'Unknown error occurred'
  
  return {
    error: errorMessage,
    done: true
  }
}