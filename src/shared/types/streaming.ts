/**
 * DeeChat原创简化流式输出类型定义
 * 基于奥卡姆剃刀定律：简单就是美
 */

export enum StreamEventType {
  START = 'stream_start',        // 流式开始
  CHUNK = 'stream_chunk',        // 文本片段  
  COMPLETE = 'stream_complete',  // 流式完成
  ERROR = 'stream_error'         // 流式错误
}

export interface StreamEvent {
  type: StreamEventType
  sessionId: string
  content?: string      // 仅在CHUNK时有内容
  error?: string        // 仅在ERROR时有错误信息
}

/**
 * 流式回调函数类型
 * 简化版：只接收文本内容
 */
export type StreamCallback = (content: string) => void

/**
 * 流式状态
 */
export enum StreamStatus {
  IDLE = 'idle',
  STREAMING = 'streaming',
  COMPLETED = 'completed',
  ERROR = 'error'
}