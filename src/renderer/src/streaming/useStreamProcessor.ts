/**
 * 前端流式处理Hook
 * 
 * 设计原则：
 * - 简洁API，零学习成本
 * - 高性能渲染，支持大型内容
 * - 统一状态管理
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { StreamChunk, StreamCallbacks, StreamOptions } from '../../../shared/streaming/StreamTypes'
import log from 'electron-log'

export interface StreamState {
  isStreaming: boolean
  currentContent: string
  toolExecutions: any[]
  error: string | null
}

export interface StreamProcessorHook {
  state: StreamState
  startStream: (sessionId: string, options?: Partial<StreamOptions>) => void
  processChunk: (chunk: StreamChunk) => void
  stopStream: () => void
  reset: () => void
}

/**
 * 平滑文本渲染Hook
 */
const useSmoothTextRenderer = (
  onUpdate: (text: string) => void,
  options: { chunkSize?: number; interval?: number } = {}
) => {
  const { chunkSize = 100, interval = 16 } = options
  const queueRef = useRef<string[]>([])
  const displayedTextRef = useRef<string>('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const addText = useCallback((text: string) => {
    // 将文本按字符分块
    const chars = text.split('')
    queueRef.current.push(...chars)

    // 如果没有正在渲染，开始渲染循环
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (queueRef.current.length === 0) {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
          return
        }

        // 计算本次渲染的字符数
        const renderCount = Math.min(chunkSize, queueRef.current.length)
        const textToRender = queueRef.current.splice(0, renderCount).join('')
        
        displayedTextRef.current += textToRender
        onUpdate(displayedTextRef.current)
      }, interval)
    }
  }, [chunkSize, interval, onUpdate])

  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    queueRef.current = []
    displayedTextRef.current = ''
    onUpdate('')
  }, [onUpdate])

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return { addText, reset }
}

/**
 * 主要的流式处理Hook
 */
export const useStreamProcessor = (callbacks?: Partial<StreamCallbacks>): StreamProcessorHook => {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    currentContent: '',
    toolExecutions: [],
    error: null
  })

  const sessionIdRef = useRef<string>('')
  const toolExecutionsRef = useRef<any[]>([])

  // 平滑文本渲染器
  const textRenderer = useSmoothTextRenderer(
    useCallback((text: string) => {
      setState(prev => ({ ...prev, currentContent: text }))
    }, []),
    { chunkSize: 50, interval: 16 } // 60fps
  )

  // 处理单个流式块
  const processChunk = useCallback((chunk: StreamChunk) => {
    log.debug(`🎯 [useStreamProcessor] 处理块: ${chunk.type}`, chunk)

    switch (chunk.type) {
      case 'text':
        // 使用平滑渲染器
        if (chunk.incremental) {
          textRenderer.addText(chunk.content)
        } else {
          setState(prev => ({ 
            ...prev, 
            currentContent: prev.currentContent + chunk.content 
          }))
        }
        callbacks?.onText?.(chunk)
        break

      case 'tool_start':
        log.info(`🔧 [useStreamProcessor] 工具开始: ${chunk.toolName}`)
        callbacks?.onToolStart?.(chunk)
        break

      case 'tool_result':
        // 处理分片内容
        if (chunk.result?.isPartial) {
          // 累积分片内容
          const existingTool = toolExecutionsRef.current.find(t => t.toolId === chunk.toolId)
          if (existingTool) {
            existingTool.result.content += chunk.result.content
          } else {
            toolExecutionsRef.current.push({
              toolId: chunk.toolId,
              toolName: chunk.toolName,
              result: { ...chunk.result },
              success: chunk.success
            })
          }
        } else {
          // 完整结果
          const toolExecution = {
            toolId: chunk.toolId,
            toolName: chunk.toolName,
            result: chunk.result,
            success: chunk.success,
            error: chunk.error,
            duration: chunk.duration
          }
          
          toolExecutionsRef.current.push(toolExecution)
          
          setState(prev => ({ 
            ...prev, 
            toolExecutions: [...toolExecutionsRef.current] 
          }))
        }
        
        log.info(`✅ [useStreamProcessor] 工具结果: ${chunk.toolName}`, chunk.success)
        callbacks?.onToolResult?.(chunk)
        break

      case 'complete':
        setState(prev => ({ 
          ...prev, 
          isStreaming: false,
          toolExecutions: chunk.toolExecutions || []
        }))
        log.info(`🎉 [useStreamProcessor] 流处理完成: ${chunk.sessionId}`)
        callbacks?.onComplete?.(chunk)
        break

      case 'error':
        setState(prev => ({ 
          ...prev, 
          isStreaming: false,
          error: chunk.error 
        }))
        log.error(`❌ [useStreamProcessor] 流处理错误: ${chunk.error}`)
        callbacks?.onError?.(chunk)
        break
    }
  }, [callbacks, textRenderer])

  // 开始流处理
  const startStream = useCallback((sessionId: string, options?: Partial<StreamOptions>) => {
    log.info(`🚀 [useStreamProcessor] 开始流处理: ${sessionId}`)
    
    sessionIdRef.current = sessionId
    toolExecutionsRef.current = []
    
    setState({
      isStreaming: true,
      currentContent: '',
      toolExecutions: [],
      error: null
    })
    
    textRenderer.reset()
  }, [textRenderer])

  // 停止流处理
  const stopStream = useCallback(() => {
    log.info(`⏹️ [useStreamProcessor] 停止流处理: ${sessionIdRef.current}`)
    
    setState(prev => ({ ...prev, isStreaming: false }))
  }, [])

  // 重置状态
  const reset = useCallback(() => {
    log.info(`🔄 [useStreamProcessor] 重置状态`)
    
    sessionIdRef.current = ''
    toolExecutionsRef.current = []
    
    setState({
      isStreaming: false,
      currentContent: '',
      toolExecutions: [],
      error: null
    })
    
    textRenderer.reset()
  }, [textRenderer])

  return {
    state,
    startStream,
    processChunk,
    stopStream,
    reset
  }
}