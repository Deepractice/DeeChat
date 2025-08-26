/**
 * 统一消息API Hook
 * 简化流式和非流式消息的处理，统一使用流式架构
 * 🔧 集成角色注入机制，回归原始设计
 */

import React from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '../store'
import { 
  addUserMessage, 
  addAIMessage,
  startStreamingMessage,
  addStreamUpdate,
  completeStreamingMessage, 
  resetStreamingMessage,
  setLoading 
} from '../store/slices/chatSlice'
import { VariableInjector, VariableMap } from '../../../shared/utils/VariableInjector'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import { tokenCounter } from '../../../shared/langchain/components/TokenCounter'
import log from 'electron-log'

/**
 * 根据配置ID映射到TokenCounter支持的模型标识
 * @param configId 模型配置ID
 * @returns TokenCounter支持的模型key
 */
const getModelKeyFromConfigId = (configId: string): string => {
  // 将配置ID转换为小写，便于匹配
  const normalizedId = configId.toLowerCase()
  
  console.log(`🔍 [TokenCounter调试] 原始configId: ${configId}`)
  console.log(`🔍 [TokenCounter调试] 规范化ID: ${normalizedId}`)
  
  // Kimi/Moonshot系列 - 提前检查避免被其他条件误匹配
  if (normalizedId.includes('kimi') || normalizedId.includes('moonshot') || normalizedId.includes('k2-')) {
    console.log(`✅ [TokenCounter调试] 匹配到Kimi系列，返回 gpt-4`)
    return 'gpt-4' // Kimi的token窗口与GPT-4更相似
  }
  
  // Claude系列
  if (normalizedId.includes('claude-3-5-sonnet') || normalizedId.includes('claude-3.5-sonnet')) {
    console.log(`✅ [TokenCounter调试] 匹配到Claude 3.5 Sonnet`)
    return 'claude-3-5-sonnet'
  }
  if (normalizedId.includes('claude-3-5-haiku') || normalizedId.includes('claude-3.5-haiku')) {
    console.log(`✅ [TokenCounter调试] 匹配到Claude 3.5 Haiku`)
    return 'claude-3-5-haiku'
  }
  if (normalizedId.includes('claude')) {
    console.log(`✅ [TokenCounter调试] 匹配到Claude通用，返回 claude-3-5-sonnet`)
    return 'claude-3-5-sonnet' // Claude系列默认使用sonnet
  }
  
  // GPT系列
  if (normalizedId.includes('gpt-4o-mini')) {
    console.log(`✅ [TokenCounter调试] 匹配到GPT-4o-mini`)
    return 'gpt-4o-mini'
  }
  if (normalizedId.includes('gpt-4o')) {
    console.log(`✅ [TokenCounter调试] 匹配到GPT-4o`)
    return 'gpt-4o'
  }
  if (normalizedId.includes('gpt-4')) {
    console.log(`✅ [TokenCounter调试] 匹配到GPT-4`)
    return 'gpt-4'
  }
  if (normalizedId.includes('gpt-3.5') || normalizedId.includes('gpt-35')) {
    console.log(`✅ [TokenCounter调试] 匹配到GPT-3.5`)
    return 'gpt-3.5-turbo'
  }
  
  // Gemini系列
  if (normalizedId.includes('gemini')) {
    console.log(`✅ [TokenCounter调试] 匹配到Gemini`)
    return 'gemini-1.5-pro'
  }
  
  // 默认使用Claude 3.5 Sonnet
  console.warn(`⚠️ [TokenCounter] 未知模型配置ID: ${configId}, 使用默认模型 claude-3-5-sonnet`)
  return 'claude-3-5-sonnet'
}

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

// 🚫 移除前端角色注入逻辑 - 现在统一由后端SmartLayeredPromptSystem处理
// generateEnhancedSystemPrompt函数已移除，角色激活现在通过后端处理

// 防止重复注册监听器的全局标志
let isListenerRegistered = false

