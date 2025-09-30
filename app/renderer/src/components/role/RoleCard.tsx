/**
 * RoleCard - 角色卡片展示组件
 *
 * 职责: 展示单个角色的信息
 */

import React from 'react'
import { Card, Tag, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { Role } from '../../types/role'

const { Text, Paragraph } = Typography

interface RoleCardProps {
  role: Role
  loading?: boolean
  onClick?: (role: Role) => void
}

/**
 * 获取角色分类标签颜色
 */
const getCategoryTagColor = (category?: string) => {
  switch (category) {
    case 'system': return 'blue'
    case 'project': return 'green'
    case 'user': return 'purple'
    default: return 'default'
  }
}

/**
 * 角色卡片组件
 */
const RoleCard: React.FC<RoleCardProps> = ({ role, loading = false, onClick }) => {
  return (
    <Card
      loading={loading}
      hoverable={!!onClick}
      onClick={() => onClick?.(role)}
      style={{
        borderRadius: '8px',
        border: '1px solid #e8e8e8',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        cursor: onClick ? 'pointer' : 'default'
      }}
      styles={{
        body: { padding: '16px' }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* 角色图标 */}
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
            {role.description || '暂无描述'}
          </Paragraph>
        </div>
      </div>
    </Card>
  )
}

export default RoleCard