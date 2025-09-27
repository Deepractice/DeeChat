/**
 * Core type definitions for MCP Client
 */

// ============== Server Configuration ==============

export interface McpServerConfig {
  /** 服务器唯一标识 */
  id: string;
  /** 服务器名称 */
  name: string;
  /** 服务器描述 */
  description?: string;
  /** 传输配置 */
  transport: TransportConfig;
  /** 是否启用 */
  enabled: boolean;
  /** 自动重连 */
  autoReconnect?: boolean;
  /** 超时时间 (ms) */
  timeout?: number;
  /** 标签 */
  tags?: string[];
  /** 创建时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
}

// ============== Transport Configuration ==============

export type TransportType = 'stdio' | 'http' | 'websocket' | 'streamable-http';

export interface BaseTransportConfig {
  type: TransportType;
}

export interface StdioTransportConfig extends BaseTransportConfig {
  type: 'stdio';
  /** 命令 */
  command: string;
  /** 参数 */
  args?: string[];
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

export interface HttpTransportConfig extends BaseTransportConfig {
  type: 'http';
  /** URL */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

export interface WebSocketTransportConfig extends BaseTransportConfig {
  type: 'websocket';
  /** URL */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

export interface StreamableHttpTransportConfig extends BaseTransportConfig {
  type: 'streamable-http';
  /** URL */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 会话 ID（可选，用于恢复会话） */
  sessionId?: string;
  /** 启用 DNS 重绑定保护 */
  enableDnsRebindingProtection?: boolean;
  /** 允许的主机列表 */
  allowedHosts?: string[];
  /** SSE 重连延迟 (ms) */
  reconnectDelay?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
}

export type TransportConfig =
  | StdioTransportConfig
  | HttpTransportConfig
  | WebSocketTransportConfig
  | StreamableHttpTransportConfig;

// ============== Connection Status ==============

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface ConnectionInfo {
  serverId: string;
  status: ConnectionStatus;
  connectedAt?: Date;
  error?: string;
}

// ============== MCP Protocol Types ==============

export interface ToolInfo {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description?: string;
  /** 输入参数结构 */
  inputSchema: any;
}

export interface ResourceInfo {
  /** 资源 URI */
  uri: string;
  /** 资源名称 */
  name?: string;
  /** 资源描述 */
  description?: string;
  /** MIME 类型 */
  mimeType?: string;
}

export interface PromptInfo {
  /** 提示词名称 */
  name: string;
  /** 提示词描述 */
  description?: string;
  /** 参数定义 */
  arguments?: any;
}

export interface ToolCallResult {
  /** 调用结果 */
  content: any[];
  /** 是否出错 */
  isError?: boolean;
}

export interface ResourceContent {
  /** 资源内容 */
  contents: any[];
  /** MIME 类型 */
  mimeType?: string;
}

export interface PromptResult {
  /** 提示词内容 */
  description?: string;
  /** 消息列表 */
  messages: any[];
}

// ============== Claude Desktop Configuration ==============

/**
 * Claude Desktop 标准配置格式（官方格式 + 扩展）
 * 这是统一的配置格式，支持 Claude Desktop 官方的 stdio 传输，
 * 以及扩展的 HTTP、WebSocket、StreamableHTTP 传输类型
 */
export interface ClaudeDesktopServerConfig {
  /** 服务器名称（可选） */
  name?: string;
  /** 服务器描述（可选） */
  description?: string;
  /** 是否启用（可选，默认 true） */
  enabled?: boolean;

  // Stdio 传输（Claude Desktop 标准）
  /** 执行命令 */
  command?: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: Record<string, string>;

  // HTTP/WebSocket/StreamableHTTP 传输（扩展支持）
  /** 传输类型（扩展字段） */
  type?: 'stdio' | 'http' | 'websocket' | 'streamable-http' | 'sse';
  /** 连接地址（扩展字段） */
  url?: string;
  /** HTTP 头部（扩展字段） */
  headers?: Record<string, string>;
}

/** Claude Desktop 配置文件格式 */
export interface ClaudeDesktopConfig {
  /** MCP 服务器配置（Claude Desktop 标准字段名） */
  mcpServers: Record<string, ClaudeDesktopServerConfig>;
  /** 配置版本（可选） */
  version?: string;
  /** 时间戳（可选） */
  timestamp?: string;
}

// ============== 内部配置文件格式 ==============

export interface McpConfigFile {
  /** 配置版本 */
  version: string;
  /** 服务器配置 */
  servers: Record<string, McpServerConfig>;
  /** 默认配置 */
  defaults?: {
    timeout?: number;
    autoReconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
  };
}

// ============== JSON-RPC Types ==============

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}