/**
 * 新一代流式处理器
 * 
 * 设计原则：
 * - 单一职责：只处理LangChain流式输出
 * - 高性能：最小化数据转换
 * - 可靠性：统一错误处理
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { StreamChunk, StreamOptions, StreamCallbacks } from '../../../shared/streaming/StreamTypes'
import { StreamChunkUtils } from '../../../shared/streaming/StreamChunkUtils'
import log from 'electron-log'

export interface ProcessOptions extends StreamOptions {
  onChunk?: (chunk: StreamChunk) => void
  signal?: AbortSignal
}

export class StreamProcessor {
  private mcpClient: any

  constructor(mcpClient?: any) {
    this.mcpClient = mcpClient
    log.info('🚀 [StreamProcessor] 新流式处理器初始化完成')
  }

  /**
   * 处理流式消息
   */
  async process(
    model: BaseChatModel,
    messages: any[],
    options: ProcessOptions
  ): Promise<string> {
    const { sessionId, onChunk, signal } = options
    let fullContent = ''
    const toolExecutions: any[] = []
    let currentMessages = [...messages] // 复制消息数组用于工具调用循环

    // 简化初始化

    try {
      // 工具调用循环：持续处理直到AI不再调用工具
      let hasToolCalls = true
      let iterationCount = 0
      const maxIterations = 10 // 防止无限循环

      while (hasToolCalls && iterationCount < maxIterations) {
        hasToolCalls = false
        iterationCount++
        
        // 简化迭代日志

        // 🚨 [前端控制台] 完整LangChain请求日志
        if (process.type === 'browser') {
          try {
            const { webContents } = require('electron');
            const allWebContents = webContents.getAllWebContents();
            allWebContents.forEach((contents: any) => {
              const messagesJson = JSON.stringify(currentMessages.map(msg => ({
                role: msg.role,
                content: msg.content
              })), null, 2);

              contents.executeJavaScript(`
                console.clear();
                console.group('%c🚨 [LANGCHAIN-REQUEST] 完整请求参数', 'color: #ff1744; font-weight: bold; font-size: 18px; background: #ffebee; padding: 8px 12px; border-radius: 6px; border: 2px solid #ff1744;');
                console.log('%c📊 迭代轮次: ${iterationCount}', 'color: #1976d2; font-weight: bold; font-size: 14px;');
                console.log('%c🎭 会话ID: ${sessionId}', 'color: #388e3c; font-weight: bold; font-size: 14px;');
                console.log('%c📨 消息数量: ${currentMessages.length}', 'color: #7b1fa2; font-weight: bold; font-size: 14px;');
                console.log('%c📝 完整消息数组:', 'color: #e65100; font-weight: bold; font-size: 16px;');
                console.log(${JSON.stringify(messagesJson)});
                console.log('%c⏳ 正在发送给LangChain模型...', 'color: #ff9800; font-weight: bold; font-size: 14px;');
                console.groupEnd();
              `);
            });
          } catch (error) {
            // 忽略错误，不打印任何错误日志
          }
        }

        // 获取LangChain模型流
        const stream = await model.stream(currentMessages, { signal })

        // 处理每个流式块
        for await (const chunk of stream) {
          // 检查中断信号
          if (signal?.aborted) {
            log.warn(`⏹️ [StreamProcessor] 流处理被中断: ${sessionId}`)
            return fullContent
          }

          // 处理文本内容
          if (chunk.content && typeof chunk.content === 'string') {
            const textContent = chunk.content
            fullContent += textContent

            // 发送文本块
            const textChunk = StreamChunkUtils.createTextChunk(
              textContent, 
              sessionId, 
              true
            )
            onChunk?.(textChunk)

            // 清理文本块日志
          }

          // 处理工具调用
          if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            hasToolCalls = true
            
            // 工具调用处理（移除前端日志）
            
            // 创建AI消息记录工具调用
            const aiMessage = {
              role: 'assistant',
              content: chunk.content || '',
              tool_calls: chunk.tool_calls
            }
            currentMessages.push(aiMessage)

            // 执行所有工具调用
            for (const toolCall of chunk.tool_calls) {
              const toolResult = await this.processToolCall(toolCall, sessionId, onChunk, toolExecutions)
              
              // 创建工具结果消息
              const toolMessage = {
                role: 'tool',
                content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                tool_call_id: toolCall.id
              }
              currentMessages.push(toolMessage)

              // 清理工具调用完成日志
            }

            // 工具调用完成后，AI需要基于结果继续生成响应
            break // 退出当前流，开始下一轮
          }
        }

        // 如果这轮没有工具调用，说明AI完成了最终响应
      }

      if (iterationCount >= maxIterations) {
        log.warn(`⚠️ [StreamProcessor] 达到最大迭代次数 ${maxIterations}，停止处理`)
      }

      // 发送完成块
      const completeChunk = StreamChunkUtils.createCompleteChunk(
        fullContent,
        toolExecutions,
        sessionId
      )
      onChunk?.(completeChunk)

      return fullContent

    } catch (error) {
      // 简化错误日志
      
      // 发送错误块
      const errorChunk = StreamChunkUtils.createErrorChunk(
        error instanceof Error ? error.message : String(error),
        '流式处理失败',
        sessionId
      )
      onChunk?.(errorChunk)
      
      throw error
    }
  }

  /**
   * 处理单个工具调用
   */
  private async processToolCall(
    toolCall: any,
    sessionId: string,
    onChunk?: (chunk: StreamChunk) => void,
    toolExecutions: any[] = []
  ): Promise<any> {
    const startTime = Date.now()
    const toolId = toolCall.id || `tool_${Date.now()}`
    const toolName = toolCall.name

    // 简化工具调用日志

    // 发送工具开始块
    const startChunk = StreamChunkUtils.createToolStartChunk(
      toolName,
      toolId,
      toolCall.args || {},
      sessionId
    )
    onChunk?.(startChunk)

    try {
      // 执行工具调用
      const result = await this.executeToolCall(toolCall)
      const duration = Date.now() - startTime

      // 处理大型结果
      if (typeof result === 'string' && StreamChunkUtils.isLargeContent(result)) {
        await this.handleLargeContent(result, toolName, toolId, sessionId, onChunk)
      } else {
        // 发送工具结果块
        const resultChunk = StreamChunkUtils.createToolResultChunk(
          toolName,
          toolId,
          result,
          true,
          undefined,
          duration,
          sessionId
        )
        onChunk?.(resultChunk)
        toolExecutions.push(resultChunk)
      }

      log.info(`✅ [StreamProcessor] 工具调用完成: ${toolName} (${duration}ms)`)
      return result // 返回工具执行结果

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // 发送工具错误块
      const errorChunk = StreamChunkUtils.createToolResultChunk(
        toolName,
        toolId,
        null,
        false,
        errorMessage,
        duration,
        sessionId
      )
      onChunk?.(errorChunk)
      toolExecutions.push(errorChunk)

      log.error(`❌ [StreamProcessor] 工具调用失败: ${toolName}`, error)
      return `Error: ${errorMessage}` // 返回错误信息
    }
  }

  /**
   * 处理大型内容
   */
  private async handleLargeContent(
    content: string,
    toolName: string,
    toolId: string,
    sessionId: string,
    onChunk?: (chunk: StreamChunk) => void
  ) {
    log.info(`📦 [StreamProcessor] 处理大型内容: ${content.length}字符`)

    // 分块发送
    const chunks = StreamChunkUtils.chunkLargeContent(content, 1000)
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const isLast = i === chunks.length - 1
      
      // 创建分片结果块
      const resultChunk = StreamChunkUtils.createToolResultChunk(
        toolName,
        toolId,
        {
          content: chunk,
          isPartial: !isLast,
          chunkIndex: i,
          totalChunks: chunks.length
        },
        true,
        undefined,
        undefined,
        sessionId
      )
      
      onChunk?.(resultChunk)
      
      // 小延迟让前端有时间处理
      if (!isLast) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }
  }

  /**
   * 执行工具调用
   */
  private async executeToolCall(toolCall: any): Promise<any> {
    if (!this.mcpClient) {
      throw new Error('MCP客户端未初始化')
    }

    const toolName = toolCall.name
    const toolArgs = toolCall.args

    log.info(`🔧 [StreamProcessor] 执行工具调用: ${toolName}`)
    log.debug(`🔧 [StreamProcessor] 工具参数:`, JSON.stringify(toolArgs, null, 2))
    
    // 🔍 增强调试：控制台输出和详细分析
    console.log(`🔧 [StreamProcessor-DEBUG] 工具调用详情:`);
    console.log(`🔧 [StreamProcessor-DEBUG] - 工具名: ${toolName}`);
    console.log(`🔧 [StreamProcessor-DEBUG] - 参数类型: ${typeof toolArgs}`);
    console.log(`🔧 [StreamProcessor-DEBUG] - 参数是否为空对象: ${JSON.stringify(toolArgs) === '{}'}`);
    console.log(`🔧 [StreamProcessor-DEBUG] - 参数内容: ${JSON.stringify(toolArgs, null, 2)}`);
    
    if (JSON.stringify(toolArgs) === '{}') {
      console.log(`❌ [StreamProcessor-DEBUG] 发现空参数问题！工具: ${toolName}`);
      log.error(`❌ [StreamProcessor-DEBUG] 发现空参数问题！工具: ${toolName}`);
    }

    // 解析serverId__toolName格式
    const parts = toolName.split('__')
    if (parts.length >= 2) {
      const serverId = parts[0]
      const actualToolName = parts[1]
      log.info(`🔧 [StreamProcessor] 路由工具调用: ${serverId} -> ${actualToolName}`)
      return await this.mcpClient.callTool(serverId, actualToolName, toolArgs)
    } else {
      log.error(`❌ [StreamProcessor] 无法解析工具名称: "${toolName}"`)
      log.error(`❌ [StreamProcessor] 期望格式: serverId__toolName，实际: ${toolName}`)
      throw new Error(`无法解析工具名称: ${toolName}`)
    }
  }

  /**
   * 中断处理
   */
  interrupt(sessionId: string): void {
    log.info(`⏹️ [StreamProcessor] 中断处理请求: ${sessionId}`)
    // 简化版本，实际中断逻辑在process方法的signal中处理
  }

  /**
   * 获取处理状态
   */
  getStatus(sessionId: string): { isProcessing: boolean } {
    // 简化版本，返回基本状态
    return { isProcessing: false }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    log.info('🧹 [StreamProcessor] 清理资源')
    // 简化版本，主要清理工作在process方法完成时自动处理
  }
}