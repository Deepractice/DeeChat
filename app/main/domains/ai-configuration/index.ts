/**
 * 🏛️ AIConfigurationDomain - AI配置领域聚合根 (模块入口)
 *
 * 📍 这是AI配置功能的统一入口和协调者，采用Python风格的模块组织
 * 📂 具体实现分布在当前目录的子文件夹中
 *
 * 核心职责：
 * - 作为AI配置领域的统一入口和协调者
 * - 管理AI配置的生命周期（创建、查询、更新、删除）
 * - 处理AI模型的发现和偏好设置
 * - 协调各个服务和组件的业务流程
 *
 * 架构特点：
 * - 采用DDD聚合根模式，职责单一且清晰
 * - 通过依赖注入管理各个领域服务
 * - 提供统一的错误处理和日志记录
 * - 支持优雅的资源管理和清理
 *
 * 🔗 依赖组件:
 *   - ./services/     业务服务层
 *   - ./utils/        工具函数层
 *   - ./adapters/     接口适配层
 *   - ./types/        类型定义层
 */

import { Service } from 'typedi'
import { DatabaseConfig } from '../../config/database.config.js'
import { BetterSQLite3Adapter } from '@deepracticex/database-adapter'
import { AIConfigManager } from '@deepracticex/ai-config'
import { IDomain } from '../../ipc/ipc-registry.js'

// 导入各个领域服务和组件
import { ConfigurationService } from './services/ConfigurationService.js'
import { ModelService } from './services/ModelService.js'
import { IPCAdapter } from './adapters/IPCAdapter.js'

/**
 * AIConfigurationDomain类 - 聚合根实现
 *
 * 作为AI配置领域的聚合根，负责：
 * - 初始化和管理所有领域服务
 * - 提供统一的业务接口
 * - 协调各服务间的交互
 * - 管理领域资源的生命周期
 */
@Service()
export class AIConfigurationDomain implements IDomain {
  // ============ 私有字段 ============

  /** 初始化状态标志，防止重复初始化 */
  private initialized = false

  /** AI配置管理器实例 */
  private aiConfigManager: AIConfigManager | null = null

  /** 配置管理服务 */
  private configurationService: ConfigurationService | null = null

  /** 模型管理服务 */
  private modelService: ModelService | null = null

  /** IPC适配器 - 暴露IPC接口 */
  private ipcAdapter: IPCAdapter | null = null

  // ============ 构造函数 ============

  /**
   * 构造函数
   * 注意：所有服务将在initialize()中创建和配置
   */
  constructor() {
    console.log('🏗️ AIConfigurationDomain聚合根构造中...')
  }

  // ============ 领域初始化 ============

  /**
   * 初始化AI配置领域服务
   *
   * 执行必要的初始化步骤：
   * 1. 获取标准化的数据库路径配置
   * 2. 执行数据迁移（如果需要）
   * 3. 初始化底层ai-config包
   * 4. 建立数据库连接和表结构
   * 5. 创建并初始化各个领域服务
   *
   * @throws {Error} 初始化失败时抛出错误
   */
  async initialize(): Promise<void> {
    // 防止重复初始化
    if (this.initialized) return

    try {
      console.log('🔧 初始化AI配置领域...')

      // 1. 获取数据库配置管理器
      const dbConfig = DatabaseConfig.getInstance()
      const dbPath = dbConfig.getDatabasePath()

      console.log(`🗄️ 使用数据库路径: ${dbPath}`)

      // 2. 尝试从旧路径迁移数据
      if (!dbConfig.databaseExists()) {
        console.log('📦 检测到首次启动或需要数据迁移...')
        const migrationResult = await dbConfig.autoMigrateFromCommonPaths()

        if (migrationResult.successful.length > 0) {
          console.log(`✅ 数据迁移完成，来源: ${migrationResult.successful[0]}`)
        } else {
          console.log('📝 未找到旧数据，将创建新数据库')
        }
      }

      // 3. 创建数据库适配器
      const adapter = new BetterSQLite3Adapter(dbPath)
      await adapter.connect()

      // 4. 创建AI配置管理器实例
      this.aiConfigManager = new AIConfigManager({ database: adapter })
      await this.aiConfigManager.initialize()

      console.log('✅ AIConfigManager 初始化完成')

      // 5. 创建各个领域服务
      this.configurationService = new ConfigurationService(this.aiConfigManager)
      console.log('✅ ConfigurationService 初始化完成')

      this.modelService = new ModelService(this.aiConfigManager)
      console.log('✅ ModelService 初始化完成')

      // 6. 创建IPC适配器（依赖所有服务）
      this.ipcAdapter = new IPCAdapter(
        this.configurationService,
        this.modelService
      )
      console.log('✅ IPCAdapter 初始化完成')

      this.initialized = true
      console.log('✅ AI配置领域初始化完成')

      // 7. 显示数据库状态信息
      const stats = dbConfig.getDatabaseStats()
      if (stats) {
        console.log(`📊 数据库状态: ${Math.round(stats.size / 1024)}KB, 修改时间: ${stats.mtime.toISOString()}`)
      }

    } catch (error: any) {
      console.error('❌ AI配置领域初始化失败:', error)
      throw error  // 重新抛出错误，让上层处理
    }
  }

