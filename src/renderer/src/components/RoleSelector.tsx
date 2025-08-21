import React, { useEffect, useState, useRef } from 'react'
import { Button, Space, Typography, Avatar, Dropdown, Spin, App, MenuProps } from 'antd'
import { UserOutlined, DownOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { loadAvailableRoles, activateRole, clearRole, clearRoleError, refreshRoleCache } from '../store/slices/chatSlice'
import { ParsedRole, getSourceDisplayName } from '../utils/promptxParser'
import { useRoleStateManager } from '../hooks/useRoleStateManager'
import { roleContentService } from '../services/RoleContentService'

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
  const { message } = App.useApp()
  const dispatch = useDispatch<AppDispatch>()
  const { roles } = useSelector((state: RootState) => state.chat)
  const [dropdownVisible, setDropdownVisible] = useState(false)
  
  // 防抖：避免频繁刷新
  const REFRESH_DEBOUNCE_TIME = 5000 // 5秒内不重复刷新
  const lastRefreshTimeRef = useRef(0)
  
  // 处理下拉框打开/关闭，打开时自动刷新角色列表
  const handleDropdownChange = (open: boolean) => {
    setDropdownVisible(open)
    
    if (open && !roles.loading) {
      const now = Date.now()
      const timeSinceLastRefresh = now - lastRefreshTimeRef.current
      
      if (timeSinceLastRefresh > REFRESH_DEBOUNCE_TIME) {
        console.log('[RoleSelector] 下拉框打开，自动刷新角色列表（距上次刷新', timeSinceLastRefresh, 'ms）')
        lastRefreshTimeRef.current = now
        dispatch(loadAvailableRoles(true)) // 强制刷新
      } else {
        console.log('[RoleSelector] 下拉框打开，但跳过刷新（距上次刷新仅', timeSinceLastRefresh, 'ms）')
      }
    }
  }
  
  // 🎭 使用角色状态管理器获取状态信息，启用自动同步以确保UI及时更新
  const { roleStateInfo } = useRoleStateManager({
    enableAutoSync: true,         // 启用自动同步确保UI及时反映状态变化
    enableNewSessionReset: false, // 由ChatArea统一处理
    enableConsistencyCheck: true  // 启用一致性检查
  })
  
  // 角色状态信息已通过useRoleStateManager获取

  // 移除组件挂载时的自动加载，只在用户打开下拉框时才加载角色列表


  // 错误处理 - 静默记录
  useEffect(() => {
    if (roles.error) {
      console.error('角色操作错误:', roles.error)
      dispatch(clearRoleError())
      // 不显示错误提示，保持界面简洁
    }
  }, [roles.error, dispatch, message])

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

  // 处理角色选择 - 立即预加载角色内容
  const handleRoleSelect = async (role: ParsedRole) => {
    try {
      console.log(`[RoleSelector] 🎯 角色选择: ${role.name} (${role.id})`)
      
      // 1. 立即预加载角色内容（异步进行，不阻塞UI更新）
      roleContentService.preloadRole(role.id, role.name).catch(error => {
        console.error('[RoleSelector] 角色内容预加载失败:', error)
      })
      
      // 2. 更新UI状态（立即完成）
      await dispatch(activateRole(role.id)).unwrap()
      setDropdownVisible(false)
      
      console.log(`[RoleSelector] ✅ 角色选择完成，内容预加载中: ${role.name}`)
      
    } catch (error) {
      console.error('角色切换失败:', error)
      message.error(`角色切换失败`)
    }
  }

  // 处理清除角色选择 - 静默操作
  const handleClearRole = async () => {
    try {
      await dispatch(clearRole()).unwrap()
      setDropdownVisible(false)
      // 静默清除，不显示任何提示
    } catch (error) {
      console.error('清除角色失败:', error)
      message.error(`清除角色失败`)
    }
  }

  // 处理刷新角色列表 - 用户主动操作，给予反馈
  const handleRefreshRoles = async () => {
    try {
      console.log('[RoleSelector] 用户手动刷新角色列表')
      dispatch(refreshRoleCache())
      await dispatch(loadAvailableRoles(true)).unwrap()
      message.success('角色列表已刷新')
    } catch (error) {
      console.error('刷新角色列表失败:', error)
      message.error('刷新角色列表失败')
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
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, color: '#262626' }}>
                  {roles.currentRole.name}
                  {/* 🎭 角色状态指示器 */}
                  <span style={{ 
                    marginLeft: '8px',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    backgroundColor: roleStateInfo.isActivatedInSession ? '#52c41a' : '#faad14',
                    color: 'white',
                    fontWeight: 'normal'
                  }}>
                    {roleStateInfo.isActivatedInSession ? '已激活' : '待激活'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  {getSourceDisplayName(roles.currentRole.source)} · {roles.currentRole.description}
                </div>
                {/* 🎯 状态说明 */}
                <div style={{ fontSize: '11px', color: roleStateInfo.isActivatedInSession ? '#52c41a' : '#fa8c16', marginTop: '4px' }}>
                  {roleStateInfo.stateDescription}
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
        <Space direction="vertical" size={0} style={{ lineHeight: '1.2' }}>
          <Space>
            <ReloadOutlined style={{ 
              color: roles.currentRole?.id === 'nuwa' ? '#1890ff' : undefined 
            }} />
            <span style={{ 
              color: roles.currentRole?.id === 'nuwa' ? '#1890ff' : undefined,
              fontWeight: roles.currentRole?.id === 'nuwa' ? 500 : 'normal'
            }}>
              刷新角色列表
            </span>
          </Space>
          <Text 
            type={roles.currentRole?.id === 'nuwa' ? 'warning' : 'secondary'} 
            style={{ 
              fontSize: '11px', 
              marginLeft: '16px',
              fontWeight: roles.currentRole?.id === 'nuwa' ? 500 : 'normal'
            }}
          >
            {roles.currentRole?.id === 'nuwa' ? '💡 使用女娲创建新角色后请点击此处' : '创建新角色后点击此处'}
          </Text>
        </Space>
      ),
      onClick: handleRefreshRoles,
    },
    {
      type: 'divider' as const,
    },
    
    // 按来源分组的角色列表
    ...(['system', 'project', 'user'] as const).map(source => {
      // 确保availableRoles是数组
      const availableRoles = Array.isArray(roles.availableRoles) ? roles.availableRoles : []
      const sourceRoles = availableRoles.filter(role => role.source === source)
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
        onOpenChange={handleDropdownChange}
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
      onOpenChange={handleDropdownChange}
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
                maxWidth: '120px',
                display: 'flex',
                alignItems: 'center'
              }}
              title={roles.currentRole.name}
            >
              {roles.currentRole.name}
              {/* 🎭 状态指示点 */}
              <span style={{
                marginLeft: '6px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: roleStateInfo.isActivatedInSession ? '#52c41a' : '#faad14',
                display: 'inline-block',
                flexShrink: 0
              }} />
            </div>
            {size !== 'small' && (
              <div style={{ fontSize: '10px', color: '#999', lineHeight: 1.2 }}>
                {sourceInfo.name} • {roleStateInfo.isActivatedInSession ? '已激活' : '待激活'}
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