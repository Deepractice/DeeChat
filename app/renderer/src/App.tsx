import React, { useState, useEffect } from 'react'
import { ConfigProvider, Button } from 'antd'
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
  const [currentView, setCurrentView] = useState<AppView>('config') // 默认先显示配置页面
  const [hasConfigs, setHasConfigs] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleActivationResult, setRoleActivationResult] = useState<RoleActivationResponse | null>(null)
  const [chatSidebarVisible, setChatSidebarVisible] = useState(false)

  // 检查是否有AI配置
  useEffect(() => {
    checkAIConfigs()

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
        // 如果有配置且当前在配置页面，自动跳转到角色选择器
        if (currentView === 'config') {
          setCurrentView('role-selector')
        }
      } else {
        setHasConfigs(false)
        // 如果没有配置，确保停留在配置页面
        setCurrentView('config')
      }
    } catch (error) {
      console.error('检查AI配置失败:', error)
      setHasConfigs(false)
      setCurrentView('config')
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
          globalNavigation={{
            currentPage: currentView,
            onNavigateToConfig: switchToConfig,
            onNavigateToRoleSelector: switchToRoleSelector,
            onNavigateToChat: switchToChat,
            onNavigateToMcpConfig: switchToMcpConfig,
            hasConfigs,
            selectedRoleName: selectedRole?.name
          }}
        >
          {currentView === 'config' ? (
            <ConfigPage
              onConfigChange={handleConfigChange}
              onStartChat={switchToRoleSelector}
              onMcpConfig={switchToMcpConfig}
              hasConfigs={hasConfigs}
            />
          ) : currentView === 'mcp-config' ? (
            <McpConfigPage
              onBack={switchToConfig}
            />
          ) : currentView === 'role-selector' ? (
            <RoleSelector
              onRoleSelect={handleRoleSelect}
              onBack={switchToConfig}
            />
          ) : (
            <ChatPage
              onBackToConfig={switchToConfig}
              onBackToRoleSelector={switchToRoleSelector}
              selectedRole={selectedRole}
              roleActivationResult={roleActivationResult}
              sidebarVisible={chatSidebarVisible}
              onSidebarVisibleChange={setChatSidebarVisible}
            />
          )}
        </AppLayout>
      </ConfigProvider>
    </McpProvider>
  )
}

export default App