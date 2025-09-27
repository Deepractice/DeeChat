/**
 * 🏛️ RoleManagementDomain - 角色管理领域聚合根 (模块入口)
 *
 * 📍 这是角色管理功能的统一入口和协调者，采用Python风格的模块组织
 * 📂 具体实现分布在当前目录的子文件夹中
 *
 * 核心职责:
 * - 作为角色管理领域的统一入口和协调者
 * - 管理 PromptX 角色发现和激活功能
 * - 提供角色缓存和统计管理
 * - 暴露统一的 IPC 接口给前端使用
 *
 * 设计原则:
 * - 简单实用，遵循奥卡姆剃刀定律
 * - 用户需求到简单接口的直接映射
 * - 基于 @promptx/core 包构建
 *
 * 🔗 依赖组件:
 *   - ./services/     业务服务层
 *   - ./adapters/     接口适配层
 *   - ./types/        类型定义层
 */

import { Service } from 'typedi'
import { IDomain } from '../../ipc/ipc-registry.js'

// 导入各个领域服务和组件
import { RoleDiscoveryService } from './services/RoleDiscoveryService.js'
import { RoleActivationService } from './services/RoleActivationService.js'
import { IPCAdapter } from './adapters/IPCAdapter.js'

// 导入类型定义
import {
  Role,
  RoleActivationResult,
  DiscoveryResult,
  RoleStats
} from './types/RoleTypes.js'

/**
 * RoleManagementDomain类 - 聚合根实现
 *
 * 作为角色管理领域的聚合根，负责：
 * - 初始化和管理所有领域服务
 * - 提供统一的业务接口
 * - 协调各服务间的交互
 * - 管理领域资源的生命周期
 * - 与 PromptX 系统集成
 */
@Service()
export class RoleManagementDomain implements IDomain {
  // ============ 私有字段 ============

  /** 角色发现服务 */
  private roleDiscoveryService: RoleDiscoveryService | null = null

  /** 角色激活服务 */
  private roleActivationService: RoleActivationService | null = null

  /** IPC适配器 - 暴露IPC接口 */
  private ipcAdapter: IPCAdapter | null = null

  // ============ 构造函数 ============

  constructor() {
    // PromptX Core 自动初始化，无需手动配置
    console.log('🏛️ RoleManagementDomain 聚合根创建')
  }

  // ============ 领域初始化 ============

  /**
   * 初始化角色管理领域服务
   *
   * 执行必要的初始化步骤：
   * 1. 创建各个领域服务
   * 2. 建立服务间的依赖关系
   * 3. PromptX 核心模块自动管理
   */
  async initialize(): Promise<void> {
    console.log('🎯 Initializing RoleManagement domain service...')

    try {
      // 1. 创建角色发现服务 (PromptX CLI已自动初始化，无需额外处理)
      this.roleDiscoveryService = new RoleDiscoveryService()
      console.log('✅ RoleDiscoveryService 初始化完成')

      // 2. 创建角色激活服务 (PromptX CLI已自动初始化，无需额外处理)
      this.roleActivationService = new RoleActivationService()
      console.log('✅ RoleActivationService 初始化完成')

      // 3. 创建IPC适配器（依赖所有服务）
      this.ipcAdapter = new IPCAdapter(
        this.roleDiscoveryService,
        this.roleActivationService
      )
      console.log('✅ IPCAdapter 初始化完成')

      console.log('✅ RoleManagement domain service initialized successfully')

    } catch (error) {
      console.error('❌ RoleManagement domain service initialization failed:', error)
      throw error
    }
  }

  // ============ IPC接口暴露 ============

  /**
   * 暴露角色管理领域的IPC接口
   *
   * 将领域服务的方法暴露给IPC层，供渲染进程调用
   * 通过IPCAdapter统一管理所有IPC接口
   *
   * @returns IPC方法映射表
   */
  exposeToIPC(): Record<string, Function> {
    console.log('🔧 RoleManagementDomain聚合根注册IPC接口...')

    if (!this.ipcAdapter) {
      throw new Error('IPCAdapter未初始化，请先调用initialize方法')
    }

    const ipcHandlers = this.ipcAdapter.exposeToIPC()

    console.log(`✅ RoleManagementDomain聚合根IPC接口注册完成: ${Object.keys(ipcHandlers).length}个方法`)
    console.log('📋 注册的IPC方法:', Object.keys(ipcHandlers).join(', '))

    return ipcHandlers
  }

