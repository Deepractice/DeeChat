/**
 * DDD集成演示
 * 展示如何在现有代码中逐步引入新的DDD架构
 */
import { ConversationUseCase } from '../application/conversation/ConversationUseCase'
import { ConversationService } from '../domains/conversation/services/ConversationService'
import { SqliteSessionRepository } from '../infrastructure/persistence/conversation/SqliteSessionRepository'
import { SqliteChatSessionRepository } from '../main/repositories/SqliteChatSessionRepository'
import { ChatService } from '../main/services/core/ChatService'

/**
 * 混合架构适配器
 * 在过渡期间同时支持旧的ChatService和新的ConversationUseCase
 */
export class HybridChatAdapter {
  private legacyChatService: ChatService
  private newConversationUseCase: ConversationUseCase
  private useNewImplementation: boolean = false

  constructor() {
    // 初始化原有服务
    this.legacyChatService = new ChatService()
    
    // 初始化新DDD服务
    const legacyRepository = new SqliteChatSessionRepository()
    const sqliteRepository = new SqliteSessionRepository(legacyRepository)
    const conversationService = new ConversationService(sqliteRepository)
    this.newConversationUseCase = new ConversationUseCase(conversationService, sqliteRepository)
  }

  /**
   * 功能开关：切换到新实现
   */
  enableNewImplementation(enable: boolean = true) {
    this.useNewImplementation = enable
    console.log(`🔄 [HybridAdapter] ${enable ? '启用' : '禁用'}新的DDD实现`)
  }

  /**
   * 创建会话 - 混合实现
   */
  async createNewSession(title?: string): Promise<any> {
    try {
      if (this.useNewImplementation) {
        console.log('🆕 [HybridAdapter] 使用新DDD实现创建会话')
        return await this.newConversationUseCase.createNewSession(title)
      } else {
        console.log('🔄 [HybridAdapter] 使用原有实现创建会话')
        return await this.legacyChatService.createNewSession(title)
      }
    } catch (error) {
      console.error('❌ [HybridAdapter] 创建会话失败，回退到原有实现')
      return await this.legacyChatService.createNewSession(title)
    }
  }

  /**
   * 发送消息 - 混合实现
   */
  async sendMessage(sessionId: string, content: string, role: 'user' | 'assistant' = 'user'): Promise<any> {
    try {
      if (this.useNewImplementation) {
        console.log('🆕 [HybridAdapter] 使用新DDD实现发送消息')
        return await this.newConversationUseCase.sendMessage(sessionId, content, role)
      } else {
        console.log('🔄 [HybridAdapter] 使用原有实现发送消息')
        return await this.legacyChatService.sendMessage(sessionId, content, role)
      }
    } catch (error) {
      console.error('❌ [HybridAdapter] 发送消息失败，回退到原有实现')
      return await this.legacyChatService.sendMessage(sessionId, content, role)
    }
  }

  /**
   * 获取会话历史 - 混合实现
   */
  async getChatHistory(sessionId: string): Promise<any> {
    try {
      if (this.useNewImplementation) {
        console.log('🆕 [HybridAdapter] 使用新DDD实现获取历史')
        return await this.newConversationUseCase.getChatHistory(sessionId)
      } else {
        console.log('🔄 [HybridAdapter] 使用原有实现获取历史')
        return await this.legacyChatService.getChatHistory(sessionId)
      }
    } catch (error) {
      console.error('❌ [HybridAdapter] 获取历史失败，回退到原有实现')
      return await this.legacyChatService.getChatHistory(sessionId)
    }
  }

  /**
   * 获取所有会话 - 混合实现
   */
  async getAllSessions(): Promise<any[]> {
    try {
      if (this.useNewImplementation) {
        console.log('🆕 [HybridAdapter] 使用新DDD实现获取会话列表')
        return await this.newConversationUseCase.getAllSessions()
      } else {
        console.log('🔄 [HybridAdapter] 使用原有实现获取会话列表')
        return await this.legacyChatService.getAllSessions()
      }
    } catch (error) {
      console.error('❌ [HybridAdapter] 获取会话列表失败，回退到原有实现')
      return await this.legacyChatService.getAllSessions()
    }
  }

  /**
   * 对比测试：同时运行新旧实现并比较结果
   */
  async compareImplementations(): Promise<{
    sessionCreation: any
    messageSending?: any
    sessionHistory?: any
  }> {
    console.log('🔍 [HybridAdapter] 开始对比测试...')
    
    const results: any = {}
    const testTitle = `对比测试会话 - ${new Date().toLocaleString()}`

    try {
      // 测试1: 会话创建对比
      console.log('📝 对比会话创建...')
      const legacySession = await this.legacyChatService.createNewSession(testTitle)
      const newSession = await this.newConversationUseCase.createNewSession(testTitle)
      
      results.sessionCreation = {
        legacy: legacySession,
        new: newSession,
        compatible: legacySession?.sessionId && newSession?.sessionId &&
                   legacySession?.session && newSession?.session
      }

      if (results.sessionCreation.compatible && newSession?.sessionId) {
        // 测试2: 消息发送对比
        console.log('💬 对比消息发送...')
        const testMessage = '这是一条对比测试消息'
        
        const legacyMessageResult = await this.legacyChatService.sendMessage(legacySession.sessionId, testMessage)
        const newMessageResult = await this.newConversationUseCase.sendMessage(newSession.sessionId, testMessage)
        
        results.messageSending = {
          legacy: legacyMessageResult,
          new: newMessageResult,
          compatible: legacyMessageResult?.success === newMessageResult?.success
        }

        // 测试3: 会话历史对比
        console.log('📚 对比会话历史...')
        const legacyHistory = await this.legacyChatService.getChatHistory(legacySession.sessionId)
        const newHistory = await this.newConversationUseCase.getChatHistory(newSession.sessionId)
        
        results.sessionHistory = {
          legacy: legacyHistory,
          new: newHistory,
          compatible: legacyHistory?.messages?.length === newHistory?.messages?.length
        }
      }

      // 输出对比结果
      console.log('\n📊 对比测试结果:')
      Object.entries(results).forEach(([test, result]: [string, any]) => {
        const status = result.compatible ? '✅ 兼容' : '❌ 不兼容'
        console.log(`  ${test}: ${status}`)
      })

    } catch (error) {
      console.error('❌ 对比测试失败:', error)
    }

    return results
  }

