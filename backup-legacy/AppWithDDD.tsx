/**
 * App组件 - DDD架构版本
 * 🏗️ DDD重构: 支持新旧架构切换的主应用组件
 */

import { useEffect, useState } from 'react'
import { Layout, ConfigProvider, theme, App as AntdApp, Button, Alert } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { loadConfig } from '../store/slices/configSlice'
import { loadChatHistory } from '../store/slices/chatSlice'
import Sidebar from './Sidebar'
import ChatArea from './ChatArea' // 旧版组件
import SettingsPage from '../pages/SettingsPage'
import ResourcesPage from '../pages/ResourcesPage'
import WorkspaceArea from './Workspace/WorkspaceArea'
import BackendLogPanel from './BackendLogPanel'
import { useRoleStateManager } from '../hooks/useRoleStateManager'

// DDD组件导入
import { ChatAreaDDD } from '../../../presentation/components/ChatAreaDDD'
import { DDDModeManager } from '../../../presentation'
import { useDDDAdapter } from '../../../presentation/hooks/useDDDAdapter'

import './App.css'

const { Sider, Content } = Layout

type AppView = 'chat' | 'resources' | 'settings'

// 工作区状态管理
interface WorkspaceState {
  isExpanded: boolean;
  isTransitioning: boolean;
}

