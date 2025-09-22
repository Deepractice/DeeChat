/**
 * ConversationDomain - 对话领域服务
 * 
 * 核心职责：
 * - 管理AI对话会话生命周期
 * - 处理流式AI响应和实时交互
 * - 协调AI配置与聊天逻辑
 * - 管理消息历史记录和持久化
 * 
 * 架构特点：
 * - 采用DDD充血模型，业务逻辑集中在领域对象中
 * - 支持多AI Provider，通过缓存机制优化性能
 * - 提供同步和异步流式两种消息发送方式
 * - 统一数据库存储，确保数据一致性
 */

import { Service } from 'typedi'
import { AIChat, ChatOptions, ChatStreamChunk, AIChatConfig } from '@deepracticex/ai-chat'
import { BetterSQLite3Adapter } from '@deepracticex/database-adapter'
import { ConversationStorage } from '@deepracticex/conversation-storage'
import { ContextFormatter } from '@deepracticex/context-manager'
import { IDomain } from '../ipc/ipc-registry.js'
import { DatabaseConfig } from '../config/database.config.js'

// ==================== 类型定义 ====================

/**
 * 对话会话接口
 * 表示一个完整的AI对话会话，包含基本信息和统计数据
 */
export interface ConversationSession {
  id: string                 // 会话唯一标识符
  title: string              // 会话标题，用于UI显示
  ai_model: string           // 使用的AI模型名称
  created_at: string         // 创建时间（ISO字符串）
  updated_at: string         // 最后更新时间（ISO字符串）
  message_count: number      // 消息总数
}

/**
 * 对话消息接口
 * 表示对话中的单条消息，支持用户、AI助手和系统三种角色
 */
export interface ConversationMessage {
  id: string                 // 消息唯一标识符
  session_id: string         // 所属会话ID
  role: 'user' | 'assistant' | 'system'  // 消息发送者角色
  content: string            // 消息内容
  timestamp: string          // 消息时间戳（ISO字符串）
  token_usage?: {            // Token使用统计（可选）
    prompt_tokens: number    // 提示词Token数量
    completion_tokens: number // 生成内容Token数量
    total_tokens: number     // 总Token数量
  }
}

/**
 * AI配置输入接口
 * 用于配置AI客户端的基本参数
 */
export interface AIConfigInput {
  baseUrl: string            // AI服务的API基础URL
  model: string              // 模型名称（如gpt-4, claude-3等）
  apiKey: string             // API密钥
  temperature?: number       // 温度参数，控制回答随机性（0-1）
  maxTokens?: number         // 最大生成Token数量
}

/**
 * 创建会话输入接口
 * 用于创建新对话会话时的参数
 */
export interface CreateSessionInput {
  title?: string             // 会话标题（可选，默认生成）
  ai_config: AIConfigInput   // AI配置信息
  system_prompt?: string     // 系统提示词（可选）
}

/**
 * 发送消息输入接口
 * 用于发送消息时的参数，支持动态配置选项
 */
export interface SendMessageInput {
  session_id: string         // 目标会话ID
  content: string            // 消息内容
  ai_config: AIConfigInput   // AI配置信息
  options?: {                // 可选的聊天配置
    temperature?: number     // 临时温度设置
    max_tokens?: number      // 临时最大Token设置
    system_prompt?: string   // 临时系统提示词
  }
}

// ==================== 领域服务实现 ====================

/**
 * ConversationDomain类 - 充血模型实现
 * 
 * 这是对话领域的核心服务类，采用充血模型设计：
 * - 包含完整的业务逻辑，而非仅仅作为数据载体
 * - 负责协调多个基础设施组件（存储层、AI客户端等）
 * - 实现复杂的业务流程（流式消息处理、缓存管理等）
 */
@Service()
export class ConversationDomain implements IDomain {
  // ============ 私有字段 ============

  /** 对话存储管理器，负责数据持久化 */
  private conversationStorage: ConversationStorage | null = null

  /** AI客户端缓存，提高性能并避免重复创建 */
  private activeChatClients: Map<string, AIChat> = new Map()

  // ============ 构造函数 ============
  
  /**
   * 构造函数
   * 初始化存储层，使用统一的数据库文件确保数据一致性
   * 注意：数据库路径由DatabaseConfig统一管理，确保与AIConfigurationDomain使用相同的数据库
   */
  constructor() {
    // 注意：此时app可能还未ready，DatabaseConfig会在initialize()中使用
    // conversationStorage将在initialize()中创建
  }

