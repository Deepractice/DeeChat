import React, { useEffect, useState } from 'react'
import { Button, Space, Typography, Avatar, Dropdown, Spin, message, MenuProps } from 'antd'
import { UserOutlined, DownOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { loadAvailableRoles, activateRole, clearRole, clearRoleError, refreshRoleCache } from '../store/slices/chatSlice'
import { ParsedRole, getSourceDisplayName } from '../utils/promptxParser'

const { Text } = Typography

interface RoleSelectorProps {
  disabled?: boolean
  style?: React.CSSProperties
  size?: 'small' | 'middle' | 'large'
}

const RoleSelector: React.FC<RoleSelectorProps> = ({
  disabled = false,
  style,
  size = 'small'
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const { roles } = useSelector((state: RootState) => state.chat)
  const [dropdownVisible, setDropdownVisible] = useState(false)

  // 组件挂载时加载角色列表
  useEffect(() => {
    // 使用Redux中的initialized标志来防止重复加载
    if (!roles.initialized && !roles.loading && !roles.error) {
      dispatch(loadAvailableRoles())
    }
  }, [dispatch, roles.initialized, roles.loading, roles.error])

  // 错误处理
  useEffect(() => {
    if (roles.error) {
      message.error(`角色操作失败: ${roles.error}`)
      dispatch(clearRoleError())
    }
  }, [roles.error, dispatch])

  // 获取来源图标和颜色
  const getSourceInfo = (source: 'system' | 'project' | 'user') => {
    const sourceMap = {
      system: {
        icon: '📦',
        color: '#1890ff',
        bgColor: '#f0f8ff',
        name: '系统角色'
      },
      project: {
        icon: '🏗️',
        color: '#52c41a',
        bgColor: '#f6ffed',
        name: '项目角色'
      },
      user: {
        icon: '👤',
        color: '#722ed1',
        bgColor: '#f9f0ff',
        name: '用户角色'
      }
    }
    return sourceMap[source] || sourceMap.system
  }

  // 处理角色选择
  const handleRoleSelect = async (role: ParsedRole) => {
    try {
      await dispatch(activateRole(role.id)).unwrap()
      setDropdownVisible(false)
      message.success(`已激活角色: ${role.name}`)
    } catch (error) {
      console.error('角色激活失败:', error)
      // 错误已通过 useEffect 处理
    }
  }

  // 处理清除角色选择
  const handleClearRole = async () => {
    try {
      await dispatch(clearRole()).unwrap()
      setDropdownVisible(false)
      message.info('已清除角色选择')
    } catch (error) {
      console.error('清除角色失败:', error)
      // 错误已通过 useEffect 处理
    }
  }

  // 处理刷新角色列表
  const handleRefreshRoles = async () => {
    try {
      dispatch(refreshRoleCache())
      await dispatch(loadAvailableRoles(true)).unwrap()
      message.success('角色列表已更新')
    } catch (error) {
      console.error('刷新角色列表失败:', error)
      // 错误已通过 useEffect 处理
    }
  }

  // 构建下拉菜单项
  const menuItems: MenuProps['items'] = [
    // 当前角色状态
    ...(roles.currentRole ? [
      {
        key: 'current-role-header',
        type: 'group' as const,
        label: '当前角色',
      },
      {
        key: 'current-role',
        label: (
          <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
            <Space>
              <span style={{ fontSize: '16px' }}>
                {getSourceInfo(roles.currentRole.source).icon}
              </span>
              <div>
                <div style={{ fontWeight: 500, color: '#262626' }}>
                  {roles.currentRole.name}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  {getSourceDisplayName(roles.currentRole.source)} · {roles.currentRole.description}
                </div>
              </div>
            </Space>
          </div>
        ),
        disabled: true,
      },
      {
        key: 'clear-role',
        label: (
          <Space>
            <ClearOutlined />
            <span>清除角色选择</span>
          </Space>
        ),
        onClick: handleClearRole,
      },
      {
        type: 'divider' as const,
      },
    ] : []),
    
    // 操作菜单
    {
      key: 'actions',
      type: 'group' as const,
      label: '操作',
    },
    {
      key: 'refresh',
      label: (
        <Space>
          <ReloadOutlined />
          <span>刷新角色列表</span>
        </Space>
      ),
      onClick: handleRefreshRoles,
    },
    {
      type: 'divider' as const,
    },
    
    // 按来源分组的角色列表
    ...(['system', 'project', 'user'] as const).map(source => {
      const sourceRoles = roles.availableRoles.filter(role => role.source === source)
      if (sourceRoles.length === 0) return null
      
      const sourceInfo = getSourceInfo(source)
      
      return [
        {
          key: `${source}-header`,
          type: 'group' as const,
          label: (
            <Space>
              <span>{sourceInfo.icon}</span>
              <span>{sourceInfo.name}</span>
              <span style={{ color: '#8c8c8c' }}>({sourceRoles.length})</span>
            </Space>
          ),
        },
        ...sourceRoles.map(role => ({
          key: role.id,
          label: (
            <div style={{ padding: '4px 0' }}>
              <div style={{ 
                fontWeight: role.isActive ? 500 : 400,
                color: role.isActive ? sourceInfo.color : '#262626'
              }}>
                {role.name}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#8c8c8c',
                marginTop: '2px'
              }}>
                {role.description}
              </div>
            </div>
          ),
          onClick: () => handleRoleSelect(role),
          disabled: role.isActive,
        })),
      ]
    }).filter(Boolean).flat(),
  ]

  // 如果没有当前角色，显示选择按钮
  if (!roles.currentRole) {
    return (
      <Dropdown
        menu={{ items: menuItems }}
        placement="bottomLeft"
        trigger={['click']}
        open={dropdownVisible}
        onOpenChange={setDropdownVisible}
        disabled={disabled}
      >
        <Button
          size={size}
          disabled={disabled}
          loading={roles.loading}
          style={{
            minWidth: 120,
            height: size === 'small' ? 32 : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size === 'small' ? 12 : undefined,
            ...style
          }}
        >
          <Space size={4}>
            <UserOutlined />
            <Text>选择角色</Text>
            <DownOutlined style={{ fontSize: '12px' }} />
          </Space>
        </Button>
      </Dropdown>
    )
  }

  // 显示当前选中的角色
  const sourceInfo = getSourceInfo(roles.currentRole.source)
  
  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomLeft"
      trigger={['click']}
      open={dropdownVisible}
      onOpenChange={setDropdownVisible}
      disabled={disabled}
    >
      <Button
        size={size}
        disabled={disabled}
        loading={roles.loading}
        style={{
          minWidth: 140,
          maxWidth: 200,
          height: size === 'small' ? 32 : undefined,
          padding: size === 'small' ? '6px 12px' : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: size === 'small' ? 12 : undefined,
          ...style
        }}
      >
        <Space size={6}>
          <Avatar
            size={size === 'small' ? 20 : 24}
            style={{
              backgroundColor: sourceInfo.bgColor,
              color: sourceInfo.color,
              border: `1px solid ${sourceInfo.color}20`,
              fontSize: size === 'small' ? '12px' : '14px'
            }}
          >
            {sourceInfo.icon}
          </Avatar>
          <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
            <div 
              style={{ 
                fontSize: size === 'small' ? '12px' : '14px', 
                fontWeight: 500, 
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '120px'
              }}
              title={roles.currentRole.name}
            >
              {roles.currentRole.name}
            </div>
            {size !== 'small' && (
              <div style={{ fontSize: '10px', color: '#999', lineHeight: 1.2 }}>
                {sourceInfo.name}
              </div>
            )}
          </div>
        </Space>
        <Space size={4}>
          <DownOutlined style={{ fontSize: '12px', color: '#999' }} />
        </Space>
      </Button>
    </Dropdown>
  )
}

export default RoleSelector