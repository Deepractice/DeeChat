/**
 * RoleManager - 角色管理容器组件 (重构版)
 *
 * 职责:
 * 1. 组件组合和布局
 * 2. 事件协调
 * 3. 通过 useRoleManager Hook 管理业务逻辑
 *
 * 架构模式: 参考 ChatPage
 * - 容器组件: RoleManager (当前文件)
 * - 业务逻辑: useRoleManager Hook
 * - 展示组件: RoleHeader, RoleGrid, RoleCard, RoleEmptyState
 */

import React from 'react'
import { Spin, Typography } from 'antd'
import { useRoleManager } from '../../hooks/useRoleManager'
import { Role, RoleActivationResponse } from '../../types/role'
import RoleHeader from './RoleHeader'
import RoleGrid from './RoleGrid'
import RoleEmptyState from './RoleEmptyState'

const { Text } = Typography

interface RoleManagerProps {
  onBack?: () => void
  onRoleSelect?: (role: Role, activationResult: RoleActivationResponse) => void
  loading?: boolean
}

/**
 * RoleManager - 重构版
 * 职责: 组件组合和事件协调
 * 业务逻辑已抽取到 useRoleManager Hook
 */
const RoleManager: React.FC<RoleManagerProps> = ({
  onBack,
  onRoleSelect,
  loading: externalLoading = false
}) => {
  // ==================== 使用业务逻辑Hook ====================
  const logic = useRoleManager({ onRoleSelect })

  // 合并加载状态
  const isLoading = logic.loading || externalLoading

  // ==================== 渲染 ====================

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
          {/* 加载状态 */}
          {isLoading && logic.roles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text style={{ color: '#6b7280' }}>正在加载角色列表...</Text>
              </div>
            </div>
          ) : logic.roles.length === 0 ? (
            /* 空状态 */
            <RoleEmptyState
              onRefresh={logic.refreshRoles}
              loading={isLoading}
            />
          ) : (
            /* 角色列表 */
            <div>
              <RoleHeader
                roleCount={logic.roles.length}
                onRefresh={logic.refreshRoles}
                loading={isLoading}
              />
              <RoleGrid
                roles={logic.roles}
                loading={isLoading}
                onRoleClick={logic.selectRole}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoleManager