import 'reflect-metadata'
import { Container } from 'typedi'
import { AIConfigurationDomain } from '../domains/ai-configuration/index.js'
import { ConversationDomain } from '../domains/conversation/index.js'
import { RoleManagementDomain } from '../domains/role-management/index.js'
import { McpDomain } from '../domains/mcp/index.js'
import { WindowManager } from './window-manager.js'

/**
 * 应用启动器 - 负责应用的初始化和启动流程
 * 
 * 职责：
 * - 初始化typedi容器
 * - 注册基础设施服务
 * - 按序初始化Domain服务
 * - 为IPCRegistry提供服务解析适配
 */
export class ApplicationBootstrapper {
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    
    console.log('🚀 DeeChat应用启动中...')

    // 1. 注册基础设施服务 (非@Service装饰的类)
    this.registerInfrastructureServices()

    // 2. 按序初始化核心Domain服务
    await this.initializeDomains()
    
    this.initialized = true
    console.log('✅ 应用启动完成')
  }

  /**
   * 注册基础设施服务
   * 这些服务没有@Service装饰器，需要手动注册到typedi容器
   */
  private registerInfrastructureServices(): void {
    Container.set('WindowManager', new WindowManager())
    console.log('🔧 基础设施服务注册完成')
  }

  /**
   * 按序初始化核心Domain服务
   * 确保有依赖关系的Domain按正确顺序初始化
   */
  private async initializeDomains(): Promise<void> {
    console.log('🎯 开始Domain初始化')

    // 1. 初始化AI配置域 (使用统一的数据库)
    const aiConfigDomain = Container.get(AIConfigurationDomain)
    await aiConfigDomain.initialize()

    // 等待一小段时间，确保数据库完全释放资源
    await new Promise(resolve => setTimeout(resolve, 100))

    // 2. 初始化MCP域 (外部工具集成) - 必须在ConversationDomain之前初始化
    const mcpDomain = Container.get(McpDomain)
    await mcpDomain.initialize()

    // 等待一小段时间，确保数据库完全释放资源
    await new Promise(resolve => setTimeout(resolve, 100))

    // 3. 初始化对话域 (依赖McpDomain，必须在其之后)

    // 🚨 DEBUG: 验证Container中McpDomain的状态
    console.log('🔍 [DEBUG] Container中McpDomain验证:', {
      mcpDomainFromContainer: Container.get(McpDomain),
      mcpDomainType: typeof Container.get(McpDomain),
      mcpDomainConstructor: Container.get(McpDomain)?.constructor?.name,
      hasCallTool: typeof Container.get(McpDomain)?.callTool,
      mcpDomainInstance: Container.get(McpDomain) === mcpDomain
    })

    const conversationDomain = Container.get(ConversationDomain)
    await conversationDomain.initialize()

    // 等待一小段时间，确保数据库完全释放资源
    await new Promise(resolve => setTimeout(resolve, 100))

    // 4. 初始化角色管理域 (PromptX适配层)
    const roleManagementDomain = Container.get(RoleManagementDomain)
    await roleManagementDomain.initialize()

    console.log('🎯 核心Domain初始化完成')
  }

  /**
   * 服务解析适配器 - 为IPCRegistry等提供统一的服务解析接口
   * 保持向后兼容性
   */
  resolve<T>(serviceName: string): T {
    try {
      if (serviceName === 'AIConfigurationDomain') {
        return Container.get(AIConfigurationDomain) as T
      }
      if (serviceName === 'ConversationDomain') {
        return Container.get(ConversationDomain) as T
      }
      if (serviceName === 'RoleManagementDomain') {
        return Container.get(RoleManagementDomain) as T
      }
      if (serviceName === 'McpDomain') {
        return Container.get(McpDomain) as T
      }

      // 其他服务使用token解析
      return Container.get(serviceName) as T

    } catch (error: any) {
      throw new Error(`Service resolution failed: ${serviceName}. ${error?.message || String(error)}`)
    }
  }

  /**
   * 获取typedi容器实例 (如果需要直接访问)
   */
  getContainer() {
    return Container
  }
}