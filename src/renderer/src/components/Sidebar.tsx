import React, { useState } from 'react'
import {
  Button,
  List,
  Typography,
  Space,
  Modal,
  Tooltip,
  Divider,
  message,
  Switch
} from 'antd'
import {
  PlusOutlined,
  MessageOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  ToolOutlined,
  BulbOutlined,
  BulbFilled
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import {
  createNewSession,
  switchSession,
  deleteSession,
  loadChatHistory,
  switchToSessionWithConfig  // 🔥 新增：使用数据驱动的会话切换
} from '../store/slices/chatSlice'
import { updateUIConfig, saveConfig } from '../store/slices/configSlice'
import ModelManagement from '../pages/ModelManagement'
import MCPManagement from '../pages/MCPManagement'

const { Text } = Typography

const Sidebar: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { sessions, currentSession } = useSelector((state: RootState) => state.chat)
  const { config } = useSelector((state: RootState) => state.config)
  const [modelManagementVisible, setModelManagementVisible] = useState(false)
  const [mcpManagementVisible, setMcpManagementVisible] = useState(false)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)

  // 组件初始化时加载历史会话（只加载一次）
  React.useEffect(() => {
    if (!hasLoadedHistory) {
      dispatch(loadChatHistory())
      setHasLoadedHistory(true)
    }
  }, [dispatch, hasLoadedHistory])

  const handleNewChat = () => {
    dispatch(createNewSession())
  }

  const handleSessionClick = (sessionId: string) => {
    // 🔥 使用新的数据驱动会话切换
    console.log('🔄 [Sidebar] 用户点击会话:', sessionId)
    dispatch(switchToSessionWithConfig(sessionId))
  }

  // 删除会话
  const handleDeleteSession = async (sessionId: string) => {
    try {
      await dispatch(deleteSession(sessionId)).unwrap()
      message.success('会话删除成功')
    } catch (error) {
      message.error(`删除会话失败: ${error}`)
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } else {
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  // 处理主题切换
  const handleThemeChange = async (checked: boolean) => {
    const newTheme = checked ? 'dark' : 'light'
    dispatch(updateUIConfig({ theme: newTheme }))
    // 保存配置到本地
    const updatedConfig = {
      ...config,
      ui: {
        ...config.ui,
        theme: newTheme
      }
    }
    await dispatch(saveConfig(updatedConfig))
  }

  return (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部操作区 */}
      <Space direction="vertical" style={{ width: '100%', marginBottom: '16px' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={handleNewChat}
        >
          新建对话
        </Button>

        <Button
          icon={<DatabaseOutlined />}
          block
          onClick={() => setModelManagementVisible(true)}
        >
          配置管理
        </Button>

        <Button
          icon={<ToolOutlined />}
          block
          onClick={() => setMcpManagementVisible(true)}
        >
          插件市场
        </Button>
        
        {/* 主题切换 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: config.ui.theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          borderRadius: '6px'
        }}>
          <Space>
            {config.ui.theme === 'dark' ? <BulbFilled style={{ color: '#faad14' }} /> : <BulbOutlined />}
            <Text style={{ fontSize: '14px' }}>深色模式</Text>
          </Space>
          <Switch 
            checked={config.ui.theme === 'dark'}
            onChange={handleThemeChange}
            size="small"
          />
        </div>
      </Space>

      <Divider style={{ margin: '0 0 16px 0' }} />

      {/* 对话历史列表 */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Text type="secondary" style={{ fontSize: '12px', marginBottom: '8px', display: 'block' }}>
          对话历史
        </Text>
        
        <div style={{ height: '100%', overflow: 'auto' }}>
          <List
            size="small"
            dataSource={sessions}
            renderItem={(session) => (
              <List.Item
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: '6px',
                  marginBottom: '4px',
                  backgroundColor: currentSession?.id === session.id ? '#f0f8ff' : 'transparent',
                  border: currentSession?.id === session.id ? '1px solid #1890ff' : '1px solid transparent',
                }}
                onClick={() => handleSessionClick(session.id)}
                actions={[
                  <Tooltip title="删除对话" key="delete">
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        Modal.confirm({
                          title: '确认删除',
                          content: '确定要删除这个对话吗？',
                          onOk: () => {
                            handleDeleteSession(session.id)
                          },
                        })
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <List.Item.Meta
                  avatar={<MessageOutlined style={{ color: '#1890ff' }} />}
                  title={
                    <Text 
                      ellipsis={{ tooltip: session.title }} 
                      style={{ fontSize: '14px' }}
                    >
                      {session.title}
                    </Text>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatTime(session.updatedAt)}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </div>

      {/* 配置管理弹窗 */}
      <ModelManagement
        visible={modelManagementVisible}
        onClose={() => setModelManagementVisible(false)}
      />

      {/* 插件市场弹窗 */}
      <Modal
        title="插件市场"
        open={mcpManagementVisible}
        onCancel={() => setMcpManagementVisible(false)}
        footer={null}
        width="90%"
        style={{ top: 20 }}
      >
        <MCPManagement />
      </Modal>
    </div>
  )
}

export default Sidebar
