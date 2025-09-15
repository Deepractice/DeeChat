import React from 'react'
import { Avatar, Typography, Tag } from 'antd'
import { UserOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons'
import type { ConversationMessage } from '../../preload'

const { Text, Paragraph } = Typography

interface MessageBubbleProps {
  message: ConversationMessage
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  
  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isSystem) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '16px 0'
      }}>
        <Tag 
          icon={<SettingOutlined />}
          color="blue"
          style={{ 
            padding: '4px 12px',
            borderRadius: '16px'
          }}
        >
          系统消息: {message.content}
        </Tag>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      marginBottom: '16px',
      alignItems: 'flex-start'
    }}>
      {/* 头像 */}
      <Avatar 
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{ 
          backgroundColor: isUser ? '#1890ff' : '#52c41a',
          flexShrink: 0,
          margin: isUser ? '0 0 0 12px' : '0 12px 0 0'
        }} 
      />
      
      {/* 消息内容 */}
      <div style={{
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start'
      }}>
        {/* 消息气泡 */}
        <div style={{
          background: isUser ? '#1890ff' : '#fff',
          color: isUser ? '#fff' : '#333',
          padding: '12px 16px',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          wordBreak: 'break-word',
          position: 'relative'
        }}>
          {/* 消息内容 */}
          <div style={{ 
            whiteSpace: 'pre-wrap',
            lineHeight: '1.5'
          }}>
            {message.content}
          </div>
          
          {/* Token使用信息 */}
          {message.token_usage && (
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : '#f0f0f0'}`,
              fontSize: '12px',
              opacity: 0.8
            }}>
              Token: {message.token_usage.total_tokens} 
              (输入: {message.token_usage.prompt_tokens}, 
              输出: {message.token_usage.completion_tokens})
            </div>
          )}
        </div>
        
        {/* 时间戳 */}
        <Text 
          type="secondary" 
          style={{ 
            fontSize: '12px', 
            marginTop: '4px',
            marginLeft: isUser ? 0 : '16px',
            marginRight: isUser ? '16px' : 0
          }}
        >
          {formatTime(message.timestamp)}
        </Text>
      </div>
    </div>
  )
}

export default MessageBubble