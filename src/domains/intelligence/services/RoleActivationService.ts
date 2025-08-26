/**
 * 角色激活领域服务
 * 🏗️ DDD重构: 负责PromptX角色的发现、加载和激活逻辑
 */

import { PromptXRole, RoleActivationContext } from '../entities/PromptXRole';
import { RoleId } from '../value-objects/RoleId';
import { PromptContent } from '../value-objects/PromptContent';
import { IRoleRepository } from '../repositories/IRoleRepository';
import { RoleActivated } from '../events/RoleActivated';
import { RoleDeactivated } from '../events/RoleDeactivated';
import { RoleActivationFailed } from '../events/RoleActivationFailed';

export interface PromptXProvider {
  getRoleContent(roleId: string): Promise<string | null>;
  listAvailableRoles(): Promise<string[]>;
}

export class RoleActivationService {
  private _activeRole?: PromptXRole;
  private readonly _activationCache = new Map<string, PromptXRole>();

  constructor(
    private readonly roleRepository: IRoleRepository,
    private readonly promptxProvider: PromptXProvider,
    private readonly eventPublisher: (event: any) => void
  ) {}

  /**
   * 激活指定角色
   */
  async activateRole(
    roleId: RoleId,
    context: RoleActivationContext
  ): Promise<PromptXRole> {
    try {
      // 如果当前已有激活的角色，先停用
      if (this._activeRole) {
        await this.deactivateCurrentRole();
      }

      // 获取或加载角色
      let role = await this.getOrLoadRole(roleId);
      
      // 激活角色
      role.activate(context);
      this._activeRole = role;

      // 缓存激活的角色
      this._activationCache.set(context.sessionId, role);

      // 保存到仓储
      await this.roleRepository.save(role);

      // 发布角色激活事件
      this.eventPublisher(new RoleActivated(
        role.id,
        role.getDisplayName(),
        context.sessionId,
        context.currentModel
      ));

      return role;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 发布角色激活失败事件
      this.eventPublisher(new RoleActivationFailed(
        roleId,
        context.sessionId,
        errorMessage
      ));

      throw error;
    }
  }

  /**
   * 停用当前角色
   */
  async deactivateCurrentRole(): Promise<void> {
    if (!this._activeRole) {
      return;
    }

    const roleId = this._activeRole.id;
    const roleName = this._activeRole.getDisplayName();
    const sessionId = this._activeRole.activationContext?.sessionId;

    this._activeRole.deactivate();
    await this.roleRepository.save(this._activeRole);

    // 发布角色停用事件
    this.eventPublisher(new RoleDeactivated(
      roleId,
      roleName,
      sessionId
    ));

    this._activeRole = undefined;
  }

  /**
   * 获取当前激活的角色
   */
  getCurrentRole(): PromptXRole | undefined {
    return this._activeRole;
  }

  /**
   * 检查角色是否已激活
   */
  isRoleActive(roleId: RoleId): boolean {
    return this._activeRole?.id.equals(roleId) && this._activeRole.isActivated;
  }

  /**
   * 获取会话的激活角色
   */
  getSessionRole(sessionId: string): PromptXRole | undefined {
    return this._activationCache.get(sessionId);
  }

  /**
   * 刷新当前角色内容（从PromptX重新加载）
   */
  async refreshCurrentRole(): Promise<PromptXRole | undefined> {
    if (!this._activeRole || !this._activeRole.activationContext) {
      return undefined;
    }

    const roleId = this._activeRole.id;
    const context = this._activeRole.activationContext;

    // 从PromptX重新加载角色内容
    const freshContent = await this.promptxProvider.getRoleContent(roleId.value);
    if (!freshContent) {
      throw new Error(`无法刷新角色内容: ${roleId.value}`);
    }

    // 更新角色内容
    this._activeRole.updateContent(PromptContent.fromString(freshContent));
    
    // 重新激活以使用新内容
    this._activeRole.activate(context);
    
    await this.roleRepository.save(this._activeRole);

    return this._activeRole;
  }

  /**
   * 列出可用的角色
   */
  async listAvailableRoles(): Promise<RoleId[]> {
    try {
      const roleIds = await this.promptxProvider.listAvailableRoles();
      return roleIds.map(id => new RoleId(id));
    } catch (error) {
      console.error('获取可用角色列表失败:', error);
      return [];
    }
  }

  /**
   * 验证角色是否可用
   */
  async validateRole(roleId: RoleId): Promise<boolean> {
    try {
      const content = await this.promptxProvider.getRoleContent(roleId.value);
      return content !== null && content.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 创建默认角色
   */
  async ensureDefaultRole(): Promise<PromptXRole> {
    const defaultRoleId = RoleId.default();
    
    try {
      // 尝试从仓储获取
      let defaultRole = await this.roleRepository.findById(defaultRoleId);
      
      if (!defaultRole) {
        // 创建默认角色
        defaultRole = PromptXRole.createDefault();
        await this.roleRepository.save(defaultRole);
      }
      
      return defaultRole;
    } catch (error) {
      // 如果失败，返回内存中的默认角色
      return PromptXRole.createDefault();
    }
  }

  /**
   * 获取或加载角色
   */
  private async getOrLoadRole(roleId: RoleId): Promise<PromptXRole> {
    // 先尝试从仓储获取
    let role = await this.roleRepository.findById(roleId);
    
    if (!role) {
      // 从PromptX加载
      const content = await this.promptxProvider.getRoleContent(roleId.value);
      
      if (!content) {
        throw new Error(`角色不存在或无法加载: ${roleId.value}`);
      }

      // 创建新角色实体
      role = PromptXRole.create(
        roleId.value,
        content,
        {
          name: roleId.value,
          description: 'PromptX角色',
          category: 'promptx'
        }
      );

      // 保存到仓储以便下次使用
      await this.roleRepository.save(role);
    }

    return role;
  }

  /**
   * 清理激活缓存
   */
  clearActivationCache(): void {
    this._activationCache.clear();
  }

  /**
   * 获取激活统计信息
   */
  getActivationStats(): {
    currentRole: string | null;
    cachedSessions: number;
    totalActivations: number;
  } {
    const currentRole = this._activeRole?.getDisplayName() || null;
    const cachedSessions = this._activationCache.size;
    const totalActivations = Array.from(this._activationCache.values())
      .reduce((total, role) => total + role.activationCount, 0);

    return {
      currentRole,
      cachedSessions,
      totalActivations
    };
  }
}