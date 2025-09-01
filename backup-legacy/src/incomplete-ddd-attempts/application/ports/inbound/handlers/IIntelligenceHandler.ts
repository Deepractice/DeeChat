/**
 * 智能处理器接口（入站端口）
 * 定义AI角色相关操作的抽象契约
 */

import { Result } from '../../../../domain/shared/primitives/Result'

export interface IActivateRoleRequest {
  roleId: string
  context?: {
    userId?: string
    sessionId?: string
    previousRoleId?: string
    requiredCapabilities?: string[]
  }
}

export interface IActivateRoleResponse {
  roleId: string
  roleName: string
  activated: boolean
  previousRoleId?: string
  capabilities: string[]
  message?: string
}

export interface ICreateRoleRequest {
  name: string
  description?: string
  capabilities: string[]
  isSystemRole?: boolean
  metadata?: Record<string, any>
}

export interface ICreateRoleResponse {
  roleId: string
  success: boolean
  message?: string
}

export interface IGetRoleRequest {
  roleId: string
}

export interface IGetRoleResponse {
  role: any // 将来会定义具体的Role DTO
  found: boolean
}

export interface IListRolesRequest {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
  capabilities?: string[]
  isSystemRole?: boolean
}

export interface IListRolesResponse {
  roles: any[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export interface IRecommendRolesRequest {
  requiredCapabilities: string[]
  context?: string
  excludeRoleIds?: string[]
  preferSystemRoles?: boolean
  maxResults?: number
}

export interface IRecommendRolesResponse {
  recommendations: Array<{
    roleId: string
    roleName: string
    matchScore: number
    reason: string
    capabilities: string[]
  }>
}

export interface IRoleStatisticsResponse {
  totalRoles: number
  activeRoles: number
  mostUsedRoles: Array<{ roleId: string; roleName: string; usageCount: number }>
  recentlyUsedRoles: Array<{ roleId: string; roleName: string }>
  capabilityDistribution: Record<string, number>
}

/**
 * 智能处理器接口
 * 定义所有AI角色相关操作的契约
 */
export interface IIntelligenceHandler {
  /**
   * 激活角色
   */
  activateRole(request: IActivateRoleRequest): Promise<Result<IActivateRoleResponse, Error>>

  /**
   * 停用角色
   */
  deactivateRole(roleId: string, userId?: string): Promise<Result<void, Error>>

  /**
   * 创建角色
   */
  createRole(request: ICreateRoleRequest): Promise<Result<ICreateRoleResponse, Error>>

  /**
   * 获取角色详情
   */
  getRole(request: IGetRoleRequest): Promise<Result<IGetRoleResponse, Error>>

  /**
   * 获取角色列表
   */
  listRoles(request: IListRolesRequest): Promise<Result<IListRolesResponse, Error>>

  /**
   * 推荐角色
   */
  recommendRoles(request: IRecommendRolesRequest): Promise<Result<IRecommendRolesResponse, Error>>

  /**
   * 智能角色切换
   */
  intelligentRoleSwitch(
    currentRoleId: string | null,
    requiredCapabilities: string[],
    context?: string
  ): Promise<Result<{
    newRoleId?: string
    switched: boolean
    reason: string
  }, Error>>

  /**
   * 获取角色统计
   */
  getRoleStatistics(): Promise<Result<IRoleStatisticsResponse, Error>>

  /**
   * 更新角色能力
   */
  updateRoleCapabilities(
    roleId: string,
    capabilities: string[]
  ): Promise<Result<void, Error>>

  /**
   * 删除角色
   */
  deleteRole(roleId: string): Promise<Result<void, Error>>
}