/**
 * 🏛️ ConversationDomain - 对话领域聚合根 (模块入口)
 *
 * 📍 这是对话功能的统一入口和协调者，采用Python风格的模块组织
 * 📂 具体实现分布在当前目录的子文件夹中
 *
 * 核心职责：
 * - 作为对话领域的统一入口和协调者
 * - 实现IDomain接口，提供IPC接口暴露
 * - 协调各个服务和仓储的业务流程
 * - 管理领域的生命周期和资源
 *
 * 架构特点：
 * - 采用DDD聚合根模式，职责单一且清晰
 * - 通过依赖注入管理各个领域服务
 * - 提供统一的错误处理和日志记录
 * - 支持优雅的资源管理和清理
 *
 * 🔗 依赖组件:
 *   - ./services/     业务服务层
 *   - ./repositories/ 数据访问层
 *   - ./adapters/     接口适配层
 *   - ./types/        类型定义层
 */

import { Service, Container } from 'typedi'
import { BetterSQLite3Adapter } from '@deepracticex/database-adapter'
import { ConversationStorage } from '@deepracticex/conversation-storage'
import { IDomain } from '../../ipc/ipc-registry.js'
import { DatabaseConfig } from '../../config/database.config.js'

// 导入各个领域服务和组件 (相对路径)
import { SessionService } from './services/SessionService.js'
import { MessageService } from './services/MessageService.js'
import { ToolCallService } from './services/ToolCallService.js'
import { ConversationRepository } from './repositories/ConversationRepository.js'
import { IPCAdapter } from './adapters/IPCAdapter.js'

// 导入类型定义 (相对路径)
import type {
  ConversationSession,
  CreateSessionInput,
  SendMessageInput,
  ConversationMessage
} from './types/ConversationTypes.js'

/**
 * ConversationDomain类 - 聚合根实现
 *
 * 作为对话领域的聚合根，负责：
 * - 初始化和管理所有领域服务
 * - 提供统一的业务接口
 * - 协调各服务间的交互
 * - 管理领域资源的生命周期
 */
@Service()
export class ConversationDomain implements IDomain {
  // ============ 私有字段 ============

  /** 对话存储管理器，负责数据持久化 */
  private conversationStorage: ConversationStorage | null = null

  /** 会话服务 - 管理对话会话生命周期 */
  private sessionService: SessionService | null = null

  /** 消息服务 - 处理AI消息发送和响应 */
  private messageService: MessageService | null = null

  /** 工具调用服务 - 处理MCP工具调用 */
  private toolCallService: ToolCallService | null = null

  /** 对话仓储 - 数据访问层 */
  private conversationRepository: ConversationRepository | null = null

  /** IPC适配器 - 暴露IPC接口 */
  private ipcAdapter: IPCAdapter | null = null

  // ============ 构造函数 ============

  /**
   * 构造函数
   * 注意：所有服务将在initialize()中创建和配置
   */
  constructor() {
    console.log('🏗️ ConversationDomain聚合根构造中...')
  }

  // ============ 领域初始化 ============

  /**
   * 初始化领域服务
   *
   * 执行必要的初始化步骤：
   * 1. 获取标准化的数据库路径配置
   * 2. 创建ConversationStorage实例
   * 3. 初始化存储层（创建数据库表、索引等）
   * 4. 创建并初始化各个领域服务
   * 5. 建立服务间的依赖关系
   *
   * @throws {Error} 初始化失败时抛出错误
   */
  async initialize(): Promise<void> {
    console.log('🤖 初始化ConversationDomain聚合根...')

    try {
      // 1. 获取统一的数据库配置
      const dbConfig = DatabaseConfig.getInstance()
      const dbPath = dbConfig.getDatabasePath()

      console.log(`🗄️ ConversationDomain使用数据库路径: ${dbPath}`)

      // 2. 创建数据库适配器
      const adapter = new BetterSQLite3Adapter(dbPath)
      await adapter.connect()

      // 3. 创建对话存储管理器实例
      this.conversationStorage = new ConversationStorage({
        database: adapter
        // 让conversation-storage包自己决定表名，使用内部默认值
      })
      await this.conversationStorage.initialize()
      console.log('✅ ConversationStorage 初始化完成')

      // 4. 创建仓储层
      this.conversationRepository = new ConversationRepository()
      this.conversationRepository.setStorage(this.conversationStorage)
      console.log('✅ ConversationRepository 初始化完成')

      // 5. 创建工具调用服务（使用 Container.get 支持依赖注入）
      this.toolCallService = Container.get(ToolCallService)
      console.log('✅ ToolCallService 初始化完成')

      // 6. 创建消息服务（使用 Container.get 支持依赖注入）
      this.messageService = Container.get(MessageService)
      // 手动设置构造函数依赖
      ;(this.messageService as any).conversationRepository = this.conversationRepository
      ;(this.messageService as any).toolCallService = this.toolCallService
      console.log('✅ MessageService 初始化完成')

      // 7. 创建会话服务（依赖仓储）
      this.sessionService = new SessionService(this.conversationRepository)
      console.log('✅ SessionService 初始化完成')

      // 8. 创建IPC适配器（依赖所有服务）
      this.ipcAdapter = new IPCAdapter(
        this.sessionService,
        this.messageService,
        this.conversationRepository
      )
      console.log('✅ IPCAdapter 初始化完成')

      console.log('✅ ConversationDomain聚合根初始化完成')
    } catch (error) {
      console.error('❌ ConversationDomain聚合根初始化失败:', error)
      throw error  // 重新抛出错误，让上层处理
    }
  }

