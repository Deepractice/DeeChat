/**
 * 角色仓储接口
 * 定义AI角色数据访问的抽象契约
 */

import { AIRole } from '../entities/AIRole'
import { RoleId } from '../value-objects/RoleId'
import { RoleName } from '../value-objects/RoleName'
import { RoleStatus } from '../value-objects/RoleStatus'
import { Result } from '../../../shared/primitives/Result'

export interface RoleSearchCriteria {
  name?: string
  status?: 'inactive' | 'active' | 'suspended' | 'error'
  capabilities?: string[]
  category?: string
  tags?: string[]
  isSystemRole?: boolean
  hasAnyCapability?: string[]
  hasAllCapabilities?: string[]
  createdAfter?: Date
  createdBefore?: Date
  lastUsedAfter?: Date
  lastUsedBefore?: Date
  minUsageCount?: number
  maxUsageCount?: number
}

export interface RoleListOptions {
  offset?: number
  limit?: number
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastUsedAt' | 'usageCount'
  sortOrder?: 'asc' | 'desc'
}

export interface IRoleRepository {
  /**
   * 根据ID查找角色
   */
  findById(id: RoleId): Promise<Result<AIRole | null, Error>>

  /**
   * 根据名称查找角色
   */
  findByName(name: RoleName): Promise<Result<AIRole | null, Error>>

  /**
   * 保存角色（创建或更新）
   */
  save(role: AIRole): Promise<Result<void, Error>>

  /**
   * 删除角色
   */
  delete(id: RoleId): Promise<Result<void, Error>>

  /**
   * 查找所有角色
   */
  findAll(options?: RoleListOptions): Promise<Result<AIRole[], Error>>

  /**
   * 根据条件搜索角色
   */
  findByCriteria(
    criteria: RoleSearchCriteria,
    options?: RoleListOptions
  ): Promise<Result<AIRole[], Error>>

  /**
   * 获取角色总数
   */
  count(criteria?: RoleSearchCriteria): Promise<Result<number, Error>>

  /**
   * 检查角色是否存在
   */
  exists(id: RoleId): Promise<Result<boolean, Error>>

  /**
   * 检查角色名称是否存在
   */
  existsByName(name: RoleName): Promise<Result<boolean, Error>>

  /**
   * 获取活跃的角色
   */
  findActive(options?: RoleListOptions): Promise<Result<AIRole[], Error>>

  /**
   * 获取系统预定义角色
   */
  findSystemRoles(options?: RoleListOptions): Promise<Result<AIRole[], Error>>

  /**
   * 获取用户自定义角色
   */
  findCustomRoles(options?: RoleListOptions): Promise<Result<AIRole[], Error>>

  /**
   * 根据能力查找角色
   */
  findByCapabilities(
    requiredCapabilities: string[],
    requireAll: boolean = false,
    options?: RoleListOptions
  ): Promise<Result<AIRole[], Error>>

  /**
   * 获取最常用的角色
   */
  findMostUsed(limit: number): Promise<Result<AIRole[], Error>>

  /**
   * 获取最近使用的角色
   */
  findRecentlyUsed(limit: number): Promise<Result<AIRole[], Error>>

  /**
   * 批量激活角色
   */
  activateMany(ids: RoleId[]): Promise<Result<number, Error>>

  /**
   * 批量停用角色
   */
  deactivateMany(ids: RoleId[]): Promise<Result<number, Error>>

  /**
   * 批量删除角色
   */
  deleteMany(ids: RoleId[]): Promise<Result<number, Error>>

  /**
   * 获取所有可用的能力列表
   */
  getAllCapabilities(): Promise<Result<string[], Error>>

  /**
   * 获取所有角色类别
   */
  getAllCategories(): Promise<Result<string[], Error>>

  /**
   * 获取所有标签
   */
  getAllTags(): Promise<Result<string[], Error>>

  /**
   * 获取角色统计信息
   */
  getStatistics(): Promise<Result<{
    totalRoles: number
    activeRoles: number
    systemRoles: number
    customRoles: number
    mostUsedCapabilities: Array<{ capability: string; count: number }>
    rolesByCategory: Record<string, number>
    averageUsageCount: number
    rolesCreatedThisWeek: number
    rolesUsedThisWeek: number
  }, Error>>

  /**
   * 清理长时间未使用的角色
   */
  cleanupUnusedRoles(unusedDays: number): Promise<Result<number, Error>>
}