  // ============ 领域初始化 ============
  
  /**
   * 初始化领域服务
   * 
   * 执行必要的初始化步骤：
   * 1. 获取标准化的数据库路径配置
   * 2. 创建ConversationStorage实例
   * 3. 初始化存储层（创建数据库表、索引等）
   * 4. 验证系统依赖
   * 
   * @throws {Error} 初始化失败时抛出错误
   */
  async initialize(): Promise<void> {
    console.log('🤖 初始化ConversationDomain...')
    
    try {
      // 1. 获取统一的数据库配置
      const dbConfig = DatabaseConfig.getInstance()
      const dbPath = dbConfig.getDatabasePath()
      
      console.log(`🗄️ ConversationDomain使用数据库路径: ${dbPath}`)
      
      // 2. 创建数据库适配器
      const adapter = new BetterSQLite3Adapter(dbPath)
      await adapter.connect()

      // 3. 创建对话存储管理器实例
      this.conversationStorage = new ConversationStorage({ database: adapter })
      await this.conversationStorage.initialize()
      console.log('✅ ConversationStorage 初始化完成')
      
      console.log('✅ ConversationDomain 初始化完成')
    } catch (error) {
      console.error('❌ ConversationDomain 初始化失败:', error)
      throw error  // 重新抛出错误，让上层处理
    }
  }

  // ============ IPC接口暴露 ============
  
  /**
   * 暴露IPC接口
   * 
   * 将领域服务的方法暴露给IPC层，供渲染进程调用
   * 使用bind确保方法调用时的this上下文正确
   * 
   * @returns IPC方法映射表
   */
  exposeToIPC(): Record<string, Function> {
    console.log('🤖 ConversationDomain 注册IPC接口...')
    
    const ipcHandlers = {
      'conversation:create-session': this.createSession.bind(this),      // 创建新会话
      'conversation:get-sessions': this.getSessions.bind(this),          // 获取会话列表
      'conversation:get-session': this.getSession.bind(this),            // 获取单个会话
      'conversation:send-message': this.sendMessageSync.bind(this),      // 发送消息（同步）
      'conversation:send-message-stream': this.sendMessageStream.bind(this), // 发送消息（流式）
      'conversation:delete-session': this.deleteSession.bind(this),      // 删除会话
      'conversation:get-message-history': this.getMessageHistory.bind(this), // 获取消息历史
      'conversation:clear-cache': this.clearAIClientCache.bind(this)     // 清理缓存
    }
    
    console.log(`✅ ConversationDomain IPC接口注册完成: ${Object.keys(ipcHandlers).length}个方法`)
    console.log('📋 注册的IPC方法:', Object.keys(ipcHandlers).join(', '))
    
    return ipcHandlers
  }

  // ============ 核心业务方法 ============
  
  /**
   * 创建新的对话会话
   * 
   * 业务流程：
   * 1. 验证输入参数的完整性
   * 2. 调用存储层创建会话记录
   * 3. 转换数据格式以适配领域模型
   * 4. 可选添加系统提示消息
   * 
   * @param input 创建会话的输入参数
   * @returns 创建的会话对象
   * @throws {Error} 参数验证失败或创建过程出错
   */
  async createSession(input: CreateSessionInput): Promise<ConversationSession> {
    // 1. 业务规则验证：确保AI配置完整
    if (!input.ai_config.baseUrl || !input.ai_config.model || !input.ai_config.apiKey) {
      throw new Error('AI配置不完整：需要 baseUrl、model 和 apiKey')
    }

    // 2. 调用存储层创建会话
    const storageSession = await this.getStorageManager().createSession({
      title: input.title || `对话 ${new Date().toLocaleString()}`,  // 默认标题
      ai_config_name: input.ai_config.model  // 使用模型名作为配置标识
    })

    // 3. 数据转换：将存储层模型转换为领域模型
    const session: ConversationSession = {
      id: storageSession.id,
      title: storageSession.title,
      ai_model: input.ai_config.model,
      created_at: storageSession.created_at,
      updated_at: storageSession.updated_at,
      message_count: storageSession.message_count
    }

    // 4. 可选业务逻辑：添加系统提示消息
    if (input.system_prompt) {
      await this.addSystemMessage(session.id, input.system_prompt)
    }

    return session
  }

