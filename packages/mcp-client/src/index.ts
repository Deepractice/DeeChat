/**
 * @deechat/mcp-client - Main Entry Point
 * 
 * MCP (Model Context Protocol) client for DeeChat
 */

// 主要导出
export { McpClient } from './McpClient.js';

// 类型导出
export type {
  McpServerConfig,
  TransportConfig,
  ConnectionStatus,
  ToolInfo,
  ResourceInfo,
  PromptInfo
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