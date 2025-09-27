/**
 * MessageService - 消息处理服务
 *
 * 职责：
 * - 处理AI消息发送和响应
 * - 管理消息流和状态
 * - 协调AI客户端和工具调用
 */

import { Service, Inject } from 'typedi'
import { AIChat, ChatOptions, ChatStreamChunk, AIChatConfig, Tool } from '@deepracticex/ai-chat'
import { ConversationRepository } from '../repositories/ConversationRepository.js'
import { ToolCallService } from './ToolCallService.js'
import { AIConfigInput, ConversationMessage, SendMessageInput } from '../types/ConversationTypes.js'
import { McpDomain } from '../../mcp/index.js'

@Service()
export class MessageService {
  /** AI客户端缓存，提高性能并避免重复创建 */
  private activeChatClients: Map<string, AIChat> = new Map()

  /** MCP域服务，提供工具列表 */
  @Inject(() => McpDomain)
  private mcpDomain!: McpDomain

  constructor(
    private conversationRepository: ConversationRepository,
    private toolCallService: ToolCallService
  ) {}

  /**
   * 发送消息并处理流式响应
   */
  async *sendMessageStream(input: SendMessageInput): Promise<AsyncGenerator<any, void, unknown>> {
    try {
      console.log(`💬 [MessageService] 开始发送消息`, {
        sessionId: input.session_id,
        messageLength: input.content.length,
        aiModel: input.ai_config.model
      })

      // 1. 保存用户消息
      const userMessageId = await this.conversationRepository.addMessage({
        session_id: input.session_id,
        role: 'user',
        content: input.content,
        token_count: 0
      })

      console.log(`📝 用户消息已保存: ${userMessageId}`)

      // 2. 获取消息历史
      const messageHistory = await this.conversationRepository.getMessageHistory(input.session_id)

      // 3. 转换为AI Chat格式
      const messages = messageHistory.map(msg => ({
        role: msg.role as any,
        content: msg.content,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id
      }))

      // 4. 创建AI客户端
      const aiClient = this.getOrCreateAIClient(input.ai_config)

      // 5. 获取可用工具（静默处理，只关心是否有可用工具）
      const availableTools = await this.getAvailableTools()

      // 准备聊天选项 - 只有当真正有可用工具时才传递给 AI
      const chatOptions: ChatOptions = {
        model: input.ai_config.model,
        temperature: input.ai_config.temperature,
        maxTokens: input.ai_config.maxTokens,
        systemPrompt: input.options?.system_prompt
      }

      // 只有当有可用工具时才添加到聊天选项中
      if (availableTools.length > 0) {
        chatOptions.tools = availableTools
        console.log(`🛠️ [MessageService] 向 AI 提供 ${availableTools.length} 个可用工具`)
      } else {
        console.log(`📝 [MessageService] 没有可用工具，AI 将以纯文本模式运行`)
      }

      // 6. 设置工具调用处理器
      chatOptions.onToolCall = async (toolCall) => {
        return await this.toolCallService.handleToolCall(toolCall)
      }

      let assistantContent = ''
      let assistantMessageId: string | null = null
      let lastUsage: any = null

      // 7. 发送消息并处理流式响应
      for await (const chunk of aiClient.sendMessage(messages, chatOptions)) {
        // 转发chunk到前端
        yield {
          type: 'ai_chunk',
          data: chunk
        }

        // 收集助手回复内容
        if (chunk.content) {
          assistantContent += chunk.content
        }

        // 保存usage信息
        if (chunk.usage) {
          lastUsage = chunk.usage
        }

        // 如果是完成标志，保存助手消息
        if (chunk.done && assistantContent) {
          assistantMessageId = await this.conversationRepository.addMessage({
            session_id: input.session_id,
            role: 'assistant',
            content: assistantContent,
            ai_model: input.ai_config.model,
            token_count: lastUsage?.total_tokens || 0
          })

          console.log(`🤖 AI响应已保存: ${assistantMessageId}`, {
            contentLength: assistantContent.length,
            tokens: lastUsage?.total_tokens || 0
          })
        }
      }

      console.log(`✅ 消息处理完成`)

    } catch (error) {
      console.error(`❌ 消息处理失败:`, error)

      // 发送错误信息到前端
      yield {
        type: 'error',
        data: {
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  /**
   * 发送消息（非流式）
   */
  async sendMessage(input: SendMessageInput): Promise<ConversationMessage> {
    const chunks: any[] = []

    for await (const chunk of this.sendMessageStream(input)) {
      chunks.push(chunk)
    }

    // 找到最后的AI消息
    const lastChunk = chunks[chunks.length - 1]
    if (lastChunk?.type === 'error') {
      throw new Error(lastChunk.data.error)
    }

    // 获取最新的消息历史
    const messages = await this.conversationRepository.getMessageHistory(input.session_id)
    const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop()

    if (!lastAssistantMessage) {
      throw new Error('Failed to retrieve assistant message')
    }

    return lastAssistantMessage
  }

  /**
   * 获取或创建AI客户端
   */
  private getOrCreateAIClient(config: AIConfigInput): AIChat {
    const clientKey = `${config.model}-${config.baseUrl}`

    if (!this.activeChatClients.has(clientKey)) {
      const aiConfig: AIChatConfig = {
        model: config.model,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey || '',
        temperature: config.temperature || 0.7,
        // 不限制maxTokens，让AI模型决定输出长度
        // 如果需要限制，可以在前端配置中设定
        maxTokens: config.maxTokens
      }

      const client = new AIChat(aiConfig)
      this.activeChatClients.set(clientKey, client)

      console.log(`🔧 创建新的AI客户端: ${clientKey}`)
    }

    return this.activeChatClients.get(clientKey)!
  }

  /**
   * 获取可用工具列表
   * 从MCP域获取所有连接的服务器的工具，转换为AI Chat需要的格式
   * 静默处理错误，只返回实际可用的工具
   */
  private async getAvailableTools(): Promise<Tool[]> {
    try {
      // 检查McpDomain是否可用
      if (!this.mcpDomain || !this.mcpDomain.serverService || !this.mcpDomain.functionService) {
        console.log('⚠️ [MessageService] MCP域服务不可用，跳过工具加载')
        return []
      }

      // 获取所有连接的服务器
      const connections = this.mcpDomain.serverService.listConnections()
      const connectedServers = connections.filter(conn => conn.status === 'connected')

      console.log(`📊 [MessageService] 找到 ${connectedServers.length} 个已连接的MCP服务器`)

      // 如果没有连接的服务器，静默返回空数组
      if (connectedServers.length === 0) {
        console.log('📝 [MessageService] 没有可用的MCP服务器连接')
        return []
      }

      // 获取所有服务器的工具
      const toolsPromises = connectedServers.map(async (conn) => {
        try {
          const tools = await this.mcpDomain.functionService.listTools(conn.serverId)
          console.log(`🛠️ [MessageService] 服务器 ${conn.serverId}: ${tools.length} 个工具`)

          // 转换为AI Chat工具格式
          return tools.map(tool => this.convertMcpToolToAIChatTool(conn.serverId, tool))
        } catch (error) {
          console.error(`❌ [MessageService] 获取服务器 ${conn.serverId} 的工具失败:`, error)
          return []
        }
      })

      const toolArrays = await Promise.all(toolsPromises)
      const allTools = toolArrays.flat()

      console.log(`✅ [MessageService] 总计获取到 ${allTools.length} 个可用工具`)

      return allTools
    } catch (error) {
      console.error('❌ [MessageService] 获取可用工具列表失败:', error)
      return []
    }
  }


  /**
   * 将MCP工具格式转换为AI Chat工具格式
   */
  private convertMcpToolToAIChatTool(serverId: string, mcpTool: any): Tool {
    return {
      type: 'function',
      function: {
        name: `${serverId}.${mcpTool.name}`,  // 格式: serverId.toolName
        description: mcpTool.description || `Tool ${mcpTool.name} from ${serverId}`,
        parameters: mcpTool.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }
  }

  /**
   * 清理AI客户端缓存
   */
  clearClientCache(): void {
    this.activeChatClients.clear()
    console.log('🧹 AI客户端缓存已清理')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { activeClients: number } {
    return {
      activeClients: this.activeChatClients.size
    }
  }
}