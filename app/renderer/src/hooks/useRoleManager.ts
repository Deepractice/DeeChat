/**
 * RoleManager 业务逻辑 Hook
 *
 * 职责:
 * 1. 角色数据加载和刷新
 * 2. 角色状态管理
 * 3. 错误处理
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { message } from 'antd'
import { Role, DiscoverResponse } from '../types/role'

interface UseRoleManagerOptions {
  onRoleSelect?: (role: Role, activationResult: any) => void
}

export const useRoleManager = (options: UseRoleManagerOptions = {}) => {
  // ==================== 状态管理 ====================
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const hasLoadedRef = useRef(false) // 防止重复加载

  // ==================== 数据加载 ====================

  /**
   * 加载角色列表
   */
  const loadRoles = useCallback(async () => {
    if (hasLoadedRef.current) return

    try {
      setLoading(true)
      hasLoadedRef.current = true

      const response = await (window as any).electronAPI.promptx.discover('roles')

      // 检查响应数据
      if (response.success && response.data && response.data.data && response.data.data.roles) {
        setRoles(response.data.data.roles)
        console.log('✅ 角色列表加载成功:', response.data.data.roles.length)
      } else {
        throw new Error(response.error || '获取角色列表失败')
      }
    } catch (error: any) {
      hasLoadedRef.current = false // 重置状态，允许重试
      message.error(`加载角色失败: ${error.message}`)
      setRoles([])
      console.error('❌ 加载角色失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 刷新角色列表
   */
  const refreshRoles = useCallback(async () => {
    try {
      setLoading(true)
      hasLoadedRef.current = false // 允许重新加载

      const response = await (window as any).electronAPI.promptx.discover('roles')

      if (response.success && response.data && response.data.data && response.data.data.roles) {
        setRoles(response.data.data.roles)
        hasLoadedRef.current = true
        message.success('角色列表刷新成功')
        console.log('✅ 角色列表刷新成功')
      } else {
        throw new Error(response.error || '获取角色列表失败')
      }
    } catch (error: any) {
      message.error(`刷新角色失败: ${error.message}`)
      setRoles([])
      console.error('❌ 刷新角色失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 激活并选择角色
   */
  const selectRole = useCallback(async (role: Role) => {
    try {
      console.log('🎭 激活角色:', role.name)

      // 调用角色激活接口
      const activationResponse = await (window as any).electronAPI.promptx.action(role.id)

      if (activationResponse.success) {
        message.success(`角色 "${role.name}" 激活成功`)
        options.onRoleSelect?.(role, activationResponse.data)
      } else {
        throw new Error(activationResponse.error || '角色激活失败')
      }
    } catch (error: any) {
      message.error(`激活角色失败: ${error.message}`)
      console.error('❌ 激活角色失败:', error)
    }
  }, [options])

  // ==================== 副作用 ====================

  // 初始化加载
  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  // ==================== 返回接口 ====================
  return {
    // 状态
    roles,
    loading,

    // 方法
    loadRoles,
    refreshRoles,
    selectRole
  }
}