  // ============ IPC接口暴露 ============

  /**
   * 暴露AI配置领域的IPC接口
   *
   * 将领域服务的方法暴露给IPC层，供渲染进程调用
   * 通过IPCAdapter统一管理所有IPC接口
   *
   * @returns IPC方法映射表
   */
  exposeToIPC(): Record<string, Function> {
    console.log('🔧 AIConfigurationDomain聚合根注册IPC接口...')

    if (!this.ipcAdapter) {
      throw new Error('IPCAdapter未初始化，请先调用initialize方法')
    }

    const ipcHandlers = this.ipcAdapter.exposeToIPC()

    console.log(`✅ AIConfigurationDomain聚合根IPC接口注册完成: ${Object.keys(ipcHandlers).length}个方法`)
    console.log('📋 注册的IPC方法:', Object.keys(ipcHandlers).join(', '))

    return ipcHandlers
  }

  // ============ 领域业务接口（可选，用于内部调用）============

  /**
   * 获取配置管理服务实例
   * 用于其他领域需要访问配置功能时
   */
  getConfigurationService(): ConfigurationService {
    if (!this.configurationService) {
      throw new Error('ConfigurationService未初始化，请先调用initialize方法')
    }
    return this.configurationService
  }

  /**
   * 获取模型管理服务实例
   * 用于其他领域需要访问模型功能时
   */
  getModelService(): ModelService {
    if (!this.modelService) {
      throw new Error('ModelService未初始化，请先调用initialize方法')
    }
    return this.modelService
  }

  // ============ 系统监控方法 ============

  /**
   * 系统健康检查
   *
   * @returns 健康状态报告
   */
  healthCheck(): any {
    return {
      ai_config_manager_initialized: !!this.aiConfigManager,
      configuration_service_initialized: !!this.configurationService,
      model_service_initialized: !!this.modelService,
      ipc_adapter_initialized: !!this.ipcAdapter
    }
  }

  // ============ 资源管理方法 ============

  /**
   * 关闭并清理所有资源
   *
   * 应用关闭时调用，确保资源正确释放：
   * - 关闭数据库连接
   * - 清理各服务实例
   */
  async close(): Promise<void> {
    console.log('🔄 AIConfigurationDomain聚合根开始资源清理...')

    try {
      // 关闭AI配置管理器
      if (this.aiConfigManager) {
        await this.aiConfigManager.close()
        console.log('✅ AIConfigManager 连接已关闭')
      }

      // 清理服务实例引用
      this.configurationService = null
      this.modelService = null
      this.ipcAdapter = null
      this.aiConfigManager = null

      console.log('✅ AIConfigurationDomain聚合根资源清理完成')
    } catch (error) {
      console.error('❌ AIConfigurationDomain聚合根资源清理失败:', error)
      throw error
    }
  }

  // ============ 私有辅助方法 ============

  /**
   * 确保领域服务已初始化
   *
   * 在执行任何业务操作前调用此方法，
   * 如果未初始化则自动执行初始化
   *
   * @private
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }
}