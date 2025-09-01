import { CoreLLMService } from './CoreLLMService'
import { IConfigManager } from './managers/IConfigManager'
import { IModelManager } from './managers/IModelManager'
import { IPromptBuilder } from './managers/IPromptBuilder'
import { ConfigManager } from './managers/ConfigManager'
import { ModelManager } from './managers/ModelManager'
import { StreamProcessor } from '../streaming/StreamProcessor'
import { PromptBuilder } from './managers/PromptBuilder'
import { MCPClient } from '../mcp/client/MCPClient'
import log from 'electron-log'

/**
 * CoreLLMService工厂类
 * 
 * 负责创建和配置CoreLLMService实例
 * 使用工厂模式隐藏复杂的依赖注入逻辑
 */
export class CoreLLMServiceFactory {
  /**
   * 创建CoreLLMService实例
   * 
   * @param mcpClient 可选的MCP客户端实例
   * @returns 配置完整的CoreLLMService实例
   */
  static create(mcpClient?: MCPClient): CoreLLMService {
    log.info('🏭 [CoreLLMServiceFactory] 开始创建CoreLLMService实例')

    // 1. 创建默认MCP客户端（如果未提供）
    const finalMcpClient = mcpClient || CoreLLMServiceFactory.createDefaultMCPClient()

    // 2. 创建各个管理器的实现类（注入MCP客户端到需要的组件）
    const configManager = CoreLLMServiceFactory.createConfigManager()
    const modelManager = CoreLLMServiceFactory.createModelManager()
    const streamProcessor = CoreLLMServiceFactory.createStreamProcessor(finalMcpClient)
    const promptBuilder = CoreLLMServiceFactory.createPromptBuilder()

    // 3. 创建CoreLLMService实例
    const service = new CoreLLMService(
      configManager,
      modelManager,
      streamProcessor,
      promptBuilder,
      finalMcpClient
    )

    log.info('🏭 [CoreLLMServiceFactory] CoreLLMService实例创建完成')
    return service
  }

  /**
   * 创建配置管理器
   * 
   * @returns 配置管理器实例
   */
  private static createConfigManager(): IConfigManager {
    return new ConfigManager()
  }

  /**
   * 创建模型管理器
   * 
   * @returns 模型管理器实例
   */
  private static createModelManager(): IModelManager {
    return new ModelManager()
  }

  /**
   * 创建流式处理器
   * 
   * @param mcpClient MCP客户端实例
   * @returns 流式处理器实例
   */
  private static createStreamProcessor(mcpClient?: MCPClient): StreamProcessor {
    // ✅ 使用新的简洁流式处理器
    return new StreamProcessor(mcpClient)
  }

  // createToolIntegrator 方法已删除，工具集成已简化

  /**
   * 创建提示词构建器
   * 
   * @returns 提示词构建器实例
   */
  private static createPromptBuilder(): IPromptBuilder {
    return new PromptBuilder()
  }

  /**
   * 创建默认MCP客户端
   * 
   * @returns MCP客户端实例
   */
  private static createDefaultMCPClient(): MCPClient {
    log.info('🔌 [CoreLLMServiceFactory] 创建默认MCP客户端')
    const mcpClient = new MCPClient()
    
    // TODO: 在这里可以添加默认的MCP服务器连接
    // 例如：连接到已配置的PromptX服务器
    
    return mcpClient
  }
}