export const useUnifiedMessage = () => {
  const dispatch = useDispatch<AppDispatch>()
  
  // 🔥 新增：设置流式事件监听器（防重复注册）
  React.useEffect(() => {
    if (isListenerRegistered) {
      console.log('⚠️ [流式监听] 监听器已注册，跳过重复注册')
      return
    }
    const handleStreamChunk = (event: any, chunk: any) => {
      // console.log('🌊 [前端监听] 收到流式块:', chunk.type, chunk)
      
      // 🎯 根据chunk类型分发处理
      switch (chunk.type) {
        case 'text':
          // 文本块处理 - 添加到Redux流式状态
          dispatch(addStreamUpdate({
            type: 'text',
            content: chunk.content,
            incremental: chunk.incremental,
            sessionId: chunk.sessionId
          }))
          break
          
        case 'tool_start':
          // 工具开始块
          dispatch(addStreamUpdate({
            type: 'tool_start',
            toolName: chunk.toolName,
            toolId: chunk.toolId,
            args: chunk.args,
            sessionId: chunk.sessionId
          }))
          break
          
        case 'tool_result':
          // 工具结果块
          dispatch(addStreamUpdate({
            type: 'tool_result',
            toolName: chunk.toolName,
            toolId: chunk.toolId,
            result: chunk.result,
            success: chunk.success,
            error: chunk.error,
            duration: chunk.duration,
            sessionId: chunk.sessionId
          }))
          break
          
        case 'complete':
          // 完成块 - 结束流式状态并添加AI消息
          // 注意：completeStreamingMessage 已经会自动添加AI消息到聊天历史，不需要重复调用 addAIMessage
          dispatch(completeStreamingMessage({
            content: chunk.content,
            toolExecutions: chunk.toolExecutions || []
          }))
          break
          
        case 'error':
          // 错误块
          dispatch(resetStreamingMessage())
          console.error('❌ [流式消息] 处理错误:', chunk.error)
          break
          
        default:
          console.warn('⚠️ [流式消息] 未知chunk类型:', chunk.type)
      }
    }

    // 注册事件监听器
    if (window.electronAPI?.on) {
      window.electronAPI.on('ai:streamChunk', handleStreamChunk)
      isListenerRegistered = true
      console.log('✅ [流式监听] 流式事件监听器已注册')
    } else {
      console.error('❌ [流式监听] electronAPI.on不存在，无法注册监听器')
    }

    // 清理函数
    return () => {
      if (window.electronAPI?.removeListener && isListenerRegistered) {
        window.electronAPI.removeListener('ai:streamChunk', handleStreamChunk)
        isListenerRegistered = false
        console.log('🧹 [流式监听] 流式事件监听器已清理')
      }
    }
  }, [dispatch])
  
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
      console.log('🌊 [统一消息] 调用流式API...');
      
      // 🧠 智能maxTokens计算：使用精确的TokenCounter
      let smartMaxTokens = 4096; // 默认值
      
      // 获取模型标识
      const modelKey = getModelKeyFromConfigId(configId);
      console.log(`🧠 [TokenCounter] 配置ID: ${configId} → 模型标识: ${modelKey}`);
      
      try {
        // 使用TokenCounter进行基础的token计算（不包含systemPrompt，由后端处理）
        const userMessageResult = tokenCounter.countTokens(content, modelKey);
        
        // 计算历史消息的tokens
        let historyTokens = 0;
        for (const msg of chatHistory) {
          if (msg.content) {
            const msgResult = tokenCounter.countTokens(msg.content, modelKey);
            historyTokens += msgResult.tokens;
          }
        }
        
        // 预留系统提示词空间（由后端生成）
        const estimatedSystemTokens = 2000; // 预留空间，实际由后端计算
        const totalContextTokens = estimatedSystemTokens + userMessageResult.tokens + historyTokens;
        
        // 获取模型配置信息
        const modelConfig = tokenCounter.getModelConfig(modelKey);
        if (modelConfig) {
          // 使用模型上下文窗口的20%作为输出限制
          const maxOutputTokens = Math.floor(modelConfig.maxContextLength * 0.2);
          // 考虑当前上下文使用情况
          const availableTokens = modelConfig.maxContextLength - totalContextTokens;
          const dynamicMaxTokens = Math.floor(availableTokens * 0.8); // 留20%安全边际
          
          // 取较小值，但保证至少1024 tokens
          // 🔧 移除硬编码8192限制，让大模型（如Kimi 128k）充分利用上下文窗口
          smartMaxTokens = Math.max(1024, Math.min(maxOutputTokens, dynamicMaxTokens));
          
          console.log(`🔧 [TokenCounter调试] maxOutputTokens: ${maxOutputTokens} tokens`);
          console.log(`🔧 [TokenCounter调试] dynamicMaxTokens: ${dynamicMaxTokens} tokens`);
          
          console.log(`🧠 [TokenCounter] 用户消息: ${userMessageResult.tokens} tokens`);
          console.log(`🧠 [TokenCounter] 历史消息: ${historyTokens} tokens`);
          console.log(`🧠 [TokenCounter] 预估系统提示词: ${estimatedSystemTokens} tokens`);
          console.log(`🧠 [TokenCounter] 总上下文: ${totalContextTokens} tokens`);
          console.log(`🧠 [TokenCounter] 模型窗口: ${modelConfig.maxContextLength} tokens`);
          console.log(`🧠 [TokenCounter] 可用空间: ${availableTokens} tokens`);
          console.log(`🧠 [TokenCounter] 智能限制: ${smartMaxTokens} tokens`);
        }
      } catch (error) {
        console.warn(`⚠️ [TokenCounter] token计算失败，使用默认值:`, error);
      }
      
      const requestData = {
        llmRequest: {
          message: content,
          temperature: 0.7,
          maxTokens: smartMaxTokens,  // 🧠 使用智能计算的maxTokens
          attachmentIds,
          activeRole,  // 🎯 只传递角色ID，由后端处理角色激活
          sessionId
          // ✅ 移除systemPrompt - 现在由后端SmartLayeredPromptSystem统一生成
        },
        configId,
        enableMCPTools,
        chatHistory,
        sessionId
      };
      
      console.log('🌊 [统一消息] 请求数据准备完成, activeRole:', activeRole);
      
      // 🔥 修复：使用正确的API路径
      const response = await window.electronAPI.ai.streamMessage(requestData);
      
      // console.log('✅ [统一消息] 流式API调用成功');
      
      // console.log('✅ [统一消息] 流式消息发送成功:', response?.success)
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
