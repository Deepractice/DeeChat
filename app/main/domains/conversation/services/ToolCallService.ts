/**
 * ToolCallService - 工具调用处理服务
 *
 * 职责：
 * - 处理AI工具调用请求
 * - 协调与McpDomain的交互
 * - 管理工具调用的生命周期和错误处理
 */

import { Service, Inject } from 'typedi'
import { ToolCall, ToolResult } from '@deepracticex/ai-chat'
import { McpDomain } from '../../mcp/index.js'

export interface ToolCallResult {
  tool_call_id: string
  result: any
  error?: string
}

@Service()
export class ToolCallService {
  /** MCP域服务，处理工具调用 - 使用属性注入 */
  @Inject(() => McpDomain)
  private mcpDomain!: McpDomain

  /**
   * 处理单个工具调用
   */
  async handleToolCall(call: ToolCall): Promise<ToolCallResult> {
    try {
      console.log(`🔧 [ToolCallService] 开始处理工具调用: ${call.function.name}`, {
        toolCallId: call.id,
        args: call.function.arguments
      })

      // 🚨 CRITICAL DEBUG: 检查 mcpDomain 实例状态
      console.log('🔍 [CRITICAL DEBUG] ToolCallService mcpDomain检查:', {
        mcpDomainExists: !!this.mcpDomain,
        mcpDomainType: typeof this.mcpDomain,
        mcpDomainConstructor: this.mcpDomain?.constructor?.name,
        hasCallToolMethod: typeof this.mcpDomain?.callTool,
        isCallToolFunction: typeof this.mcpDomain?.callTool === 'function',
        mcpDomainKeys: this.mcpDomain ? Object.keys(this.mcpDomain).slice(0, 10) : 'NULL',
        mcpDomainProto: this.mcpDomain ? Object.getPrototypeOf(this.mcpDomain).constructor.name : 'NULL'
      })

      // 解析工具名称: "serverId.toolName"
      const parts = call.function.name.split('.')

      if (parts.length !== 2) {
        throw new Error(`无效的工具名称格式: ${call.function.name}，期望格式: serverId.toolName`)
      }

      const [serverId, toolName] = parts
      let args: any = {}

      // 解析参数
      if (call.function.arguments) {
        try {
          args = JSON.parse(call.function.arguments)
        } catch (parseError) {
          console.warn(`⚠️ 参数解析失败，使用空对象:`, parseError)
        }
      }

      console.log(`🎯 调用 MCP 工具: ${serverId}.${toolName}`, args)

      // 直接调用 McpDomain - 绕过所有中间层
      const result = await this.mcpDomain.callTool(serverId, toolName, args)

      console.log(`✅ 工具调用成功: ${call.id}`, {
        contentLength: result.content?.length || 0,
        isError: result.isError
      })

      return {
        tool_call_id: call.id,
        result: result.content || result,
        error: result.isError ? (result.content || 'Unknown error') : undefined
      }

    } catch (error) {
      console.error(`❌ 工具调用失败: ${call.id}`, {
        toolName: call.function.name,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      return {
        tool_call_id: call.id,
        result: null,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 批量处理工具调用
   */
  async handleToolCalls(calls: ToolCall[]): Promise<ToolCallResult[]> {
    console.log(`🔧 [ToolCallService] 批量处理工具调用: ${calls.length}个`)

    // 并发处理所有工具调用
    const results = await Promise.all(
      calls.map(call => this.handleToolCall(call))
    )

    const successCount = results.filter(r => !r.error).length
    const errorCount = results.filter(r => r.error).length

    console.log(`✅ 批量工具调用完成: ${successCount}成功, ${errorCount}失败`)

    return results
  }

  /**
   * 检查工具调用格式是否有效
   */
  isValidToolCall(call: ToolCall): boolean {
    if (!call.function?.name) return false

    const parts = call.function.name.split('.')
    return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0
  }

  /**
   * 获取工具调用统计信息
   */
  getToolCallStats(): { validCalls: number; invalidCalls: number } {
    // 这里可以添加统计逻辑，目前返回占位符
    return { validCalls: 0, invalidCalls: 0 }
  }
}