// DDD模式控制组件
const DDDModeToggle: React.FC<{ 
  isDDDMode: boolean; 
  onToggle: (enabled: boolean) => void;
  dddStatus: {
    isInitialized: boolean;
    isInitializing: boolean;
    error: string | null;
  }
}> = ({ isDDDMode, onToggle, dddStatus }) => {
  if (process.env.NODE_ENV !== 'development') {
    return null; // 生产环境隐藏切换按钮
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      zIndex: 9999,
      background: 'white',
      border: '1px solid #d9d9d9',
      borderRadius: '6px',
      padding: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
        架构模式: {isDDDMode ? 'DDD' : 'Legacy'}
      </div>
      
      {dddStatus.error && (
        <Alert 
          message="DDD初始化失败" 
          type="error" 
          size="small" 
          style={{ marginBottom: '4px', fontSize: '11px' }}
        />
      )}
      
      <Button 
        size="small" 
        type={isDDDMode ? 'primary' : 'default'}
        onClick={() => onToggle(!isDDDMode)}
        loading={dddStatus.isInitializing}
        disabled={!isDDDMode && !dddStatus.isInitialized && !dddStatus.error}
      >
        {isDDDMode ? '切换到Legacy' : '切换到DDD'}
      </Button>
      
      {dddStatus.isInitializing && (
        <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
          正在初始化DDD架构...
        </div>
      )}
      
      {dddStatus.isInitialized && (
        <div style={{ fontSize: '11px', color: '#52c41a', marginTop: '2px' }}>
          ✅ DDD架构已就绪
        </div>
      )}
    </div>
  )
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
  const [isDDDMode, setIsDDDMode] = useState(false)
  const { message } = AntdApp.useApp()

  // DDD适配器状态
  const { isInitialized, isInitializing, error: dddError } = useDDDAdapter()

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
    
    // 检查是否自动启用DDD模式
    const autoEnableDDD = process.env.REACT_APP_ENABLE_DDD === 'true' || 
                         process.env.NODE_ENV === 'development'
    
    if (autoEnableDDD) {
      DDDModeManager.getInstance().autoDetectMode()
      setIsDDDMode(DDDModeManager.getInstance().isDDDModeEnabled())
    }
  }, [dispatch])

  useEffect(() => {
    // 显示错误消息
    if (configError) {
      message.error(`配置错误: ${configError}`)
    }
    if (chatError) {
      message.error(`聊天错误: ${chatError}`)
    }
    if (dddError) {
      message.error(`DDD架构错误: ${dddError}`)
    }
  }, [configError, chatError, dddError, message])

  // 设置固定背景色
  useEffect(() => {
    document.body.style.backgroundColor = '#fff'
  }, [])

  // DDD模式切换处理
  const handleDDDModeToggle = (enabled: boolean) => {
    if (enabled) {
      if (!isInitialized && !dddError) {
        message.info('DDD架构正在初始化，请稍候...')
        return
      }
      if (dddError) {
        message.error('DDD架构初始化失败，无法切换')
        return
      }
      
      DDDModeManager.getInstance().enableDDDMode({ 
        debugMode: process.env.NODE_ENV === 'development',
        enablePerformanceMetrics: true
      })
      message.success('已切换到DDD架构模式')
    } else {
      DDDModeManager.getInstance().disableDDDMode()
      message.success('已切换到传统架构模式')
    }
    
    setIsDDDMode(enabled)
  }

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
      }, 150)
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
      console.log('AI文件生成请求:', prompt)
      
      // 如果工作区未展开，先展开工作区
      if (!workspaceState.isExpanded && !workspaceState.isTransitioning) {
        await toggleWorkspace(true)
      }
    } catch (error) {
      console.error('AI文件生成请求失败:', error)
      message.error('AI文件生成请求失败')
    }
  }

  // 渲染聊天区域 - 根据模式选择组件
  const renderChatArea = () => {
    const commonProps = {
      onGoToSettings: () => setCurrentView('settings'),
      onToggleWorkspace: toggleWorkspace,
      workspaceExpanded: workspaceState.isExpanded,
      workspaceTransitioning: workspaceState.isTransitioning,
      onAIFileRequest: handleAIFileRequest
    }

    // 如果启用DDD模式且DDD已初始化
    if (isDDDMode && isInitialized) {
      return <ChatAreaDDD {...commonProps} />
    }

    // 显示DDD初始化状态
    if (isDDDMode && !isInitialized) {
      return (
        <div style={{ 
          padding: '24px', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%'
        }}>
          {isInitializing ? (
            <>
              <div style={{ marginBottom: '16px' }}>🏗️ 正在初始化DDD架构...</div>
              <div style={{ color: '#666', fontSize: '14px' }}>
                首次启动可能需要几秒钟时间
              </div>
            </>
          ) : dddError ? (
            <>
              <div style={{ marginBottom: '16px', color: '#f5222d' }}>
                ❌ DDD架构初始化失败
              </div>
              <div style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                {dddError}
              </div>
              <Button 
                type="primary" 
                onClick={() => setIsDDDMode(false)}
              >
                回退到传统模式
              </Button>
            </>
          ) : null}
        </div>
      )
    }

    // 默认使用传统组件
    return <ChatArea {...commonProps} />
  }

  // 主内容区域
  const renderMainContent = () => {
    switch (currentView) {
      case 'settings':
        return <SettingsPage onBack={() => setCurrentView('chat')} />
      case 'resources':
        return <ResourcesPage onBack={() => setCurrentView('chat')} />
      default:
        return renderChatArea()
    }
  }

  return (
    <>
      {/* DDD模式切换器 */}
      <DDDModeToggle 
        isDDDMode={isDDDMode}
        onToggle={handleDDDModeToggle}
        dddStatus={{
          isInitialized,
          isInitializing, 
          error: dddError
        }}
      />

      <Layout style={{ height: '100vh' }}>
        {/* 侧边栏 */}
        <Sider 
          width={250} 
          theme="light" 
          style={{
            borderRight: '1px solid #f0f0f0',
            backgroundColor: '#fafafa'
          }}
        >
          <Sidebar 
            onViewChange={setCurrentView}
            currentView={currentView}
          />
        </Sider>

        {/* 主内容区 */}
        <Layout>
          <Content 
            style={{ 
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: workspaceState.isExpanded ? 'row' : 'column'
            }}
          >
            {/* 主要内容 */}
            <div 
              style={{ 
                flex: workspaceState.isExpanded ? '1 1 60%' : '1',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                transition: workspaceState.isTransitioning ? 'none' : 'all 0.3s ease'
              }}
            >
              {renderMainContent()}
            </div>

            {/* 工作区面板 */}
            {workspaceState.isExpanded && (
              <div 
                style={{ 
                  flex: '1 1 40%',
                  borderLeft: '1px solid #f0f0f0',
                  minWidth: '400px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <WorkspaceArea 
                  onToggleExpand={(expand) => toggleWorkspace(expand)}
                  isExpanded={workspaceState.isExpanded}
                />
              </div>
            )}
          </Content>
        </Layout>
      </Layout>

      {/* 后端日志面板 (开发模式) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '200px',
          zIndex: 1000,
          display: 'none' // 默认隐藏，可通过开发工具控制
        }}>
          <BackendLogPanel />
        </div>
      )}
    </>
  )
}

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <AntdApp>
        <AppContent />
      </AntdApp>
    </ConfigProvider>
  )
}

export default App