import React, { useEffect, useRef, useCallback } from 'react'
import { message } from 'antd'
import { ModelSelectorModal } from './model'
import { ChatSidebar, ChatMainContent } from './chat'
import { useChatPageLogic } from '../hooks/useChatPageLogic'
import type { StreamingMessageRef } from './message'
import type {
  ConversationSession,
  ConversationMessage
} from '../../../main/preload'
import { Role, RoleActivationResponse } from '../types/role'

interface ChatPageProps {
  onBackToConfig: () => void
  onBackToRoleSelector?: () => void
  selectedRole?: Role | null
  roleActivationResult?: RoleActivationResponse | null
  sidebarVisible?: boolean
  onSidebarVisibleChange?: (visible: boolean) => void
  onCurrentSessionChange?: (session: ConversationSession | null) => void
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
  sessionListRefreshTrigger?: number
}

/**
 * ChatPage - 重构版
 * 职责：组件组合和事件协调
 * 业务逻辑已抽取到 useChatPageLogic Hook
 */
const ChatPage: React.FC<ChatPageProps> = ({
  onBackToConfig,
  onBackToRoleSelector,
  selectedRole,
  roleActivationResult,
  sidebarVisible = false,
  onSidebarVisibleChange,
  onCurrentSessionChange,
  onUpdateSessionTitle,
  sessionListRefreshTrigger
}) => {
  // ==================== 使用业务逻辑Hook ====================
  const logic = useChatPageLogic({
    selectedRole,
    roleActivationResult,
    onCurrentSessionChange,
    onUpdateSessionTitle
  })

  // ==================== Refs ====================
  const streamingMessageRef = useRef<StreamingMessageRef>(null)
  const messageListRef = useRef<HTMLDivElement>(null)

  // 事件队列,保证按顺序处理
  const eventQueueRef = useRef<any[]>([])
  const isProcessingRef = useRef(false)
  const processQueueTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 缓存第一个chunk的内容,等待startStreaming完成后追加
  const firstChunkCacheRef = useRef<string[]>([])

  // ==================== 流式事件处理 ====================

  // 处理单个事件的核心逻辑
  const processEvent = useCallback((event: any) => {
    console.log('[DEBUG processEvent] 处理事件:', event?.type, '内容:', event.data?.content)

    // 使用 ref 来避免闭包问题
    if (!logic.currentSessionRef.current) {
      console.warn('[DEBUG processEvent] currentSessionRef is null, 跳过')
      return
    }

    console.log('🌊 流式事件:', event.type, { content: event.data?.content })

    // 工具调用处理 - 添加到timeline而不是直接return
    if (event.data?.toolExecuting) {
      console.log('🔧 工具执行中:', event.data.toolExecuting)
      logic.setIsCallingTool(true)

      // 添加工具执行项到timeline
      const toolItem = {
        id: event.data.toolExecuting.id,
        type: 'tool',
        toolExecution: {
          id: event.data.toolExecuting.id,
          toolName: event.data.toolExecuting.name,
          serverId: 'mcp', // 从工具名称推断或使用默认值
          arguments: event.data.toolExecuting.arguments,
          status: 'executing',
          startTime: event.data.toolExecuting.startTime
        }
      }

      logic.setStreamingTimeline(prev => [...prev, toolItem])
      return
    }

    if (event.data?.toolResults && event.data.toolResults.length > 0) {
      console.log('✅ 工具执行结果:', event.data.toolResults)
      logic.setIsCallingTool(false)

      // 更新timeline中的工具执行结果
      logic.setStreamingTimeline(prev => {
        const newTimeline = [...prev]
        event.data.toolResults.forEach((result: any) => {
          const toolIndex = newTimeline.findIndex(
            item => item.type === 'tool' && item.toolExecution?.id === result.tool_call_id
          )
          if (toolIndex >= 0 && newTimeline[toolIndex].toolExecution) {
            newTimeline[toolIndex].toolExecution.status = result.error ? 'error' : 'completed'
            newTimeline[toolIndex].toolExecution.result = result.result
            newTimeline[toolIndex].toolExecution.error = result.error
            newTimeline[toolIndex].toolExecution.endTime = Date.now()
          }
        })
        return newTimeline
      })
      return
    }

    if (event.data?.toolError) {
      console.error('❌ 工具执行错误:', event.data.toolError)
      logic.setIsCallingTool(false)

      // 更新timeline中的工具错误状态
      logic.setStreamingTimeline(prev => {
        const newTimeline = [...prev]
        const toolIndex = newTimeline.findIndex(
          item => item.type === 'tool' && item.toolExecution?.id === event.data.toolError.tool_call_id
        )
        if (toolIndex >= 0 && newTimeline[toolIndex].toolExecution) {
          newTimeline[toolIndex].toolExecution.status = 'error'
          newTimeline[toolIndex].toolExecution.error = event.data.toolError.error
          newTimeline[toolIndex].toolExecution.endTime = Date.now()
        }
        return newTimeline
      })
      return
    }

    // 主要事件处理
    switch (event.type) {
      case 'ai_chunk':
        if (event.data.content) {
          logic.setSendingMessage(false)

          // 如果还没有流式消息，创建一个
          if (!logic.streamingMessageId) {
            const messageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            console.log('🤖 创建流式消息ID:', { messageId })

            // 缓存第一个chunk的内容
            firstChunkCacheRef.current.push(event.data.content)
            console.log('💾 缓存第一个chunk:', event.data.content)

            // 设置流式消息ID,会触发useEffect自动调用startStreaming
            logic.setStreamingMessageId(messageId)

            // 初始化timeline，添加第一个文本项
            logic.setStreamingTimeline([{
              id: `text_${Date.now()}`,
              type: 'text',
              content: event.data.content
            }])
            return
          }

          // 已经有流式消息ID，直接追加内容
          console.log('📝 追加内容:', event.data.content)
          if (streamingMessageRef.current) {
            streamingMessageRef.current.appendContent(event.data.content)
          } else {
            console.error('❌ streamingMessageRef.current is null when appending!')
            // 如果ref还没准备好,也缓存起来
            firstChunkCacheRef.current.push(event.data.content)
          }

          // 更新timeline中的最后一个文本项，或添加新的文本项
          logic.setStreamingTimeline(prev => {
            const lastItem = prev[prev.length - 1]
            if (lastItem && lastItem.type === 'text') {
              // 合并到最后一个文本项
              const updated = [...prev]
              updated[updated.length - 1] = {
                ...lastItem,
                content: (lastItem.content || '') + event.data.content
              }
              return updated
            } else {
              // 添加新的文本项
              return [...prev, {
                id: `text_${Date.now()}`,
                type: 'text',
                content: event.data.content
              }]
            }
          })
        }

        // 检查是否完成(后端发送 done: true 标志)
        if (event.data.done) {
          console.log('✅ AI响应完成 (通过done标志)')
          console.log('📋 Timeline数据:', logic.streamingTimeline)

          // 完成流式输出
          if (streamingMessageRef.current && logic.streamingMessageId) {
            streamingMessageRef.current.completeStreaming()
          }

          // 清空流式状态和缓存
          logic.setIsCallingTool(false)
          logic.setSendingMessage(false)
          firstChunkCacheRef.current = []

          // 延迟刷新消息列表，并清空timeline
          setTimeout(() => {
            logic.loadMessages()
            logic.setStreamingMessageId(null)
            logic.setStreamingTimeline([])  // 清空timeline
          }, 500)
        }
        break

      case 'ai_complete':
        console.log('✅ AI响应完成')
        console.log('📋 Timeline数据:', logic.streamingTimeline)

        // 完成流式输出
        if (streamingMessageRef.current && logic.streamingMessageId) {
          streamingMessageRef.current.completeStreaming()
        }

        // 清空流式状态和缓存
        logic.setIsCallingTool(false)
        logic.setSendingMessage(false)
        firstChunkCacheRef.current = []

        // 延迟刷新消息列表，并清空timeline
        setTimeout(() => {
          logic.loadMessages()
          logic.setStreamingMessageId(null)
          logic.setStreamingTimeline([])  // 清空timeline
        }, 500)
        break

      case 'error':
        console.error('流式错误:', event.data.error)
        const errorMsg = event.data.error || '处理失败'
        message.error(errorMsg)

        // 设置错误状态
        if (streamingMessageRef.current) {
          streamingMessageRef.current.setError(errorMsg)
        }

        // 重置状态和清空缓存
        logic.setIsCallingTool(false)
        logic.setSendingMessage(false)
        firstChunkCacheRef.current = []

        // 延迟清理
        setTimeout(() => {
          logic.setStreamingMessageId(null)
          logic.setStreamingTimeline([])  // 清空timeline
        }, 2000)
        break

      default:
        break
    }
  }, [logic, streamingMessageRef])

  // 队列处理函数 - 确保事件按顺序处理（修复版）
  const processQueue = useCallback(() => {
    // 清除之前的定时器
    if (processQueueTimeoutRef.current) {
      clearTimeout(processQueueTimeoutRef.current)
      processQueueTimeoutRef.current = null
    }

    if (isProcessingRef.current || eventQueueRef.current.length === 0) {
      return
    }

    isProcessingRef.current = true
    const event = eventQueueRef.current.shift()

    if (event) {
      try {
        processEvent(event)
      } catch (error) {
        console.error('处理事件失败:', error)
      }
    }

    // 在下一个微任务中继续处理
    // 使用 Promise.resolve 比 setTimeout 更快，且保证顺序
    Promise.resolve().then(() => {
      isProcessingRef.current = false

      // 继续处理队列中的下一个事件
      if (eventQueueRef.current.length > 0) {
        processQueue()
      }
    })
  }, [processEvent])

  // 接收事件并加入队列
  const handleStreamEvent = useCallback((event: any) => {
    console.log('[DEBUG handleStreamEvent] 收到事件,加入队列:', event?.type, '内容:', event.data?.content)
    eventQueueRef.current.push(event)

    // 立即尝试处理队列
    if (!isProcessingRef.current) {
      processQueue()
    }
  }, [processQueue])

  const setupStreamListeners = useCallback(() => {
    console.log('🔧 设置事件监听器')

    // 先清理现有监听器
    if (window.electronAPI.removeStreamListeners) {
      window.electronAPI.removeStreamListeners()
    }

    // 实时流式事件
    window.electronAPI.onStreamEvent((data: any) => {
      console.log('📨 [DEBUG 1] 收到事件包装器调用')
      console.log('📨 [DEBUG 2] data:', JSON.stringify(data, null, 2))
      console.log('📨 [DEBUG 3] data.event:', data.event)
      console.log('📨 [DEBUG 4] event type:', data.event?.type)
      console.log('📨 [DEBUG 5] currentSessionRef.current:', logic.currentSessionRef.current)
      handleStreamEvent(data.event)
    })

    // 流式完成事件
    window.electronAPI.onStreamComplete(() => {
      logic.setSendingMessage(false)
    })

    // 流式错误事件
    window.electronAPI.onStreamError((data: any) => {
      console.error('流式处理错误:', data.error)
      logic.setSendingMessage(false)
      const errorMessage = data.error || '流式处理失败'
      message.error({
        content: (
          <div style={{ whiteSpace: 'pre-line', maxWidth: '400px', lineHeight: '1.5' }}>
            {errorMessage}
          </div>
        ),
        duration: 8
      })
    })
  }, [handleStreamEvent])  // 依赖 handleStreamEvent

  // ==================== 副作用 ====================

  // 设置流式监听器
  useEffect(() => {
    setupStreamListeners()

    return () => {
      if (window.electronAPI.removeStreamListeners) {
        window.electronAPI.removeStreamListeners()
      }
    }
  }, [setupStreamListeners])

  // 监听会话列表刷新触发器
  useEffect(() => {
    if (sessionListRefreshTrigger && sessionListRefreshTrigger > 0) {
      console.log('🔄 收到会话列表刷新信号，重新加载会话列表')
      logic.loadSessions()
    }
  }, [sessionListRefreshTrigger])

  // 监听 streamingMessageId 变化，自动启动流式输出
  useEffect(() => {
    if (logic.streamingMessageId && streamingMessageRef.current) {
      console.log('🚀 检测到新的流式消息ID,启动流式输出:', logic.streamingMessageId)
      streamingMessageRef.current.startStreaming()

      // 追加所有缓存的chunk
      if (firstChunkCacheRef.current.length > 0) {
        console.log('📦 追加缓存的chunks:', firstChunkCacheRef.current.length, '个')
        firstChunkCacheRef.current.forEach(chunk => {
          streamingMessageRef.current?.appendContent(chunk)
        })
        // 清空缓存
        firstChunkCacheRef.current = []
      }
    }
  }, [logic.streamingMessageId])

  // ==================== 渲染 ====================

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* 左侧会话列表 */}
      <ChatSidebar
        visible={sidebarVisible}
        sessions={logic.sessions}
        currentSession={logic.currentSession}
        loading={logic.loading}
        onCreateSession={logic.createNewSession}
        onSelectSession={logic.selectSession}
        onDeleteSession={logic.deleteSession}
        onUpdateSessionTitle={onUpdateSessionTitle}
        onDeleteAllSessions={logic.deleteAllSessions}
      />

      {/* 右侧主内容区域 */}
      <ChatMainContent
        currentSession={logic.currentSession}
        messages={logic.messages}
        aiConfigs={logic.aiConfigs}
        selectedConfig={logic.selectedConfig}
        availableModels={logic.availableModels}
        currentDisplayModel={logic.currentDisplayModel}
        internalSelectedRole={logic.internalSelectedRole}
        sendingMessage={logic.sendingMessage}
        loadingCurrentModel={logic.loadingCurrentModel}
        loadingModels={logic.loadingModels}
        loading={logic.loading}
        isCallingTool={logic.isCallingTool}
        streamingMessageId={logic.streamingMessageId}
        streamingTimeline={logic.streamingTimeline}
        streamingMessageRef={streamingMessageRef}
        messageListRef={messageListRef}
        toolCount={logic.tools.length}
        onConfigChange={logic.setSelectedConfig}
        onModelSelect={logic.handleModelSelect}
        onRoleSelect={logic.handleRoleSelect}
        onSendMessage={logic.sendMessage}
        onCreateSession={logic.createNewSession}
        onStreamStart={() => {
          console.log('🚀 流式输出开始')
        }}
        onStreamComplete={(content) => {
          console.log('✅ 流式输出完成:', {
            contentLength: content.length,
            messageId: logic.streamingMessageId
          })
        }}
        onStreamError={(error) => {
          console.error('❌ 流式输出错误:', error)
        }}
      />

      {/* 模型选择弹窗 */}
      <ModelSelectorModal
        visible={logic.modelSelectorVisible}
        onCancel={() => logic.setModelSelectorVisible(false)}
        onSelect={logic.handleModelSelect}
        models={logic.availableModels}
        selectedModel={logic.currentDisplayModel}
        loading={logic.loadingModels}
      />
    </div>
  )
}

export default ChatPage