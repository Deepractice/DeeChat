import { IPromptBuilder, PromptContext, BuildResult } from './IPromptBuilder'
import { SmartLayeredPromptSystem, ConversationContext, UIInjectionContext } from '../../../../shared/langchain/SmartLayeredPromptSystem'
import { MCPToolEntity } from '../../../../shared/entities/MCPToolEntity'
import log from 'electron-log'

/**
 * 提示词构建器实现
 * 
 * 基于原有SmartLayeredPromptSystem的逻辑重构
 * 保留所有原有功能：
 * - 3层架构提示词系统
 * - 角色激活和状态监控
 * - 历史对话管理和压缩
 * - UI上下文注入
 * - Token优化
 */
export class PromptBuilder implements IPromptBuilder {
  private promptSystem: SmartLayeredPromptSystem
  
  // 构建统计
  private stats = {
    totalBuilds: 0,
    averageBuildTime: 0,
    averageMessageCount: 0,
    roleActivationCount: 0,
    compressionCount: 0
  }

  constructor() {
    // 初始化智能分层提示词系统 - 保留原有配置
    this.promptSystem = new SmartLayeredPromptSystem({
      defaultModel: 'gpt-3.5-turbo',
      maxRetainedRounds: 10,
      compressionThreshold: 4000
    })
    
    log.info('✅ [PromptBuilder] 提示词构建器初始化完成')
  }

  /**
   * 新方法：基于PromptX角色内容构建消息上下文
   */
  async buildFromRole(roleContent: string, context: PromptContext): Promise<BuildResult> {
    const startTime = Date.now()
    this.stats.totalBuilds++
    
    log.info(`🎭 [PromptBuilder] 开始基于角色内容构建提示词`)

    try {
      // 1. 准备会话上下文
      const conversationContext: ConversationContext = {
        sessionId: context.conversationContext?.sessionId || `build_${Date.now()}`,
        currentModel: context.config.model,
        activeRole: context.request.activeRole,
        conversationStartTime: new Date(),
        totalRounds: 1
      }

      // 2. 准备UI注入上下文
      const uiInjectionContext: UIInjectionContext = {
        selectedRole: context.request.activeRole,
        roleActivationRequest: !!context.request.activeRole,
        ...context.uiContext
      }

      // 3. 使用新的统一方法构建系统提示词
      const finalSystemPrompt = await this.promptSystem.buildSystemPromptFromRole(
        roleContent,
        context.request.message,
        conversationContext,
        context.tools || [],
        uiInjectionContext
      )

      // 4. 构建消息数组
      const messages = [
        { role: 'system', content: finalSystemPrompt } as any,
        { role: 'user', content: context.request.message } as any
      ]

      // 5. 构建结果
      const buildResult: BuildResult = {
        messages,
        systemPrompt: finalSystemPrompt,
        roleId: context.request.activeRole,
        hasTools: (context.tools?.length || 0) > 0,
        metadata: {
          buildTime: new Date(),
          messageCount: messages.length,
          systemPromptLength: finalSystemPrompt.length,
          toolCount: context.tools?.length || 0
        }
      }

      // 6. 更新统计信息
      const duration = Date.now() - startTime
      this.updateStats(duration, buildResult, false)

      log.info(`✅ [PromptBuilder] 角色提示词构建完成 - 消息数: ${buildResult.messages.length}, 耗时: ${duration}ms`)
      return buildResult

    } catch (error) {
      log.error(`❌ [PromptBuilder] 角色提示词构建失败`, error)
      throw error
    }
  }

