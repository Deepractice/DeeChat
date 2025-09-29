import React, { useState, useEffect } from 'react'
import { ConfigProvider, Button, message } from 'antd'
import { SettingOutlined, MessageOutlined, UserOutlined, ToolOutlined, PlusOutlined, UserSwitchOutlined, MenuOutlined } from '@ant-design/icons'
import ConfigPage from './components/ConfigPage'
import ChatPage from './components/ChatPage'
import RoleSelector from './components/RoleSelector'
import McpConfigPage from './components/McpConfigPage'
import { AppLayout } from './components/layout'
import { Role, RoleActivationResponse } from './types/role'
import { McpProvider } from './contexts/McpContext'

type AppView = 'config' | 'role-selector' | 'chat' | 'mcp-config'

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('chat') // 默认进入聊天页面
  const [hasConfigs, setHasConfigs] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleActivationResult, setRoleActivationResult] = useState<RoleActivationResponse | null>(null)
  const [chatSidebarVisible, setChatSidebarVisible] = useState(true)
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [sessionListRefreshTrigger, setSessionListRefreshTrigger] = useState(0)

  // 检查是否有AI配置
  useEffect(() => {
    checkAIConfigs()

    // 配置message全局位置为右侧边滑出
    message.config({
      top: 80, // 距离顶部的距离
      duration: 3, // 显示时长
      maxCount: 3, // 最大显示数量
      placement: 'topRight', // 右上角位置
      getContainer: () => document.body
    })

    // 监听hash变化来处理路由
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) // 去掉#号
      if (hash === 'mcp-config') {
        setCurrentView('mcp-config')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange() // 初始化时检查一次

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const checkAIConfigs = async () => {
    try {
      const result = await (window as any).electronAPI.aiConfig.getAll()
      if (result.success && result.data && result.data.length > 0) {
        setHasConfigs(true)
      } else {
        setHasConfigs(false)
      }
    } catch (error) {
      console.error('检查AI配置失败:', error)
      setHasConfigs(false)
    }
  }

  const handleConfigChange = () => {
    checkAIConfigs()
  }

  const switchToChat = () => {
    setCurrentView('chat')
  }

  const switchToConfig = () => {
    setCurrentView('config')
    window.location.hash = ''
  }

  const switchToRoleSelector = () => {
    setCurrentView('role-selector')
  }

  const switchToMcpConfig = () => {
    setCurrentView('mcp-config')
    window.location.hash = 'mcp-config'
  }

  const handleRoleSelect = (role: Role, activationResult: RoleActivationResponse) => {
    console.log('🎭 App接收角色选择:', {
      role: role.name,
      activationResult,
      hasSystemPrompt: !!activationResult?.system_prompt
    })
    setSelectedRole(role)
    setRoleActivationResult(activationResult)
    setCurrentView('chat')
  }

  const handleUpdateSessionTitle = async (sessionId: string, newTitle: string) => {
    // 简单的刷新逻辑 - 重新加载会话列表
    console.log('🔄 会话标题已更新，刷新当前会话显示和会话列表')
    if (currentSession && currentSession.id === sessionId) {
      setCurrentSession(prev => prev ? { ...prev, title: newTitle } : null)
    }
    // 触发会话列表刷新
    setSessionListRefreshTrigger(prev => prev + 1)
  }


  return (
    <McpProvider>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 8,
          }
        }}
      >
        <AppLayout
          pageType={currentView === 'chat' ? 'chat' : 'other'}
          backButton={{
            show: currentView !== 'chat',
            title: currentView === 'config' ? 'AI 配置' :
                   currentView === 'mcp-config' ? 'MCP 工具' :
                   currentView === 'role-selector' ? '选择角色' : '',
            onBack: () => {
              if (currentView === 'role-selector') {
                switchToChat() // 角色选择页面返回聊天
              } else {
                switchToChat() // 其他页面都返回聊天
              }
            }
          }}
          chatActions={{
            onUserClick: switchToRoleSelector,
            onSettingsClick: switchToConfig,
            onSessionListClick: () => setChatSidebarVisible(!chatSidebarVisible)
          }}
          currentSession={currentSession}
          sidebarVisible={chatSidebarVisible}
          onUpdateSessionTitle={handleUpdateSessionTitle}
        >
          {currentView === 'config' || currentView === 'mcp-config' ? (
            <ConfigPage
              onConfigChange={handleConfigChange}
              onStartChat={switchToRoleSelector}
              onMcpConfig={switchToMcpConfig}
              hasConfigs={hasConfigs}
              currentPage={currentView}
            />
          ) : currentView === 'role-selector' ? (
            <RoleSelector
              onRoleSelect={handleRoleSelect}
              onBack={switchToChat}
            />
          ) : (
            <ChatPage
              onBackToConfig={switchToConfig}
              onBackToRoleSelector={switchToRoleSelector}
              selectedRole={selectedRole}
              roleActivationResult={roleActivationResult}
              sidebarVisible={chatSidebarVisible}
              onSidebarVisibleChange={setChatSidebarVisible}
              onCurrentSessionChange={setCurrentSession}
              onUpdateSessionTitle={handleUpdateSessionTitle}
              sessionListRefreshTrigger={sessionListRefreshTrigger}
            />
          )}
        </AppLayout>
      </ConfigProvider>
    </McpProvider>
  )
}

export default App