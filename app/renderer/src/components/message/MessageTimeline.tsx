/**
 * MessageTimeline - 消息时间线组件
 *
 * 职责:
 * 1. 渲染基于时间线的混合内容（文本 + 工具执行）
 * 2. 支持旧版混合内容解析（回退机制）
 * 3. 协调 ToolMessage 组件
 */

import React from 'react'
import ToolMessage from './ToolMessage'
import { parseMixedContent } from '../../utils/messageParser'

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

interface TimelineItem {
  id: string
  type: 'text' | 'tool'
  content?: string
  toolExecution?: EmbeddedToolExecution
}

interface MessageTimelineProps {
  timeline: TimelineItem[]
  fallbackContent?: string // 回退内容（旧版消息）
}

const MessageTimeline: React.FC<MessageTimelineProps> = ({ timeline, fallbackContent }) => {
  // 渲染基于时间线的混合内容（新方法）
  const renderTimelineContent = () => {
    if (timeline.length === 0) {
      // 如果没有时间线数据，回退到原有方式
      return fallbackContent ? renderMixedContent(fallbackContent) : null
    }

    return timeline.map((item, index) => {
      if (item.type === 'text') {
        return (
          <div key={item.id} style={{ marginBottom: index < timeline.length - 1 ? '8px' : '0' }}>
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{item.content}</span>
          </div>
        )
      } else if (item.type === 'tool' && item.toolExecution) {
        // 转换为 ToolMessage 需要的步骤格式
        // 状态映射: executing -> running
        const mappedStatus = item.toolExecution.status === 'executing' ? 'running' : item.toolExecution.status
        const toolStep = {
          id: item.toolExecution.id,
          toolName: item.toolExecution.toolName,
          serverId: item.toolExecution.serverId,
          status: mappedStatus as 'pending' | 'running' | 'completed' | 'error',
          parameters: item.toolExecution.arguments,
          result: item.toolExecution.result,
          error: item.toolExecution.error,
          startTime: item.toolExecution.startTime,
          endTime: item.toolExecution.endTime
        }

        return (
          <div key={item.id} style={{ marginBottom: index < timeline.length - 1 ? '8px' : '0' }}>
            <ToolMessage
              steps={[toolStep]}
              onCopyResult={(result) => {
                console.log('复制结果:', result)
              }}
            />
          </div>
        )
      }
      return null
    })
  }

  // 解析混合内容：包含文本和工具执行标记（旧方法，作为回退）
  const renderMixedContent = (content: string) => {
    if (!content) return null

    const parts = parseMixedContent(content)

    if (parts.length === 1 && parts[0].type === 'text') {
      // 纯文本，直接返回
      return <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{parts[0].content}</span>
    }

    return (
      <>
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <span key={`text-${index}`} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                {part.content}
              </span>
            )
          } else if (part.type === 'tool' && part.toolInfo) {
            // 状态映射: executing -> running
            const mappedStatus = part.toolInfo.status === 'executing' ? 'running' : part.toolInfo.status
            const toolStep = {
              id: part.toolInfo.id,
              toolName: part.toolInfo.toolName,
              status: mappedStatus as 'pending' | 'running' | 'completed' | 'error',
              parameters: undefined,
              result: part.toolInfo.result,
              error: part.toolInfo.error
            }

            return (
              <div key={`tool-${index}`} className="tool-inline-block">
                <ToolMessage
                  steps={[toolStep]}
                  onCopyResult={(result) => {
                    console.log('复制结果:', result)
                  }}
                />
              </div>
            )
          }
          return null
        })}
      </>
    )
  }

  return <>{renderTimelineContent()}</>
}

export default MessageTimeline