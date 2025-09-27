import React, { useState, useEffect, useRef } from 'react'
import { Card, Button, Row, Col, Spin, message, Typography, Tag } from 'antd'
import { LeftOutlined, RobotOutlined } from '@ant-design/icons'
import { Role, DiscoverResponse, RoleActivationResponse, RoleSelectorProps } from '../types/role'
import '../styles/RoleSelector.css'

const { Title, Paragraph, Text } = Typography

// 角色卡片组件
const RoleCard: React.FC<{
  role: Role
  onSelect: (role: Role) => void
  loading?: boolean
}> = ({ role, onSelect, loading = false }) => {
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
      hoverable
      loading={loading}
      onClick={() => onSelect(role)}
      style={{
        borderRadius: '8px',
        border: '1px solid #e8e8e8',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }}
      styles={{
        body: { padding: '16px' }
      }}
      actions={[
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={(e) => {
            e.stopPropagation()
            onSelect(role)
          }}
          style={{
            background: '#1890ff',
            borderColor: '#1890ff',
            borderRadius: '6px'
          }}
        >
          选择角色
        </Button>
      ]}
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

// 主要角色选择器组件
const RoleSelector: React.FC<RoleSelectorProps> = ({
  onRoleSelect,
  onBack,
  loading: externalLoading = false
}) => {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState<string | null>(null)
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
          message.success(`发现 ${response.data.data.roles.length} 个可用角色`)
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
        message.success(`发现 ${response.data.data.roles.length} 个可用角色`)
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

  const handleRoleSelect = async (role: Role) => {
    try {
      console.log('🎭 开始激活角色:', role.name, role.id)
      setActivating(role.id)
      message.loading({ content: `正在激活角色 ${role.name}...`, key: 'activating' })

      const response = await (window as any).electronAPI.promptx.action(role.id)
      console.log('🎯 角色激活响应:', response)

      if (response.success && response.data) {
        console.log('✅ 角色激活成功，数据:', response.data)
        message.success({
          content: `成功激活角色 ${role.name}`,
          key: 'activating'
        })

        // 将激活结果传递给父组件
        console.log('📤 传递激活结果给父组件')
        onRoleSelect(role, response.data)
      } else {
        console.log('❌ 角色激活失败，响应:', response)
        throw new Error(response.error || '角色激活失败')
      }
    } catch (error: any) {
      console.error('💥 角色激活异常:', error)
      message.error({
        content: `角色激活失败: ${error.message}`,
        key: 'activating'
      })
    } finally {
      setActivating(null)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
      {/* 顶部栏 - 与ConfigPage风格一致 */}
      <div style={{
        background: '#ffffff',
        padding: '16px 24px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Button
            icon={<LeftOutlined />}
            onClick={onBack}
            type="text"
            style={{ marginRight: '12px' }}
          >
            返回
          </Button>
          <RobotOutlined style={{ fontSize: '20px', color: '#666', marginRight: '12px' }} />
          <Title level={4} style={{ margin: 0, color: '#2c3e50' }}>
            选择 AI 角色
          </Title>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            onClick={refreshRoles}
            loading={loading}
            style={{ borderRadius: '6px' }}
          >
            刷新角色
          </Button>
        </div>
      </div>

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
                    可用角色 ({roles.length})
                  </Title>
                  <Text style={{ color: '#6b7280', fontSize: '14px' }}>
                    选择一个角色来开始对话，每个角色都有独特的专业知识和交互方式
                  </Text>
                </div>
              </div>

              {/* 角色卡片网格 */}
              <div style={{ padding: '24px' }}>
                <Row gutter={[16, 16]}>
                  {roles.map((role) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={role.id}>
                      <RoleCard
                        role={role}
                        onSelect={handleRoleSelect}
                        loading={activating === role.id}
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