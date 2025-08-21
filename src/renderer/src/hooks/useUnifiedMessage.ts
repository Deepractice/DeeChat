/**
 * 统一消息API Hook
 * 简化流式和非流式消息的处理，统一使用流式架构
 */

import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store'
import { 
  addUserMessage, 
  startStreamingMessage, 
  resetStreamingMessage,
  setLoading 
} from '../store/slices/chatSlice'

interface SendMessageOptions {
  sessionId: string
  configId: string
  enableMCPTools?: boolean
  chatHistory?: any[]
  activeRole?: string
  attachmentIds?: string[]
}

interface SendMessageRequest {
  content: string
  options: SendMessageOptions
}

export const useUnifiedMessage = () => {
  const dispatch = useDispatch<AppDispatch>()
  
  /**
   * 统一的消息发送方法
   * 所有消息都走流式API，简化架构复杂性
   */
  const sendMessage = async (
    content: string, 
    options: SendMessageOptions
  ) => {
    const {
      sessionId,
      configId,
      enableMCPTools = true,
      chatHistory = [],
      activeRole,
      attachmentIds = []
    } = options

    console.log('🔥 [统一消息] 开始发送消息:', {
      contentLength: content.length,
      sessionId: sessionId?.slice(0, 8),
      configId: configId?.slice(0, 8),
      enableMCPTools,
      historyCount: chatHistory.length,
      activeRole
    })

    // 🔥 启动统一流式处理
    dispatch(startStreamingMessage({ sessionId }))
    dispatch(setLoading(true))
    
    try {
      // 添加用户消息到状态（立即显示）
      dispatch(addUserMessage({
        message: content,
        attachments: attachmentIds
      }))

      // 🌊 统一使用流式API
      console.log('🚨 [DEBUG-前端] 准备调用streamMessage...');
      console.log('🚨 [DEBUG-前端] electronAPI存在:', !!window.electronAPI);
      console.log('🚨 [DEBUG-前端] electronAPI.ai存在:', !!(window.electronAPI as any)?.ai);
      console.log('🚨 [DEBUG-前端] streamMessage方法存在:', typeof (window.electronAPI as any)?.ai?.streamMessage);
      
      const requestData = {
        llmRequest: {
          message: content,
          temperature: 0.7,
          maxTokens: 2000,
          attachmentIds,
          activeRole,
          sessionId
        },
        configId,
        enableMCPTools,
        chatHistory,
        sessionId
      };
      
      console.log('🚨 [DEBUG-前端] 请求数据:', requestData);
      
      const response = await (window.electronAPI as any).ai.streamMessage(requestData);
      
      console.log('🚨 [DEBUG-前端] streamMessage调用完成，response:', response);
      
      console.log('✅ [统一消息] 流式消息发送成功:', response?.success)
      return response
      
    } catch (error) {
      console.error('❌ [统一消息] 发送失败:', error)
      
      // 🔧 错误处理：重置流式状态
      dispatch(resetStreamingMessage())
      dispatch(setLoading(false))
      
      throw error
    }
  }

  /**
   * 批量发送消息（未来扩展用）
   */
  const sendBatchMessages = async (requests: SendMessageRequest[]) => {
    const results = []
    
    for (const request of requests) {
      try {
        const result = await sendMessage(request.content, request.options)
        results.push({ success: true, data: result })
      } catch (error) {
        results.push({ success: false, error })
      }
    }
    
    return results
  }

  /**
   * 重置流式状态（用于错误恢复）
   */
  const resetStreaming = () => {
    dispatch(resetStreamingMessage())
    dispatch(setLoading(false))
  }

  return { 
    sendMessage,
    sendBatchMessages,
    resetStreaming
  }
}

export default useUnifiedMessage
