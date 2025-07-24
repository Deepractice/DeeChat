import { useEffect } from 'react'
import { Layout, message, ConfigProvider, theme } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from './store'
import { loadConfig } from './store/slices/configSlice'
import { loadChatHistory } from './store/slices/chatSlice'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import SystemRoleDebugPanel from './components/SystemRoleDebugPanel'

import './App.css'

const { Sider, Content } = Layout

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const { error: configError, config } = useSelector((state: RootState) => state.config)
  const { error: chatError } = useSelector((state: RootState) => state.chat)
  const appTheme = config.ui.theme

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
  }, [configError, chatError])

  // 根据主题设置背景色
  useEffect(() => {
    if (appTheme === 'dark') {
      document.body.style.backgroundColor = '#141414'
    } else {
      document.body.style.backgroundColor = '#fff'
    }
  }, [appTheme])

  return (
    <ConfigProvider
      theme={{
        algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <div className="app-container">
        <Layout style={{ height: '100vh' }}>
          <Sider
            width={280}
            theme={appTheme === 'dark' ? 'dark' : 'light'}
            style={{
              borderRight: appTheme === 'dark' ? '1px solid #303030' : '1px solid #f0f0f0',
              overflow: 'auto'
            }}
          >
            <Sidebar />
          </Sider>
          <Content>
            <ChatArea />
          </Content>
        </Layout>
        
        {/* 🤖 系统角色调试面板（仅开发环境） */}
        <SystemRoleDebugPanel />
      </div>
    </ConfigProvider>
  )
}

export default App