  // ============ IPC接口暴露 ============

  /**
   * 暴露IPC接口
   *
   * 将领域服务的方法暴露给IPC层，供渲染进程调用
   * 通过IPCAdapter统一管理所有IPC接口
   *
   * @returns IPC方法映射表
   */
  exposeToIPC(): Record<string, Function> {
    console.log('🤖 ConversationDomain聚合根注册IPC接口...')

    if (!this.ipcAdapter) {
      throw new Error('IPCAdapter未初始化，请先调用initialize方法')
    }

    const ipcHandlers = this.ipcAdapter.exposeToIPC()

    console.log(`✅ ConversationDomain聚合根IPC接口注册完成: ${Object.keys(ipcHandlers).length}个方法`)
    console.log('📋 注册的IPC方法:', Object.keys(ipcHandlers).join(', '))

    return ipcHandlers
  }

  // ============ 领域业务接口（可选，用于内部调用）============

  /**
   * 获取会话服务实例
   * 用于其他领域需要访问会话功能时
   */
  getSessionService(): SessionService {
    if (!this.sessionService) {
      throw new Error('SessionService未初始化，请先调用initialize方法')
    }
    return this.sessionService
  }

  /**
   * 获取消息服务实例
   * 用于其他领域需要访问消息功能时
   */
  getMessageService(): MessageService {
    if (!this.messageService) {
      throw new Error('MessageService未初始化，请先调用initialize方法')
    }
    return this.messageService
  }

  /**
   * 获取对话仓储实例
   * 用于其他领域需要直接访问数据时
   */
  getConversationRepository(): ConversationRepository {
    if (!this.conversationRepository) {
      throw new Error('ConversationRepository未初始化，请先调用initialize方法')
    }
    return this.conversationRepository
  }

  // ============ 系统监控方法 ============

  /**
   * 获取系统统计信息
   *
   * @returns 统计数据对象
   */
  async getStats(): Promise<any> {
    if (!this.conversationRepository) {
      throw new Error('ConversationRepository未初始化')
    }
    return await this.conversationRepository.getStats()
  }

  /**
   * 系统健康检查
   *
   * @returns 健康状态报告
   */
  healthCheck(): any {
    const messageServiceStats = this.messageService?.getCacheStats() || { activeClients: 0 }

    return {
      conversation_storage_initialized: !!this.conversationStorage,
      session_service_initialized: !!this.sessionService,
      message_service_initialized: !!this.messageService,
      tool_call_service_initialized: !!this.toolCallService,
      conversation_repository_initialized: !!this.conversationRepository,
      ipc_adapter_initialized: !!this.ipcAdapter,
      active_ai_clients: messageServiceStats.activeClients
    }
  }

  // ============ 资源管理方法 ============

  /**
   * 关闭并清理所有资源
   *
   * 应用关闭时调用，确保资源正确释放：
   * - 清理消息服务的AI客户端缓存
   * - 关闭数据库连接
   * - 清理各服务实例
   */
  async close(): Promise<void> {
    console.log('🔄 ConversationDomain聚合根开始资源清理...')

    try {
      // 清理消息服务缓存
      if (this.messageService) {
        this.messageService.clearClientCache()
        console.log('✅ MessageService 缓存已清理')
      }

      // 清理对话仓储缓存
      if (this.conversationRepository) {
        await this.conversationRepository.clearCache()
        console.log('✅ ConversationRepository 缓存已清理')
      }

      // 关闭存储层连接
      if (this.conversationStorage) {
        await this.conversationStorage.close()
        console.log('✅ ConversationStorage 连接已关闭')
      }

      // 清理服务实例引用
      this.sessionService = null
      this.messageService = null
      this.toolCallService = null
      this.conversationRepository = null
      this.ipcAdapter = null
      this.conversationStorage = null

      console.log('✅ ConversationDomain聚合根资源清理完成')
    } catch (error) {
      console.error('❌ ConversationDomain聚合根资源清理失败:', error)
      throw error
    }
  }
}