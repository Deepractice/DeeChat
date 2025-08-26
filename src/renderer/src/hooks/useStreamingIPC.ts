/**
 * 流式消息IPC监听Hook
 * 
 * 设计原则：
 * - 统一接收所有流式事件
 * - 自动路由到对应的流式处理器
 * - 简化事件处理逻辑
 */

import { useEffect, useCallback } from 'react'
import { useStreamProcessor } from '../streaming/useStreamProcessor'
import { StreamChunk } from '../../../shared/streaming/StreamTypes'
import log from 'electron-log'

export interface StreamingIPCHook {
  startListening: (sessionId: string) => void
  stopListening: () => void
}

export const useStreamingIPC = (): StreamingIPCHook => {
  const streamProcessor = useStreamProcessor({
    onComplete: (chunk) => {
      log.info('🎉 流式消息完成:', chunk)
    },
    onError: (chunk) => {
      log.error('❌ 流式消息错误:', chunk.error)
    }
  })

  // 处理流式chunk的回调
  const handleStreamChunk = useCallback((chunk: StreamChunk) => {
    log.debug('📨 收到流式chunk:', chunk.type)
    streamProcessor.processChunk(chunk)
  }, [streamProcessor])

  // 开始监听流式事件
  const startListening = useCallback((sessionId: string) => {
    log.info(`🎧 开始监听流式事件: ${sessionId}`)
    
    // 启动流处理器
    streamProcessor.startStream(sessionId)
    
    // 监听IPC事件
    window.electronAPI.onStreamChunk(handleStreamChunk)
  }, [streamProcessor, handleStreamChunk])

  // 停止监听
  const stopListening = useCallback(() => {
    log.info('🔇 停止监听流式事件')
    
    // 停止流处理器
    streamProcessor.stopStream()
    
    // 移除IPC监听器
    window.electronAPI.removeStreamChunkListener?.()
  }, [streamProcessor])

  // 组件卸载时自动清理
  useEffect(() => {
    return () => {
      stopListening()
    }
  }, [stopListening])

  return {
    startListening,
    stopListening
  }
}