/**
 * 简单DDD演示
 * 展示DDD架构的核心概念和实际运行效果
 */

// 模拟现有的ChatService行为
class LegacyChatService {
  constructor() {
    this.sessions = new Map()
  }
  
  async createNewSession(title) {
    const sessionId = 'legacy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    const session = {
      id: sessionId,
      title: title || '新会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    this.sessions.set(sessionId, session)
    
    console.log(`🏗️  [Legacy] 创建会话: ${sessionId}`)
    return {
      sessionId,
      session
    }
  }
  
  async sendMessage(sessionId, content, role = 'user') {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('会话不存在')
    }
    
    const message = {
      id: 'msg_' + Date.now(),
      content,
      role,
      createdAt: Date.now()
    }
    
    session.messages.push(message)
    session.updatedAt = Date.now()
    
    console.log(`💬 [Legacy] 发送消息到 ${sessionId}: ${content}`)
    return {
      success: true,
      messageCount: session.messages.length
    }
  }
  
  async getChatHistory(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { messages: [], totalCount: 0 }
    }
    
    console.log(`📚 [Legacy] 获取历史 ${sessionId}: ${session.messages.length}条消息`)
    return {
      messages: session.messages,
      totalCount: session.messages.length
    }
  }
  
  async getAllSessions() {
    const sessions = Array.from(this.sessions.values())
    console.log(`📋 [Legacy] 获取会话列表: ${sessions.length}个会话`)
    return sessions
  }
}

// 模拟新的DDD实现
class NewDDDImplementation {
  constructor() {
    this.sessions = new Map()
  }
  
  async createNewSession(title) {
    const sessionId = 'ddd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    
    // 模拟DDD聚合根创建
    const session = {
      id: sessionId,
      title: title || '新会话',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // DDD特有的属性
      domainEvents: [
        { name: 'SessionCreated', data: { sessionId, title } }
      ],
      businessRules: {
        maxMessages: 1000,
        canBeDeleted: false,
        isArchived: false
      }
    }
    
    this.sessions.set(sessionId, session)
    
    console.log(`🆕 [DDD] 创建聚合根: ${sessionId}`)
    console.log(`📅 [DDD] 发布事件: SessionCreated`)
    
    return {
      sessionId,
      session: {
        id: session.id,
        title: session.title,
        selectedModelId: undefined,
        messages: session.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        metadata: session.businessRules
      }
    }
  }
  
  async sendMessage(sessionId, content, role = 'user') {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('聚合根不存在')
    }
    
    // 业务规则验证
    if (session.messages.length >= session.businessRules.maxMessages) {
      throw new Error('消息数量已达上限')
    }
    
    if (session.businessRules.isArchived) {
      throw new Error('不能向已归档的会话发送消息')
    }
    
    const message = {
      id: 'msg_' + Date.now(),
      content,
      role,
      createdAt: Date.now(),
      // DDD实体属性
      wordCount: content.split(/\\s+/).length,
      isValid: content.trim().length > 0
    }
    
    session.messages.push(message)
    session.updatedAt = Date.now()
    
    // 发布领域事件
    session.domainEvents.push({
      name: 'MessageAdded',
      data: { sessionId, messageId: message.id, content, role }
    })
    
    console.log(`💬 [DDD] 添加消息到聚合根 ${sessionId}: ${content}`)
    console.log(`📅 [DDD] 发布事件: MessageAdded`)
    console.log(`🔍 [DDD] 业务规则检查通过`)
    
    return {
      success: true,
      messageCount: session.messages.length
    }
  }
  
  async getChatHistory(sessionId) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { messages: [], totalCount: 0 }
    }
    
    // DDD样式的消息转换
    const messages = session.messages.map(msg => ({
      id: msg.id,
      sessionId: sessionId,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
      // DDD增强信息
      wordCount: msg.wordCount,
      isValid: msg.isValid
    }))
    
    console.log(`📚 [DDD] 查询聚合根历史 ${sessionId}: ${messages.length}条消息`)
    console.log(`🔍 [DDD] 应用业务逻辑过滤`)
    
    return {
      messages,
      totalCount: messages.length
    }
  }
  
  async getAllSessions() {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      title: session.title,
      selectedModelId: undefined,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      metadata: session.businessRules
    }))
    
    console.log(`📋 [DDD] 查询所有聚合根: ${sessions.length}个会话`)
    console.log(`🔍 [DDD] 应用领域过滤规则`)
    
    return sessions
  }
  
  // DDD特有方法
  getDomainEvents(sessionId) {
    const session = this.sessions.get(sessionId)
    return session ? session.domainEvents : []
  }
  
  clearDomainEvents(sessionId) {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.domainEvents = []
      console.log(`🧹 [DDD] 清除聚合根 ${sessionId} 的领域事件`)
    }
  }
}

// 混合适配器演示
class DemoHybridAdapter {
  constructor() {
    this.legacy = new LegacyChatService()
    this.ddd = new NewDDDImplementation()
    this.useDDD = false
  }
  
  switchToDDD(enable = true) {
    this.useDDD = enable
    console.log(`🔄 [Demo] ${enable ? '切换到DDD实现' : '切换到传统实现'}`)
  }
  
  async createNewSession(title) {
    if (this.useDDD) {
      return await this.ddd.createNewSession(title)
    } else {
      return await this.legacy.createNewSession(title)
    }
  }
  