  /**
   * 性能对比测试
   */
  async performanceComparison(iterations: number = 5): Promise<{
    legacy: { times: number[], average: number }
    new: { times: number[], average: number }
    improvement: number
  }> {
    console.log(`⚡ [HybridAdapter] 开始性能对比测试 (${iterations}次迭代)...`)
    
    const legacyTimes: number[] = []
    const newTimes: number[] = []

    for (let i = 0; i < iterations; i++) {
      console.log(`  第${i + 1}轮测试...`)
      
      // 测试原有实现性能
      const legacyStart = Date.now()
      try {
        const session = await this.legacyChatService.createNewSession(`性能测试${i}`)
        if (session?.sessionId) {
          await this.legacyChatService.sendMessage(session.sessionId, `性能测试消息${i}`)
          await this.legacyChatService.getChatHistory(session.sessionId)
        }
      } catch (error) {
        console.warn(`    原有实现第${i + 1}轮失败:`, error)
      }
      legacyTimes.push(Date.now() - legacyStart)

      // 测试新DDD实现性能
      const newStart = Date.now()
      try {
        const session = await this.newConversationUseCase.createNewSession(`性能测试${i}`)
        if (session?.sessionId) {
          await this.newConversationUseCase.sendMessage(session.sessionId, `性能测试消息${i}`)
          await this.newConversationUseCase.getChatHistory(session.sessionId)
        }
      } catch (error) {
        console.warn(`    新DDD实现第${i + 1}轮失败:`, error)
      }
      newTimes.push(Date.now() - newStart)
    }

    const legacyAverage = legacyTimes.reduce((sum, time) => sum + time, 0) / legacyTimes.length
    const newAverage = newTimes.reduce((sum, time) => sum + time, 0) / newTimes.length
    const improvement = ((legacyAverage - newAverage) / legacyAverage) * 100

    console.log(`\n⚡ 性能对比结果:`)
    console.log(`  原有实现平均时间: ${legacyAverage.toFixed(2)}ms`)
    console.log(`  新DDD实现平均时间: ${newAverage.toFixed(2)}ms`)
    console.log(`  性能改善: ${improvement > 0 ? '+' : ''}${improvement.toFixed(2)}%`)

    return {
      legacy: { times: legacyTimes, average: legacyAverage },
      new: { times: newTimes, average: newAverage },
      improvement
    }
  }
}

/**
 * 演示如何在实际项目中使用混合适配器
 */
export async function demonstrateHybridUsage() {
  console.log('🎭 DDD混合架构演示开始...\n')
  
  const adapter = new HybridChatAdapter()
  
  // 1. 首先使用原有实现
  console.log('=== 阶段1: 使用原有实现 ===')
  adapter.enableNewImplementation(false)
  
  try {
    const session1 = await adapter.createNewSession('演示会话1')
    console.log(`✅ 创建会话成功: ${session1?.sessionId}`)
    
    if (session1?.sessionId) {
      const result1 = await adapter.sendMessage(session1.sessionId, '这是使用原有实现发送的消息')
      console.log(`✅ 发送消息成功, 消息数: ${result1?.messageCount}`)
    }
  } catch (error) {
    console.error('❌ 原有实现测试失败:', error)
  }
  
  // 2. 切换到新DDD实现
  console.log('\n=== 阶段2: 切换到新DDD实现 ===')
  adapter.enableNewImplementation(true)
  
  try {
    const session2 = await adapter.createNewSession('演示会话2')
    console.log(`✅ 创建会话成功: ${session2?.sessionId}`)
    
    if (session2?.sessionId) {
      const result2 = await adapter.sendMessage(session2.sessionId, '这是使用新DDD实现发送的消息')
      console.log(`✅ 发送消息成功, 消息数: ${result2?.messageCount}`)
    }
  } catch (error) {
    console.error('❌ 新DDD实现测试失败:', error)
  }
  
  // 3. 运行对比测试
  console.log('\n=== 阶段3: 功能对比测试 ===')
  await adapter.compareImplementations()
  
  // 4. 运行性能对比
  console.log('\n=== 阶段4: 性能对比测试 ===')
  await adapter.performanceComparison(3)
  
  console.log('\n🎉 DDD混合架构演示完成！')
  
  return adapter
}

// 如果直接运行此文件
if (require.main === module) {
  demonstrateHybridUsage()
    .then(() => {
      console.log('\n✨ 演示执行完成')
    })
    .catch((error) => {
      console.error('\n💥 演示执行失败:', error)
    })
}