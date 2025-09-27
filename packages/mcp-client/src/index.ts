/**
 * @deechat/mcp-client - Main Entry Point
 * 
 * MCP (Model Context Protocol) client for DeeChat
 */

// 主要导出
export { McpClient } from './McpClient.js';
export type { McpClientOptions } from './McpClient.js';

// Enum导出
export { ConnectionStatus } from './types/index.js';

// 类型导出
export type {
  McpServerConfig,
  TransportConfig,
  ToolInfo,
  ResourceInfo,
  PromptInfo,
  ToolCallResult,
  ResourceContent,
  PromptResult
} from './types/index.js';

// 错误类型导出
export { 
  McpClientError,
  ConnectionError,
  ConfigurationError,
  ProtocolError
} from './utils/errors.js';

// 版本信息
export const VERSION = '1.0.0';
export const SUPPORTED_MCP_VERSION = '2024-11-05';