import { useEffect } from 'react'
import { Layout, message } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from './store'
import { loadConfig } from './store/slices/configSlice'
import { loadChatHistory } from './store/slices/chatSlice'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'




import './App.css'

const { Sider, Content } = Layout

function App() {
  const dispatch = useDispatch<AppDispatch>()
  const { error: configError } = useSelector((state: RootState) => state.config)
  const { error: chatError } = useSelector((state: RootState) => state.chat)

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

  return (
    <div className="app-container">
      <Layout style={{ height: '100vh' }}>
        <Sider
          width={280}
          theme="light"
          style={{
            borderRight: '1px solid #f0f0f0',
            overflow: 'auto'
          }}
        >
          <Sidebar />
        </Sider>
        <Content>
          <ChatArea />
        </Content>
      </Layout>
    </div>
  )
}

export default App
