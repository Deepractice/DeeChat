/**
 * 流式消息组件
 *
 * 功能：
 * 1. 专门显示流式AI消息
 * 2. 支持打字机效果
 * 3. 自动滚动和性能优化
 * 4. 支持多种状态显示
 */

import React, { forwardRef, useImperativeHandle, useMemo } from 'react'
import { Avatar, Spin } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useStreamingOptimizer } from '../../hooks/useStreamingOptimizer'
import type { ConversationMessage } from '../../types/preload'

interface StreamingMessageProps {
  messageId: string
  initialContent?: string
  onStreamStart?: () => void
  onStreamComplete?: (content: string) => void
  onError?: (error: string) => void
  scrollContainer?: React.RefObject<HTMLElement>
  className?: string
  style?: React.CSSProperties
}

export interface StreamingMessageRef {
  startStreaming: () => void
  appendContent: (chunk: string) => void
  completeStreaming: () => void
  setError: (error: string) => void
  getContent: () => string
  getStats: () => any
}

const StreamingMessage = forwardRef<StreamingMessageRef, StreamingMessageProps>(({
  messageId,
  initialContent = '',
  onStreamStart,
  onStreamComplete,
  onError,
  scrollContainer,
  className,
  style
}, ref) => {
  // 使用流式优化 Hook
  const {
    content,
    isStreaming,
    isComplete,
    error,
    startStreaming,
    appendContent,
    completeStreaming,
    setError,
    getStats
  } = useStreamingOptimizer({
    messageId,
    onStreamStart,
    onStreamComplete,
    onError,
    autoScroll: true,
    scrollContainer
  })

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    startStreaming,
    appendContent,
    completeStreaming,
    setError,
    getContent: () => content,
    getStats
  }), [startStreaming, appendContent, completeStreaming, setError, content, getStats])

  // 格式化时间
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })

    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 渲染内容（支持简单的格式化）
  const renderedContent = useMemo(() => {
    if (!content && !isStreaming) return null

    // 简单的内容处理
    const displayContent = content || initialContent

    return (
      <div className="streaming-content">
        {/* 文本内容 */}
        <div
          className="content-text"
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: '1.6',
            wordBreak: 'break-word'
          }}
        >
          {displayContent}
        </div>

        {/* 流式指示器 */}
        {isStreaming && (
          <span
            className="streaming-cursor"
            style={{
              display: 'inline-block',
              width: '2px',
              height: '16px',
              backgroundColor: '#1890ff',
              marginLeft: '2px',
              animation: 'blink 1s infinite'
            }}
          />
        )}
      </div>
    )
  }, [content, initialContent, isStreaming])

  // 如果既没有内容也没有在流式输出，不渲染
  if (!content && !isStreaming && !error) {
    return null
  }

  return (
    <>
      {/* CSS动画定义 */}
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }

          .streaming-message-container {
            transition: opacity 0.3s ease;
          }

          .streaming-message-container.streaming {
            opacity: 1;
          }

          .streaming-content {
            position: relative;
          }

          .content-text {
            min-height: 20px;
          }
        `}
      </style>

      <div
        className={`streaming-message-container ${isStreaming ? 'streaming' : ''} ${className || ''}`}
        style={{
          display: 'flex',
          flexDirection: 'row',
          marginBottom: '16px',
          alignItems: 'flex-start',
          ...style
        }}
      >
        {/* AI头像 */}
        <Avatar
          icon={<RobotOutlined />}
          style={{
            backgroundColor: '#52c41a',
            flexShrink: 0,
            marginRight: '12px'
          }}
        />

        {/* 消息内容区域 */}
        <div style={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}>
          {/* 消息气泡 */}
          <div style={{
            background: '#fff',
            color: '#333',
            padding: '12px 16px',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            wordBreak: 'break-word',
            position: 'relative',
            minHeight: isStreaming ? '40px' : 'auto'
          }}>
            {/* 错误状态 */}
            {error ? (
              <div style={{
                color: '#ff4d4f',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>❌</span>
                <span>错误: {error}</span>
              </div>
            ) : isStreaming && !content ? (
              // 等待首个chunk的状态
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#666',
                fontSize: '14px'
              }}>
                <Spin size="small" />
                <span>AI正在思考...</span>
              </div>
            ) : (
              // 正常内容
              renderedContent
            )}
          </div>

          {/* 时间戳和状态 */}
          <div style={{
            fontSize: '12px',
            color: '#999',
            marginTop: '4px',
            marginLeft: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{formatTime()}</span>

            {/* 状态指示 */}
            {isStreaming && (
              <span style={{ color: '#1890ff' }}>
                ● 流式输出中
              </span>
            )}

            {isComplete && !error && (
              <span style={{ color: '#52c41a' }}>
                ✓ 完成
              </span>
            )}

            {error && (
              <span style={{ color: '#ff4d4f' }}>
                ✗ 错误
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
})

StreamingMessage.displayName = 'StreamingMessage'

export default StreamingMessage