  async sendMessage(sessionId, content, role) {
    if (this.useDDD) {
      return await this.ddd.sendMessage(sessionId, content, role)
    } else {
      return await this.legacy.sendMessage(sessionId, content, role)
    }
  }
  
  async getChatHistory(sessionId) {
    if (this.useDDD) {
      return await this.ddd.getChatHistory(sessionId)
    } else {
      return await this.legacy.getChatHistory(sessionId)
    }
  }
  
  async getAllSessions() {
    if (this.useDDD) {
      return await this.ddd.getAllSessions()
    } else {
      return await this.legacy.getAllSessions()
    }
  }
  
  // DDD特有功能
  getDomainEvents(sessionId) {
    if (this.useDDD) {
      return this.ddd.getDomainEvents(sessionId)
    }
    return []
  }
}

// 运行演示
async function runDemoComparison() {
  console.log('🎭 DeeChat DDD架构演示 - 新旧实现对比\\n')
  
  const adapter = new DemoHybridAdapter()
  
  console.log('=== 阶段1: 传统实现演示 ===')
  adapter.switchToDDD(false)
  
  // 传统实现测试
  const legacySession = await adapter.createNewSession('传统实现测试')
  await adapter.sendMessage(legacySession.sessionId, '使用传统架构发送的消息')
  await adapter.sendMessage(legacySession.sessionId, '这是AI的回复', 'assistant')
  const legacyHistory = await adapter.getChatHistory(legacySession.sessionId)
  
  console.log(`\\n📊 传统实现结果:`)
  console.log(`   会话ID: ${legacySession.sessionId}`)
  console.log(`   消息数量: ${legacyHistory.totalCount}`)
  
  console.log('\\n=== 阶段2: DDD实现演示 ===')
  adapter.switchToDDD(true)
  
  // DDD实现测试
  const dddSession = await adapter.createNewSession('DDD架构测试')
  await adapter.sendMessage(dddSession.sessionId, '使用DDD架构发送的消息')
  await adapter.sendMessage(dddSession.sessionId, '这是AI通过DDD的回复', 'assistant')
  const dddHistory = await adapter.getChatHistory(dddSession.sessionId)
  
  console.log(`\\n📊 DDD实现结果:`)
  console.log(`   会话ID: ${dddSession.sessionId}`)
  console.log(`   消息数量: ${dddHistory.totalCount}`)
  
  // 展示DDD特有功能
  const domainEvents = adapter.getDomainEvents(dddSession.sessionId)
  console.log(`   领域事件数量: ${domainEvents.length}`)
  domainEvents.forEach((event, index) => {
    console.log(`   事件${index + 1}: ${event.name}`)
  })
  
  console.log('\\n=== 阶段3: 功能对比分析 ===')
  
  // 获取会话列表对比
  adapter.switchToDDD(false)
  const legacySessions = await adapter.getAllSessions()
  
  adapter.switchToDDD(true)
  const dddSessions = await adapter.getAllSessions()
  
  console.log(`\\n📊 对比结果:`)
  console.log(`   传统实现会话数: ${legacySessions.length}`)
  console.log(`   DDD实现会话数: ${dddSessions.length}`)
  
  // API兼容性检查
  const legacyKeys = Object.keys(legacySessions[0] || {}).sort()
  const dddKeys = Object.keys(dddSessions[0] || {}).sort()
  
  console.log(`\\n🔍 API兼容性分析:`)
  console.log(`   传统API字段: ${legacyKeys.join(', ')}`)
  console.log(`   DDD API字段: ${dddKeys.join(', ')}`)
  console.log(`   向后兼容: ${JSON.stringify(legacyKeys) === JSON.stringify(dddKeys) ? '✅' : '⚠️ 需要适配'}`)
  
  console.log('\\n=== 阶段4: 业务价值展示 ===')
  
  console.log(`\\n💡 DDD架构优势:`)
  console.log(`   ✅ 业务规则集中管理 (消息数量限制、归档状态检查)`)
  console.log(`   ✅ 领域事件驱动 (${domainEvents.length}个事件被记录)`)
  console.log(`   ✅ 强类型和验证 (消息内容验证、业务规则检查)`)
  console.log(`   ✅ 可测试性提升 (聚合根可独立测试)`)
  console.log(`   ✅ 扩展性增强 (新业务逻辑易于添加)`)
  
  console.log(`\\n🎯 迁移建议:`)
  console.log(`   1. 使用功能开关逐步切换到DDD实现`)
  console.log(`   2. 保持API兼容性，内部逻辑逐步重构`)
  console.log(`   3. 监控性能和错误率，确保稳定性`)
  console.log(`   4. 团队逐步学习DDD概念和最佳实践`)
  
  return {
    legacy: {
      sessionCount: legacySessions.length,
      apiFields: legacyKeys
    },
    ddd: {
      sessionCount: dddSessions.length,
      apiFields: dddKeys,
      eventCount: domainEvents.length
    }
  }
}

// 运行演示
if (require.main === module) {
  runDemoComparison()
    .then(results => {
      console.log('\\n🎉 DDD架构演示完成！')
      console.log('📈 这展示了如何在保持功能兼容的前提下，实现架构的现代化升级')
    })
    .catch(error => {
      console.error('\\n💥 演示失败:', error)
    })
}

module.exports = { DemoHybridAdapter, runDemoComparison }