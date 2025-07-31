/**
 * 🤖 系统角色管理器
 * 简化的系统角色管理，避免复杂的静默激活逻辑
 * 
 * 核心简化：
 * 1. 移除复杂的静默激活
 * 2. 按需激活角色
 * 3. 清晰的角色状态管理
 */

import { EventEmitter } from 'events'

export interface SystemRole {
  id: string
  name: string
  description: string
  isActive: boolean
  activatedAt?: Date
  config?: any
}

export class SystemRoleManager extends EventEmitter {
  private isInitialized = false
  private availableRoles: Map<string, SystemRole> = new Map()
  private activeRoles: Set<string> = new Set()

  /**
   * 初始化系统角色管理器
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    console.log('🤖 [SystemRoleManager] 初始化系统角色管理器...')

    // 注册默认角色
    this.registerDefaultRoles()

    this.isInitialized = true
    console.log('✅ [SystemRoleManager] 系统角色管理器初始化完成')
  }

  /**
   * 注册默认角色
   */
  private registerDefaultRoles(): void {
    const defaultRoles: SystemRole[] = [
      {
        id: 'assistant',
        name: 'AI助手',
        description: '通用AI助手角色，提供基础对话和任务处理能力',
        isActive: true, // 默认激活
        activatedAt: new Date()
      },
      {
        id: 'developer',
        name: '开发者助手',
        description: '专业开发者角色，提供编程和技术支持',
        isActive: false
      },
      {
        id: 'analyst',
        name: '数据分析师',
        description: '数据分析和洞察角色',
        isActive: false
      }
    ]

    for (const role of defaultRoles) {
      this.availableRoles.set(role.id, role)
      if (role.isActive) {
        this.activeRoles.add(role.id)
      }
    }

    console.log(`📋 [SystemRoleManager] 注册了 ${defaultRoles.length} 个默认角色`)
  }

  /**
   * 激活角色
   */
  public async activateRole(roleId: string, config?: any): Promise<void> {
    const role = this.availableRoles.get(roleId)
    if (!role) {
      throw new Error(`角色不存在: ${roleId}`)
    }

    if (this.activeRoles.has(roleId)) {
      console.log(`⚠️ [SystemRoleManager] 角色已激活: ${role.name}`)
      return
    }

    console.log(`🤖 [SystemRoleManager] 激活角色: ${role.name}`)

    role.isActive = true
    role.activatedAt = new Date()
    role.config = config

    this.activeRoles.add(roleId)

    this.emit('role-activated', { roleId, roleName: role.name })
    console.log(`✅ [SystemRoleManager] 角色激活成功: ${role.name}`)
  }

  /**
   * 停用角色
   */
  public async deactivateRole(roleId: string): Promise<void> {
    const role = this.availableRoles.get(roleId)
    if (!role) {
      throw new Error(`角色不存在: ${roleId}`)
    }

    if (!this.activeRoles.has(roleId)) {
      console.log(`⚠️ [SystemRoleManager] 角色未激活: ${role.name}`)
      return
    }

    console.log(`🤖 [SystemRoleManager] 停用角色: ${role.name}`)

    role.isActive = false
    role.activatedAt = undefined
    role.config = undefined

    this.activeRoles.delete(roleId)

    this.emit('role-deactivated', { roleId, roleName: role.name })
    console.log(`✅ [SystemRoleManager] 角色停用成功: ${role.name}`)
  }

  /**
   * 获取所有可用角色
   */
  public getAvailableRoles(): SystemRole[] {
    return Array.from(this.availableRoles.values())
  }

  /**
   * 获取激活的角色
   */
  public getActiveRoles(): SystemRole[] {
    return Array.from(this.availableRoles.values()).filter(role => role.isActive)
  }

  /**
   * 获取角色信息
   */
  public getRole(roleId: string): SystemRole | null {
    return this.availableRoles.get(roleId) || null
  }

  /**
   * 检查角色是否激活
   */
  public isRoleActive(roleId: string): boolean {
    return this.activeRoles.has(roleId)
  }

  /**
   * 获取系统状态
   */
  public getSystemStatus(): {
    totalRoles: number
    activeRoles: number
    availableRoles: SystemRole[]
  } {
    return {
      totalRoles: this.availableRoles.size,
      activeRoles: this.activeRoles.size,
      availableRoles: this.getAvailableRoles()
    }
  }

  /**
   * 重置所有角色
   */
  public resetAllRoles(): void {
    console.log('🔄 [SystemRoleManager] 重置所有角色状态')

    for (const role of this.availableRoles.values()) {
      if (role.id !== 'assistant') { // 保持assistant角色激活
        role.isActive = false
        role.activatedAt = undefined
        role.config = undefined
      }
    }

    this.activeRoles.clear()
    this.activeRoles.add('assistant') // 重新激活assistant

    this.emit('roles-reset')
    console.log('✅ [SystemRoleManager] 角色状态已重置')
  }

  /**
   * 关闭系统角色管理器
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 [SystemRoleManager] 关闭系统角色管理器...')

    // 停用所有角色
    for (const roleId of this.activeRoles) {
      const role = this.availableRoles.get(roleId)
      if (role) {
        role.isActive = false
        role.activatedAt = undefined
        role.config = undefined
      }
    }

    this.activeRoles.clear()
    this.availableRoles.clear()

    console.log('✅ [SystemRoleManager] 系统角色管理器已关闭')
  }
}