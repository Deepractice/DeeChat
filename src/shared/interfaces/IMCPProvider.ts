/**
 * MCP提供者接口定义
 * 定义MCP服务的核心接口和数据结构
 */

import { MCPServerEntity } from '../entities/MCPServerEntity.js';
import { MCPToolEntity } from '../entities/MCPToolEntity.js';

/**
 * MCP连接状态
 */
export enum MCPConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting'
}

/**
 * MCP工具调用请求
 */
export interface MCPToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: any;
  callId?: string;
}

/**
 * MCP工具调用响应
 */
export interface MCPToolCallResponse {
  success: boolean;
  result?: any;
  error?: string;
  callId?: string;
  duration?: number;
}

/**
 * MCP服务器状态信息
 */
export interface MCPServerStatus {
  serverId: string;
  status: MCPConnectionStatus;
  lastConnected?: Date;
  lastError?: string;
  toolCount: number;
  version?: string;
}

/**
 * MCP工具发现结果
 */
export interface MCPToolDiscoveryResult {
  serverId: string;
  tools: MCPToolEntity[];
  discoveredAt: Date;
  error?: string;
}

/**
 * MCP连接配置
 */
export interface MCPConnectionConfig {
  timeout: number;
  retryCount: number;
  retryDelay: number;
  keepAlive: boolean;
}

/**
 * MCP事件类型
 */
export enum MCPEventType {
  SERVER_CONNECTED = 'server_connected',
  SERVER_DISCONNECTED = 'server_disconnected',
  SERVER_ERROR = 'server_error',
  TOOL_DISCOVERED = 'tool_discovered',
  TOOL_CALLED = 'tool_called',
  TOOL_ERROR = 'tool_error'
}

/**
 * MCP事件数据
 */
export interface MCPEvent {
  type: MCPEventType;
  serverId: string;
  timestamp: Date;
  data?: any;
  error?: string;
}

/**
 * MCP客户端接口
 */
export interface IMCPClient {
  /**
   * 连接到MCP服务器
   */
  connect(server: MCPServerEntity): Promise<void>;

  /**
   * 断开连接
   */
  disconnect(): Promise<void>;

  /**
   * 获取连接状态
   */
  getStatus(): MCPConnectionStatus;

  /**
   * 发现可用工具
   */
  discoverTools(): Promise<MCPToolEntity[]>;

  /**
   * 调用工具
   */
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;

  /**
   * 测试连接
   */
  testConnection(): Promise<boolean>;

  /**
   * 获取服务器信息
   */
  getServerInfo(): Promise<{ name: string; version: string }>;
}

/**
 * MCP传输适配器接口
 */
export interface IMCPTransportAdapter {
  /**
   * 建立连接
   */
  connect(server: MCPServerEntity): Promise<void>;

  /**
   * 关闭连接
   */
  disconnect(): Promise<void>;

  /**
   * 发送请求
   */
  sendRequest(request: any): Promise<any>;

  /**
   * 获取连接状态
   */
  isConnected(): boolean;

  /**
   * 设置事件监听器
   */
  onEvent(callback: (event: MCPEvent) => void): void;
}

/**
 * MCP服务提供者接口
 */
export interface IMCPProvider {
  /**
   * 添加MCP服务器
   */
  addServer(server: MCPServerEntity): Promise<void>;

  /**
   * 移除MCP服务器
   */
  removeServer(serverId: string): Promise<void>;

  /**
   * 获取所有服务器
   */
  getAllServers(): Promise<MCPServerEntity[]>;

  /**
   * 获取服务器状态
   */
  getServerStatus(serverId: string): Promise<MCPServerStatus>;

  /**
   * 测试服务器连接
   */
  testServerConnection(serverId: string): Promise<boolean>;

  /**
   * 发现服务器工具
   */
  discoverServerTools(serverId: string): Promise<MCPToolEntity[]>;

  /**
   * 获取所有可用工具
   */
  getAllTools(): Promise<MCPToolEntity[]>;

  /**
   * 调用工具
   */
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;

  /**
   * 搜索工具
   */
  searchTools(query: string): Promise<MCPToolEntity[]>;

  /**
   * 获取工具使用统计
   */
  getToolUsageStats(): Promise<Record<string, number>>;

  /**
   * 设置事件监听器
   */
  onEvent(callback: (event: MCPEvent) => void): void;

  /**
   * 清理资源
   */
  cleanup(): Promise<void>;
}

/**
 * MCP配置服务接口
 */
export interface IMCPConfigService {
  /**
   * 保存服务器配置
   */
  saveServerConfig(server: MCPServerEntity): Promise<void>;

  /**
   * 删除服务器配置
   */
  deleteServerConfig(serverId: string): Promise<void>;

  /**
   * 获取所有服务器配置
   */
  getAllServerConfigs(): Promise<MCPServerEntity[]>;

  /**
   * 获取服务器配置
   */
  getServerConfig(serverId: string): Promise<MCPServerEntity | null>;

  /**
   * 更新服务器配置
   */
  updateServerConfig(serverId: string, updates: Partial<MCPServerEntity>): Promise<void>;

  /**
   * 导出配置
   */
  exportConfigs(): Promise<string>;

  /**
   * 导入配置
   */
  importConfigs(configData: string): Promise<void>;
}