  /**
   * 构建完整的消息上下文 - 基于原有SmartLayeredPromptSystem逻辑
   */
  async build(context: PromptContext): Promise<BuildResult> {
    const startTime = Date.now()
    this.stats.totalBuilds++
    
    log.debug(`🏗️ [PromptBuilder] 开始构建提示词上下文`)

    try {
      // 1. 准备会话上下文 - 完全基于原有逻辑
      const conversationContext: ConversationContext = {
        sessionId: context.conversationContext?.sessionId || `build_${Date.now()}`,
        currentModel: context.config.model,
        activeRole: context.request.activeRole,
        conversationStartTime: new Date(),
        totalRounds: 1
      }

      // 2. 准备UI注入上下文 - 完全基于原有逻辑  
      const uiInjectionContext: UIInjectionContext = {
        selectedRole: context.request.activeRole,
        roleActivationRequest: !!context.request.activeRole,
        ...context.uiContext
      }

      // 3. 调用智能分层提示词系统 - 完全保留原有接口
      const promptResponse = await this.promptSystem.buildMessages(
        context.request.message,
        conversationContext,
        context.request.systemPrompt || '',
        context.tools || [],
        uiInjectionContext
      )

      // 简化日志：只记录统计信息
      log.info(`🚨 [PromptBuilder] 系统提示词构建完成: ${promptResponse.messages.length}条消息`);

      // 4. 构建结果
      const buildResult: BuildResult = {
        messages: promptResponse.messages,
        systemPrompt: this.extractSystemPrompt(promptResponse.messages),
        roleId: context.request.activeRole,
        hasTools: (context.tools?.length || 0) > 0,
        metadata: {
          buildTime: new Date(),
          messageCount: promptResponse.messages.length,
          systemPromptLength: this.extractSystemPrompt(promptResponse.messages).length,
          toolCount: context.tools?.length || 0
        }
      }

      // 5. 更新统计信息
      const duration = Date.now() - startTime
      this.updateStats(duration, buildResult, promptResponse.compressionTriggered)

      log.info(`✅ [PromptBuilder] 提示词构建完成 - 消息数: ${buildResult.messages.length}, 耗时: ${duration}ms`)
      return buildResult

    } catch (error) {
      log.error(`❌ [PromptBuilder] 提示词构建失败`, error)
      throw error
    }
  }

  /**
   * 构建系统提示词
   */
  async buildSystemPrompt(context: PromptContext): Promise<string> {
    const buildResult = await this.build(context)
    return buildResult.systemPrompt || ''
  }

  /**
   * 处理角色激活 - 基于原有逻辑
   */
  async handleRoleActivation(roleId: string, context: PromptContext): Promise<string> {
    log.debug(`🎭 [PromptBuilder] 处理角色激活: ${roleId}`)
    
    this.stats.roleActivationCount++
    
    // 构建角色激活上下文
    const activationContext: PromptContext = {
      ...context,
      uiContext: {
        ...context.uiContext,
        selectedRole: roleId,
        roleActivationRequest: true
      }
    }
    
    const result = await this.build(activationContext)
    
    // 返回角色相关的系统提示词部分
    return this.extractRoleContent(result.messages, roleId)
  }

  /**
   * 处理聊天历史 - 基于原有历史管理逻辑
   */
  async processHistory(history: any[], _context: PromptContext): Promise<any[]> {
    if (!history || history.length === 0) {
      return []
    }

    log.debug(`📚 [PromptBuilder] 处理聊天历史: ${history.length} 条`)

    // 这里可以添加历史处理逻辑，比如：
    // - 格式标准化
    // - 长度限制
    // - 敏感信息过滤
    // 目前直接返回原历史
    
    return history
  }

  /**
   * 构建工具相关的提示词
   */
  async buildToolPrompt(tools: MCPToolEntity[], _context: PromptContext): Promise<string> {
    if (!tools || tools.length === 0) {
      return ''
    }

    log.debug(`🔧 [PromptBuilder] 构建工具提示词: ${tools.length} 个工具`)

    // 构建工具描述
    const toolDescriptions = tools.map(tool => {
      return `- ${tool.name}: ${tool.description || '无描述'}`
    }).join('\n')

    const toolPrompt = `
可用工具：
${toolDescriptions}

请根据用户需求智能选择合适的工具。只有在明确需要时才使用工具。
`

    return toolPrompt.trim()
  }

  /**
   * 优化消息以适应token限制 - 基于原有压缩逻辑
   */
  async optimizeForTokens(messages: any[], maxTokens: number): Promise<any[]> {
    log.debug(`🎯 [PromptBuilder] 优化token使用 - 最大: ${maxTokens}`)

    // 这里可以使用SmartLayeredPromptSystem的压缩功能
    // 目前简单实现：如果消息过多，保留最新的消息
    
    if (messages.length <= 10) {
      return messages
    }

    // 保留系统消息和最新的用户消息
    const systemMessages = messages.filter(msg => msg.role === 'system')
    const recentMessages = messages.slice(-8) // 保留最新8条消息
    
    this.stats.compressionCount++
    
    log.debug(`🎯 [PromptBuilder] Token优化完成 - 压缩: ${messages.length} -> ${systemMessages.length + recentMessages.length}`)
    
    return [...systemMessages, ...recentMessages]
  }