  // ============ 领域业务接口（可选，用于内部调用）============

  /**
   * 获取角色发现服务实例
   * 用于其他领域需要访问角色发现功能时
   */
  getRoleDiscoveryService(): RoleDiscoveryService {
    if (!this.roleDiscoveryService) {
      throw new Error('RoleDiscoveryService未初始化，请先调用initialize方法')
    }
    return this.roleDiscoveryService
  }

  /**
   * 获取角色激活服务实例
   * 用于其他领域需要访问角色激活功能时
   */
  getRoleActivationService(): RoleActivationService {
    if (!this.roleActivationService) {
      throw new Error('RoleActivationService未初始化，请先调用initialize方法')
    }
    return this.roleActivationService
  }

  // ============ 便捷访问方法 ============

  /**
   * 获取所有可用角色
   */
  async getRoles(): Promise<Role[]> {
    if (!this.roleDiscoveryService) {
      throw new Error('RoleDiscoveryService未初始化，请先调用initialize方法')
    }
    return await this.roleDiscoveryService.getRoles()
  }

  /**
   * 根据ID获取角色
   */
  async getRoleById(roleId: string): Promise<Role | null> {
    if (!this.roleDiscoveryService) {
      throw new Error('RoleDiscoveryService未初始化，请先调用initialize方法')
    }
    return await this.roleDiscoveryService.getRoleById(roleId)
  }

  /**
   * 激活角色
   */
  async activateRole(roleId: string): Promise<RoleActivationResult> {
    if (!this.roleActivationService) {
      throw new Error('RoleActivationService未初始化，请先调用initialize方法')
    }
    return await this.roleActivationService.activateRole(roleId)
  }

  /**
   * 发现资源
   */
  async discoverResources(focus?: 'all' | 'roles' | 'tools'): Promise<DiscoveryResult> {
    if (!this.roleDiscoveryService) {
      throw new Error('RoleDiscoveryService未初始化，请先调用initialize方法')
    }
    return await this.roleDiscoveryService.discoverResources(focus)
  }

  /**
   * 获取角色统计信息
   */
  async getRoleStats(): Promise<RoleStats> {
    if (!this.roleActivationService) {
      throw new Error('RoleActivationService未初始化，请先调用initialize方法')
    }
    return await this.roleActivationService.getRoleStats()
  }

  // ============ IDomain 接口实现 ============

  /**
   * 获取领域名称
   */
  getDomainName(): string {
    return 'RoleManagement'
  }

  // ============ 系统监控方法 ============

  /**
   * 系统健康检查
   *
   * @returns 健康状态报告
   */
  healthCheck(): any {
    return {
      role_discovery_service_initialized: !!this.roleDiscoveryService,
      role_activation_service_initialized: !!this.roleActivationService,
      ipc_adapter_initialized: !!this.ipcAdapter,
      cache_status: this.roleDiscoveryService?.getCacheStatus() || null
    }
  }

  // ============ 资源管理方法 ============

  /**
   * 清理资源
   *
   * 应用关闭时调用，确保资源正确释放：
   * - 清理角色缓存
   * - 重置激活统计
   * - 清理各服务实例
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up RoleManagement domain service...')

    try {
      // 清理角色发现服务缓存
      if (this.roleDiscoveryService) {
        this.roleDiscoveryService.clearCache()
        console.log('✅ RoleDiscoveryService cleanup completed')
      }

      // 清理角色激活统计
      if (this.roleActivationService) {
        this.roleActivationService.clearActivationStats()
        console.log('✅ RoleActivationService cleanup completed')
      }

      // 清理服务实例引用
      this.roleDiscoveryService = null
      this.roleActivationService = null
      this.ipcAdapter = null

      console.log('✅ RoleManagement domain service cleanup completed')
    } catch (error) {
      console.error('❌ RoleManagement domain service cleanup failed:', error)
    }
  }
}

// ============ 类型导出 ============

// 导出类型供其他模块使用
export type {
  Role,
  RoleActivationResult,
  DiscoveryResult,
  RoleStats,
  PouchCommand
} from './types/RoleTypes.js'