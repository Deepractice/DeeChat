/**
 * useStreamingMessage Hook
 * 管理AI流式消息的状态和事件监听
 */

import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store'
import { startStreamingMessage, addStreamUpdate, completeStreamingMessage, resetStreamingMessage } from '../store/slices/chatSlice'

export const useStreamingMessage = () => {
  const dispatch = useDispatch<AppDispatch>()

  useEffect(() => {
    // 监听流式消息开始事件
    const unsubscribeStart = window.electronAPI.onStreamStart((data: { sessionId: string }) => {
      console.log('🔥 [流式消息] 开始:', data)
      dispatch(startStreamingMessage({ sessionId: data.sessionId }))
    })

    // 监听流式更新事件
    const unsubscribeUpdate = window.electronAPI.onStreamUpdate((data: { sessionId: string; update: any }) => {
      console.log('📡 [流式更新]:', data.update.type, '-', data.update.stage)
      dispatch(addStreamUpdate(data.update))
    })

    // 监听流式消息完成事件
    const unsubscribeComplete = window.electronAPI.onStreamComplete((data: { sessionId: string; response: any }) => {
      console.log('✅ [流式消息] 完成:', data.response)
      dispatch(completeStreamingMessage({
        content: data.response.content,
        model: data.response.model,
        toolExecutions: data.response.toolExecutions
      }))
    })

    // 清理函数
    return () => {
      unsubscribeStart()
      unsubscribeUpdate()
      unsubscribeComplete()
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