/**
 * Intelligence领域服务
 * 处理跨聚合根的复杂业务逻辑
 */

import { Result } from '../../../shared/primitives/Result'
import { AIRole } from '../entities/AIRole'
import { RoleId } from '../value-objects/RoleId'
import { RoleName } from '../value-objects/RoleName'
import { RoleCapabilities } from '../value-objects/RoleCapabilities'
import { IRoleRepository } from '../repositories/IRoleRepository'
import { RoleActivated } from '../events/RoleActivated'
import { RoleDeactivated } from '../events/RoleDeactivated'

export interface IRoleActivationRequest {
  roleId: RoleId
  context?: {
    userId?: string
    sessionId?: string
    previousRoleId?: RoleId
    requiredCapabilities?: string[]
  }
}

export interface IRoleRecommendationCriteria {
  requiredCapabilities: string[]
  context?: string
  excludeRoleIds?: RoleId[]
  preferSystemRoles?: boolean
  maxResults?: number
}

export class IntelligenceDomainService {
  constructor(
    private readonly roleRepository: IRoleRepository
  ) {}

  /**
   * 激活角色并处理相关业务规则
   */
  async activateRole(request: IRoleActivationRequest): Promise<Result<AIRole, Error>> {
    try {
      // 1. 获取角色
      const roleResult = await this.roleRepository.findById(request.roleId)
      if (roleResult.isError()) {
        return Result.error(roleResult.getError())
      }

      const role = roleResult.getValue()
      if (!role) {
        return Result.error(new Error(`Role not found: ${request.roleId.getValue()}`))
      }

      // 2. 验证角色状态和能力
      const validationResult = this.validateRoleActivation(role, request.context?.requiredCapabilities)
      if (validationResult.isError()) {
        return Result.error(validationResult.getError())
      }

      // 3. 如果有前一个角色，先停用它
      if (request.context?.previousRoleId) {
        const deactivationResult = await this.deactivateRole(request.context.previousRoleId)
        if (deactivationResult.isError()) {
          // 记录警告但不阻止激活新角色
          console.warn('Failed to deactivate previous role:', deactivationResult.getError())
        }
      }

      // 4. 激活角色
      role.activate()

      // 5. 保存角色状态
      const saveResult = await this.roleRepository.save(role)
      if (saveResult.isError()) {
        return Result.error(saveResult.getError())
      }

      // 6. 更新使用统计
      role.recordUsage()

      return Result.success(role)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 停用角色
   */
  async deactivateRole(roleId: RoleId): Promise<Result<AIRole, Error>> {
    try {
      const roleResult = await this.roleRepository.findById(roleId)
      if (roleResult.isError()) {
        return Result.error(roleResult.getError())
      }

      const role = roleResult.getValue()
      if (!role) {
        return Result.error(new Error(`Role not found: ${roleId.getValue()}`))
      }

      // 停用角色
      role.deactivate()

      // 保存状态
      const saveResult = await this.roleRepository.save(role)
      if (saveResult.isError()) {
        return Result.error(saveResult.getError())
      }

      return Result.success(role)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 根据能力要求推荐合适的角色
   */
  async recommendRoles(criteria: IRoleRecommendationCriteria): Promise<Result<AIRole[], Error>> {
    try {
      // 1. 根据能力查找角色
      const rolesResult = await this.roleRepository.findByCapabilities(
        criteria.requiredCapabilities,
        false, // 不需要全部匹配
        { 
          limit: criteria.maxResults || 10,
          sortBy: 'usageCount',
          sortOrder: 'desc'
        }
      )

      if (rolesResult.isError()) {
        return Result.error(rolesResult.getError())
      }

      let roles = rolesResult.getValue()

      // 2. 过滤排除的角色
      if (criteria.excludeRoleIds) {
        const excludeIds = new Set(criteria.excludeRoleIds.map(id => id.getValue()))
        roles = roles.filter(role => !excludeIds.has(role.getId().getValue()))
      }

      // 3. 根据系统角色偏好排序
      if (criteria.preferSystemRoles) {
        roles.sort((a, b) => {
          if (a.isSystemRole() && !b.isSystemRole()) return -1
          if (!a.isSystemRole() && b.isSystemRole()) return 1
          return 0
        })
      }

      // 4. 根据能力匹配度排序
      roles.sort((a, b) => {
        const aMatchCount = this.countCapabilityMatches(a, criteria.requiredCapabilities)
        const bMatchCount = this.countCapabilityMatches(b, criteria.requiredCapabilities)
        return bMatchCount - aMatchCount
      })

      // 5. 只返回活跃状态的角色
      const activeRoles = roles.filter(role => role.getStatus().isActive() || role.getStatus().canActivate())

      return Result.success(activeRoles)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 批量激活角色
   */
  async activateMultipleRoles(roleIds: RoleId[]): Promise<Result<AIRole[], Error>> {
    try {
      const results: AIRole[] = []
      const errors: Error[] = []

      for (const roleId of roleIds) {
        const activationResult = await this.activateRole({ roleId })
        
        if (activationResult.isSuccess()) {
          results.push(activationResult.getValue())
        } else {
          errors.push(activationResult.getError())
        }
      }

      if (errors.length > 0) {
        const combinedError = new Error(
          `Failed to activate ${errors.length} roles: ${errors.map(e => e.message).join('; ')}`
        )
        return Result.error(combinedError)
      }

      return Result.success(results)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 智能角色切换
   * 根据上下文和需求自动推荐并切换角色
   */
  async intelligentRoleSwitch(
    currentRoleId: RoleId | null,
    requiredCapabilities: string[],
    context?: string
  ): Promise<Result<AIRole | null, Error>> {
    try {
      // 1. 如果当前角色满足要求，不需要切换
      if (currentRoleId) {
        const currentRoleResult = await this.roleRepository.findById(currentRoleId)
        if (currentRoleResult.isSuccess()) {
          const currentRole = currentRoleResult.getValue()
          if (currentRole && this.roleHasRequiredCapabilities(currentRole, requiredCapabilities)) {
            return Result.success(currentRole)
          }
        }
      }

      // 2. 推荐新角色
      const recommendationResult = await this.recommendRoles({
        requiredCapabilities,
        context,
        excludeRoleIds: currentRoleId ? [currentRoleId] : undefined,
        preferSystemRoles: true,
        maxResults: 1
      })

      if (recommendationResult.isError()) {
        return Result.error(recommendationResult.getError())
      }

      const recommendations = recommendationResult.getValue()
      if (recommendations.length === 0) {
        return Result.success(null) // 没有合适的角色
      }

      // 3. 激活推荐的角色
      const newRole = recommendations[0]
      const activationResult = await this.activateRole({
        roleId: newRole.getId(),
        context: {
          previousRoleId: currentRoleId || undefined,
          requiredCapabilities
        }
      })

      if (activationResult.isError()) {
        return Result.error(activationResult.getError())
      }

      return Result.success(activationResult.getValue())
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 验证角色激活条件
   */
  private validateRoleActivation(
    role: AIRole,
    requiredCapabilities?: string[]
  ): Result<void, Error> {
    // 检查角色状态
    if (!role.getStatus().canActivate()) {
      return Result.error(new Error(
        `Cannot activate role ${role.getName().getValue()}: ${role.getStatus().toString()}`
      ))
    }

    // 检查必需的能力
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      if (!this.roleHasRequiredCapabilities(role, requiredCapabilities)) {
        return Result.error(new Error(
          `Role ${role.getName().getValue()} does not have required capabilities: ${requiredCapabilities.join(', ')}`
        ))
      }
    }

    return Result.success()
  }

  /**
   * 检查角色是否具有必需的能力
   */
  private roleHasRequiredCapabilities(role: AIRole, requiredCapabilities: string[]): boolean {
    const roleCapabilities = role.getCapabilities().getCapabilities()
    return requiredCapabilities.some(required => 
      roleCapabilities.includes(required)
    )
  }

  /**
   * 计算能力匹配数量
   */
  private countCapabilityMatches(role: AIRole, requiredCapabilities: string[]): number {
    const roleCapabilities = new Set(role.getCapabilities().getCapabilities())
    return requiredCapabilities.filter(required => roleCapabilities.has(required)).length
  }

  /**
   * 获取角色使用统计
   */
  async getRoleUsageStatistics(): Promise<Result<{
    totalRoles: number
    activeRoles: number
    mostUsedRoles: Array<{ role: AIRole; usageCount: number }>
    recentlyUsedRoles: AIRole[]
    capabilityDistribution: Record<string, number>
  }, Error>> {
    try {
      // 获取统计信息
      const statsResult = await this.roleRepository.getStatistics()
      if (statsResult.isError()) {
        return Result.error(statsResult.getError())
      }

      const stats = statsResult.getValue()

      // 获取最常用和最近使用的角色
      const mostUsedResult = await this.roleRepository.findMostUsed(5)
      const recentlyUsedResult = await this.roleRepository.findRecentlyUsed(10)

      if (mostUsedResult.isError() || recentlyUsedResult.isError()) {
        return Result.error(new Error('Failed to fetch usage data'))
      }

      // 构建能力分布统计
      const capabilityDistribution: Record<string, number> = {}
      stats.mostUsedCapabilities.forEach(cap => {
        capabilityDistribution[cap.capability] = cap.count
      })

      return Result.success({
        totalRoles: stats.totalRoles,
        activeRoles: stats.activeRoles,
        mostUsedRoles: mostUsedResult.getValue().map(role => ({
          role,
          usageCount: role.getUsageCount()
        })),
        recentlyUsedRoles: recentlyUsedResult.getValue(),
        capabilityDistribution
      })
    } catch (error) {
      return Result.error(error as Error)
    }
  }
}