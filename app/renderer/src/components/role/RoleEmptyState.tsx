/**
 * RoleEmptyState - 角色列表空状态组件
 *
 * 职责: 展示角色列表为空时的提示信息
 */

import React from 'react'
import { Button, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

interface RoleEmptyStateProps {
  onRefresh?: () => void
  loading?: boolean
}

/**
 * 空状态组件
 */
const RoleEmptyState: React.FC<RoleEmptyStateProps> = ({ onRefresh, loading = false }) => {
  return (
    <div style={{ textAlign: 'center', padding: '64px 0' }}>
      <RobotOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />
      <div style={{ marginTop: 16 }}>
        <Title level={4} type="secondary">暂无可用角色</Title>
        <Paragraph type="secondary">
          请检查 PromptX 配置或联系管理员
        </Paragraph>
        {onRefresh && (
          <Button
            type="primary"
            onClick={onRefresh}
            loading={loading}
            style={{
              background: '#1890ff',
              borderColor: '#1890ff',
              borderRadius: '6px'
            }}
          >
            重新加载
          </Button>
        )}
      </div>
    </div>
  )
}

export default RoleEmptyState