  /**
   * 发送消息（同步版本，用于IPC调用）
   * 
   * 这是sendMessage的同步包装器，将流式响应转换为单次返回结果
   * 适用于需要等待完整响应的场景
   * 
   * @param input 发送消息的输入参数
   * @returns 包含用户消息和AI回复的完整结果
   * @throws {Error} 消息发送失败或响应不完整
   */
  async sendMessageSync(input: SendMessageInput): Promise<{
    userMessage: ConversationMessage
    aiMessage: ConversationMessage
  }> {
    let userMessage: ConversationMessage | null = null
    let aiMessage: ConversationMessage | null = null

    // 遍历流式响应，收集最终结果
    for await (const event of this.sendMessage(input)) {
      if (event.type === 'message_saved') {
        userMessage = event.data
      } else if (event.type === 'ai_complete') {
        aiMessage = event.data
      } else if (event.type === 'error') {
        throw new Error(event.data.error)
      }
    }

    // 验证响应完整性
    if (!userMessage || !aiMessage) {
      throw new Error('发送消息失败：未收到完整响应')
    }

    return { userMessage, aiMessage }
  }

  /**
   * 发送消息（流式版本，用于IPC调用）
   *
   * 通过IPC事件实时发送流式响应，不等待完成
   * 适用于需要实时显示AI响应的场景
   *
   * @param input 发送消息的输入参数
   * @param event Electron IPC事件对象，用于发送实时事件
   * @returns 操作结果
   */
  async sendMessageStream(input: SendMessageInput, event?: any): Promise<{ status: string }> {
    try {
      // 实时发送流式事件
      for await (const streamEvent of this.sendMessage(input)) {
        if (event && event.sender) {
          // 发送实时流式事件到前端
          console.log('📡 发送IPC流式事件:', JSON.stringify(streamEvent, null, 2))
          event.sender.send('conversation:stream-event', {
            sessionId: input.session_id,
            event: streamEvent
          })
        } else {
          console.log('❌ IPC事件发送失败: event或sender不存在')
        }
      }

      // 发送完成信号
      if (event && event.sender) {
        event.sender.send('conversation:stream-complete', {
          sessionId: input.session_id
        })
      }

      return { status: 'streaming_started' }
    } catch (error) {
      // 发送错误事件
      if (event && event.sender) {
        event.sender.send('conversation:stream-error', {
          sessionId: input.session_id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
      throw error
    }
  }

  /**
   * 发送消息并获取AI回复（流式核心方法）
   * 
   * 这是整个对话系统的核心方法，实现了复杂的流式AI交互逻辑：
   * 1. 验证会话存在性
   * 2. 保存用户消息到数据库
   * 3. 获取或创建AI客户端（带缓存）
   * 4. 构建消息历史上下文
   * 5. 执行流式AI请求
   * 6. 实时转发AI响应块
   * 7. 保存AI回复消息
   * 8. 更新会话统计信息
   * 
   * @param input 发送消息的输入参数
   * @yields 流式事件：消息保存、AI响应块、完成、错误
   */
  async *sendMessage(input: SendMessageInput): AsyncIterable<{
    type: 'message_saved' | 'ai_chunk' | 'ai_complete' | 'error'
    data: any
  }> {
    try {
      // 1. 业务验证：确保会话存在
      const session = await this.getSession(input.session_id)
      if (!session) {
        throw new Error(`会话 '${input.session_id}' 不存在`)
      }

      // 2. 持久化用户消息
      const userMessage = await this.saveMessage({
        session_id: input.session_id,
        role: 'user',
        content: input.content
      })

      // 3. 通知消息已保存
      yield {
        type: 'message_saved',
        data: userMessage
      }

      // 4. 获取AI客户端（带缓存优化）
      const aiClient = await this.getOrCreateAIClient(input.ai_config)
      console.log('🤖 AI客户端配置:', {
        baseUrl: input.ai_config.baseUrl,
        model: input.ai_config.model,
        hasApiKey: !!input.ai_config.apiKey
      })

      // 5. 构建对话上下文
      const messageHistory = await this.getMessageHistory(input.session_id)

      // 使用context-manager包直接生成消息数组
      const systemPrompt = input.options?.systemPrompt || 'You are a helpful AI assistant.'
      console.log('🎭 后端接收到的系统提示词:', systemPrompt)

      const templateInput = {
        role: systemPrompt,
        conversation: messageHistory
          .filter(msg => msg.role !== 'system')
          .map(msg => `${msg.role}: ${msg.content}`),
        current: input.content
      }

      const messages = ContextFormatter.fromTemplateAsMessages('standard', templateInput)

      console.log('📝 生成的消息数组:')
      console.log(JSON.stringify(messages, null, 2))
      console.log('📝 发送给AI的消息数量:', messages.length)

      // 6. 配置AI请求参数
      const chatOptions: ChatOptions = {
        temperature: input.options?.temperature,
        maxTokens: input.options?.max_tokens
        // 注意：systemPrompt已经包含在formattedContext中，不需要单独设置
      }

      console.log('⚙️ 聊天选项:', chatOptions)

      // 7. 执行流式AI对话
      let aiContent = ''           // 累积AI响应内容
      let finalUsage: any = undefined  // Token使用统计

      console.log('🔄 开始AI流式请求...')

      for await (const chunk of aiClient.sendMessage(messages, chatOptions)) {
        console.log('📦 收到AI流式chunk:', JSON.stringify(chunk, null, 2))
        // 实时转发AI响应块给前端
        yield {
          type: 'ai_chunk',
          data: chunk
        }

        // 累积响应数据
        if (chunk.content) {
          aiContent += chunk.content
        }
        if (chunk.usage) {
          finalUsage = chunk.usage
        }

        // 错误处理
        if (chunk.error) {
          console.error('❌ AI客户端错误详情:', chunk.error)
          yield {
            type: 'error',
            data: { error: chunk.error }
          }
          return
        }

        // 检查流式响应是否完成
        if (chunk.done) {
          break
        }
      }

      // 8. 持久化AI回复
      const aiMessage = await this.saveMessage({
        session_id: input.session_id,
        role: 'assistant',
        content: aiContent,
        token_usage: finalUsage
      })

      // 9. 更新会话统计（消息数量等）
      await this.updateSessionMessageCount(input.session_id)

      // 10. 通知AI响应完成
      yield {
        type: 'ai_complete',
        data: aiMessage
      }

    } catch (error) {
      // 统一错误处理和通知
      yield {
        type: 'error',
        data: { 
          error: error instanceof Error ? error.message : String(error) 
        }
      }
    }
  }

  // ============ 私有辅助方法 ============


  /**
   * 获取或创建AI客户端（带缓存优化）
   *
   * 实现AI客户端的懒加载和缓存机制：
   * - 使用baseUrl+model作为唯一缓存键
   * - 避免重复创建相同配置的客户端
   * - 提高性能，减少资源消耗
   *
   * @param aiConfig AI配置参数
   * @returns AI客户端实例
   * @private
   */
  private async getOrCreateAIClient(aiConfig: AIConfigInput): Promise<AIChat> {
    // 构建缓存键：baseUrl + model 组合确保唯一性
    const cacheKey = `${aiConfig.baseUrl}:${aiConfig.model}`
    
    // 检查缓存，如果存在则直接返回
    if (this.activeChatClients.has(cacheKey)) {
      return this.activeChatClients.get(cacheKey)!
    }

    // 创建新的AI客户端配置
    const aiChatConfig: AIChatConfig = {
      baseUrl: aiConfig.baseUrl,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      temperature: aiConfig.temperature || 0.7,    // 默认温度
      maxTokens: aiConfig.maxTokens || 4000        // 默认最大Token数
    }

    // 创建AI客户端实例
    const aiClient = new AIChat(aiChatConfig)

    // 将客户端存入缓存
    this.activeChatClients.set(cacheKey, aiClient)

    return aiClient
  }

  // ============ 存储管理器访问方法 ============

  /**
   * 获取对话存储管理器实例
   * 确保管理器已正确初始化
   */
  private getStorageManager(): ConversationStorage {
    if (!this.conversationStorage) {
      throw new Error('ConversationStorage未初始化，请先调用initialize方法')
    }
    return this.conversationStorage
  }

  // ============ 查询方法 ============

  /**
   * 获取单个会话信息
   *
   * @param sessionId 会话ID
   * @returns 会话对象，不存在时返回null
   */
  async getSession(sessionId: string): Promise<ConversationSession | null> {
    const storageSession = await this.getStorageManager().getSession(sessionId)
    if (!storageSession) {
      return null
    }

    // 数据转换：存储层模型 → 领域模型
    return {
      id: storageSession.id,
      title: storageSession.title,
      ai_model: storageSession.ai_config_name, // 映射字段名
      created_at: storageSession.created_at,
      updated_at: storageSession.updated_at,
      message_count: storageSession.message_count
    }
  }

  /**
   * 获取会话列表
   * 
   * 按最后更新时间降序排列，最近使用的会话排在前面
   * 
   * @returns 会话列表数组
   */
  async getSessions(): Promise<ConversationSession[]> {
    const storageSessions = await this.getStorageManager().getSessions({
      orderBy: 'updated_at',
      orderDirection: 'DESC'
    })

    // 批量数据转换：存储层模型 → 领域模型
    return storageSessions.map((session: any) => ({
      id: session.id,
      title: session.title,
      ai_model: session.ai_config_name,
      created_at: session.created_at,
      updated_at: session.updated_at,
      message_count: session.message_count
    }))
  }

  /**
   * 获取指定会话的消息历史
   * 
   * 按时间戳升序排列，确保消息按发送顺序显示
   * 
   * @param sessionId 会话ID
   * @returns 消息历史数组
   */
  async getMessageHistory(sessionId: string): Promise<ConversationMessage[]> {
    return await this.getStorageManager().getMessageHistory(sessionId, {
      orderBy: 'timestamp',
      orderDirection: 'ASC'
    })
  }

  /**
   * 保存消息到数据库
   * 
   * @param data 消息数据
   * @returns 保存后的消息对象
   * @private
   */
  private async saveMessage(data: {
    session_id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    token_usage?: any
  }): Promise<ConversationMessage> {
    // 委托给存储层处理具体的保存逻辑
    return await this.getStorageManager().saveMessage({
      session_id: data.session_id,
      role: data.role,
      content: data.content,
      token_usage: data.token_usage
    })
  }

  /**
   * 添加系统提示消息
   * 
   * @param sessionId 会话ID
   * @param content 系统提示内容
   * @private
   */
  private async addSystemMessage(sessionId: string, content: string): Promise<void> {
    await this.saveMessage({
      session_id: sessionId,
      role: 'system',
      content
    })
  }

  /**
   * 更新会话消息数量统计
   * 
   * 注意：当前存储层会自动维护计数，无需主动调用
   * 
   * @param _sessionId 会话ID（暂未使用）
   * @private
   */
  private async updateSessionMessageCount(_sessionId: string): Promise<void> {
    // conversation-storage 包在 saveMessage 时会自动更新消息计数
    // 此方法预留用于未来可能的扩展需求
  }

  // ============ 管理操作方法 ============
  
  /**
   * 删除会话及其所有消息
   * 
   * 执行级联删除：会话记录 + 所有关联消息
   * 
   * @param sessionId 要删除的会话ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    // 存储层负责级联删除所有关联消息
    await this.getStorageManager().deleteSession(sessionId)
  }

  /**
   * 清理AI客户端缓存
   * 
   * 用于释放内存，特别在配置变更后调用
   */
  clearAIClientCache(): void {
    this.activeChatClients.clear()
  }

  // ============ 系统监控方法 ============
  
  /**
   * 获取系统统计信息
   * 
   * @returns 统计数据对象
   */
  async getStats(): Promise<any> {
    return await this.getStorageManager().getStats()
  }

  /**
   * 系统健康检查
   * 
   * @returns 健康状态报告
   */
  healthCheck(): any {
    return {
      conversation_storage: this.getStorageManager().healthCheck(),
      active_clients: this.activeChatClients.size
    }
  }

  // ============ 资源管理方法 ============
  
  /**
   * 关闭并清理所有资源
   * 
   * 应用关闭时调用，确保资源正确释放：
   * - 清理AI客户端缓存
   * - 关闭数据库连接
   */
  async close(): Promise<void> {
    // 清理内存中的AI客户端缓存
    this.activeChatClients.clear()

    // 关闭存储层连接
    if (this.conversationStorage) {
      await this.conversationStorage.close()
    }
  }
}