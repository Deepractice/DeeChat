import React from 'react'
import { Select, Button, Space, Typography, Popconfirm, message } from 'antd'
import { PlusOutlined, MessageOutlined, DeleteOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import {
  createNewSession,
  switchToSessionWithConfig,
  deleteSession
} from '../store/slices/chatSlice'

const { Text } = Typography

export interface ChatSessionDropdownProps {
  compact?: boolean  // 紧凑模式，用于工作区展开时
}

export const ChatSessionDropdown: React.FC<ChatSessionDropdownProps> = ({ compact = false }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { sessions, currentSession } = useSelector((state: RootState) => state.chat)

  const handleNewChat = () => {
    dispatch(createNewSession())
  }

  const handleSessionChange = (sessionId: string) => {
    dispatch(switchToSessionWithConfig(sessionId))
  }

  const handleDeleteSession = async (sessionId: string, sessionTitle: string, e?: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发选择会话
    e?.preventDefault()
    e?.stopPropagation()
    
    try {
      await dispatch(deleteSession(sessionId)).unwrap()
      message.success(`已删除对话 "${sessionTitle}"`)
    } catch (error) {
      console.error('删除会话失败:', error)
      message.error('删除对话失败')
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

  const sessionOptions = sessions.map(session => ({
    value: session.id,
    label: session.title,
    session
  }))

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center',
      gap: compact ? '8px' : '12px',
      flex: 1,
      minWidth: 0  // 防止flex子元素溢出
    }}>
      {!compact && <MessageOutlined style={{ color: '#1890ff', fontSize: '16px', flexShrink: 0 }} />}
      
      <Select
        value={currentSession?.id}
        onChange={handleSessionChange}
        style={{ 
          minWidth: compact ? 80 : 120, 
          maxWidth: compact ? 150 : 200,
          flex: 1  // 允许选择框弹性调整
        }}
        placeholder={compact ? "选择" : "选择对话"}
        dropdownStyle={{ 
          maxHeight: 400, 
          overflow: 'auto',
          minWidth: 300,
          maxWidth: 400
        }}
        showSearch
        filterOption={(input, option) => {
          const session = option?.session
          return session?.title.toLowerCase().includes(input.toLowerCase()) || false
        }}
      >
        {sessionOptions.map(option => (
          <Select.Option 
            key={option.value} 
            value={option.value}
            session={option.session}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              width: '100%',
              padding: '2px 0'
            }}>
              <div style={{ 
                flex: 1, 
                minWidth: 0, 
                paddingRight: '8px',
                fontSize: '14px', 
                fontWeight: '500',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: '20px'
              }}>
                {option.session.title}
              </div>
              <Popconfirm
                title="删除对话"
                description={`确定要删除对话 "${option.session.title}" 吗？此操作无法撤销。`}
                onConfirm={(e) => handleDeleteSession(option.session.id, option.session.title, e)}
                onCancel={(e) => { e?.preventDefault(); e?.stopPropagation() }}
                okText="确定删除"
                cancelText="取消"
                okType="danger"
                placement="topRight"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation();
                  }}
                  style={{ 
                    color: '#bfbfbf',
                    padding: '2px',
                    height: '20px',
                    width: '20px',
                    border: 'none',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => { 
                    e.currentTarget.style.color = '#ff4d4f';
                    e.currentTarget.style.backgroundColor = '#fff1f0';
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.stopPropagation();
                  }}
                  onMouseLeave={(e) => { 
                    e.currentTarget.style.color = '#bfbfbf';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.stopPropagation();
                  }}
                />
              </Popconfirm>
            </div>
          </Select.Option>
        ))}
      </Select>

      {/* 紧凑模式下隐藏对话数量文字 */}
      {!compact && (
        <Text 
          type="secondary" 
          style={{ 
            fontSize: '12px', 
            whiteSpace: 'nowrap',
            flexShrink: 0  // 防止文字被压缩
          }}
        >
          {sessions.length} 个对话
        </Text>
      )}
      
      {/* 新建按钮 - 紧凑模式下只显示图标 */}
      <Button
        type="text"
        icon={<PlusOutlined />}
        onClick={handleNewChat}
        style={{
          color: '#1890ff',
          borderColor: '#1890ff',
          flexShrink: 0,  // 防止按钮被压缩
          minWidth: compact ? '28px' : 'auto',
          padding: compact ? '4px' : '4px 8px'
        }}
        title={compact ? '新建对话' : undefined}  // 紧凑模式显示tooltip
      >
        {!compact && '新建'}
      </Button>
    </div>
  )
}

export default ChatSessionDropdown