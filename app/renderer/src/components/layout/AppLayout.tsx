import React, { useState } from 'react'
import { Layout, Button, Input } from 'antd'
import { LeftOutlined, UserOutlined, SettingOutlined, MenuOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'

const { Content, Header } = Layout

// 聊天页面顶栏组件
const ChatHeader: React.FC<{
  chatActions?: {
    onUserClick?: () => void;
    onSettingsClick?: () => void;
    onSessionListClick?: () => void;
  }
  currentSession?: { title: string; id: string } | null
  sidebarVisible?: boolean
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
}> = ({ chatActions, currentSession, sidebarVisible, onUpdateSessionTitle }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')

  const handleDoubleClick = () => {
    if (currentSession && onUpdateSessionTitle) {
      setIsEditing(true)
      setEditingTitle(currentSession.title)
    }
  }

  const handleSave = async () => {
    if (currentSession && currentSession.id && editingTitle.trim()) {
      try {
        console.log('🔄 更新会话标题:', { sessionId: currentSession.id, newTitle: editingTitle.trim() })

        // 直接调用后端API
        const result = await (window as any).electronAPI.conversation.updateSessionTitle(
          currentSession.id,
          editingTitle.trim()
        )

        if (result.success) {
          console.log('✅ 会话标题更新成功')
          // 通知父组件刷新数据（如果有回调的话）
          if (onUpdateSessionTitle) {
            onUpdateSessionTitle(currentSession.id, editingTitle.trim())
          }
        } else {
          console.error('❌ 更新会话标题失败:', result.error)
        }
      } catch (error) {
        console.error('❌ 更新会话标题异常:', error)
      }
    }
    setIsEditing(false)
    setEditingTitle('')
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditingTitle('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  return (
    <Header style={{
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '56px'
    }}>
      {/* 左侧：会话列表按钮和应用名称 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Button
          type="text"
          icon={sidebarVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          onClick={chatActions?.onSessionListClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#666'
          }}
          title={sidebarVisible ? "收缩侧边栏" : "展开侧边栏"}
        />
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#2c3e50' }}>
          DeeChat
        </div>
      </div>

      {/* 中间：当前会话标题 */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 20px',
        height: '100%'
      }}>
        {currentSession ? (
          isEditing ? (
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyPress}
              style={{
                maxWidth: '400px',
                fontSize: '16px',
                fontWeight: 500,
                textAlign: 'center'
              }}
              autoFocus
            />
          ) : (
            <span
              style={{
                color: '#374151',
                fontSize: '16px',
                fontWeight: 500,
                maxWidth: '400px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background-color 0.2s'
              }}
              onDoubleClick={handleDoubleClick}
              title="双击编辑标题"
            >
              {currentSession.title}
            </span>
          )
        ) : (
          <span style={{
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            选择会话开始对话
          </span>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button
          type="text"
          icon={<UserOutlined />}
          onClick={chatActions?.onUserClick}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          角色
        </Button>
        <Button
          type="text"
          icon={<SettingOutlined />}
          onClick={chatActions?.onSettingsClick}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          设置
        </Button>
      </div>
    </Header>
  )
}

// 功能页面简单顶栏组件
const SimpleHeader: React.FC<{ title?: string; onBack: () => void }> = ({ title, onBack }) => {
  return (
    <Header style={{
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: '56px'
    }}>
      <Button
        type="text"
        icon={<LeftOutlined />}
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          marginRight: '16px'
        }}
      >
        返回
      </Button>

      {title && (
        <div style={{ fontSize: '18px', fontWeight: 500, color: '#2c3e50' }}>
          {title}
        </div>
      )}
    </Header>
  )
}

interface AppLayoutProps {
  children: React.ReactNode
  // 页面类型：chat为聊天主页，other为功能页面
  pageType?: 'chat' | 'other'
  // 功能页面的返回按钮配置
  backButton?: {
    show: boolean
    title?: string
    onBack: () => void
  }
  // 聊天页面的跳转按钮配置
  chatActions?: {
    onUserClick?: () => void
    onSettingsClick?: () => void
    onSessionListClick?: () => void
  }
  // 当前会话信息
  currentSession?: { title: string; id: string } | null
  // 侧边栏可见状态
  sidebarVisible?: boolean
  // 会话标题更新回调
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
  // 布局样式
  contentStyle?: React.CSSProperties
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  pageType = 'chat',
  backButton,
  chatActions,
  currentSession,
  sidebarVisible,
  onUpdateSessionTitle,
  contentStyle = {}
}) => {
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {/* 聊天页面：显示带操作按钮的顶栏 */}
      {pageType === 'chat' && (
        <ChatHeader
          chatActions={chatActions}
          currentSession={currentSession}
          sidebarVisible={sidebarVisible}
          onUpdateSessionTitle={onUpdateSessionTitle}
        />
      )}

      {/* 功能页面：显示简单的返回按钮顶栏 */}
      {pageType === 'other' && backButton?.show && (
        <SimpleHeader
          title={backButton.title}
          onBack={backButton.onBack}
        />
      )}

      {/* 内容区域 */}
      <Content style={{
        flex: 1,
        overflow: 'hidden',
        background: '#fff',
        ...contentStyle
      }}>
        {children}
      </Content>
    </Layout>
  )
}

export default AppLayout