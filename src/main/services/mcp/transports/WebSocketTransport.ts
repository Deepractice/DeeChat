/**
 * WebSocket传输实现
 * 支持双向实时通信的MCP传输协议
 */

import { BaseTransport, IMCPTransport, JSONRPCMessage, TransportStatus } from './IMCPTransport';
import { MCPServerConfig } from '../../../../shared/entities/MCPServerConfigV2';
import log from 'electron-log';
import * as WebSocket from 'ws';

/**
 * WebSocket传输
 * 特性：
 * - 双向实时通信
 * - 心跳保活
 * - 自动重连
 * - 消息队列
 */
export class WebSocketTransport extends BaseTransport implements IMCPTransport {
  private ws?: WebSocket;
  private pingInterval?: NodeJS.Timeout;
  private messageQueue: JSONRPCMessage[] = [];
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  
  readonly features = {
    streaming: true,
    notifications: true,
    sessions: true,
    reconnect: true
  };
  
  constructor(config: MCPServerConfig) {
    super(config);
    log.info(`[WebSocket] 创建传输: ${config.name}`);
  }
  
  async connect(): Promise<void> {
    if (this.isConnected()) return;
    
    this.setStatus(TransportStatus.CONNECTING);
    log.info(`[WebSocket] 连接到: ${this.config.url}`);
    
    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, this.timeout);
      
      try {
        const headers = this.getAuthHeaders();
        if (this.config.headers) {
          Object.assign(headers, this.config.headers);
        }
        
        this.ws = new WebSocket(this.config.url!, {
          headers,
          handshakeTimeout: this.timeout
        });
        
        // 连接成功
        this.ws.on('open', () => {
          clearTimeout(connectTimeout);
          log.info('[WebSocket] 连接成功');
          
          this.setStatus(TransportStatus.CONNECTED);
          this.reconnectAttempts = 0;
          
          // 开始心跳
          this.startPingInterval();
          
          // 发送队列中的消息
          this.flushMessageQueue();
          
          // 发送初始化请求
          this.sendInitializeRequest()
            .then(() => resolve())
            .catch(reject);
        });
        
        // 接收消息
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleIncomingMessage(message);
          } catch (error) {
            log.error('[WebSocket] 消息解析失败:', error);
          }
        });
        
        // 错误处理
        this.ws.on('error', (error) => {
          clearTimeout(connectTimeout);
          log.error('[WebSocket] 错误:', error);
          this.handleError(error);
          reject(error);
        });
        
        // 连接关闭
        this.ws.on('close', (code, reason) => {
          log.info(`[WebSocket] 连接关闭: ${code} - ${reason}`);
          this.handleDisconnect();
        });
        
        // Ping/Pong
        this.ws.on('pong', () => {
          log.debug('[WebSocket] Pong received');
        });
        
      } catch (error) {
        clearTimeout(connectTimeout);
        this.handleError(error as Error);
        reject(error);
      }
    });
  }
  
  async disconnect(): Promise<void> {
    if (this._status === TransportStatus.DISCONNECTED) return;
    
    this.setStatus(TransportStatus.DISCONNECTING);
    log.info(`[WebSocket] 断开连接: ${this.config.name}`);
    
    // 停止心跳
    this.stopPingInterval();
    
    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // 关闭WebSocket
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, 'Normal closure');
      }
      this.ws = undefined;
    }
    
    // 清理待处理请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Transport disconnected'));
    });
    this.pendingRequests.clear();
    
    // 清空消息队列
    this.messageQueue = [];
    
    this.setStatus(TransportStatus.DISCONNECTED);
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.config.autoReconnect !== false) {
        // 加入队列
        this.messageQueue.push(message);
        // 尝试重连
        if (this._status === TransportStatus.DISCONNECTED) {
          this.reconnect();
        }
        return;
      }
      throw new Error('WebSocket not connected');
    }
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(message);
      this.ws!.send(data, (error) => {
        if (error) {
          reject(error);
        } else {
          this.updateStats(message, 'out');
          resolve();
        }
      });
    });
  }
  
  async request(method: string, params?: any): Promise<any> {
    const id = ++this.requestIdCounter;
    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);
      
      // 存储请求
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      // 发送请求
      this.send(message).catch(error => {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  async notify(method: string, params?: any): Promise<void> {
    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      method,
      params
    };
    await this.send(message);
  }
  
  async reconnect(): Promise<void> {
    if (this._status === TransportStatus.CONNECTING) return;
    
    log.info(`[WebSocket] 尝试重连: ${this.config.name} (尝试 ${this.reconnectAttempts + 1})`);
    
    try {
      await this.disconnect();
      await this.connect();
    } catch (error) {
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts < this.retryPolicy.count) {
        const delay = Math.min(
          this.retryPolicy.delay * Math.pow(this.retryPolicy.backoffFactor || 2, this.reconnectAttempts),
          this.retryPolicy.maxDelay || 30000
        );
        
        log.info(`[WebSocket] 将在 ${delay}ms 后重试`);
        
        this.reconnectTimer = setTimeout(() => {
          this.reconnect();
        }, delay);
      } else {
        log.error(`[WebSocket] 重连失败，已达最大尝试次数`);
        this.handleError(error as Error);
      }
    }
  }
  
  destroy(): void {
    this.disconnect();
  }
  
  private async sendInitializeRequest(): Promise<void> {
    const response = await this.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'DeeChat',
        version: '1.0.0'
      }
    });
    
    log.info('[WebSocket] 初始化成功:', response);
  }
  
  private handleIncomingMessage(message: JSONRPCMessage): void {
    this.updateStats(message, 'in');
    
    // 处理响应
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    
    // 发送消息事件
    this.emit('message', message);
  }
  
  private handleDisconnect(): void {
    this.stopPingInterval();
    
    if (this._status === TransportStatus.DISCONNECTING) {
      // 正常断开
      return;
    }
    
    // 异常断开
    this.setStatus(TransportStatus.DISCONNECTED);
    
    if (this.config.autoReconnect !== false) {
      this.reconnect();
    }
  }
  
  private startPingInterval(): void {
    this.stopPingInterval();
    
    // 每30秒发送一次ping
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        log.debug('[WebSocket] Ping sent');
      }
    }, 30000);
  }
  
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.send(message).catch(error => {
        log.error('[WebSocket] 队列消息发送失败:', error);
      });
    }
  }
  
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          if (this.config.auth.token) {
            headers['Authorization'] = `Bearer ${this.config.auth.token}`;
          }
          break;
        case 'custom':
          if (this.config.auth.customHeaders) {
            Object.assign(headers, this.config.auth.customHeaders);
          }
          break;
      }
    }
    
    return headers;
  }
}