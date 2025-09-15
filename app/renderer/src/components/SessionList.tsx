import React from 'react'
import { List, Button, Typography, Popconfirm, Tag } from 'antd'
import { DeleteOutlined, MessageOutlined } from '@ant-design/icons'
import type { ConversationSession } from '../../preload'

const { Text, Paragraph } = Typography

interface SessionListProps {
  sessions: ConversationSession[]
  currentSession: ConversationSession | null
  onSelectSession: (session: ConversationSession) => void
  onDeleteSession: (sessionId: string) => void
}

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSession,
  onSelectSession,
  onDeleteSession
}) => {
  // 格式化时间
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      })
    }
  }

  if (sessions.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: '#999'
      }}>
        <MessageOutlined style={{ fontSize: '32px', marginBottom: '16px' }} />
        <p>暂无会话</p>
        <p style={{ fontSize: '12px' }}>点击上方按钮创建新会话</p>
      </div>
    )
  }

  return (
    <List
      dataSource={sessions}
      renderItem={(session) => (
        <List.Item
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '8px',
            border: currentSession?.id === session.id ? '2px solid #1890ff' : '1px solid #f0f0f0',
            background: currentSession?.id === session.id ? '#f6ffed' : '#fff',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => onSelectSession(session)}
          actions={[
            <Popconfirm
              title="确定删除这个会话吗？"
              description="删除后将无法恢复所有消息记录"
              onConfirm={(e) => {
                e?.stopPropagation()
                onDeleteSession(session.id)
              }}
              okText="删除"
              cancelText="取消"
              okType="danger"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          ]}
        >
          <List.Item.Meta
            title={
              <div style={{ marginBottom: '4px' }}>
                <Paragraph 
                  ellipsis={{ rows: 1 }}
                  style={{ 
                    margin: 0, 
                    fontWeight: currentSession?.id === session.id ? 600 : 400,
                    fontSize: '14px'
                  }}
                >
                  {session.title}
                </Paragraph>
              </div>
            }
            description={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size="small" color="blue">
                    {session.ai_config_name}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {session.message_count} 条消息
                  </Text>
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {formatTime(session.updated_at)}
                </Text>
              </div>
            }
          />
        </List.Item>
      )}
    />
  )
}

export default SessionList