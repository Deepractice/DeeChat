/**
 * DeeChat角色状态管理器 - 解决"角色选择 ≠ 角色激活"问题
 * 
 * 核心功能：
 * 1. 监听Redux状态变化，智能同步角色状态
 * 2. 处理新会话创建时的角色状态重置
 * 3. 检测AI工具调用结果，同步角色激活状态
 * 4. 提供角色状态一致性保证
 */

import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../store'
import { clearCurrentRole, setCurrentRole } from '../store/slices/chatSlice'
import { App } from 'antd'

interface UseRoleStateManagerOptions {
  enableAutoSync?: boolean      // 是否启用自动同步
  enableNewSessionReset?: boolean // 是否在新会话时重置角色
  enableConsistencyCheck?: boolean // 是否启用一致性检查
}

/**
 * 角色状态管理Hook
 * 解决角色选择与激活状态不一致的问题
 */
export const useRoleStateManager = (options: UseRoleStateManagerOptions = {}) => {
  const {
    enableAutoSync = true,
    enableNewSessionReset = true,
    enableConsistencyCheck = true
  } = options

  const dispatch = useDispatch()
  const { message } = App.useApp()
  
  // Redux状态
  const { currentSession, roles } = useSelector((state: RootState) => state.chat)
  
  // 引用，用于跟踪状态变化
  const previousSessionRef = useRef<string | null>(null)
  const previousRoleRef = useRef<string | null>(null)
  const roleSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * 🔥 核心功能1：监听会话变化，处理角色状态重置
   */
  useEffect(() => {
    if (!enableNewSessionReset) return

    const currentSessionId = currentSession?.id || null
    const previousSessionId = previousSessionRef.current

    // 检测新会话创建
    if (currentSessionId !== previousSessionId) {
      console.log('[RoleStateManager] 🆕 检测到会话变化:', {
        previous: previousSessionId?.slice(0, 8) || '无',
        current: currentSessionId?.slice(0, 8) || '无',
        hasSelectedRole: !!roles.currentRole
      })

      // 🔥 关键逻辑：新会话时检查是否需要重置角色状态
      if (currentSessionId && previousSessionId && roles.currentRole) {
        console.log('[RoleStateManager] 🔄 新会话创建，重置角色状态')
        dispatch(clearCurrentRole())
        
        // 静默重置，不显示提示
      }

      // 更新引用
      previousSessionRef.current = currentSessionId
    }
  }, [currentSession?.id, roles.currentRole, dispatch, message, enableNewSessionReset])

  /**
   * 🔥 核心功能2：监听角色选择变化，提供状态反馈
   */
  useEffect(() => {
    if (!enableAutoSync) return

    const currentRoleId = roles.currentRole?.id || null
    const previousRoleId = previousRoleRef.current

    // 检测角色选择变化
    if (currentRoleId !== previousRoleId) {
      console.log('[RoleStateManager] 🎭 检测到角色选择变化:', {
        previous: previousRoleId || '无',
        current: currentRoleId || '无',
        sessionId: currentSession?.id?.slice(0, 8) || '无'
      })

      // 清除之前的延时任务
      if (roleSyncTimeoutRef.current) {
        clearTimeout(roleSyncTimeoutRef.current)
      }

      if (currentRoleId) {
        // 🔥 角色选择 - 提供激活指导
        console.log('[RoleStateManager] ✅ 角色已选择，等待下次对话时激活:', roles.currentRole?.name)
        
        // 延时检查已移除，保持界面简洁
      } else if (previousRoleId) {
        // 🔄 角色清除
        console.log('[RoleStateManager] 🗑️ 角色选择已清除')
        // 静默清除，不显示提示
      }

      // 更新引用
      previousRoleRef.current = currentRoleId
    }
  }, [roles.currentRole?.id, currentSession?.id, enableAutoSync, message, roles.currentRole?.name])

  // 🔥 核心功能3：一致性检查 - 已简化，因为角色内容直接注入，无需检测工具调用

  /**
   * 检查当前会话中角色是否已激活（简化版：角色选择即激活）
   */
  const isRoleActivatedInCurrentSession = (): boolean => {
    // 现在角色内容直接注入，选择即激活
    return !!roles.currentRole
  }

  /**
   * 获取角色状态信息
   */
  const getRoleStateInfo = () => {
    const hasSelectedRole = !!roles.currentRole
    const isActivatedInSession = isRoleActivatedInCurrentSession()
    
    return {
      // 基础状态
      hasSelectedRole,
      selectedRoleId: roles.currentRole?.id,
      selectedRoleName: roles.currentRole?.name,
      
      // 激活状态
      isActivatedInSession,
      
      // 状态一致性
      isConsistent: hasSelectedRole === isActivatedInSession,
      
      // 状态描述
      stateDescription: getStateDescription(hasSelectedRole, isActivatedInSession)
    }
  }

  /**
   * 获取状态描述（简化版：选择即激活）
   */
  const getStateDescription = (hasSelected: boolean, isActivated: boolean): string => {
    if (!hasSelected) return '默认AI模式'
    if (hasSelected && isActivated) return '角色已激活'
    return '角色准备中'
  }

  /**
   * 手动触发角色状态重置
   */
  const resetRoleState = () => {
    console.log('[RoleStateManager] 🔄 手动重置角色状态')
    dispatch(clearCurrentRole())
    // 静默重置，不显示提示
  }

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (roleSyncTimeoutRef.current) {
        clearTimeout(roleSyncTimeoutRef.current)
      }
    }
  }, [])

  return {
    // 状态信息
    roleStateInfo: getRoleStateInfo(),
    
    // 工具方法
    resetRoleState,
    isRoleActivatedInCurrentSession,
    
    // 配置状态
    managerConfig: {
      enableAutoSync,
      enableNewSessionReset,
      enableConsistencyCheck
    }
  }
}

export default useRoleStateManager