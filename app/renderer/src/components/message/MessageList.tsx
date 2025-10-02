import React, { useEffect, useRef, useMemo } from 'react'
import { List, Spin, Avatar } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import MessageBubble from './MessageBubble'
import type { ConversationMessage } from '../../types/preload'

interface MessageListProps {
  messages: ConversationMessage[]
  loading?: boolean
  streamingMessage?: React.ReactNode  // 流式消息组件
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading = false,
  streamingMessage
}) => {
  const listRef = useRef<HTMLDivElement>(null)

  // 调试消息状态
  useEffect(() => {
    console.log('📋 MessageList接收到messages更新:', {
      messageCount: messages.length,
      messages: messages.map(m => ({ id: m.id, role: m.role, contentLength: m.content?.length || 0 }))
    })
  }, [messages])

  // 优化的自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      // 使用 RAF 确保在渲染完成后滚动
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight
        }
      })
    }
  }, [messages])

  // 使用 useMemo 优化消息渲染 - 必须在顶层调用
  const renderedMessages = useMemo(() =>
    messages.map((message, index) => (
      <MessageBubble
        key={message.id}
        message={message}
      />
    )), [messages]
  )

  return (
    <div 
      ref={listRef}
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '16px',
        background: '#fafafa'
      }}
    >
      {messages.length === 0 && !loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#999',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <img
              src="./icon.png"
              alt="DeeChat"
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                objectFit: 'cover'
              }}
            />
          </div>
          <p>开始你的AI对话之旅吧！</p>
        </div>
      ) : (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* 渲染预优化的消息列表 */}
          {renderedMessages}

          {/* 流式消息 */}
          {streamingMessage}

          {/* 加载状态 */}
          {loading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '16px',
              padding: '12px',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
              <Avatar 
                icon={<RobotOutlined />} 
                style={{ 
                  backgroundColor: '#52c41a',
                  marginRight: '12px'
                }} 
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Spin size="small" />
                <span style={{ color: '#666' }}>AI正在思考中...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MessageList