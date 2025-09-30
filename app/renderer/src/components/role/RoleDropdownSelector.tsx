/**
 * RoleDropdownSelector - 角色下拉选择器（重构版）
 *
 * 职责:
 * 1. 提供下拉选择器UI
 * 2. 复用 useRoleSelector Hook
 * 3. 支持搜索和过滤
 *
 * 架构改进:
 * - 业务逻辑迁移到 useRoleSelector Hook
 * - UI 展示保持简洁清晰
 * - 代码量从 259行 减少到 ~140行
 */

import React from 'react'
import { Select, Button, Avatar, Tag, Tooltip } from 'antd'
import { RobotOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons'
import { Role, RoleActivationResponse } from '../../types/role'
import { useRoleSelector } from '../../hooks/useRoleSelector'

const { Option } = Select

export interface RoleDropdownSelectorProps {
  selectedRole?: Role | null
  onRoleSelect: (role: Role | null, activationResult?: RoleActivationResponse) => void
  disabled?: boolean
  style?: React.CSSProperties
  placeholder?: string
}

const RoleDropdownSelector: React.FC<RoleDropdownSelectorProps> = ({
  selectedRole,
  onRoleSelect,
  disabled = false,
  style,
  placeholder = '选择AI角色'
}) => {
  // ==================== 使用业务逻辑Hook ====================
  const { roles, loading, activating, refreshRoles, activateAndSelectRole, clearRoleSelection } =
    useRoleSelector({
      onRoleSelect
    })

  // ==================== 工具函数 ====================

  // 角色分类标签颜色
  const getCategoryTagColor = (category?: string) => {
    switch (category) {
      case 'system':
        return 'blue'
      case 'project':
        return 'green'
      case 'user':
        return 'purple'
      default:
        return 'default'
    }
  }

  // ==================== 事件处理 ====================

  // 处理角色选择
  const handleRoleChange = async (roleId: string | undefined) => {
    if (!roleId) {
      clearRoleSelection()
    } else {
      await activateAndSelectRole(roleId)
    }
  }

  // ==================== UI 渲染 ====================

  // 渲染角色选项
  const renderRoleOption = (role: Role) => (
    <Option key={role.id} value={role.id} label={role.name}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar
          size="small"
          icon={<RobotOutlined />}
          style={{
            backgroundColor: '#f6f8fa',
            color: '#586069',
            border: '1px solid #e1e4e8'
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 500, fontSize: '14px' }}>{role.name}</span>
            {role.category && (
              <Tag
                color={getCategoryTagColor(role.category)}
                style={{
                  fontSize: '10px',
                  margin: 0,
                  borderRadius: '4px',
                  transform: 'scale(0.85)'
                }}
              >
                {role.category}
              </Tag>
            )}
          </div>
          {role.description && (
            <div
              style={{
                fontSize: '12px',
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '300px'
              }}
            >
              {role.description}
            </div>
          )}
        </div>
      </div>
    </Option>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...style }}>
      <Select
        value={selectedRole?.id}
        onChange={handleRoleChange}
        placeholder={placeholder}
        loading={loading || activating}
        disabled={disabled}
        allowClear
        showSearch
        optionFilterProp="children"
        filterOption={(input, option: any) => {
          const role = roles.find((r) => r.id === option.value)
          if (!role) return false

          const searchText = input.toLowerCase()
          return (
            role.name.toLowerCase().includes(searchText) ||
            (role.description && role.description.toLowerCase().includes(searchText)) ||
            (role.category && role.category.toLowerCase().includes(searchText))
          )
        }}
        style={{
          minWidth: '200px',
          maxWidth: '300px',
          flex: 1
        }}
        dropdownStyle={{
          maxHeight: '400px'
        }}
        optionLabelProp="label"
        notFoundContent={
          loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <RobotOutlined style={{ fontSize: '24px', color: '#d9d9d9' }} />
              <div style={{ marginTop: '8px', color: '#666' }}>加载角色中...</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <RobotOutlined style={{ fontSize: '24px', color: '#d9d9d9' }} />
              <div style={{ marginTop: '8px', color: '#666' }}>暂无可用角色</div>
              <Button size="small" type="primary" onClick={refreshRoles} style={{ marginTop: '8px' }}>
                刷新角色
              </Button>
            </div>
          )
        }
      >
        {/* 默认选项 - 无角色 */}
        <Option value={undefined} label="默认AI助手">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{
                backgroundColor: '#f0f0f0',
                color: '#999'
              }}
            />
            <span style={{ color: '#999' }}>无角色（默认AI助手）</span>
          </div>
        </Option>

        {/* 角色列表 */}
        {roles.map(renderRoleOption)}
      </Select>

      {/* 刷新按钮 */}
      <Tooltip title="刷新角色列表">
        <Button
          icon={<ReloadOutlined />}
          onClick={refreshRoles}
          loading={loading}
          disabled={disabled}
          size="middle"
        />
      </Tooltip>
    </div>
  )
}

export default RoleDropdownSelector