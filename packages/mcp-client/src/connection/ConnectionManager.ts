/**
 * Connection Manager
 * 
 * 管理与多个 MCP 服务器的连接
 */

import { EventEmitter } from 'events';
import type { McpServerConfig } from '../types/index.js';
import type { Transport } from '../transport/types.js';
import type { Connection, ConnectionManagerOptions } from './types.js';
import { ConnectionStatus } from './types.js';
import { TransportFactory } from '../transport/TransportFactory.js';
import { ProtocolHandler } from '../protocol/ProtocolHandler.js';
import { ConnectionError, toMcpError } from '../utils/errors.js';

export class ConnectionManager extends EventEmitter {
  private connections = new Map<string, {
    connection: Connection;
    transport?: Transport;
    protocol?: ProtocolHandler;
    reconnectTimer?: NodeJS.Timeout;
  }>();

  private options: Required<ConnectionManagerOptions>;

  constructor(options: ConnectionManagerOptions = {}) {
    super();
    this.options = {
      defaultTimeout: 30000,
      defaultAutoReconnect: true,
      defaultMaxReconnectAttempts: 3,
      defaultReconnectDelay: 1000,
      ...options
    };
  }

  // ============== Public API ==============

  /**
   * 添加服务器连接
   */
  addConnection(config: McpServerConfig): void {
    if (this.connections.has(config.id)) {
      throw new ConnectionError(`Connection for server '${config.id}' already exists`);
    }

    const connection: Connection = {
      serverId: config.id,
      config,
      status: ConnectionStatus.DISCONNECTED,
      reconnectAttempts: 0,
      isReconnecting: false
    };

    this.connections.set(config.id, { connection });
    this.emit('connection-added', config.id);
  }

  /**
   * 移除服务器连接
   */
  async removeConnection(serverId: string): Promise<void> {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) {
      return; // 连接不存在，静默返回
    }

    try {
      // 先断开连接
      await this.disconnect(serverId);
    } catch (error) {
      // 忽略断开连接时的错误
    }

    // 清理定时器
    if (connectionData.reconnectTimer) {
      clearTimeout(connectionData.reconnectTimer);
    }

