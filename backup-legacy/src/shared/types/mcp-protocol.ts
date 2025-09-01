/**
 * MCP协议类型定义
 * 定义Model Context Protocol支持的所有传输协议和相关类型
 */

/**
 * MCP传输协议类型
 * 基于官方规范，支持5种传输方式
 */
export type MCPTransportType = 
  | 'stdio'           // 标准输入输出（本地进程）
  | 'sse'            // Server-Sent Events（已弃用，仅向后兼容）
  | 'streamable-http' // Streamable HTTP（新标准）
  | 'websocket'      // WebSocket连接
  | 'inmemory';      // 内存传输（测试用）

/**
 * 执行模式（DeeChat独有）
 * 决定MCP服务器的运行方式
 */
export type MCPExecutionMode = 
  | 'inprocess'  // 进程内执行（零开销）
  | 'sandbox'    // 沙箱隔离执行（安全）
  | 'standard';  // 标准子进程执行

/**
 * 服务器分组
 * 用于UI组织和权限管理
 */
export type MCPServerCollection = 
  | 'system'   // 系统级服务器
  | 'project'  // 项目级服务器
  | 'user';    // 用户级服务器

/**
 * 认证类型
 */
export type MCPAuthType = 
  | 'none'     // 无认证
  | 'bearer'   // Bearer Token
  | 'oauth2'   // OAuth 2.0
  | 'custom';  // 自定义认证

/**
 * 服务器状态
 */
export enum MCPServerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  ERROR = 'error',
  STOPPING = 'stopping'
}

/**
 * 连接错误类型
 */
export enum MCPConnectionError {
  TIMEOUT = 'TIMEOUT',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
  PROTOCOL = 'PROTOCOL',
  CONFIG = 'CONFIG',
  UNKNOWN = 'UNKNOWN'
}

/**
 * 协议特性支持
 */
export interface MCPProtocolFeatures {
  streaming: boolean;      // 支持流式响应
  notifications: boolean;  // 支持服务器通知
  sessions: boolean;       // 支持会话管理
  reconnect: boolean;      // 支持断线重连
  auth: boolean;          // 支持认证
}

/**
 * 协议特性映射
 */
export const PROTOCOL_FEATURES: Record<MCPTransportType, MCPProtocolFeatures> = {
  'stdio': {
    streaming: true,
    notifications: true,
    sessions: false,
    reconnect: false,
    auth: false
  },
  'sse': {
    streaming: true,
    notifications: true,
    sessions: true,
    reconnect: true,
    auth: true
  },
  'streamable-http': {
    streaming: true,
    notifications: true,
    sessions: true,
    reconnect: true,
    auth: true
  },
  'websocket': {
    streaming: true,
    notifications: true,
    sessions: true,
    reconnect: true,
    auth: true
  },
  'inmemory': {
    streaming: true,
    notifications: true,
    sessions: false,
    reconnect: false,
    auth: false
  }
};

/**
 * 获取协议显示名称
 */
export function getProtocolDisplayName(type: MCPTransportType): string {
  const names: Record<MCPTransportType, string> = {
    'stdio': '本地进程',
    'sse': 'SSE (已弃用)',
    'streamable-http': 'HTTP流式传输',
    'websocket': 'WebSocket',
    'inmemory': '内存传输'
  };
  return names[type] || type;
}

/**
 * 获取执行模式显示名称
 */
export function getExecutionModeDisplayName(mode: MCPExecutionMode): string {
  const names: Record<MCPExecutionMode, string> = {
    'inprocess': '进程内执行',
    'sandbox': '沙箱隔离',
    'standard': '标准模式'
  };
  return names[mode] || mode;
}

/**
 * 获取分组显示名称
 */
export function getCollectionDisplayName(collection: MCPServerCollection): string {
  const names: Record<MCPServerCollection, string> = {
    'system': '系统',
    'project': '项目',
    'user': '用户'
  };
  return names[collection] || collection;
}

/**
 * 判断协议是否需要URL配置
 */
export function isNetworkProtocol(type: MCPTransportType): boolean {
  return ['sse', 'streamable-http', 'websocket'].includes(type);
}

/**
 * 判断协议是否支持认证
 */
export function supportsAuth(type: MCPTransportType): boolean {
  return PROTOCOL_FEATURES[type]?.auth || false;
}

/**
 * 判断协议是否已弃用
 */
export function isDeprecatedProtocol(type: MCPTransportType): boolean {
  return type === 'sse';
}