import React, { useState, useEffect } from 'react'
import { ConfigProvider } from 'antd'
import ConfigPage from './components/ConfigPage'
import ChatPage from './components/ChatPage'
import RoleSelector from './components/RoleSelector'
import { Role, RoleActivationResponse } from './types/role'

type AppView = 'config' | 'role-selector' | 'chat'

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('config') // 默认先显示配置页面
  const [hasConfigs, setHasConfigs] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleActivationResult, setRoleActivationResult] = useState<RoleActivationResponse | null>(null)

  // 检查是否有AI配置
  useEffect(() => {
    checkAIConfigs()
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
  }

  const switchToRoleSelector = () => {
    setCurrentView('role-selector')
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
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        }
      }}
    >
      {currentView === 'config' ? (
        <ConfigPage
          onConfigChange={handleConfigChange}
          onStartChat={switchToRoleSelector}
          hasConfigs={hasConfigs}
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
        />
      )}
    </ConfigProvider>
  )
}

export default App