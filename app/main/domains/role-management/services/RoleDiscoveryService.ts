/**
 * 角色发现服务
 *
 * 职责：
 * - 从 PromptX 发现可用角色
 * - 缓存角色信息提高性能
 * - 解析角色描述和分类
 */

import {
  Role,
  DiscoveryResult
} from '../types/RoleTypes.js'

// @ts-ignore
import { pouch } from '@promptx/core'
const { cli } = pouch

export class RoleDiscoveryService {
  private pouchCli = cli
  private rolesCache: Role[] | null = null
  private lastCacheTime: number = 0
  private readonly CACHE_DURATION = 30000 // 30秒缓存

  constructor() {
    // PromptX Pouch CLI已自动初始化，无需额外配置
  }

  /**
   * 发现资源（角色和工具）
   */
  async discoverResources(focus?: 'all' | 'roles' | 'tools'): Promise<DiscoveryResult> {
    // 检查缓存
    const now = Date.now()
    if (this.rolesCache && (now - this.lastCacheTime) < this.CACHE_DURATION) {
      console.log('🚀 使用角色缓存数据')
      return {
        success: true,
        data: {
          roles: this.rolesCache,
          tools: []
        }
      }
    }

    try {
      const args = focus ? [focus] : []
      const result = await this.executePouchCommand('discover', args)

      if (result && result.content) {
        const content = result.content || result.toString()
        const roles: Role[] = this.parseRolesFromContent(content)

        // 更新缓存
        this.rolesCache = roles
        this.lastCacheTime = Date.now()

        return {
          success: true,
          data: {
            roles,
            tools: []
          }
        }
      }

      return {
        success: true,
        data: {
          roles: [],
          tools: []
        }
      }
    } catch (error: any) {
      return this.handleDiscoveryError(error)
    }
  }

  /**
   * 获取所有角色列表
   */
  async getRoles(): Promise<Role[]> {
    try {
      const result = await this.discoverResources('roles')
      return result?.data?.roles || []
    } catch (error) {
      console.error('获取角色列表失败:', error)
      return []
    }
  }

  /**
   * 根据ID获取角色信息
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    try {
      const roles = await this.getRoles()
      return roles.find((role: Role) => role.id === roleId) || null
    } catch (error) {
      console.error('获取角色信息失败:', error)
      return null
    }
  }

  /**
   * 清除角色缓存
   */
  clearCache(): void {
    this.rolesCache = null
    this.lastCacheTime = 0
    console.log('🧹 角色缓存已清除')
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): { cached: boolean; cacheAge: number; rolesCount: number } {
    const now = Date.now()
    const cacheAge = now - this.lastCacheTime
    const isCacheValid = this.rolesCache !== null && cacheAge < this.CACHE_DURATION

    return {
      cached: isCacheValid,
      cacheAge,
      rolesCount: this.rolesCache?.length || 0
    }
  }

  // ============ 私有方法 ============

  /**
   * 执行 PromptX 命令
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
   * 从内容中解析角色信息
   */
  private parseRolesFromContent(content: string): Role[] {
    const roles: Role[] = []

    const allRoleMatches = content.match(/- `([^`]+)`:\s*([^→]+)→\s*action\("[^"]+"\)/g)
    if (allRoleMatches) {
      allRoleMatches.forEach((roleMatch: string) => {
        const match = roleMatch.match(/- `([^`]+)`:\s*([^→]+)/)
        if (match) {
          const roleId = match[1]
          let description = match[2].trim()
          let category: 'system' | 'project' | 'user' = 'system'

          // 根据内容位置确定分类
          const beforeRole = content.substring(0, content.indexOf(roleMatch))
          if (beforeRole.includes('👤 **用户角色**')) {
            category = 'user'
          } else if (beforeRole.includes('📦 **项目角色**')) {
            category = 'project'
          }

          roles.push({
            id: roleId,
            name: roleId,
            description: description,
            category: category
          })
        }
      })
    }

    return roles
  }

  /**
   * 处理资源发现过程中的错误
   */
  private handleDiscoveryError(error: any): DiscoveryResult {
    if (error.message?.includes('already registered')) {
      console.log('🔄 PromptX Area 重复注册，跳过此次调用')
      // 重复注册是正常的，返回成功状态
      return {
        success: true,
        data: {
          roles: [],
          tools: []
        }
      }
    }

    if (error.message?.includes('cloned') || error.message?.includes('serialize')) {
      return {
        success: false,
        error: 'PromptX data serialization error',
        data: {
          roles: [],
          tools: []
        }
      }
    }

    throw error
  }
}