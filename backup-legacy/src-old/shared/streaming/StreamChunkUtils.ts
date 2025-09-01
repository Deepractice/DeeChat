/**
 * 流式块工具类
 * 提供统一的块创建方法
 */

import { 
  StreamChunk,
  TextStreamChunk, 
  ToolStartChunk, 
  ToolResultChunk, 
  CompleteChunk, 
  ErrorChunk 
} from './StreamTypes'

export class StreamChunkUtils {
  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 创建基础块信息
   */
  private static createBaseChunk(sessionId: string) {
    return {
      id: this.generateId(),
      sessionId,
      timestamp: Date.now()
    }
  }

  /**
   * 创建文本块
   */
  static createTextChunk(
    content: string, 
    sessionId: string, 
    incremental: boolean = true
  ): TextStreamChunk {
    return {
      ...this.createBaseChunk(sessionId),
      type: 'text',
      content,
      incremental
    }
  }

  /**
   * 创建工具调用开始块
   */
  static createToolStartChunk(
    toolName: string,
    toolId: string,
    args: Record<string, any>,
    sessionId: string
  ): ToolStartChunk {
    return {
      ...this.createBaseChunk(sessionId),
      type: 'tool_start',
      toolName,
      toolId,
      args
    }
  }

  /**
   * 创建工具调用结果块
   */
  static createToolResultChunk(
    toolName: string,
    toolId: string,
    result: any,
    success: boolean,
    error: string | undefined,
    duration: number | undefined,
    sessionId: string
  ): ToolResultChunk {
    return {
      ...this.createBaseChunk(sessionId),
      type: 'tool_result',
      toolName,
      toolId,
      result,
      success,
      error,
      duration
    }
  }

  /**
   * 创建完成块
   */
  static createCompleteChunk(
    finalContent: string,
    toolExecutions: ToolResultChunk[],
    sessionId: string
  ): CompleteChunk {
    return {
      ...this.createBaseChunk(sessionId),
      type: 'complete',
      finalContent,
      toolExecutions
    }
  }

  /**
   * 创建错误块
   */
  static createErrorChunk(
    error: string,
    message: string,
    sessionId: string
  ): ErrorChunk {
    return {
      ...this.createBaseChunk(sessionId),
      type: 'error',
      error,
      message
    }
  }

  /**
   * 检查是否为大型内容
   */
  static isLargeContent(content: string, threshold: number = 5000): boolean {
    return content.length > threshold
  }

  /**
   * 将大型内容分块
   */
  static chunkLargeContent(
    content: string, 
    chunkSize: number = 1000
  ): string[] {
    const chunks: string[] = []
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize))
    }
    return chunks
  }
}