import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Row, Col, Spin, message, Typography, Tag } from 'antd'
import { LeftOutlined, RobotOutlined } from '@ant-design/icons'
import { Role, DiscoverResponse, RoleActivationResponse, RoleSelectorProps } from '../types/role'
import '../styles/RoleSelector.css'

const { Title, Paragraph, Text } = Typography

// 角色卡片组件
const RoleCard: React.FC<{
  role: Role
  loading?: boolean
}> = ({ role, loading = false }) => {
  // 角色分类标签样式
  const getCategoryTagColor = (category?: string) => {
    switch (category) {
      case 'system': return 'blue'
      case 'project': return 'green'
      case 'user': return 'purple'
      default: return 'default'
    }
  }

  return (
    <Card
      loading={loading}
      style={{
        borderRadius: '8px',
        border: '1px solid #e8e8e8',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease'
      }}
      styles={{
        body: { padding: '16px' }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* 简化的图标 */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '6px',
          background: '#f6f8fa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e1e4e8',
          flexShrink: 0
        }}>
          <RobotOutlined style={{ fontSize: '18px', color: '#586069' }} />
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 标题和分类 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Text strong style={{ fontSize: '14px', color: '#2c3e50' }}>
              {role.name}
            </Text>
            {role.category && (
              <Tag
                color={getCategoryTagColor(role.category)}
                style={{
                  fontSize: '10px',
                  margin: 0,
                  borderRadius: '4px'
                }}
              >
                {role.category}
              </Tag>
            )}
          </div>

          {/* 描述 */}
          <Paragraph
            ellipsis={{ rows: 2, expandable: false }}
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#6b7280',
              lineHeight: '1.4'
            }}
          >
            {role.description}
          </Paragraph>
        </div>
      </div>
    </Card>
  )
}

// 主要角色管理器组件
const RoleSelector: React.FC<RoleSelectorProps> = ({
  onBack,
  loading: externalLoading = false
}) => {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const hasLoadedRef = useRef(false) // 使用ref防止重复加载

  // 加载角色列表 - 简化版本，移除过度的取消逻辑
  useEffect(() => {
    const loadRoles = async () => {
      if (hasLoadedRef.current) return

      try {
        setLoading(true)
        hasLoadedRef.current = true

        const response = await (window as any).electronAPI.promptx.discover('roles')

        // 检查响应数据
        if (response.success && response.data && response.data.data && response.data.data.roles) {
          setRoles(response.data.data.roles)
        } else {
          throw new Error(response.error || '获取角色列表失败')
        }
      } catch (error: any) {
        hasLoadedRef.current = false // 重置状态，允许重试
        message.error(`加载角色失败: ${error.message}`)
        setRoles([])
      } finally {
        setLoading(false)
      }
    }

    loadRoles()
  }, [])

  const refreshRoles = async () => {
    try {
      setLoading(true)
      hasLoadedRef.current = false // 允许重新加载

      const response = await (window as any).electronAPI.promptx.discover('roles')

      if (response.success && response.data && response.data.data && response.data.data.roles) {
        setRoles(response.data.data.roles)
        hasLoadedRef.current = true
      } else {
        throw new Error(response.error || '获取角色列表失败')
      }
    } catch (error: any) {
      message.error(`加载角色失败: ${error.message}`)
      setRoles([])
    } finally {
      setLoading(false)
    }
  }


  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      {/* 主内容区域 */}
      <div style={{
        flex: 1,
        padding: '24px',
        overflow: 'auto'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e8e8e8'
        }}>
          {loading || externalLoading ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text style={{ color: '#6b7280' }}>正在加载角色列表...</Text>
              </div>
            </div>
          ) : roles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <RobotOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
              <div style={{ marginTop: 16 }}>
                <Title level={4} type="secondary">暂无可用角色</Title>
                <Paragraph type="secondary">
                  请检查 PromptX 配置或联系管理员
                </Paragraph>
                <Button
                  type="primary"
                  onClick={refreshRoles}
                  style={{
                    background: '#1890ff',
                    borderColor: '#1890ff',
                    borderRadius: '6px'
                  }}
                >
                  重新加载
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* 信息栏 */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <Title level={5} style={{ margin: 0, color: '#2c3e50' }}>
                    角色库 ({roles.length})
                  </Title>
                  <Text style={{ color: '#6b7280', fontSize: '14px' }}>
                    浏览可用的AI角色信息，每个角色都有独特的专业知识和能力特长
                  </Text>
                </div>
                <Button
                  onClick={refreshRoles}
                  loading={loading}
                  style={{ borderRadius: '6px' }}
                >
                  刷新角色
                </Button>
              </div>

              {/* 角色卡片网格 */}
              <div style={{ padding: '24px' }}>
                <Row gutter={[16, 16]}>
                  {roles.map((role) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={role.id}>
                      <RoleCard
                        role={role}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoleSelector