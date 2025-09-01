/**
 * 智能应用服务
 * 协调AI角色和智能系统的业务用例
 */

import { HybridApplicationService, IApplicationContext } from './ApplicationService'
import { Result } from '../../domain/shared/primitives/Result'
import { 
  IntelligenceDomainService,
  IRoleActivationRequest,
  IRoleRecommendationCriteria,
  AIRole,
  RoleId,
  RoleName,
  RoleCapabilities,
  RoleStatus,
  IRoleRepository
} from '../../domain/models/intelligence'

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
  role: AIRole
  activated: boolean
  previousRole?: AIRole
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
  role: AIRole
}

export interface IGetRoleRequest {
  roleId: string
}

export interface IGetRoleResponse {
  role: AIRole | null
  found: boolean
}

export interface IListRolesRequest {
  page?: number
  limit?: number
  sortBy?: 'name' | 'createdAt' | 'usageCount'
  sortOrder?: 'asc' | 'desc'
  status?: 'active' | 'inactive' | 'suspended' | 'error'
  capabilities?: string[]
  isSystemRole?: boolean
}

export interface IListRolesResponse {
  roles: AIRole[]
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
    role: AIRole
    matchScore: number
    reason: string
  }>
}

export interface IRoleStatisticsResponse {
  totalRoles: number
  activeRoles: number
  mostUsedRoles: Array<{ role: AIRole; usageCount: number }>
  recentlyUsedRoles: AIRole[]
  capabilityDistribution: Record<string, number>
}

export class IntelligenceApplicationService extends HybridApplicationService {
  constructor(
    private readonly intelligenceDomainService: IntelligenceDomainService,
    private readonly roleRepository: IRoleRepository
  ) {
    super('IntelligenceService')
  }

  /**
   * 激活角色
   */
  async activateRole(request: IActivateRoleRequest): Promise<Result<IActivateRoleResponse, Error>> {
    const context = this.createContext(request.context?.userId, request.context?.sessionId)

    return this.executeCommand('activateRole', context, async () => {
      const roleId = RoleId.fromString(request.roleId)
      
      const activationRequest: IRoleActivationRequest = {
        roleId,
        context: request.context
      }

      // 获取之前的角色（如果有）
      let previousRole: AIRole | undefined
      if (request.context?.previousRoleId) {
        const previousRoleResult = await this.roleRepository.findById(
          RoleId.fromString(request.context.previousRoleId)
        )
        if (previousRoleResult.isSuccess()) {
          previousRole = previousRoleResult.getValue() || undefined
        }
      }

      // 通过领域服务激活角色
      const result = await this.intelligenceDomainService.activateRole(activationRequest)
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const role = result.getValue()

      // 发布角色激活事件
      await this.publishEvent('role.activated', {
        roleId: request.roleId,
        roleName: role.getName().getValue(),
        userId: request.context?.userId,
        sessionId: request.context?.sessionId,
        previousRoleId: request.context?.previousRoleId,
        capabilities: role.getCapabilities().getCapabilities()
      }, context)

      return Result.success({
        role,
        activated: role.getStatus().isActive(),
        previousRole
      })
    })
  }

  /**
   * 停用角色
   */
  async deactivateRole(roleId: string, userId?: string): Promise<Result<AIRole, Error>> {
    const context = this.createContext(userId)

    return this.executeCommand('deactivateRole', context, async () => {
      const id = RoleId.fromString(roleId)
      const result = await this.intelligenceDomainService.deactivateRole(id)
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const role = result.getValue()

      // 发布角色停用事件
      await this.publishEvent('role.deactivated', {
        roleId,
        roleName: role.getName().getValue(),
        userId
      }, context)

      return Result.success(role)
    })
  }

  /**
   * 创建新角色
   */
  async createRole(request: ICreateRoleRequest): Promise<Result<ICreateRoleResponse, Error>> {
    const context = this.createContext()

    return this.executeCommand('createRole', context, async () => {
      const roleId = RoleId.create()
      const roleName = RoleName.create(request.name)
      const capabilities = RoleCapabilities.create(request.capabilities)
      const status = RoleStatus.inactive()

      const role = AIRole.create(
        roleId,
        roleName,
        capabilities,
        status,
        request.description,
        request.isSystemRole || false,
        request.metadata
      )

      // 保存角色
      const saveResult = await this.roleRepository.save(role)
      if (saveResult.isError()) {
        return Result.error(saveResult.getError())
      }

      // 发布角色创建事件
      await this.publishEvent('role.created', {
        roleId: role.getId().getValue(),
        roleName: request.name,
        capabilities: request.capabilities,
        isSystemRole: request.isSystemRole || false
      }, context)

      return Result.success({
        roleId: role.getId().getValue(),
        role
      })
    })
  }

