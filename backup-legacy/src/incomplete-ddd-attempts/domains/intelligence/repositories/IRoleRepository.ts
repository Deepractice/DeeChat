/**
 * 角色仓储接口
 * 🏗️ DDD重构: 定义PromptX角色持久化的契约
 */

import { PromptXRole } from '../entities/PromptXRole';
import { RoleId } from '../value-objects/RoleId';

export interface IRoleRepository {
  /**
   * 根据ID查找角色
   */
  findById(id: RoleId): Promise<PromptXRole | null>;

  /**
   * 根据名称查找角色
   */
  findByName(name: string): Promise<PromptXRole | null>;

  /**
   * 搜索角色
   */
  search(criteria: RoleSearchCriteria): Promise<PromptXRole[]>;

  /**
   * 获取所有角色
   */
  findAll(): Promise<PromptXRole[]>;

  /**
   * 根据分类获取角色
   */
  findByCategory(category: string): Promise<PromptXRole[]>;

  /**
   * 获取最近使用的角色
   */
  findRecentlyUsed(limit: number): Promise<PromptXRole[]>;

  /**
   * 获取最活跃的角色
   */
  findMostActive(limit: number): Promise<PromptXRole[]>;

  /**
   * 保存角色
   */
  save(role: PromptXRole): Promise<void>;

  /**
   * 删除角色
   */
  delete(id: RoleId): Promise<void>;

  /**
   * 检查角色是否存在
   */
  exists(id: RoleId): Promise<boolean>;

  /**
   * 获取角色统计信息
   */
  getStats(): Promise<RoleStats>;
}

export interface RoleSearchCriteria {
  searchTerm?: string;
  category?: string;
  tags?: string[];
  isActivated?: boolean;
  limit?: number;
  offset?: number;
}

export interface RoleStats {
  totalRoles: number;
  activeRoles: number;
  categoriesCount: number;
  mostUsedRole?: {
    id: string;
    name: string;
    activationCount: number;
  };
  recentActivity: Array<{
    roleId: string;
    roleName: string;
    lastActivated: Date;
  }>;
}