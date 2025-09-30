/**
 * MessageBubble - 消息气泡容器组件（重构版）
 *
 * 职责:
 * 1. 根据消息角色分发到对应的子组件
 * 2. 提供统一的消息渲染接口
 *
 * 架构模式: 容器组件
 * - 分发逻辑: MessageBubble (当前文件)
 * - 展示组件: UserMessage, AssistantMessage, SystemMessage, ToolExecutionMessage
 * - 辅助组件: MessageTimeline
 */

import React from 'react'
import type { ConversationMessage } from '../../types/preload'
import UserMessage from './UserMessage'
import AssistantMessage from './AssistantMessage'
import SystemMessage from './SystemMessage'
import ToolExecutionMessage from './ToolExecutionMessage'
import MessageTimeline from './MessageTimeline'

// 工具执行信息类型（与ChatPage.tsx中的EmbeddedToolExecution相同）
interface EmbeddedToolExecution {
  id: string
  toolName: string
  serverId: string
  arguments?: any
  result?: any
  status: 'pending' | 'executing' | 'completed' | 'error'
  error?: string
  startTime?: number
  endTime?: number
}

interface MessageBubbleProps {
  message: ConversationMessage
}

/**
 * MessageBubble - 重构版
 * 职责：消息分发和组件组合
 * 业务逻辑已分散到各个子组件
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'
  const toolExecution = message.metadata?.toolExecution as EmbeddedToolExecution | undefined
  const timeline = message.metadata?.timeline || []

  // ==================== 系统消息 ====================
  if (isSystem) {
    return <SystemMessage content={message.content} />
  }

  // ==================== 工具执行消息 ====================
  if (isTool && toolExecution) {
    return (
      <ToolExecutionMessage
        content={message.content}
        toolExecution={toolExecution}
        timestamp={message.timestamp}
      />
    )
  }

  // ==================== 用户消息 ====================
  if (isUser) {
    return <UserMessage content={message.content} timestamp={message.timestamp} />
  }

  // ==================== AI助手消息 ====================
  // 渲染时间线内容的方法
  const renderTimelineContent = () => {
    return <MessageTimeline timeline={timeline} fallbackContent={message.content} />
  }

  return <AssistantMessage message={message} renderTimelineContent={renderTimelineContent} />
}

export default MessageBubble