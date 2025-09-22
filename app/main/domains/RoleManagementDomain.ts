/**
 * RoleManagementDomain - 角色管理领域服务
 */

import { Service } from 'typedi'
import { IDomain } from '../ipc/ipc-registry.js'

// @ts-ignore
import { pouch } from '@promptx/core'
const { cli } = pouch

export interface Role {
  id: string
  name: string
  description: string
  category: string
}

export interface RoleActivationResult {
  success: boolean
  role?: {
    id: string
    name: string
    description: string
  }
  activation_id?: string
  system_prompt?: string
  available_capabilities?: string[]
  mindmap?: any
  error?: string
}

@Service()
export class RoleManagementDomain implements IDomain {
  private pouchCli = cli
  private rolesCache: Role[] | null = null
  private lastCacheTime: number = 0
  private readonly CACHE_DURATION = 30000 // 30秒缓存

  constructor() {
    // PromptX Pouch CLI已自动初始化，无需额外配置
  }

  private async executePouchCommand(command: string, args: any[] = []): Promise<any> {
    try {
      const result = await this.pouchCli.execute(command, args)
      return result
    } catch (error: any) {
      throw new Error(`PromptX执行失败[${command}]: ${error.message}`)
    }
  }

  async discoverResources(focus?: 'all' | 'roles' | 'tools'): Promise<any> {
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
        const roles: Role[] = []

        const allRoleMatches = content.match(/- `([^`]+)`:\s*([^→]+)→\s*action\("[^"]+"\)/g)
        if (allRoleMatches) {
          allRoleMatches.forEach((roleMatch: string) => {
            const match = roleMatch.match(/- `([^`]+)`:\s*([^→]+)/)
            if (match) {
              const roleId = match[1]
              let description = match[2].trim()
              let category = 'system'

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
      if (error.message?.includes('already registered')) {
        console.log('🔄 PromptX Area 重复注册，跳过此次调用')
        // 重复注册错误，直接返回空结果，让前端重试
        throw new Error('PromptX重复注册错误，请稍后重试')
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

  async activateRole(roleId: string): Promise<RoleActivationResult> {
    try {
      const result = await this.executePouchCommand('action', [roleId])

      if (result && result.content) {
        const content = result.content || result.toString()
        const isSuccess = content.includes('成功') || content.includes('激活') || content.includes('Prime')

        if (isSuccess) {
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

      return {
        success: false,
        error: '角色激活失败'
      }
    } catch (error: any) {
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


  async getRoles(): Promise<any[]> {
    try {
      const result = await this.discoverResources('roles')
      return result?.data?.roles || []
    } catch (error) {
      return []
    }
  }

  async getRoleById(roleId: string): Promise<any | null> {
    try {
      const roles = await this.getRoles()
      return roles.find((role: any) => role.id === roleId) || null
    } catch (error) {
      return null
    }
  }

  async getRoleStats(): Promise<{
    activation_count: number
    last_activated: string | null
  }> {
    return {
      activation_count: 0,
      last_activated: null
    }
  }

  getDomainName(): string {
    return 'RoleManagement'
  }

  exposeToIPC(): Record<string, Function> {
    return {
      'role:list': this.getRoles.bind(this),
      'role:get': this.getRoleById.bind(this),
      'role:stats': this.getRoleStats.bind(this),
      'role:activate': this.activateRole.bind(this),
      'promptx:discover': this.discoverResources.bind(this),
      'promptx:action': this.activateRole.bind(this),
      'promptx:execute': async (command: string, args: any[] = []) => {
        return await this.executePouchCommand(command, args)
      }
    }
  }

  async initialize(): Promise<void> {
    // PromptX Core 无需手动初始化，自动管理内部状态
  }

  async cleanup(): Promise<void> {
    // PromptX会自动管理资源清理，无需手动处理
  }
}