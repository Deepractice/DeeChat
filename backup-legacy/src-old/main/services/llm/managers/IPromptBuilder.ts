import { LLMRequest } from '../../../../shared/interfaces/IModelProvider'
import { ModelConfigEntity } from '../../../../shared/entities/ModelConfigEntity'
import { MCPToolEntity } from '../../../../shared/entities/MCPToolEntity'

/**
 * 提示词构建上下文
 */
export interface PromptContext {
  /**
   * 用户请求
   */
  request: LLMRequest

  /**
   * 模型配置
   */
  config: ModelConfigEntity

  /**
   * 可用工具列表
   */
  tools?: MCPToolEntity[]

  /**
   * 聊天历史
   */
  chatHistory?: any[]

  /**
   * UI上下文信息
   */
  uiContext?: {
    selectedRole?: string
    roleActivationRequest?: boolean
    [key: string]: any
  }

  /**
   * 会话上下文
   */
  conversationContext?: {
    sessionId: string
    modelId: string
    roleId?: string
    timestamp: Date
    metadata: any
  }
}

/**
 * 构建结果
 */
export interface BuildResult {
  /**
   * 构建的消息列表
   */
  messages: any[]

  /**
   * 系统提示词
   */
  systemPrompt?: string

  /**
   * 使用的角色ID
   */
  roleId?: string

  /**
   * 是否包含工具
   */
  hasTools: boolean

  /**
   * 构建元数据
   */
  metadata: {
    buildTime: Date
    messageCount: number
    systemPromptLength: number
    toolCount: number
  }
}

/**
 * 提示词构建器接口
 * 负责所有与提示词构建、角色激活、上下文管理相关的逻辑
 */
export interface IPromptBuilder {
  /**
   * 构建完整的消息上下文
   * @param context 构建上下文
   * @returns 构建结果
   */
  build(context: PromptContext): Promise<BuildResult>

  /**
   * 基于PromptX角色内容构建消息上下文
   * @param roleContent 角色内容
   * @param context 构建上下文
   * @returns 构建结果
   */
  buildFromRole(roleContent: string, context: PromptContext): Promise<BuildResult>

  /**
   * 构建系统提示词
   * @param context 构建上下文
   * @returns 系统提示词
   */
  buildSystemPrompt(context: PromptContext): Promise<string>

  /**
   * 处理角色激活
   * @param roleId 角色ID
   * @param context 构建上下文
   * @returns 角色相关的提示词内容
   */
  handleRoleActivation(roleId: string, context: PromptContext): Promise<string>

  /**
   * 处理聊天历史
   * @param history 聊天历史
   * @param context 构建上下文
   * @returns 处理后的消息列表
   */
  processHistory(history: any[], context: PromptContext): Promise<any[]>

  /**
   * 构建工具相关的提示词
   * @param tools 工具列表
   * @param context 构建上下文
   * @returns 工具相关的提示词
   */
  buildToolPrompt(tools: MCPToolEntity[], context: PromptContext): Promise<string>

  /**
   * 优化消息以适应token限制
   * @param messages 原始消息列表
   * @param maxTokens 最大token数
   * @returns 优化后的消息列表
   */
  optimizeForTokens(messages: any[], maxTokens: number): Promise<any[]>

  /**
   * 验证构建结果
   * @param result 构建结果
   * @returns 验证结果
   */
  validate(result: BuildResult): {
    valid: boolean
    errors?: string[]
    warnings?: string[]
  }

  /**
   * 获取构建统计信息
   * @returns 统计信息
   */
  getStats(): {
    totalBuilds: number
    averageBuildTime: number
    averageMessageCount: number
    roleActivationCount: number
  }

  /**
   * 清理构建缓存
   */
  clearCache(): void
}