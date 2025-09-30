/**
 * RoleGrid - 角色网格展示组件
 *
 * 职责: 以网格形式展示角色列表
 */

import React from 'react'
import { Row, Col } from 'antd'
import { Role } from '../../types/role'
import RoleCard from './RoleCard'

interface RoleGridProps {
  roles: Role[]
  loading?: boolean
  onRoleClick?: (role: Role) => void
}

/**
 * 角色网格组件
 */
const RoleGrid: React.FC<RoleGridProps> = ({ roles, loading = false, onRoleClick }) => {
  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        {roles.map((role) => (
          <Col xs={24} sm={12} md={8} lg={6} key={role.id}>
            <RoleCard
              role={role}
              loading={loading}
              onClick={onRoleClick}
            />
          </Col>
        ))}
      </Row>
    </div>
  )
}

export default RoleGrid