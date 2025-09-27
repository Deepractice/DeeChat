/**
 * MCP功能调用服务
 *
 * 职责：
 * - 处理MCP工具调用
 * - 管理资源读取
 * - 处理提示词获取
 */

import { McpClient } from '@deepracticex/mcp-client'
import {
  ToolInfo,
  ToolCallResult,
  ResourceInfo,
  ResourceContent,
  PromptInfo,
  PromptResult
} from '../types/McpTypes.js'

export class FunctionService {
  constructor(private mcpClient: McpClient) {}

  // ============== 工具调用 ==============

  /**
   * 从服务器获取工具列表
   */
  async listTools(serverId: string): Promise<ToolInfo[]> {
    try {
      return await this.mcpClient.listTools(serverId)
    } catch (error) {
      console.error(`Failed to get tool list (${serverId}):`, error)
      throw new Error(`Failed to get tool list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 调用工具 - 实现McpClientAdapter接口
   * 同时满足原有IPC接口和ai-chat集成的需求
   */
  async callTool(serverId: string, toolName: string, args?: any): Promise<ToolCallResult> {
    try {
      console.log(`🔧 [McpDomain.callTool] 开始执行: ${toolName} @ ${serverId}`, args)

      // 🚨 CRITICAL DEBUG: 检查 mcpClient 实例状态
      console.log('🔍 [CRITICAL DEBUG] mcpClient实例检查:', {
        mcpClientExists: !!this.mcpClient,
        mcpClientType: typeof this.mcpClient,
        mcpClientConstructor: this.mcpClient?.constructor?.name,
        hasCallToolMethod: typeof this.mcpClient?.callTool,
        isCallToolFunction: typeof this.mcpClient?.callTool === 'function'
      })

      const result = await this.mcpClient.callTool(serverId, toolName, args)
      console.log(`✅ Tool call successful: ${toolName}`)
      return result
    } catch (error) {
      console.error(`Tool call failed (${toolName} @ ${serverId}):`, error)
      throw new Error(`Tool call failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ============== 资源管理 ==============

  /**
   * 从服务器获取资源列表
   */
  async listResources(serverId: string): Promise<ResourceInfo[]> {
    try {
      return await this.mcpClient.listResources(serverId)
    } catch (error) {
      console.error(`Failed to get resource list (${serverId}):`, error)
      throw new Error(`Failed to get resource list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 读取资源
   */
  async readResource(serverId: string, uri: string): Promise<ResourceContent> {
    try {
      console.log(`📄 Reading resource: ${uri} @ ${serverId}`)
      const result = await this.mcpClient.readResource(serverId, uri)
      console.log(`✅ Resource read successful: ${uri}`)
      return result
    } catch (error) {
      console.error(`Resource read failed (${uri} @ ${serverId}):`, error)
      throw new Error(`Resource read failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // ============== 提示词管理 ==============

  /**
   * 从服务器获取提示词列表
   */
  async listPrompts(serverId: string): Promise<PromptInfo[]> {
    try {
      return await this.mcpClient.listPrompts(serverId)
    } catch (error) {
      console.error(`Failed to get prompt list (${serverId}):`, error)
      throw new Error(`Failed to get prompt list: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取提示词
   */
  async getPrompt(serverId: string, name: string, args?: any): Promise<PromptResult> {
    try {
      console.log(`💬 Getting prompt: ${name} @ ${serverId}`, args)
      const result = await this.mcpClient.getPrompt(serverId, name, args)
      console.log(`✅ Prompt get successful: ${name}`)
      return result
    } catch (error) {
      console.error(`Prompt get failed (${name} @ ${serverId}):`, error)
      throw new Error(`Prompt get failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}