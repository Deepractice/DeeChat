import React, { useState, useEffect, useRef } from 'react'
import { Select, Button, message, Avatar, Tag, Tooltip } from 'antd'
import { RobotOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons'
import { Role, RoleActivationResponse } from '../types/role'

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
  placeholder = "选择AI角色"
}) => {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [activating, setActivating] = useState(false)
  const hasLoadedRef = useRef(false)

  // 角色分类标签颜色
  const getCategoryTagColor = (category?: string) => {
    switch (category) {
      case 'system': return 'blue'
      case 'project': return 'green'
      case 'user': return 'purple'
      default: return 'default'
    }
  }

  // 加载角色列表
  const loadRoles = async () => {
    if (hasLoadedRef.current && roles.length > 0) return

    try {
      setLoading(true)
      console.log('🔄 加载角色列表...')

      const response = await (window as any).electronAPI.promptx.discover('roles')

      if (response.success && response.data && response.data.data && response.data.data.roles) {
        const roleList = response.data.data.roles
        setRoles(roleList)
        hasLoadedRef.current = true
        console.log('✅ 角色列表加载成功:', roleList.length, '个角色')
      } else {
        throw new Error(response.error || '获取角色列表失败')
      }
    } catch (error: any) {
      console.error('❌ 加载角色失败:', error)
      message.error(`加载角色失败: ${error.message}`)
      setRoles([])
    } finally {
      setLoading(false)
    }
  }

  // 刷新角色列表
  const refreshRoles = async () => {
    hasLoadedRef.current = false
    await loadRoles()
  }

  // 组件挂载时加载角色
  useEffect(() => {
    loadRoles()
  }, [])

  // 处理角色选择
  const handleRoleChange = async (roleId: string | undefined) => {
    try {
      // 如果选择的是空值（清除角色）
      if (!roleId) {
        console.log('🚫 清除角色选择')
        onRoleSelect(null)
        return
      }

      // 查找选中的角色
      const role = roles.find(r => r.id === roleId)
      if (!role) {
        message.error('角色不存在')
        return
      }

      console.log('🎭 开始激活角色:', role.name, role.id)
      setActivating(true)

      // 激活角色
      const response = await (window as any).electronAPI.promptx.action(role.id)
      console.log('🎯 角色激活响应:', response)

      if (response.success && response.data) {
        console.log('✅ 角色激活成功')
        onRoleSelect(role, response.data)
        message.success(`已切换到角色: ${role.name}`)
      } else {
        console.log('❌ 角色激活失败:', response)
        throw new Error(response.error || '角色激活失败')
      }
    } catch (error: any) {
      console.error('💥 角色激活异常:', error)
      message.error(`角色激活失败: ${error.message}`)
    } finally {
      setActivating(false)
    }
  }

  // 处理下拉框打开
  const handleDropdownVisibleChange = (open: boolean) => {
    if (open && roles.length === 0) {
      loadRoles()
    }
  }

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
            <span style={{ fontWeight: 500, fontSize: '14px' }}>
              {role.name}
            </span>
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
            <div style={{
              fontSize: '12px',
              color: '#666',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '300px'
            }}>
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
        onDropdownVisibleChange={handleDropdownVisibleChange}
        placeholder={placeholder}
        loading={loading || activating}
        disabled={disabled}
        allowClear
        showSearch
        optionFilterProp="children"
        filterOption={(input, option: any) => {
          const role = roles.find(r => r.id === option.value)
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
        // 使用自定义的选中项显示，避免文本溢出
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
              <Button
                size="small"
                type="primary"
                onClick={refreshRoles}
                style={{ marginTop: '8px' }}
              >
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