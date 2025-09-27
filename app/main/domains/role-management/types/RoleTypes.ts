/**
 * 角色管理领域类型定义
 *
 * 统一定义角色、激活结果等相关类型
 */

/**
 * 角色信息接口
 */
export interface Role {
  id: string
  name: string
  description: string
  category: 'system' | 'project' | 'user'
}

/**
 * 角色激活结果接口
 */
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

/**
 * 资源发现结果接口
 */
export interface DiscoveryResult {
  success: boolean
  data: {
    roles: Role[]
    tools: any[]
  }
  error?: string
}

/**
 * 角色统计信息接口
 */
export interface RoleStats {
  activation_count: number
  last_activated: string | null
}

/**
 * PromptX命令执行配置
 */
export interface PouchCommand {
  command: string
  args: any[]
}