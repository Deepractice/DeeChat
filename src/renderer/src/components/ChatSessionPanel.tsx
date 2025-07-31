import React, { useState, useEffect } from 'react'
import {
  Button,
  List,
  Typography,
  Space,
  Modal,
  Tooltip,
  Divider,
  message
} from 'antd'
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import {
  createNewSession,
  deleteSession,
  loadChatHistory,
  switchToSessionWithConfig
} from '../store/slices/chatSlice'

const { Text } = Typography

export const ChatSessionPanel: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { sessions, currentSession } = useSelector((state: RootState) => state.chat)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)

  // 加载聊天历史
  useEffect(() => {
    if (!hasLoadedHistory) {
      dispatch(loadChatHistory())
      setHasLoadedHistory(true)
    }
  }, [dispatch, hasLoadedHistory])

  const handleNewChat = () => {
    dispatch(createNewSession())
  }

  const handleSessionClick = (sessionId: string) => {
    dispatch(switchToSessionWithConfig(sessionId))
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await dispatch(deleteSession(sessionId)).unwrap()
      message.success('会话删除成功')
    } catch (error) {
      message.error(`删除会话失败: ${error}`)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
      {/* 新建对话按钮 */}
      <Button
        type="primary"
        icon={<PlusOutlined />}
        block
        onClick={handleNewChat}
        style={{ 
          marginBottom: '16px',
          height: '40px',
          borderRadius: '8px',
          fontWeight: '500'
        }}
      >
        新建对话
      </Button>

      <Divider style={{ margin: '0 0 16px 0' }} />

      {/* 对话历史列表 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Text type="secondary" style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
          对话历史 ({sessions.length})
        </Text>
        
        <div style={{ height: '100%', overflow: 'auto' }}>
          <List
            size="small"
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                style={{
                  padding: '12px',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  backgroundColor: currentSession?.id === session.id ? '#f0f8ff' : 'transparent',
                  border: currentSession?.id === session.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => handleSessionClick(session.id)}
                onMouseEnter={(e) => {
                  if (currentSession?.id !== session.id) {
                    e.currentTarget.style.backgroundColor = '#fafafa'
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentSession?.id !== session.id) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
                actions={[
                  <Tooltip title="删除对话" key="delete">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      style={{
                        color: '#999',
                        opacity: 0.7
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ff4d4f'
                        e.currentTarget.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#999'
                        e.currentTarget.style.opacity = '0.7'
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        Modal.confirm({
                          title: '确认删除',
                          content: '确定要删除这个对话吗？删除后无法恢复。',
                          okText: '删除',
                          okType: 'danger',
                          cancelText: '取消',
                          onOk: () => {
                            handleDeleteSession(session.id)
                          },
                        })
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      backgroundColor: currentSession?.id === session.id ? '#1890ff' : '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: currentSession?.id === session.id ? '#ffffff' : '#999'
                    }}>
                      <MessageOutlined />
                    </div>
                  }
                  title={
                    <Text 
                      ellipsis={{ tooltip: session.title }} 
                      style={{ 
                        fontSize: '14px',
                        fontWeight: currentSession?.id === session.id ? '500' : 'normal',
                        color: currentSession?.id === session.id ? '#1890ff' : '#333'
                      }}
                    >
                      {session.title}
                    </Text>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatTime(session.updatedAt)}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </div>
    </div>
  )
}

export default ChatSessionPanel