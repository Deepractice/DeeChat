/**
 * useStreamingMessage Hook
 * 管理AI流式消息的状态和事件监听
 */

import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store'
import { startStreamingMessage, addStreamUpdate, completeStreamingMessage, resetStreamingMessage, saveCurrentSession } from '../store/slices/chatSlice'

export const useStreamingMessage = () => {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    // 🔥 修复：使用正确的新版流式事件 ai:streamChunk
    const unsubscribeStreamChunk = window.electronAPI.ai.onStreamChunk((data: any) => {
      console.log('🌊 [流式消息] 收到streamChunk:', data)
      
      // 根据chunk类型处理不同的流式事件
      if (data.type === 'start') {
        console.log('🔥 [流式消息] 开始:', data)
        dispatch(startStreamingMessage({ sessionId: data.sessionId || 'default' }))
      } else if (data.type === 'token' || data.type === 'content') {
        console.log('📡 [流式更新]:', data.type, '-', data.content || data.token)
        dispatch(addStreamUpdate(data))
      } else if (data.type === 'complete') {
        console.log('✅ [流式消息] 完成:', data)
        dispatch(completeStreamingMessage({
          content: data.content || '',
          model: data.model || '',
          toolExecutions: data.toolExecutions || []
        }))
        
        // 🔥 修复会话持久化问题：流式消息完成后立即保存会话
        console.log('💾 [流式消息] 自动保存会话（包含AI回复）')
        dispatch(saveCurrentSession())
      }
    })

    // 🔥 保留旧版事件监听器作为兜底方案
    const unsubscribeStart = window.electronAPI.onStreamStart?.((data: { sessionId: string }) => {
      console.log('🔥 [流式消息] 旧版开始事件:', data)
      dispatch(startStreamingMessage({ sessionId: data.sessionId }))
    })

    const unsubscribeUpdate = window.electronAPI.onStreamUpdate?.((data: { sessionId: string; update: any }) => {
      console.log('📡 [流式更新] 旧版更新事件:', data.update.type, '-', data.update.stage)
      dispatch(addStreamUpdate(data.update))
    })

    const unsubscribeComplete = window.electronAPI.onStreamComplete?.((data: { sessionId: string; response: any }) => {
      console.log('✅ [流式消息] 旧版完成事件:', data.response)
      dispatch(completeStreamingMessage({
        content: data.response.content,
        model: data.response.model,
        toolExecutions: data.response.toolExecutions
      }))
      
      // 🔥 修复会话持久化问题：旧版事件也需要保存会话
      console.log('💾 [流式消息] 旧版事件自动保存会话')
      dispatch(saveCurrentSession())
    })

    // 清理函数
    return () => {
      unsubscribeStreamChunk()
      unsubscribeStart?.()
      unsubscribeUpdate?.()
      unsubscribeComplete?.()
    }
  }, [dispatch])

  // 提供重置流式消息状态的方法
  const resetStreaming = () => {
    dispatch(resetStreamingMessage())
  }

  return {
    resetStreaming
  }
}