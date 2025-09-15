import React, { useState, useEffect } from 'react'
import { ConfigProvider } from 'antd'
import ConfigPage from './components/ConfigPage'
import ChatPage from './components/ChatPage'

type AppView = 'config' | 'chat'

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('chat')
  const [hasConfigs, setHasConfigs] = useState(false)

  // 检查是否有AI配置
  useEffect(() => {
    checkAIConfigs()
  }, [])

  const checkAIConfigs = async () => {
    try {
      const result = await window.electronAPI.aiConfig.getAll()
      if (result.success && result.data && result.data.length > 0) {
        setHasConfigs(true)
      } else {
        setHasConfigs(false)
      }
    } catch (error) {
      console.error('检查AI配置失败:', error)
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
          onStartChat={switchToChat}
          hasConfigs={hasConfigs}
        />
      ) : (
        <ChatPage 
          onBackToConfig={switchToConfig}
        />
      )}
    </ConfigProvider>
  )
}

export default App