/**
 * 角色激活用例
 * 🏗️ DDD重构: 激活PromptX角色的应用服务
 */

import { RoleActivationService } from '../../domains/intelligence/services/RoleActivationService';
import { PromptXRole } from '../../domains/intelligence/entities/PromptXRole';
import { RoleId } from '../../domains/intelligence/value-objects/RoleId';

export interface ActivateRoleRequest {
  roleId: string;
  sessionId: string;
  currentModel: string;
  conversationHistory?: any[];
  userId?: string;
  uiContext?: any;
  forceRefresh?: boolean; // 是否强制刷新角色内容
}

export interface ActivateRoleResponse {
  role: PromptXRole;
  success: boolean;
  error?: string;
  metadata: {
    activationTime: number;
    previousRole?: {
      id: string;
      name: string;
    };
    roleMetadata: {
      name: string;
      description?: string;
      activationCount: number;
      lastActivated: Date;
    };
    contentStats: {
      contentLength: number;
      hasVariables: boolean;
      variableCount: number;
    };
  };
}

/**
 * 角色激活用例 - 处理PromptX角色的完整激活流程
 */
export class ActivateRoleUseCase {
  constructor(
    private readonly roleActivationService: RoleActivationService
  ) {}

  /**
   * 执行角色激活用例
   */
  async execute(request: ActivateRoleRequest): Promise<ActivateRoleResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 记录之前的活跃角色
      const previousRole = this.roleActivationService.getCurrentRole();
      const previousRoleInfo = previousRole ? {
        id: previousRole.id.value,
        name: previousRole.getDisplayName()
      } : undefined;

      // 2. 验证角色是否可用
      const roleId = new RoleId(request.roleId);
      const isRoleValid = await this.roleActivationService.validateRole(roleId);
      
      if (!isRoleValid) {
        throw new Error(`角色不可用或不存在: ${request.roleId}`);
      }

      // 3. 如果需要强制刷新，刷新角色内容
      if (request.forceRefresh) {
        const currentRole = this.roleActivationService.getCurrentRole();
        if (currentRole && currentRole.id.equals(roleId)) {
          await this.roleActivationService.refreshCurrentRole();
        }
      }

      // 4. 准备激活上下文
      const activationContext = {
        sessionId: request.sessionId,
        currentModel: request.currentModel,
        conversationHistory: request.conversationHistory || [],
        userId: request.userId,
        uiContext: request.uiContext
      };

      // 5. 激活角色
      const activatedRole = await this.roleActivationService.activateRole(
        roleId,
        activationContext
      );

      // 6. 分析角色内容统计
      const contentStats = this.analyzeRoleContent(activatedRole);

      // 7. 构建响应
      const activationTime = Date.now() - startTime;
      
      return {
        role: activatedRole,
        success: true,
        metadata: {
          activationTime,
          previousRole: previousRoleInfo,
          roleMetadata: {
            name: activatedRole.getDisplayName(),
            description: activatedRole.metadata.description,
            activationCount: activatedRole.activationCount,
            lastActivated: activatedRole.lastActivated || new Date()
          },
          contentStats
        }
      };

    } catch (error) {
      const activationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        role: {} as PromptXRole, // 错误情况下返回空角色
        success: false,
        error: errorMessage,
        metadata: {
          activationTime,
          roleMetadata: {
            name: 'Unknown',
            activationCount: 0,
            lastActivated: new Date()
          },
          contentStats: {
            contentLength: 0,
            hasVariables: false,
            variableCount: 0
          }
        }
      };
    }
  }

  /**
   * 获取可用角色列表
   */
  async getAvailableRoles(): Promise<{
    roles: Array<{
      id: string;
      name: string;
      description?: string;
      isValidated: boolean;
    }>;
    totalCount: number;
  }> {
    try {
      const roleIds = await this.roleActivationService.listAvailableRoles();
      const roles = [];
      
      for (const roleId of roleIds) {
        try {
          const isValid = await this.roleActivationService.validateRole(roleId);
          roles.push({
            id: roleId.value,
            name: roleId.value, // 简化实现，实际可能需要获取更多元数据
            isValidated: isValid
          });
        } catch (error) {
          roles.push({
            id: roleId.value,
            name: roleId.value,
            isValidated: false
          });
        }
      }
      
      return {
        roles,
        totalCount: roles.length
      };
    } catch (error) {
      console.error('获取可用角色失败:', error);
      return {
        roles: [],
        totalCount: 0
      };
    }
  }

  /**
   * 停用当前角色
   */
  async deactivateCurrentRole(): Promise<{
    success: boolean;
    deactivatedRole?: {
      id: string;
      name: string;
    };
    error?: string;
  }> {
    try {
      const currentRole = this.roleActivationService.getCurrentRole();
      
      if (!currentRole) {
        return {
          success: true // 没有活跃角色也算成功
        };
      }
      
      const roleInfo = {
        id: currentRole.id.value,
        name: currentRole.getDisplayName()
      };
      
      await this.roleActivationService.deactivateCurrentRole();
      
      return {
        success: true,
        deactivatedRole: roleInfo
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 获取当前活跃角色状态
   */
  getCurrentRoleStatus(): {
    hasActiveRole: boolean;
    activeRole?: {
      id: string;
      name: string;
      isActivated: boolean;
      lastActivated?: Date;
      activationCount: number;
      errors: string[];
    };
    activationStats: {
      currentRole: string | null;
      cachedSessions: number;
      totalActivations: number;
    };
  } {
    const currentRole = this.roleActivationService.getCurrentRole();
    const activationStats = this.roleActivationService.getActivationStats();
    
    if (!currentRole) {
      return {
        hasActiveRole: false,
        activationStats
      };
    }
    
    return {
      hasActiveRole: true,
      activeRole: {
        id: currentRole.id.value,
        name: currentRole.getDisplayName(),
        isActivated: currentRole.isActivated,
        lastActivated: currentRole.lastActivated,
        activationCount: currentRole.activationCount,
        errors: [...currentRole.errors]
      },
      activationStats
    };
  }

  /**
   * 分析角色内容统计
   */
  private analyzeRoleContent(role: PromptXRole): {
    contentLength: number;
    hasVariables: boolean;
    variableCount: number;
  } {
    const content = role.content;
    
    return {
      contentLength: content.length,
      hasVariables: content.hasVariables(),
      variableCount: content.getVariablePlaceholders().length
    };
  }

  /**
   * 确保默认角色存在
   */
  async ensureDefaultRole(): Promise<PromptXRole> {
    return await this.roleActivationService.ensureDefaultRole();
  }

  /**
   * 清理角色激活缓存
   */
  clearActivationCache(): void {
    this.roleActivationService.clearActivationCache();
  }
}