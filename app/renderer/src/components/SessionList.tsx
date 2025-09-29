import React from 'react'
import { List, Button, Typography, Popconfirm } from 'antd'
import { DeleteOutlined, MessageOutlined, ClearOutlined } from '@ant-design/icons'
import type { ConversationSession } from '../../preload'

const { Paragraph } = Typography

interface SessionListProps {
  sessions: ConversationSession[]
  currentSession: ConversationSession | null
  onSelectSession: (session: ConversationSession) => void
  onDeleteSession: (sessionId: string) => void
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
  onDeleteAllSessions?: () => void
}

const SessionList: React.FC<SessionListProps> = ({
  sessions,
  currentSession,
  onSelectSession,
  onDeleteSession,
  onUpdateSessionTitle,
  onDeleteAllSessions
}) => {

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
    <div>

      {/* 会话列表 */}
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
            transition: 'all 0.2s',
            minHeight: '80px'
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
          ].filter(Boolean)}
        >
          <List.Item.Meta
            title={
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
            }
          />
        </List.Item>
        )}
      />
    </div>
  )
}

export default SessionList