/**
 * 角色激活服务
 *
 * 职责：
 * - 处理角色激活请求
 * - 管理角色激活状态和统计
 * - 执行 PromptX 命令
 */

import {
  RoleActivationResult,
  RoleStats,
  PouchCommand
} from '../types/RoleTypes.js'

// @ts-ignore
import { pouch } from '@promptx/core'
const { cli } = pouch

export class RoleActivationService {
  private pouchCli = cli
  private activationStats = new Map<string, { count: number; lastActivated: Date }>()

  constructor() {
    // PromptX Pouch CLI已自动初始化，无需额外配置
  }

  /**
   * 激活指定角色
   */
  async activateRole(roleId: string): Promise<RoleActivationResult> {
    try {
      console.log(`🎯 开始激活角色: ${roleId}`)

      const result = await this.executePouchCommand('action', [roleId])

      if (result && result.content) {
        const content = result.content || result.toString()
        const isSuccess = this.checkActivationSuccess(content)

        if (isSuccess) {
          // 更新激活统计
          this.updateActivationStats(roleId)

          console.log(`✅ 角色激活成功: ${roleId}`)
          return {
            success: true,
            role: {
              id: roleId,
              name: roleId,
              description: ''
            },
            activation_id: `activation_${Date.now()}`,
            system_prompt: content,
            available_capabilities: [],
            mindmap: null
          }
        }
      }

      console.log(`❌ 角色激活失败: ${roleId}`)
      return {
        success: false,
        error: '角色激活失败'
      }
    } catch (error: any) {
      console.error(`角色激活异常: ${roleId}`, error)
      return this.handleActivationError(error)
    }
  }

  /**
   * 执行任意 PromptX 命令
   */
  async executeCommand(command: string, args: any[] = []): Promise<any> {
    try {
      console.log(`🔧 执行 PromptX 命令: ${command}`, args)
      const result = await this.executePouchCommand(command, args)
      console.log(`✅ PromptX 命令执行完成: ${command}`)
      return result
    } catch (error: any) {
      console.error(`PromptX 命令执行失败: ${command}`, error)
      throw new Error(`PromptX执行失败[${command}]: ${error.message}`)
    }
  }

  /**
   * 获取角色统计信息
   */
  async getRoleStats(roleId?: string): Promise<RoleStats> {
    if (roleId) {
      const stats = this.activationStats.get(roleId)
      return {
        activation_count: stats?.count || 0,
        last_activated: stats?.lastActivated?.toISOString() || null
      }
    }

    // 返回全局统计
    let totalActivations = 0
    let lastActivated: Date | null = null

    for (const [_, stats] of this.activationStats) {
      totalActivations += stats.count
      if (!lastActivated || stats.lastActivated > lastActivated) {
        lastActivated = stats.lastActivated
      }
    }

    return {
      activation_count: totalActivations,
      last_activated: lastActivated?.toISOString() || null
    }
  }

  /**
   * 清除激活统计
   */
  clearActivationStats(): void {
    this.activationStats.clear()
    console.log('🧹 角色激活统计已清除')
  }

  /**
   * 获取激活统计详情
   */
  getActivationDetails(): Array<{ roleId: string; count: number; lastActivated: string }> {
    return Array.from(this.activationStats.entries()).map(([roleId, stats]) => ({
      roleId,
      count: stats.count,
      lastActivated: stats.lastActivated.toISOString()
    }))
  }

  // ============ 私有方法 ============

  /**
   * 执行 PromptX 命令的底层实现
   */
  private async executePouchCommand(command: string, args: any[] = []): Promise<any> {
    try {
      const result = await this.pouchCli.execute(command, args)
      return result
    } catch (error: any) {
      throw new Error(`PromptX执行失败[${command}]: ${error.message}`)
    }
  }

  /**
   * 检查激活是否成功
   */
  private checkActivationSuccess(content: string): boolean {
    return content.includes('成功') ||
           content.includes('激活') ||
           content.includes('Prime') ||
           content.includes('已切换') ||
           content.includes('switched to')
  }

  /**
   * 更新激活统计信息
   */
  private updateActivationStats(roleId: string): void {
    const current = this.activationStats.get(roleId) || { count: 0, lastActivated: new Date(0) }
    this.activationStats.set(roleId, {
      count: current.count + 1,
      lastActivated: new Date()
    })
  }

  /**
   * 处理激活过程中的错误
   */
  private handleActivationError(error: any): RoleActivationResult {
    if (error.message?.includes('cloned') || error.message?.includes('serialize')) {
      return {
        success: false,
        error: 'PromptX data serialization error'
      }
    }

    return {
      success: false,
      error: error.message || '角色激活失败'
    }
  }
}