    // 移除连接
    this.connections.delete(serverId);
    this.emit('connection-removed', serverId);
  }

  /**
   * 连接到服务器
   */
  async connect(serverId: string): Promise<void> {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) {
      throw new ConnectionError(`Server '${serverId}' not found`);
    }

    const { connection } = connectionData;
    
    if (connection.status === ConnectionStatus.CONNECTED) {
      return; // 已经连接
    }

    if (connection.status === ConnectionStatus.CONNECTING) {
      throw new ConnectionError(`Already connecting to server '${serverId}'`);
    }

    try {
      this.updateConnectionStatus(serverId, ConnectionStatus.CONNECTING);

      // 创建传输和协议处理器
      const transport = TransportFactory.createTransport(connection.config.transport);
      const protocol = new ProtocolHandler(transport);

      // 设置事件处理
      this.setupConnectionHandlers(serverId, transport, protocol);

      // 连接
      const timeout = connection.config.timeout || this.options.defaultTimeout;
      await this.withTimeout(transport.connect(), timeout);

      // 执行 MCP 初始化握手
      await this.performMcpHandshake(protocol);

      // 保存连接信息
      connectionData.transport = transport;
      connectionData.protocol = protocol;

      // 更新状态
      connection.connectedAt = new Date();
      connection.reconnectAttempts = 0;
      connection.lastError = undefined;
      this.updateConnectionStatus(serverId, ConnectionStatus.CONNECTED);

    } catch (error) {
      connection.lastError = error instanceof Error ? error.message : String(error);
      this.updateConnectionStatus(serverId, ConnectionStatus.ERROR);
      
      // 清理
      this.cleanupConnection(serverId);

      // 尝试自动重连
      if (this.shouldAutoReconnect(connection)) {
        this.scheduleReconnect(serverId);
      }

      throw toMcpError(error);
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnect(serverId: string): Promise<void> {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) {
      return; // 连接不存在
    }

    const { connection, transport, reconnectTimer } = connectionData;

    // 清理重连定时器
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      connectionData.reconnectTimer = undefined;
    }

    connection.isReconnecting = false;

    if (transport && transport.isConnected()) {
      try {
        await transport.close();
      } catch (error) {
        // 忽略关闭时的错误
      }
    }

    this.cleanupConnection(serverId);
    this.updateConnectionStatus(serverId, ConnectionStatus.DISCONNECTED);
  }

  /**
   * 获取连接信息
   */
  getConnection(serverId: string): Connection | null {
    const connectionData = this.connections.get(serverId);
    return connectionData ? connectionData.connection : null;
  }

  /**
   * 获取协议处理器
   */
  getProtocol(serverId: string): ProtocolHandler | null {
    const connectionData = this.connections.get(serverId);
    return connectionData?.protocol || null;
  }

  /**
   * 检查是否已连接
   */
  isConnected(serverId: string): boolean {
    const connection = this.getConnection(serverId);
    return connection?.status === ConnectionStatus.CONNECTED;
  }

  /**
   * 列出所有连接
   */
  listConnections(): Connection[] {
    return Array.from(this.connections.values()).map(data => data.connection);
  }

  /**
   * 清理所有连接
   */
  async dispose(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(serverId => 
      this.disconnect(serverId)
    );

    await Promise.allSettled(disconnectPromises);
    this.connections.clear();
    this.removeAllListeners();
  }

  // ============== Private Methods ==============

  private setupConnectionHandlers(serverId: string, transport: Transport, protocol: ProtocolHandler): void {
    transport.onError((error) => {
      this.handleConnectionError(serverId, error);
    });

    transport.onClose(() => {
      this.handleConnectionClose(serverId);
    });

    protocol.on('protocol-error', (error) => {
      this.handleConnectionError(serverId, error);
    });
  }

  private async performMcpHandshake(protocol: ProtocolHandler): Promise<void> {
    try {
      const result = await protocol.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: '@deechat/mcp-client',
          version: '1.0.0'
        }
      });

      // 可以在这里验证服务器的响应
      if (!result || !result.protocolVersion) {
        throw new Error('Invalid MCP handshake response');
      }

    } catch (error) {
      throw new ConnectionError(`MCP handshake failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleConnectionError(serverId: string, error: Error): void {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) return;

    const { connection } = connectionData;
    connection.lastError = error.message;
    this.updateConnectionStatus(serverId, ConnectionStatus.ERROR);

    this.emit('connection-error', serverId, error);

    // 尝试自动重连
    if (this.shouldAutoReconnect(connection)) {
      this.scheduleReconnect(serverId);
    }
  }

  private handleConnectionClose(serverId: string): void {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) return;

    const { connection } = connectionData;
    this.cleanupConnection(serverId);
    this.updateConnectionStatus(serverId, ConnectionStatus.DISCONNECTED);

    this.emit('connection-closed', serverId);

    // 尝试自动重连
    if (this.shouldAutoReconnect(connection)) {
      this.scheduleReconnect(serverId);
    }
  }

  private shouldAutoReconnect(connection: Connection): boolean {
    const autoReconnect = connection.config.autoReconnect ?? this.options.defaultAutoReconnect;
    const maxAttempts = this.options.defaultMaxReconnectAttempts;
    
    return autoReconnect && 
           connection.reconnectAttempts < maxAttempts &&
           !connection.isReconnecting;
  }

  private scheduleReconnect(serverId: string): void {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) return;

    const { connection } = connectionData;
    connection.isReconnecting = true;
    connection.reconnectAttempts++;

    const delay = this.options.defaultReconnectDelay * Math.pow(2, connection.reconnectAttempts - 1);
    
    connectionData.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(serverId);
      } catch (error) {
        // 重连失败，错误已在 connect 方法中处理
      }
    }, delay);

    this.emit('reconnect-scheduled', serverId, delay);
  }

  private updateConnectionStatus(serverId: string, status: ConnectionStatus): void {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) return;

    const oldStatus = connectionData.connection.status;
    connectionData.connection.status = status;

    if (oldStatus !== status) {
      this.emit('connection-status-changed', serverId, status, oldStatus);
    }
  }

  private cleanupConnection(serverId: string): void {
    const connectionData = this.connections.get(serverId);
    if (!connectionData) return;

    // 清理协议处理器
    if (connectionData.protocol) {
      connectionData.protocol.dispose();
      connectionData.protocol = undefined;
    }

    // 清理传输
    if (connectionData.transport) {
      // 传输层事件处理器会在 onError, onClose 等方法中自动清理
      connectionData.transport = undefined;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}