/**
 * MCP领域类型定义
 *
 * 包含：
 * - MCP服务器状态接口
 * - 工具调用结果接口
 * - 提示词结果接口
 */

import {
  ConnectionStatus,
  type McpServerConfig,
  type ToolCallResult,
  type ToolInfo,
  type ResourceInfo,
  type PromptInfo,
  type ResourceContent
} from '@deepracticex/mcp-client'

/**
 * 提示词执行结果
 */
export interface PromptResult {
  description?: string;
  messages: any[];
}

/**
 * 带状态信息的服务器(用于前端显示)
 */
export interface McpServerWithStatus extends McpServerConfig {
  /** 连接状态 */
  connectionStatus: ConnectionStatus
  /** 工具数量(仅连接时可用) */
  toolCount?: number
  /** 资源数量(仅连接时可用) */
  resourceCount?: number
  /** 提示词数量(仅连接时可用) */
  promptCount?: number
  /** 错误信息 */
  error?: string
  /** 连接时间 */
  connectedAt?: Date
}

// 重新导出常用类型
export {
  McpServerConfig,
  ConnectionStatus,
  ToolCallResult,
  ToolInfo,
  ResourceInfo,
  PromptInfo,
  ResourceContent
}