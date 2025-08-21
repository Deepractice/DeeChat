/**
 * useStreamingMessage Hook
 * 管理AI流式消息的状态和事件监听
 */

import { useEffect, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store'
import { startStreamingMessage, addStreamUpdate, completeStreamingMessage, resetStreamingMessage, saveCurrentSession } from '../store/slices/chatSlice'

export const useStreamingMessage = () => {
  const dispatch = useDispatch<AppDispatch>()
  const handlersRef = useRef<any>(null)

  // 使用useCallback稳定事件处理器
  const handleStreamChunk = useCallback((streamUpdate: any) => {
    // 🚀 简化处理：基于StreamUpdate类型直接处理，不做数据重构
    switch(streamUpdate.type) {
      case 'thinking':
      case 'tool_calling':
        dispatch(startStreamingMessage({ sessionId: streamUpdate.sessionId || 'default' }))
        break
        
      case 'generating':
        if (streamUpdate.partialContent) {
          dispatch(addStreamUpdate(streamUpdate))
        }
        break
        
      case 'complete':
        dispatch(completeStreamingMessage({
          content: streamUpdate.content || streamUpdate.partialContent || '',
          model: streamUpdate.metadata?.model || '',
          toolExecutions: streamUpdate.toolResults || []
        }))
        
        dispatch(saveCurrentSession())
        break
        
      case 'state_machine':
        dispatch(addStreamUpdate(streamUpdate))
        break
        
      default:
        break
    }
  }, [dispatch])

  useEffect(() => {
    // 避免重复注册事件监听器
    if (handlersRef.current) return

    // 🎯 奥卡姆剃刀优化：直接使用StreamUpdate结构，减少转换
    const unsubscribeStreamChunk = window.electronAPI.ai.onStreamChunk(handleStreamChunk)

    // 🔥 保留旧版事件监听器作为兜底方案
    const unsubscribeStart = window.electronAPI.onStreamStart?.((data: { sessionId: string }) => {
      dispatch(startStreamingMessage({ sessionId: data.sessionId }))
    })

    const unsubscribeUpdate = window.electronAPI.onStreamUpdate?.((data: { sessionId: string; update: any }) => {
      dispatch(addStreamUpdate(data.update))
    })

    const unsubscribeComplete = window.electronAPI.onStreamComplete?.((data: { sessionId: string; response: any }) => {
      dispatch(completeStreamingMessage({
        content: data.response.content,
        model: data.response.model,
        toolExecutions: data.response.toolExecutions
      }))
      
      dispatch(saveCurrentSession())
    })

    // 保存处理器引用
    handlersRef.current = {
      unsubscribeStreamChunk,
      unsubscribeStart,
      unsubscribeUpdate,
      unsubscribeComplete
    }

    // 清理函数
    return () => {
      if (handlersRef.current) {
        handlersRef.current.unsubscribeStreamChunk()
        handlersRef.current.unsubscribeStart?.()
        handlersRef.current.unsubscribeUpdate?.()
        handlersRef.current.unsubscribeComplete?.()
        handlersRef.current = null
      }
    }
  }, [])

  // 提供重置流式消息状态的方法
  const resetStreaming = () => {
    dispatch(resetStreamingMessage())
  }

  return {
    resetStreaming
  }
}