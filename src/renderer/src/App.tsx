import { useEffect, useState } from 'react'
import { Layout, ConfigProvider, theme, App as AntdApp } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from './store'
import { loadConfig } from './store/slices/configSlice'
import { loadChatHistory } from './store/slices/chatSlice'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import SettingsPage from './pages/SettingsPage'
import ResourcesPage from './pages/ResourcesPage'
import WorkspaceArea from './components/Workspace/WorkspaceArea'
import { useRoleStateManager } from './hooks/useRoleStateManager'

import './App.css'

const { Sider, Content } = Layout

type AppView = 'chat' | 'resources' | 'settings'

// 工作区状态管理
interface WorkspaceState {
  isExpanded: boolean;
  isTransitioning: boolean;
}

const AppContent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { error: configError } = useSelector((state: RootState) => state.config)
  const { error: chatError } = useSelector((state: RootState) => state.chat)
  const [currentView, setCurrentView] = useState<AppView>('chat')
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    isExpanded: false,
    isTransitioning: false
  })
  const { message } = AntdApp.useApp()

  // 🎭 全局角色状态管理器 - 确保应用级别的角色状态一致性
  useRoleStateManager({
    enableAutoSync: true,        // 在应用级别启用全局同步
    enableNewSessionReset: true, // 启用新会话重置
    enableConsistencyCheck: true // 启用一致性检查
  })

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

  // 工作区切换功能
  const toggleWorkspace = async (expand: boolean) => {
    if (workspaceState.isTransitioning) return
    
    setWorkspaceState(prev => ({ ...prev, isTransitioning: true }))
    
    try {
      // 动态调整窗口大小
      if (expand) {
        await window.electronAPI.window.resize(1600, 900)
      } else {
        await window.electronAPI.window.resize(1000, 700)
      }
      
      // 延迟更新状态，确保窗口调整完成
      setTimeout(() => {
        setWorkspaceState({
          isExpanded: expand,
          isTransitioning: false
        })
      }, 150)  // 减少延迟时间，加快响应
    } catch (error) {
      console.error('窗口调整失败:', error)
      message.error('窗口调整失败')
      setWorkspaceState(prev => ({ ...prev, isTransitioning: false }))
    }
  }

  // 处理AI文件生成请求
  const handleAIFileRequest = async (prompt: string) => {
    try {
      message.info('AI文件生成功能正在开发中...')
      // 这里将来可以集成PromptX工具调用
      // 1. 如果工作区未展开，先展开工作区
      if (!workspaceState.isExpanded) {
        await toggleWorkspace(true)
      }
      // 2. 切换到聊天视图并发送AI请求
      setCurrentView('chat')
      // 3. 这里可以自动在聊天区域发送消息触发AI生成文件
    } catch (error) {
      console.error('AI文件请求失败:', error)
      message.error('AI文件请求失败')
    }
  }



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
            <Layout style={{ flexDirection: 'row' }}>
              {/* 聊天区域 */}
              <Content style={{
                width: workspaceState.isExpanded ? '30%' : '100%',
                transition: workspaceState.isTransitioning ? 'none' : 'width 0.15s ease',
                borderRight: workspaceState.isExpanded ? '1px solid #d9d9d9' : 'none'
              }}>
                <ChatArea 
                  onGoToSettings={() => setCurrentView('settings')}
                  onToggleWorkspace={toggleWorkspace}
                  workspaceExpanded={workspaceState.isExpanded}
                  workspaceTransitioning={workspaceState.isTransitioning}
                />
              </Content>
              
              {/* 工作区域 */}
              {workspaceState.isExpanded && (
                <Content style={{
                  width: '70%',
                  backgroundColor: '#f5f5f5',
                  animation: workspaceState.isTransitioning ? 'none' : 'slideInRight 0.15s ease'
                }}>
                  <WorkspaceArea onAIFileRequest={handleAIFileRequest} />
                </Content>
              )}
            </Layout>
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
