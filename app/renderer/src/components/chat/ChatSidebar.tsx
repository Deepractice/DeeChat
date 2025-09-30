import React from 'react'
import { Button } from 'antd'
import { PlusOutlined, ClearOutlined } from '@ant-design/icons'
import SessionList from './SessionList'
import type { ConversationSession } from '../../types/preload'

interface ChatSidebarProps {
  visible: boolean
  sessions: ConversationSession[]
  currentSession: ConversationSession | null
  loading: boolean
  onCreateSession: () => void
  onSelectSession: (session: ConversationSession) => void
  onDeleteSession: (sessionId: string) => void
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
  onDeleteAllSessions: () => void
}

/**
 * 聊天侧边栏组件
 * 负责展示会话列表和会话操作按钮
 */
const ChatSidebar: React.FC<ChatSidebarProps> = ({
  visible,
  sessions,
  currentSession,
  loading,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onUpdateSessionTitle,
  onDeleteAllSessions
}) => {
  return (
    <div style={{
      width: visible ? '280px' : '0px',
      minWidth: visible ? '280px' : '0px',
      backgroundColor: '#fafafa',
      borderRight: visible ? '1px solid #e8e8e8' : 'none',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.3s ease, min-width 0.3s ease'
    }}>
      {visible && (
        <>
          {/* 会话列表头部 */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e8e8e8',
            backgroundColor: '#fff'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={onCreateSession}
                loading={loading}
                size="large"
                title="新建会话"
                style={{
                  color: '#666',
                  fontSize: '16px'
                }}
              />
              <Button
                type="text"
                icon={<ClearOutlined />}
                onClick={async () => {
                  if (sessions.length === 0) return
                  onDeleteAllSessions()
                }}
                disabled={sessions.length === 0}
                size="large"
                title="清空所有会话"
                style={{
                  color: sessions.length > 0 ? '#666' : '#d9d9d9',
                  fontSize: '16px'
                }}
              />
            </div>
          </div>

          {/* 会话列表内容 */}
          <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#fff' }}>
            <SessionList
              sessions={sessions}
              currentSession={currentSession}
              onSelectSession={onSelectSession}
              onDeleteSession={onDeleteSession}
              onUpdateSessionTitle={onUpdateSessionTitle}
              onDeleteAllSessions={onDeleteAllSessions}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default ChatSidebar