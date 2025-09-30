/**
 * RoleSelector 业务逻辑 Hook
 *
 * 职责:
 * 1. 复用 useRoleManager 的角色加载逻辑
 * 2. 处理角色激活和选择
 * 3. 管理激活状态
 */

import { useState, useCallback } from 'react'
import { message } from 'antd'
import { Role, RoleActivationResponse } from '../types/role'
import { useRoleManager } from './useRoleManager'

interface UseRoleSelectorOptions {
  onRoleSelect?: (role: Role | null, activationResult?: RoleActivationResponse) => void
  autoLoadOnMount?: boolean
}

export const useRoleSelector = (options: UseRoleSelectorOptions = {}) => {
  const { onRoleSelect, autoLoadOnMount = true } = options

  // ==================== 复用 RoleManager ====================
  const roleManager = useRoleManager({
    onRoleSelect: (role, activationResult) => {
      // 激活成功后的回调
      onRoleSelect?.(role, activationResult)
    }
  })

  // ==================== 状态管理 ====================
  const [activating, setActivating] = useState(false)

  // ==================== 角色激活 ====================

  /**
   * 激活并选择角色
   */
  const activateAndSelectRole = useCallback(
    async (roleId: string) => {
      try {
        // 查找角色
        const role = roleManager.roles.find((r) => r.id === roleId)
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
          onRoleSelect?.(role, response.data)
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
    },
    [roleManager.roles, onRoleSelect]
  )

  /**
   * 清除角色选择
   */
  const clearRoleSelection = useCallback(() => {
    console.log('🚫 清除角色选择')
    onRoleSelect?.(null)
  }, [onRoleSelect])

  // ==================== 返回接口 ====================
  return {
    // 角色数据（来自 RoleManager）
    roles: roleManager.roles,
    loading: roleManager.loading,

    // 激活状态
    activating,

    // 方法
    refreshRoles: roleManager.refreshRoles,
    loadRoles: roleManager.loadRoles,
    activateAndSelectRole,
    clearRoleSelection
  }
}