/**
 * SSE (Server-Sent Events) 传输实现
 * 已弃用，仅用于向后兼容
 */

import { BaseTransport, IMCPTransport, JSONRPCMessage, TransportStatus } from './IMCPTransport';
import { MCPServerConfig } from '../../../../shared/entities/MCPServerConfigV2';
import log from 'electron-log';
// @ts-ignore - EventSource类型定义问题
import EventSource from 'eventsource';

/**
 * SSE传输（已弃用）
 * 注意：SSE在MCP协议中已被streamable-http取代
 * 此实现仅用于兼容旧版服务器
 */
export class SSETransport extends BaseTransport implements IMCPTransport {
  private eventSource?: EventSource;
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
    log.warn(`[SSE] ⚠️ SSE传输已弃用，建议使用streamable-http: ${config.name}`);
  }
  
  async connect(): Promise<void> {
    if (this.isConnected()) return;
    
    this.setStatus(TransportStatus.CONNECTING);
    log.info(`[SSE] 连接到: ${this.config.url}`);
    
    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, this.timeout);
      
      try {
        const headers = {
          ...this.getAuthHeaders(),
          ...this.config.headers
        };
        
        this.eventSource = new EventSource(this.config.url!, {
          headers,
          withCredentials: !!this.config.auth
        });
        
        // 连接打开
        this.eventSource.onopen = () => {
          clearTimeout(connectTimeout);
          log.info('[SSE] 连接成功');
          
          this.setStatus(TransportStatus.CONNECTED);
          this.reconnectAttempts = 0;
          
          // 发送初始化请求
          this.sendInitializeRequest()
            .then(() => resolve())
            .catch(reject);
        };
        
        // 接收消息
        this.eventSource.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            this.handleIncomingMessage(message);
          } catch (error) {
            log.error('[SSE] 消息解析失败:', error);
          }
        };
        
        // 自定义事件
        this.eventSource.addEventListener('json-rpc', (event: any) => {
          try {
            const message = JSON.parse(event.data);
            this.handleIncomingMessage(message);
          } catch (error) {
            log.error('[SSE] JSON-RPC消息解析失败:', error);
          }
        });
        
        // 错误处理
        this.eventSource.onerror = (error: Event) => {
          clearTimeout(connectTimeout);
          log.error('[SSE] 错误:', error);
          
          if (this._status === TransportStatus.CONNECTING) {
            this.handleError(new Error('SSE connection failed'));
            reject(error);
          } else if (this.config.autoReconnect !== false) {
            this.reconnect();
          }
        };
        
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
    log.info(`[SSE] 断开连接: ${this.config.name}`);
    
    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // 关闭EventSource
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    
    // 清理待处理请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Transport disconnected'));
    });
    this.pendingRequests.clear();
    
    this.setStatus(TransportStatus.DISCONNECTED);
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('SSE not connected');
    }
    
    // SSE只能接收，发送需要通过HTTP POST
    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...this.config.headers
      },
      body: JSON.stringify(message)
    });
    
    this.updateStats(message, 'out');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 处理直接响应（如果有）
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json();
      if (result && result.jsonrpc === '2.0') {
        this.handleIncomingMessage(result);
      }
    }
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
    
    log.info(`[SSE] 尝试重连: ${this.config.name} (尝试 ${this.reconnectAttempts + 1})`);
    
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
        
        log.info(`[SSE] 将在 ${delay}ms 后重试`);
        
        this.reconnectTimer = setTimeout(() => {
          this.reconnect();
        }, delay);
      } else {
        log.error(`[SSE] 重连失败，已达最大尝试次数`);
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
    
    log.info('[SSE] 初始化成功:', response);
    log.warn('[SSE] ⚠️ 提醒：SSE协议已弃用，建议迁移到streamable-http');
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