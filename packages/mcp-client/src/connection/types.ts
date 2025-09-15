/**
 * Connection management types
 */

import type { McpServerConfig } from '../types/index.js';

export interface Connection {
  /** 服务器 ID */
  serverId: string;
  /** 服务器配置 */
  config: McpServerConfig;
  /** 连接状态 */
  status: ConnectionStatus;
  /** 连接时间 */
  connectedAt?: Date;
  /** 最后一次错误 */
  lastError?: string;
  /** 重连尝试次数 */
  reconnectAttempts: number;
  /** 是否正在重连 */
  isReconnecting: boolean;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface ConnectionManagerOptions {
  /** 默认连接超时时间 */
  defaultTimeout?: number;
  /** 默认是否自动重连 */
  defaultAutoReconnect?: boolean;
  /** 默认最大重连次数 */
  defaultMaxReconnectAttempts?: number;
  /** 默认重连延迟 */
  defaultReconnectDelay?: number;
}