/**
 * 角色管理领域 IPC 适配器
 *
 * 职责：
 * - 为前端暴露角色管理相关的 IPC 接口
 * - 处理 IPC 请求和响应格式转换
 * - 协调各个服务的调用
 */

import { RoleDiscoveryService } from '../services/RoleDiscoveryService.js'
import { RoleActivationService } from '../services/RoleActivationService.js'
import {
  Role,
  RoleActivationResult,
  DiscoveryResult,
  RoleStats
} from '../types/RoleTypes.js'

export class IPCAdapter {
  constructor(
    private roleDiscoveryService: RoleDiscoveryService,
    private roleActivationService: RoleActivationService
  ) {}

  /**
   * 暴露给 IPC 的接口映射
   * 提供角色管理和 PromptX 集成的完整接口
   */
  exposeToIPC(): Record<string, Function> {
    return {
      // 角色基础管理接口
      'role:list': this.listRoles.bind(this),
      'role:get': this.getRole.bind(this),
      'role:stats': this.getRoleStats.bind(this),
      'role:activate': this.activateRole.bind(this),

      // PromptX 集成接口
      'promptx:discover': this.discoverResources.bind(this),
      'promptx:action': this.activateRole.bind(this), // 别名接口，保持向后兼容
      'promptx:execute': this.executeCommand.bind(this),

      // 扩展管理接口
      'role:clear-cache': this.clearCache.bind(this),
      'role:cache-status': this.getCacheStatus.bind(this),
      'role:activation-details': this.getActivationDetails.bind(this)
    }
  }

  // ============ 角色管理接口 ============

  /**
   * 获取角色列表
   */
  private async listRoles(): Promise<Role[]> {
    console.log('📨 IPC请求: role:list')

    try {
      const result = await this.roleDiscoveryService.getRoles()
      console.log('✅ IPC响应: role:list', `返回${result.length}个角色`)
      return result
    } catch (error) {
      console.error('❌ IPC错误: role:list', error)
      throw error
    }
  }

  /**
   * 获取指定角色信息
   */
  private async getRole(roleId: string): Promise<Role | null> {
    console.log('📨 IPC请求: role:get', roleId)

    try {
      const result = await this.roleDiscoveryService.getRoleById(roleId)
      console.log('✅ IPC响应: role:get', result ? '找到角色' : '角色不存在')
      return result
    } catch (error) {
      console.error('❌ IPC错误: role:get', error)
      throw error
    }
  }

  /**
   * 获取角色统计信息
   */
  private async getRoleStats(roleId?: string): Promise<RoleStats> {
    console.log('📨 IPC请求: role:stats', roleId)

    try {
      const result = await this.roleActivationService.getRoleStats(roleId)
      console.log('✅ IPC响应: role:stats')
      return result
    } catch (error) {
      console.error('❌ IPC错误: role:stats', error)
      throw error
    }
  }

  /**
   * 激活角色
   */
  private async activateRole(roleId: string): Promise<RoleActivationResult> {
    console.log('📨 IPC请求: role:activate', roleId)

    try {
      const result = await this.roleActivationService.activateRole(roleId)
      console.log('✅ IPC响应: role:activate', result.success ? '激活成功' : '激活失败')
      return result
    } catch (error) {
      console.error('❌ IPC错误: role:activate', error)
      throw error
    }
  }

  // ============ PromptX 集成接口 ============

  /**
   * 发现资源（角色和工具）
   */
  private async discoverResources(focus?: 'all' | 'roles' | 'tools'): Promise<DiscoveryResult> {
    console.log('📨 IPC请求: promptx:discover', focus)

    try {
      const result = await this.roleDiscoveryService.discoverResources(focus)
      console.log('✅ IPC响应: promptx:discover', `发现${result.data.roles.length}个角色`)
      return result
    } catch (error) {
      console.error('❌ IPC错误: promptx:discover', error)
      throw error
    }
  }

  /**
   * 执行 PromptX 命令
   */
  private async executeCommand(command: string, args: any[] = []): Promise<any> {
    console.log('📨 IPC请求: promptx:execute', command, args)

    try {
      const result = await this.roleActivationService.executeCommand(command, args)
      console.log('✅ IPC响应: promptx:execute')
      return result
    } catch (error) {
      console.error('❌ IPC错误: promptx:execute', error)
      throw error
    }
  }

  // ============ 扩展管理接口 ============

  /**
   * 清除角色缓存
   */
  private clearCache(): { success: boolean; message: string } {
    console.log('📨 IPC请求: role:clear-cache')

    try {
      this.roleDiscoveryService.clearCache()
      console.log('✅ IPC响应: role:clear-cache')
      return { success: true, message: '缓存已清除' }
    } catch (error) {
      console.error('❌ IPC错误: role:clear-cache', error)
      throw error
    }
  }

  /**
   * 获取缓存状态
   */
  private getCacheStatus(): { cached: boolean; cacheAge: number; rolesCount: number } {
    console.log('📨 IPC请求: role:cache-status')

    try {
      const result = this.roleDiscoveryService.getCacheStatus()
      console.log('✅ IPC响应: role:cache-status')
      return result
    } catch (error) {
      console.error('❌ IPC错误: role:cache-status', error)
      throw error
    }
  }

  /**
   * 获取激活详情
   */
  private getActivationDetails(): Array<{ roleId: string; count: number; lastActivated: string }> {
    console.log('📨 IPC请求: role:activation-details')

    try {
      const result = this.roleActivationService.getActivationDetails()
      console.log('✅ IPC响应: role:activation-details')
      return result
    } catch (error) {
      console.error('❌ IPC错误: role:activation-details', error)
      throw error
    }
  }
}