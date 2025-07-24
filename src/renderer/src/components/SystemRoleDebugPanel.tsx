import React, { useState, useEffect } from 'react'
import { Card, Button, Space, Typography, Tag, message } from 'antd'
import { ReloadOutlined, BugOutlined } from '@ant-design/icons'

const { Text, Title } = Typography

interface SystemRoleStatus {
  isActive: boolean
  attempts: number
  roleId: string
}

/**
 * 系统角色调试面板
 * 仅在开发环境下显示，用于调试静默系统角色功能
 */
const SystemRoleDebugPanel: React.FC = () => {
  const [status, setStatus] = useState<SystemRoleStatus | null>(null)
  const [loading, setLoading] = useState(false)

  // 获取系统角色状态
  const fetchStatus = async () => {
    try {
      setLoading(true)
      const result = await (window as any).electronAPI?.debug?.getSystemRoleStatus?.()
      if (result?.success) {
        setStatus(result.data)
      } else {
        message.error('获取系统角色状态失败')
      }
    } catch (error) {
      console.error('获取系统角色状态失败:', error)
      message.error('获取系统角色状态失败')
    } finally {
      setLoading(false)
    }
  }

  // 重置系统角色
  const resetSystemRole = async () => {
    try {
      setLoading(true)
      const result = await (window as any).electronAPI?.debug?.resetSystemRole?.()
      if (result?.success) {
        message.success('系统角色已重置')
        await fetchStatus() // 刷新状态
      } else {
        message.error('重置系统角色失败')
      }
    } catch (error) {
      console.error('重置系统角色失败:', error)
      message.error('重置系统角色失败')
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时获取状态
  useEffect(() => {
    fetchStatus()
    
    // 每10秒自动刷新状态
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [])

  // 检查是否为开发环境
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (!isDevelopment) {
    return null // 生产环境不显示
  }

  return (
    <Card 
      size="small"
      title={
        <Space>
          <BugOutlined />
          <Title level={5} style={{ margin: 0 }}>系统角色调试</Title>
        </Space>
      }
      style={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        width: 300,
        zIndex: 1000,
        opacity: 0.9
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {status ? (
          <>
            <div>
              <Text strong>角色ID:</Text>
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {status.roleId}
              </Tag>
            </div>
            
            <div>
              <Text strong>激活状态:</Text>
              <Tag 
                color={status.isActive ? 'green' : 'red'} 
                style={{ marginLeft: 8 }}
              >
                {status.isActive ? '已激活' : '未激活'}
              </Tag>
            </div>
            
            <div>
              <Text strong>尝试次数:</Text>
              <Tag 
                color={status.attempts === 0 ? 'green' : status.attempts < 3 ? 'orange' : 'red'}
                style={{ marginLeft: 8 }}
              >
                {status.attempts}
              </Tag>
            </div>
          </>
        ) : (
          <Text type="secondary">加载中...</Text>
        )}
        
        <Space>
          <Button 
            size="small" 
            icon={<ReloadOutlined />} 
            onClick={fetchStatus}
            loading={loading}
          >
            刷新
          </Button>
          
          <Button 
            size="small" 
            onClick={resetSystemRole}
            loading={loading}
            danger
          >
            重置
          </Button>
        </Space>
      </Space>
    </Card>
  )
}

export default SystemRoleDebugPanel