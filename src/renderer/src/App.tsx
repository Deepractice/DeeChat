import { useEffect, useState } from 'react'
import { Layout, ConfigProvider, theme, App as AntdApp } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from './store'
import { loadConfig } from './store/slices/configSlice'
import { loadChatHistory } from './store/slices/chatSlice'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import ChatSessionPanel from './components/ChatSessionPanel'
import SettingsPage from './pages/SettingsPage'
import ResourcesPage from './pages/ResourcesPage'

import './App.css'

const { Sider, Content } = Layout

type AppView = 'chat' | 'resources' | 'settings'

const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { error: configError } = useSelector((state: RootState) => state.config)
  const { error: chatError } = useSelector((state: RootState) => state.chat)
  const [currentView, setCurrentView] = useState<AppView>('chat')
  const { message } = AntdApp.useApp()

  useEffect(() => {
    // 应用启动时加载配置和聊天历史
    dispatch(loadConfig())
    dispatch(loadChatHistory())
  }, [dispatch])

  useEffect(() => {
    // 显示错误消息
    if (configError) {
      message.error(`配置错误: ${configError}`)
    }
    if (chatError) {
      message.error(`聊天错误: ${chatError}`)
    }
  }, [configError, chatError, message])

  // 设置固定背景色
  useEffect(() => {
    document.body.style.backgroundColor = '#fff'
  }, [])

  return (
    <div className="app-container">
      <Layout style={{ height: '100vh' }}>
        {/* 主导航侧边栏 */}
        <Sider
          width={80}
          theme="dark"
          style={{
            borderRight: '1px solid #333333',
            overflow: 'auto',
            backgroundColor: '#1a1a1a'
          }}
        >
          <Sidebar 
            activeView={currentView}
            onViewChange={setCurrentView}
          />
        </Sider>
        
        {/* 动态内容区域 */}
        <Layout>
          {currentView === 'chat' && (
            <>
              {/* 聊天会话侧边栏 */}
              <Sider
                width={280}
                theme="light"
                style={{
                  borderRight: '1px solid #f0f0f0',
                  overflow: 'auto',
                  backgroundColor: '#ffffff'
                }}
              >
                <ChatSessionPanel />
              </Sider>
              <Content>
                <ChatArea onGoToSettings={() => setCurrentView('settings')} />
              </Content>
            </>
          )}
          
          {currentView === 'resources' && (
            <Content>
              <ResourcesPage />
            </Content>
          )}
          
          {currentView === 'settings' && (
            <Content>
              <SettingsPage />
            </Content>
          )}
        </Layout>
      </Layout>
    </div>
  )
}

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
