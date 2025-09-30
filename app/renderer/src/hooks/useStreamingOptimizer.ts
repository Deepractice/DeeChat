/**
 * 流式优化 Hook
 *
 * 功能：
 * 1. 封装 StreamingManager 的使用
 * 2. 处理组件生命周期
 * 3. 提供简单的 API 接口
 * 4. 自动滚动到底部
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { streamingManager, type StreamingUpdateCallback } from '../services/StreamingManager'

interface UseStreamingOptimizerOptions {
  messageId: string
  onStreamStart?: () => void
  onStreamComplete?: (content: string) => void
  onError?: (error: string) => void
  autoScroll?: boolean
  scrollContainer?: React.RefObject<HTMLElement>
}

interface StreamingControls {
  content: string
  isStreaming: boolean
  isComplete: boolean
  error?: string
  startStreaming: () => void
  appendContent: (chunk: string) => void
  completeStreaming: () => void
  setError: (error: string) => void
  forceUpdate: () => void
  getStats: () => any
}

export const useStreamingOptimizer = (options: UseStreamingOptimizerOptions): StreamingControls => {
  const {
    messageId,
    onStreamStart,
    onStreamComplete,
    onError,
    autoScroll = true,
    scrollContainer
  } = options

  // 本地状态
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState<string | undefined>()

  // 保存回调引用，避免闭包问题
  const callbacksRef = useRef({
    onStreamStart,
    onStreamComplete,
    onError
  })

  // 更新回调引用
  useEffect(() => {
    callbacksRef.current = {
      onStreamStart,
      onStreamComplete,
      onError
    }
  }, [onStreamStart, onStreamComplete, onError])

  // 自动滚动函数
  const scrollToBottom = useCallback(() => {
    if (!autoScroll || !scrollContainer?.current) return

    // 使用 RAF 确保在下一帧滚动
    requestAnimationFrame(() => {
      if (scrollContainer.current) {
        scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight
      }
    })
  }, [autoScroll, scrollContainer])

  // 防抖滚动，避免过度滚动
  const debouncedScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    scrollTimeoutRef.current = setTimeout(() => {
      scrollToBottom()
    }, 50) // 50ms 防抖
  }, [scrollToBottom])

  const scrollTimeoutRef = useRef<NodeJS.Timeout>()

  // StreamingManager 回调函数
  const streamingCallback: StreamingUpdateCallback = useCallback((
    newContent: string,
    streaming: boolean,
    complete: boolean
  ) => {
    setContent(newContent)
    setIsStreaming(streaming)
    setIsComplete(complete)

    // 自动滚动
    if (streaming) {
      debouncedScroll()
    }

    // 触发生命周期回调
    if (complete && callbacksRef.current.onStreamComplete) {
      callbacksRef.current.onStreamComplete(newContent)
    }
  }, [debouncedScroll])

  // 控制函数
  const startStreaming = useCallback(() => {
    setError(undefined)
    callbacksRef.current.onStreamStart?.()
    streamingManager.startStreaming(messageId, streamingCallback)
  }, [messageId, streamingCallback])

  const appendContent = useCallback((chunk: string) => {
    streamingManager.appendContent(messageId, chunk)
  }, [messageId])

  const completeStreaming = useCallback(() => {
    streamingManager.completeStreaming(messageId)
  }, [messageId])

  const setErrorState = useCallback((errorMsg: string) => {
    setError(errorMsg)
    setIsStreaming(false)
    setIsComplete(true)
    streamingManager.setError(messageId, errorMsg)
    callbacksRef.current.onError?.(errorMsg)
  }, [messageId])

  const forceUpdate = useCallback(() => {
    streamingManager.forceUpdate(messageId, streamingCallback)
  }, [messageId, streamingCallback])

  const getStats = useCallback(() => {
    return streamingManager.getStats()
  }, [])

  // 清理资源
  useEffect(() => {
    return () => {
      // 清理滚动定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // 清理流式管理器资源
      streamingManager.cleanup(messageId)
    }
  }, [messageId])

  // 当 messageId 变化时，重置状态
  useEffect(() => {
    setContent('')
    setIsStreaming(false)
    setIsComplete(false)
    setError(undefined)
  }, [messageId])

  return {
    content,
    isStreaming,
    isComplete,
    error,
    startStreaming,
    appendContent,
    completeStreaming,
    setError: setErrorState,
    forceUpdate,
    getStats
  }
}

/**
 * 简化版 Hook - 只处理内容更新，不处理滚动
 */
export const useStreamingContent = (messageId: string) => {
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const streamingCallback: StreamingUpdateCallback = useCallback((
    newContent: string,
    streaming: boolean
  ) => {
    setContent(newContent)
    setIsStreaming(streaming)
  }, [])

  const appendContent = useCallback((chunk: string) => {
    streamingManager.appendContent(messageId, chunk)
  }, [messageId])

  const startStreaming = useCallback(() => {
    streamingManager.startStreaming(messageId, streamingCallback)
  }, [messageId, streamingCallback])

  const completeStreaming = useCallback(() => {
    streamingManager.completeStreaming(messageId)
  }, [messageId])

  useEffect(() => {
    return () => {
      streamingManager.cleanup(messageId)
    }
  }, [messageId])

  return {
    content,
    isStreaming,
    appendContent,
    startStreaming,
    completeStreaming
  }
}

/**
 * 调试 Hook - 用于开发时监控流式状态
 */
export const useStreamingDebug = () => {
  const [stats, setStats] = useState<any>({})

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(streamingManager.getStats())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return stats
}