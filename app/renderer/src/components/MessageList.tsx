import React, { useEffect, useRef } from 'react'
import { List, Spin, Avatar } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import MessageBubble from './MessageBubble'
import type { ConversationMessage } from '../../preload'

interface MessageListProps {
  messages: ConversationMessage[]
  loading?: boolean
}

const MessageList: React.FC<MessageListProps> = ({ messages, loading = false }) => {
  const listRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

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
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>🤖</div>
          <p>开始你的AI对话之旅吧！</p>
        </div>
      ) : (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
            />
          ))}
          
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