  /**
   * 获取角色
   */
  async getRole(request: IGetRoleRequest): Promise<Result<IGetRoleResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('getRole', context, async () => {
      const roleId = RoleId.fromString(request.roleId)
      const result = await this.roleRepository.findById(roleId)
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const role = result.getValue()
      return Result.success({
        role,
        found: role !== null
      })
    })
  }

  /**
   * 获取角色列表
   */
  async listRoles(request: IListRolesRequest): Promise<Result<IListRolesResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('listRoles', context, async () => {
      const page = Math.max(1, request.page || 1)
      const limit = Math.min(100, Math.max(1, request.limit || 10))

      const criteria = {
        status: request.status,
        capabilities: request.capabilities,
        isSystemRole: request.isSystemRole
      }

      const options = {
        offset: (page - 1) * limit,
        limit,
        sortBy: request.sortBy || 'usageCount',
        sortOrder: request.sortOrder || 'desc'
      }

      // 获取角色列表
      const rolesResult = await this.roleRepository.findByCriteria(criteria, options)
      if (rolesResult.isError()) {
        return Result.error(rolesResult.getError())
      }

      // 获取总数
      const countResult = await this.roleRepository.count(criteria)
      if (countResult.isError()) {
        return Result.error(countResult.getError())
      }

      const roles = rolesResult.getValue()
      const total = countResult.getValue()

      return Result.success({
        roles,
        total,
        page,
        limit,
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      })
    })
  }

  /**
   * 推荐角色
   */
  async recommendRoles(request: IRecommendRolesRequest): Promise<Result<IRecommendRolesResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('recommendRoles', context, async () => {
      const criteria: IRoleRecommendationCriteria = {
        requiredCapabilities: request.requiredCapabilities,
        context: request.context,
        excludeRoleIds: request.excludeRoleIds?.map(id => RoleId.fromString(id)),
        preferSystemRoles: request.preferSystemRoles,
        maxResults: request.maxResults || 5
      }

      const result = await this.intelligenceDomainService.recommendRoles(criteria)
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const roles = result.getValue()
      
      // 计算匹配分数和推荐理由
      const recommendations = roles.map(role => {
        const matchScore = this.calculateMatchScore(role, request.requiredCapabilities)
        const reason = this.generateRecommendationReason(role, request.requiredCapabilities)
        
        return {
          role,
          matchScore,
          reason
        }
      })

      return Result.success({ recommendations })
    })
  }

  /**
   * 智能角色切换
   */
  async intelligentRoleSwitch(
    currentRoleId: string | null,
    requiredCapabilities: string[],
    context?: string
  ): Promise<Result<AIRole | null, Error>> {
    const appContext = this.createContext()

    return this.executeCommand('intelligentRoleSwitch', appContext, async () => {
      const currentId = currentRoleId ? RoleId.fromString(currentRoleId) : null
      
      const result = await this.intelligenceDomainService.intelligentRoleSwitch(
        currentId,
        requiredCapabilities,
        context
      )
      
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const newRole = result.getValue()
      
      // 发布角色切换事件
      if (newRole) {
        await this.publishEvent('role.switched', {
          fromRoleId: currentRoleId,
          toRoleId: newRole.getId().getValue(),
          requiredCapabilities,
          context
        }, appContext)
      }

      return Result.success(newRole)
    })
  }

  /**
   * 获取角色统计
   */
  async getRoleStatistics(): Promise<Result<IRoleStatisticsResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('getRoleStatistics', context, async () => {
      const result = await this.intelligenceDomainService.getRoleUsageStatistics()
      if (result.isError()) {
        return Result.error(result.getError())
      }

      return Result.success(result.getValue())
    })
  }

  /**
   * 更新角色能力
   */
  async updateRoleCapabilities(
    roleId: string,
    capabilities: string[]
  ): Promise<Result<AIRole, Error>> {
    const context = this.createContext()

    return this.executeCommand('updateRoleCapabilities', context, async () => {
      const id = RoleId.fromString(roleId)
      
      // 获取现有角色
      const roleResult = await this.roleRepository.findById(id)
      if (roleResult.isError()) {
        return Result.error(roleResult.getError())
      }

      const role = roleResult.getValue()
      if (!role) {
        return Result.error(new Error(`Role not found: ${roleId}`))
      }

      // 更新能力
      const newCapabilities = RoleCapabilities.create(capabilities)
      role.updateCapabilities(newCapabilities)

      // 保存更新
      const saveResult = await this.roleRepository.save(role)
      if (saveResult.isError()) {
        return Result.error(saveResult.getError())
      }

      // 发布能力更新事件
      await this.publishEvent('role.capabilities.updated', {
        roleId,
        newCapabilities: capabilities,
        roleName: role.getName().getValue()
      }, context)

      return Result.success(role)
    })
  }

  /**
   * 删除角色
   */
  async deleteRole(roleId: string): Promise<Result<void, Error>> {
    const context = this.createContext()

    return this.executeCommand('deleteRole', context, async () => {
      const id = RoleId.fromString(roleId)
      
      // 检查角色是否存在
      const roleResult = await this.roleRepository.findById(id)
      if (roleResult.isError()) {
        return Result.error(roleResult.getError())
      }

      const role = roleResult.getValue()
      if (!role) {
        return Result.error(new Error(`Role not found: ${roleId}`))
      }

      // 不能删除系统角色
      if (role.isSystemRole()) {
        return Result.error(new Error('Cannot delete system role'))
      }

      // 删除角色
      const deleteResult = await this.roleRepository.delete(id)
      if (deleteResult.isError()) {
        return Result.error(deleteResult.getError())
      }

      // 发布角色删除事件
      await this.publishEvent('role.deleted', {
        roleId,
        roleName: role.getName().getValue()
      }, context)

      return Result.success()
    })
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(role: AIRole, requiredCapabilities: string[]): number {
    const roleCapabilities = role.getCapabilities().getCapabilities()
    const matches = requiredCapabilities.filter(cap => roleCapabilities.includes(cap)).length
    return requiredCapabilities.length > 0 ? matches / requiredCapabilities.length : 0
  }

  /**
   * 生成推荐理由
   */
  private generateRecommendationReason(role: AIRole, requiredCapabilities: string[]): string {
    const roleCapabilities = role.getCapabilities().getCapabilities()
    const matches = requiredCapabilities.filter(cap => roleCapabilities.includes(cap))
    
    if (matches.length === 0) {
      return '基于使用频率推荐'
    }
    
    if (matches.length === requiredCapabilities.length) {
      return `完全匹配所需能力: ${matches.join(', ')}`
    }
    
    return `匹配 ${matches.length}/${requiredCapabilities.length} 个能力: ${matches.join(', ')}`
  }
}