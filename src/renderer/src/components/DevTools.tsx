import React, { useState, useEffect } from 'react'
import { Card, Button, Space, Typography, Alert, Descriptions, Tag, Modal } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, MessageOutlined } from '@ant-design/icons'
import TestChatUI from './TestChatUI'

const { Title, Text } = Typography

interface APIStatus {
  available: boolean
  methods: string[]
  error?: string
}

/**
 * 开发工具组件
 * 用于检查Electron API的可用性和调试
 */
const DevTools: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<APIStatus>({
    available: false,
    methods: []
  })
  const [isVisible, setIsVisible] = useState(false)
  const [showTestChat, setShowTestChat] = useState(false)

  // 检查API状态
  const checkAPIStatus = () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const api = window.electronAPI
        const methods = []
        
        // 检查基础方法
        if (api.getVersion) methods.push('getVersion')
        if (api.sendMessage) methods.push('sendMessage')
        if (api.getConfig) methods.push('getConfig')
        if (api.getChatHistory) methods.push('getChatHistory')
        
        // 检查模型管理API
        if (api.model) {
          if (api.model.getAll) methods.push('model.getAll')
          if (api.model.save) methods.push('model.save')
          if (api.model.delete) methods.push('model.delete')
          if (api.model.test) methods.push('model.test')
          if (api.model.update) methods.push('model.update')
        }
        
        // 检查AI服务API
        if (api.ai) {
          if (api.ai.sendMessage) methods.push('ai.sendMessage')
          if (api.ai.testProvider) methods.push('ai.testProvider')
        }
        
        // 检查用户偏好API
        if (api.preference) {
          if (api.preference.get) methods.push('preference.get')
          if (api.preference.save) methods.push('preference.save')
        }
        
        // 检查会话管理API
        if (api.session) {
          if (api.session.getModel) methods.push('session.getModel')
          if (api.session.switchModel) methods.push('session.switchModel')
        }

        setApiStatus({
          available: true,
          methods
        })
      } else {
        setApiStatus({
          available: false,
          methods: [],
          error: 'window.electronAPI 不存在'
        })
      }
    } catch (error) {
      setApiStatus({
        available: false,
        methods: [],
        error: error instanceof Error ? error.message : '未知错误'
      })
    }
  }

  // 测试API调用
  const testAPI = async () => {
    try {
      if (window.electronAPI?.getVersion) {
        const version = await window.electronAPI.getVersion()
        console.log('应用版本:', version)
      }
      
      if (window.electronAPI?.model?.getAll) {
        const models = await window.electronAPI.model.getAll()
        console.log('模型配置:', models)
      }
    } catch (error) {
      console.error('API测试失败:', error)
    }
  }

  useEffect(() => {
    checkAPIStatus()
    
    // 在开发环境中自动显示
    if (process.env.NODE_ENV === 'development') {
      setIsVisible(true)
    }
  }, [])

  // 生产环境中不显示
  if (process.env.NODE_ENV === 'production') {
    return null
  }

  if (!isVisible) {
    return (
      <div style={{ position: 'fixed', top: 10, right: 10, zIndex: 1000 }}>
        <Button 
          size="small" 
          onClick={() => setIsVisible(true)}
          style={{ opacity: 0.7 }}
        >
          DevTools
        </Button>
      </div>
    )
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      width: 400, 
      zIndex: 1000,
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <Card 
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>开发工具</Title>
            <Button 
              size="small" 
              onClick={() => setIsVisible(false)}
              style={{ marginLeft: 'auto' }}
            >
              隐藏
            </Button>
          </Space>
        }
        size="small"
      >
        {/* API状态检查 */}
        <Alert
          message={
            <Space>
              {apiStatus.available ? (
                <>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <Text>Electron API 可用</Text>
                </>
              ) : (
                <>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  <Text>Electron API 不可用</Text>
                </>
              )}
            </Space>
          }
          description={apiStatus.error}
          type={apiStatus.available ? 'success' : 'error'}
          style={{ marginBottom: 16 }}
        />

        {/* API方法列表 */}
        <Descriptions title="可用API方法" size="small" column={1}>
          <Descriptions.Item label="总数">
            <Tag color={apiStatus.methods.length > 0 ? 'green' : 'red'}>
              {apiStatus.methods.length} 个方法
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        {apiStatus.methods.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Text strong>方法列表：</Text>
            <div style={{ marginTop: 4 }}>
              {apiStatus.methods.map(method => (
                <Tag key={method} style={{ margin: 2, fontSize: '12px' }}>
                  {method}
                </Tag>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <Space style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}>
          <Button 
            size="small" 
            icon={<ReloadOutlined />} 
            onClick={checkAPIStatus}
          >
            重新检查
          </Button>
          <Button
            size="small"
            type="primary"
            onClick={testAPI}
            disabled={!apiStatus.available}
          >
            测试API
          </Button>
          <Button
            size="small"
            icon={<MessageOutlined />}
            onClick={() => setShowTestChat(true)}
          >
            测试聊天UI
          </Button>
        </Space>

        {/* 环境信息 */}
        <Descriptions title="环境信息" size="small" column={1} style={{ marginTop: 16 }}>
          <Descriptions.Item label="NODE_ENV">
            <Tag color="blue">{process.env.NODE_ENV || 'unknown'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="用户代理">
            <Text code style={{ fontSize: 10 }}>
              {navigator.userAgent.includes('Electron') ? 'Electron' : 'Browser'}
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 测试聊天UI Modal */}
      <Modal
        title="聊天界面测试"
        open={showTestChat}
        onCancel={() => setShowTestChat(false)}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <TestChatUI />
      </Modal>
    </div>
  )
}

export default DevTools
