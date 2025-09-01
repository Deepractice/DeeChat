import { ConversationUseCase } from '../application/conversation/ConversationUseCase'
import { ConversationService } from '../domains/conversation/services/ConversationService'
import { SqliteSessionRepository } from '../infrastructure/persistence/conversation/SqliteSessionRepository'
import { SqliteChatSessionRepository } from '../main/repositories/SqliteChatSessionRepository'

/**
 * DDD 重构功能对比测试
 * 测试新的DDD实现与原有实现的功能一致性
 */
export class DDDIntegrationTest {
  private newConversationUseCase: ConversationUseCase
  private legacyChatService: any // 原有的ChatService

  constructor() {
    // 初始化新DDD架构实例
    const legacyRepository = new SqliteChatSessionRepository()
    const sqliteRepository = new SqliteSessionRepository(legacyRepository)
    const conversationService = new ConversationService(sqliteRepository)
    this.newConversationUseCase = new ConversationUseCase(conversationService, sqliteRepository)
  }

  /**
   * 设置原有ChatService实例（需要从外部注入）
   */
  setLegacyChatService(chatService: any) {
    this.legacyChatService = chatService
  }

  /**
   * 测试会话创建功能
   */
  async testSessionCreation(): Promise<{
    success: boolean
    legacy: any
    new: any
    errors?: string[]
  }> {
    console.log('🔄 测试会话创建功能...')
    const errors: string[] = []
    let legacyResult: any
    let newResult: any

    try {
      // 测试原有实现
      legacyResult = await this.legacyChatService?.createNewSession?.('测试会话')
      
      // 测试新DDD实现
      newResult = await this.newConversationUseCase.createNewSession('测试会话')
      
      // 对比结果结构
      if (!legacyResult?.sessionId || !newResult?.sessionId) {
        errors.push('会话ID生成失败')
      }

      if (!legacyResult?.session || !newResult?.session) {
        errors.push('会话对象生成失败')
      }

      // 检查会话对象结构一致性
      const legacyKeys = Object.keys(legacyResult?.session || {}).sort()
      const newKeys = Object.keys(newResult?.session || {}).sort()
      
      if (JSON.stringify(legacyKeys) !== JSON.stringify(newKeys)) {
        errors.push(`会话对象结构不一致: Legacy[${legacyKeys.join(',')}] vs New[${newKeys.join(',')}]`)
      }

    } catch (error) {
      errors.push(`会话创建测试异常: ${error}`)
    }

    return {
      success: errors.length === 0,
      legacy: legacyResult,
      new: newResult,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * 测试消息发送功能
   */
  async testMessageSending(sessionId: string): Promise<{
    success: boolean
    legacy: any
    new: any
    errors?: string[]
  }> {
    console.log('🔄 测试消息发送功能...')
    const errors: string[] = []
    let legacyResult: any
    let newResult: any

    try {
      const testMessage = '这是一条测试消息'

      // 测试原有实现
      legacyResult = await this.legacyChatService?.sendMessage?.(sessionId, testMessage)
      
      // 测试新DDD实现
      newResult = await this.newConversationUseCase.sendMessage(sessionId, testMessage)
      
      // 对比结果
      if (legacyResult?.success !== newResult?.success) {
        errors.push('发送状态不一致')
      }

      if (legacyResult?.messageCount !== newResult?.messageCount) {
        errors.push(`消息计数不一致: Legacy[${legacyResult?.messageCount}] vs New[${newResult?.messageCount}]`)
      }

    } catch (error) {
      errors.push(`消息发送测试异常: ${error}`)
    }

    return {
      success: errors.length === 0,
      legacy: legacyResult,
      new: newResult,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * 测试会话历史获取功能
   */
  async testChatHistory(sessionId: string): Promise<{
    success: boolean
    legacy: any
    new: any
    errors?: string[]
  }> {
    console.log('🔄 测试会话历史获取功能...')
    const errors: string[] = []
    let legacyResult: any
    let newResult: any

    try {
      // 测试原有实现
      legacyResult = await this.legacyChatService?.getChatHistory?.(sessionId)
      
      // 测试新DDD实现
      newResult = await this.newConversationUseCase.getChatHistory(sessionId)
      
      // 对比消息数量
      if (legacyResult?.messages?.length !== newResult?.messages?.length) {
        errors.push(`消息数量不一致: Legacy[${legacyResult?.messages?.length}] vs New[${newResult?.messages?.length}]`)
      }

      if (legacyResult?.totalCount !== newResult?.totalCount) {
        errors.push(`总数不一致: Legacy[${legacyResult?.totalCount}] vs New[${newResult?.totalCount}]`)
      }

      // 检查消息结构一致性
      if (legacyResult?.messages?.length > 0 && newResult?.messages?.length > 0) {
        const legacyMsg = legacyResult.messages[0]
        const newMsg = newResult.messages[0]
        
        const legacyMsgKeys = Object.keys(legacyMsg).sort()
        const newMsgKeys = Object.keys(newMsg).sort()
        
        if (JSON.stringify(legacyMsgKeys) !== JSON.stringify(newMsgKeys)) {
          errors.push(`消息对象结构不一致: Legacy[${legacyMsgKeys.join(',')}] vs New[${newMsgKeys.join(',')}]`)
        }
      }

    } catch (error) {
      errors.push(`会话历史测试异常: ${error}`)
    }

    return {
      success: errors.length === 0,
      legacy: legacyResult,
      new: newResult,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * 测试会话列表获取功能
   */
  async testGetAllSessions(): Promise<{
    success: boolean
    legacy: any
    new: any
    errors?: string[]
  }> {
    console.log('🔄 测试会话列表获取功能...')
    const errors: string[] = []
    let legacyResult: any
    let newResult: any

    try {
      // 测试原有实现
      legacyResult = await this.legacyChatService?.getAllSessions?.()
      
      // 测试新DDD实现
      newResult = await this.newConversationUseCase.getAllSessions()
      
      // 对比会话数量
      if (legacyResult?.length !== newResult?.length) {
        errors.push(`会话数量不一致: Legacy[${legacyResult?.length}] vs New[${newResult?.length}]`)
      }

      // 检查会话对象结构一致性
      if (legacyResult?.length > 0 && newResult?.length > 0) {
        const legacySession = legacyResult[0]
        const newSession = newResult[0]
        
        const legacyKeys = Object.keys(legacySession).sort()
        const newKeys = Object.keys(newSession).sort()
        
        if (JSON.stringify(legacyKeys) !== JSON.stringify(newKeys)) {
          errors.push(`会话对象结构不一致: Legacy[${legacyKeys.join(',')}] vs New[${newKeys.join(',')}]`)
        }
      }

    } catch (error) {
      errors.push(`会话列表测试异常: ${error}`)
    }

    return {
      success: errors.length === 0,
      legacy: legacyResult,
      new: newResult,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * 运行完整的功能对比测试套件
   */
  async runFullTest(): Promise<{
    overall: boolean
    results: {
      sessionCreation: any
      messageSending?: any
      chatHistory?: any
      sessionList: any
    }
    summary: {
      total: number
      passed: number
      failed: number
      errors: string[]
    }
  }> {
    console.log('🚀 开始运行DDD功能对比测试...')
    
    const results: any = {}
    const allErrors: string[] = []
    let passedCount = 0
    let totalCount = 0

    // 测试1: 会话创建
    totalCount++
    results.sessionCreation = await this.testSessionCreation()
    if (results.sessionCreation.success) {
      passedCount++
    } else {
      allErrors.push(...(results.sessionCreation.errors || []))
    }

    // 测试2: 消息发送（使用新创建的会话ID）
    if (results.sessionCreation.success && results.sessionCreation.new?.sessionId) {
      totalCount++
      results.messageSending = await this.testMessageSending(results.sessionCreation.new.sessionId)
      if (results.messageSending.success) {
        passedCount++
      } else {
        allErrors.push(...(results.messageSending.errors || []))
      }

      // 测试3: 会话历史（使用同一个会话ID）
      totalCount++
      results.chatHistory = await this.testChatHistory(results.sessionCreation.new.sessionId)
      if (results.chatHistory.success) {
        passedCount++
      } else {
        allErrors.push(...(results.chatHistory.errors || []))
      }
    }

    // 测试4: 会话列表
    totalCount++
    results.sessionList = await this.testGetAllSessions()
    if (results.sessionList.success) {
      passedCount++
    } else {
      allErrors.push(...(results.sessionList.errors || []))
    }

    const overall = passedCount === totalCount
    const summary = {
      total: totalCount,
      passed: passedCount,
      failed: totalCount - passedCount,
      errors: allErrors
    }

    // 输出测试结果
    console.log(`\n📊 测试结果汇总:`)
    console.log(`✅ 通过: ${passedCount}/${totalCount}`)
    console.log(`❌ 失败: ${totalCount - passedCount}/${totalCount}`)
    
    if (allErrors.length > 0) {
      console.log(`\n🔍 错误详情:`)
      allErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`)
      })
    }

    if (overall) {
      console.log(`\n🎉 所有测试通过！新DDD实现与原有实现功能一致`)
    } else {
      console.log(`\n⚠️  发现${totalCount - passedCount}个不一致问题，需要进一步调整`)
    }

    return {
      overall,
      results,
      summary
    }
  }
}

/**
 * 快速测试接口（可在控制台直接调用）
 */
export async function runDDDTest(legacyChatService?: any) {
  const tester = new DDDIntegrationTest()
  
  if (legacyChatService) {
    tester.setLegacyChatService(legacyChatService)
  }
  
  return await tester.runFullTest()
}