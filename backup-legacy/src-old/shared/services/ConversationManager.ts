import { BaseMessage, HumanMessage, AIMessage, SystemMessage, trimMessages } from '@langchain/core/messages'
import { ChatMessage } from '../types'
import log from 'electron-log'

/**
 * 对话管理器
 * 负责管理聊天历史、上下文窗口和消息格式转换
 */
export class ConversationManager {
  private static instance: ConversationManager
  
  // 不同模型的上下文窗口限制（token数）
  private readonly MODEL_CONTEXT_LIMITS: Record<string, number> = {
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 4096,
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-5-sonnet-20240620': 200000,
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-sonnet-4-20250514': 200000,
    'gemini-2.0-flash-exp': 1000000,
    'gemini-1.5-pro': 2000000,
    'gemini-1.5-flash': 1000000,
  }

  private constructor() {}

  static getInstance(): ConversationManager {
    if (!ConversationManager.instance) {
      ConversationManager.instance = new ConversationManager()
    }
    return ConversationManager.instance
  }

  /**
   * 将ChatMessage数组转换为LangChain BaseMessage数组
   */
  convertToBaseMessages(messages: ChatMessage[]): BaseMessage[] {
    return messages.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content)
      } else if (msg.role === 'system') {
        return new SystemMessage(msg.content)
      } else {
        return new AIMessage(msg.content)
      }
    })
  }

  /**
   * 获取模型的上下文窗口限制
   */
  getModelContextLimit(modelName: string): number {
    // 提取模型名称（去除配置ID前缀）
    const cleanModelName = this.extractModelName(modelName)
    
    // 查找匹配的模型限制
    const limit = this.MODEL_CONTEXT_LIMITS[cleanModelName]
    if (limit) {
      return limit
    }

    // 智能推断：根据模型名称特征判断
    const lowerName = cleanModelName.toLowerCase()
    
    if (lowerName.includes('claude')) {
      return 200000 // Claude系列默认20万token
    } else if (lowerName.includes('gpt-4o')) {
      return 128000 // GPT-4o系列默认12.8万token
    } else if (lowerName.includes('gpt-4')) {
      return 8192   // GPT-4默认8k token
    } else if (lowerName.includes('gpt-3.5')) {
      return 4096   // GPT-3.5默认4k token
    } else if (lowerName.includes('gemini')) {
      return 1000000 // Gemini默认100万token
    } else {
      return 4096   // 保守默认值
    }
  }

  /**
   * 从模型ID中提取纯模型名称
   */
  private extractModelName(modelId: string): string {
    // 如果是UUID-模型名格式，提取后半部分
    const parts = modelId.split('-')
    if (parts.length >= 6) {
      return parts.slice(5).join('-')
    }
    return modelId
  }

  /**
   * 简单的token计数器（基于字符数估算）
   * 1 token ≈ 4个字符（英文）或 1.5个字符（中文）
   */
  private estimateTokenCount(messages: BaseMessage[]): number {
    const totalChars = messages.reduce((count, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      return count + content.length
    }, 0)

    // 混合语言的保守估算：平均2.5个字符 = 1 token
    return Math.ceil(totalChars / 2.5)
  }

  /**
   * 准备对话上下文，自动管理消息窗口大小
   */
  async prepareConversationContext(
    chatHistory: ChatMessage[],
    currentMessage: string,
    modelName: string,
    systemPrompt?: string
  ): Promise<{
    messages: BaseMessage[]
    contextInfo: {
      originalMessageCount: number
      finalMessageCount: number
      tokenStats: {
        currentTokens: number
        maxTokens: number
        utilizationRate: number
        status: 'optimal' | 'near_limit' | 'compressed'
      }
      compressionApplied: boolean
      removedCount: number
    }
  }> {
    log.info('📊 [ConversationManager] 开始准备对话上下文')
    
    // 1. 转换消息格式
    const baseMessages = this.convertToBaseMessages(chatHistory)
    const newHumanMessage = new HumanMessage(currentMessage)
    
    // 2. 构造完整消息列表
    const systemMessage = systemPrompt ? new SystemMessage(systemPrompt) : null
    const allMessages: BaseMessage[] = [
      ...(systemMessage ? [systemMessage] : []),
      ...baseMessages,
      newHumanMessage
    ]

    // 3. 获取模型上下文限制
    const maxTokens = this.getModelContextLimit(modelName)
    const targetTokens = Math.floor(maxTokens * 0.8) // 使用80%的窗口，留出生成空间

    log.info(`📊 [ConversationManager] 模型: ${modelName}, 最大tokens: ${maxTokens}, 目标tokens: ${targetTokens}`)

    // 4. 检查是否需要裁剪
    const originalTokens = this.estimateTokenCount(allMessages)
    const originalCount = allMessages.length
    
    let finalMessages = allMessages
    let compressionApplied = false
    let removedCount = 0

    if (originalTokens > targetTokens) {
      log.warn(`⚠️ [ConversationManager] Token超限: ${originalTokens}/${targetTokens}, 开始裁剪消息`)
      
      // 使用LangChain的trimMessages进行智能裁剪
      finalMessages = await trimMessages(allMessages, {
        tokenCounter: (msgs) => this.estimateTokenCount(msgs),
        maxTokens: targetTokens,
        strategy: 'last', // 保留最新的消息
        startOn: 'human', // 确保以人类消息开始
        includeSystem: true, // 保留系统消息
        allowPartial: false
      })
      
      compressionApplied = true
      removedCount = originalCount - finalMessages.length
      
      log.info(`✂️ [ConversationManager] 消息裁剪完成: ${originalCount} -> ${finalMessages.length}, 移除${removedCount}条`)
    }

    // 5. 计算最终token统计
    const finalTokens = this.estimateTokenCount(finalMessages)
    const utilizationRate = finalTokens / maxTokens
    
    let status: 'optimal' | 'near_limit' | 'compressed' = 'optimal'
    if (compressionApplied) {
      status = 'compressed'
    } else if (utilizationRate > 0.7) {
      status = 'near_limit'
    }

    const contextInfo = {
      originalMessageCount: originalCount,
      finalMessageCount: finalMessages.length,
      tokenStats: {
        currentTokens: finalTokens,
        maxTokens,
        utilizationRate,
        status
      },
      compressionApplied,
      removedCount
    }

    log.info(`📊 [ConversationManager] 上下文准备完成:`, contextInfo)

    return {
      messages: finalMessages,
      contextInfo
    }
  }

  /**
   * 为模型切换准备上下文
   * 当用户切换模型时，需要重新评估上下文窗口
   */
  async prepareContextForModelSwitch(
    chatHistory: ChatMessage[],
    fromModel: string,
    toModel: string,
    systemPrompt?: string
  ): Promise<{
    messages: BaseMessage[]
    contextInfo: any
    switchInfo: {
      fromLimit: number
      toLimit: number
      expansionPossible: boolean
      compressionNeeded: boolean
    }
  }> {
    const fromLimit = this.getModelContextLimit(fromModel)
    const toLimit = this.getModelContextLimit(toModel)
    
    log.info(`🔄 [ConversationManager] 模型切换: ${fromModel} (${fromLimit}) -> ${toModel} (${toLimit})`)

    // 使用新模型的限制重新准备上下文
    const result = await this.prepareConversationContext(
      chatHistory,
      '', // 空消息，只是为了重新计算上下文
      toModel,
      systemPrompt
    )

    // 移除我们添加的空消息
    const messages = result.messages.slice(0, -1)

    const switchInfo = {
      fromLimit,
      toLimit,
      expansionPossible: toLimit > fromLimit,
      compressionNeeded: toLimit < fromLimit
    }

    return {
      messages,
      contextInfo: result.contextInfo,
      switchInfo
    }
  }

  /**
   * 获取上下文健康状态
   */
  getContextHealth(chatHistory: ChatMessage[], modelName: string): {
    status: 'healthy' | 'warning' | 'critical'
    messageCount: number
    estimatedTokens: number
    maxTokens: number
    utilizationRate: number
    recommendations: string[]
  } {
    const baseMessages = this.convertToBaseMessages(chatHistory)
    const estimatedTokens = this.estimateTokenCount(baseMessages)
    const maxTokens = this.getModelContextLimit(modelName)
    const utilizationRate = estimatedTokens / maxTokens

    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    const recommendations: string[] = []

    if (utilizationRate > 0.9) {
      status = 'critical'
      recommendations.push('上下文即将满载，建议清理早期消息')
      recommendations.push('考虑切换到更大上下文窗口的模型')
    } else if (utilizationRate > 0.7) {
      status = 'warning'
      recommendations.push('上下文使用率较高，注意监控')
      recommendations.push('可考虑总结早期对话内容')
    } else {
      recommendations.push('上下文使用率良好')
    }

    return {
      status,
      messageCount: baseMessages.length,
      estimatedTokens,
      maxTokens,
      utilizationRate,
      recommendations
    }
  }
}

export const conversationManager = ConversationManager.getInstance()