/**
 * RoleHeader - 角色管理页头部组件
 *
 * 职责: 展示角色统计信息和操作按钮
 */

import React from 'react'
import { Button, Typography } from 'antd'

const { Title, Text } = Typography

interface RoleHeaderProps {
  roleCount: number
  onRefresh?: () => void
  loading?: boolean
}

/**
 * 头部信息栏组件
 */
const RoleHeader: React.FC<RoleHeaderProps> = ({ roleCount, onRefresh, loading = false }) => {
  return (
    <div style={{
      padding: '16px 24px',
      borderBottom: '1px solid #f0f0f0',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div>
        <Title level={5} style={{ margin: 0, color: '#2c3e50' }}>
          角色库 ({roleCount})
        </Title>
        <Text style={{ color: '#6b7280', fontSize: '14px' }}>
          浏览可用的AI角色信息,每个角色都有独特的专业知识和能力特长
        </Text>
      </div>
      {onRefresh && (
        <Button
          onClick={onRefresh}
          loading={loading}
          style={{ borderRadius: '6px' }}
        >
          刷新角色
        </Button>
      )}
    </div>
  )
}

export default RoleHeader