  /**
   * 验证构建结果
   */
  validate(result: BuildResult): {
    valid: boolean
    errors?: string[]
    warnings?: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // 检查基本结构
    if (!result.messages || result.messages.length === 0) {
      errors.push('消息列表不能为空')
    }

    // 检查消息格式
    if (result.messages) {
      for (let i = 0; i < result.messages.length; i++) {
        const message = result.messages[i]
        if (!message.role || !message.content) {
          errors.push(`消息 ${i + 1} 缺少必要的role或content字段`)
        }
      }
    }

    // 检查元数据
    if (!result.metadata) {
      warnings.push('缺少构建元数据')
    }

    // 检查消息数量
    if (result.messages && result.messages.length > 50) {
      warnings.push('消息数量较多，可能影响性能')
    }

    const valid = errors.length === 0
    
    if (!valid) {
      log.warn(`⚠️ [PromptBuilder] 构建结果验证失败`, errors)
    }

    return { valid, errors, warnings }
  }

  /**
   * 获取构建统计信息
   */
  getStats(): {
    totalBuilds: number
    averageBuildTime: number
    averageMessageCount: number
    roleActivationCount: number
    compressionCount: number
    compressionRate: number
  } {
    const compressionRate = this.stats.totalBuilds > 0 
      ? (this.stats.compressionCount / this.stats.totalBuilds) * 100 
      : 0

    return {
      ...this.stats,
      compressionRate: Math.round(compressionRate * 100) / 100
    }
  }

  /**
   * 清理构建缓存
   */
  clearCache(): void {
    // 这里可以清理SmartLayeredPromptSystem的内部缓存
    // 目前暂无需要清理的缓存
    log.debug('🧹 [PromptBuilder] 构建缓存已清理')
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 从消息列表中提取系统提示词
   */
  private extractSystemPrompt(messages: any[]): string {
    const systemMessage = messages.find(msg => msg.role === 'system')
    return systemMessage?.content || ''
  }

  /**
   * 提取角色相关内容
   */
  private extractRoleContent(messages: any[], roleId: string): string {
    // 查找包含角色信息的消息内容
    for (const message of messages) {
      if (message.content && message.content.includes(roleId)) {
        return message.content
      }
    }
    return ''
  }

  /**
   * 更新统计信息
   */
  private updateStats(duration: number, result: BuildResult, compressionTriggered: boolean): void {
    // 更新平均构建时间
    this.stats.averageBuildTime = 
      (this.stats.averageBuildTime * (this.stats.totalBuilds - 1) + duration) / this.stats.totalBuilds

    // 更新平均消息数量
    this.stats.averageMessageCount = 
      (this.stats.averageMessageCount * (this.stats.totalBuilds - 1) + result.messages.length) / this.stats.totalBuilds

    // 更新压缩统计
    if (compressionTriggered) {
      this.stats.compressionCount++
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalBuilds: 0,
      averageBuildTime: 0,
      averageMessageCount: 0,
      roleActivationCount: 0,
      compressionCount: 0
    }
    log.info('📊 [PromptBuilder] 统计信息已重置')
  }

  /**
   * 获取支持的消息类型
   */
  getSupportedMessageTypes(): string[] {
    return ['system', 'user', 'assistant', 'tool']
  }

  /**
   * 检查是否需要角色激活
   */
  needsRoleActivation(context: PromptContext): boolean {
    return !!(context.request.activeRole && context.uiContext?.roleActivationRequest)
  }

  /**
   * 估算Token使用量
   */
  estimateTokens(messages: any[]): number {
    // 简单的token估算：每个字符约0.3个token（中文），英文约0.25个token
    let totalChars = 0
    
    for (const message of messages) {
      if (message.content) {
        totalChars += message.content.length
      }
    }
    
    // 中英文混合估算
    const estimatedTokens = Math.ceil(totalChars * 0.28)
    
    return estimatedTokens
  }
}