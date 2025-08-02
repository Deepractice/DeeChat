/**
 * Streamable HTTP传输实现
 * 支持MCP协议的新标准HTTP传输方式
 */

import { BaseTransport, IMCPTransport, JSONRPCMessage, TransportStatus } from './IMCPTransport';
import { MCPServerConfig } from '../../../../shared/entities/MCPServerConfigV2';
import log from 'electron-log';
// @ts-ignore - EventSource类型定义问题
import EventSource from 'eventsource';

/**
 * Streamable HTTP传输
 * 支持：
 * - POST请求发送消息
 * - GET请求接收服务器推送
 * - 会话管理
 * - 自动重连
 */
export class StreamableHTTPTransport extends BaseTransport implements IMCPTransport {
  private sessionId?: string;
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
    log.info(`[StreamableHTTP] 创建传输: ${config.name}`);
  }
  
  async connect(): Promise<void> {
    if (this.isConnected()) return;
    
    this.setStatus(TransportStatus.CONNECTING);
    log.info(`[StreamableHTTP] 连接到: ${this.config.url}`);
    
    try {
      // 发送初始化请求
      const initResponse = await this.sendInitializeRequest();
      
      // 处理会话ID
      if (initResponse.headers?.['mcp-session-id']) {
        this.sessionId = initResponse.headers['mcp-session-id'];
        log.info(`[StreamableHTTP] 获得会话ID: ${this.sessionId}`);
      }
      
      // 建立SSE连接（如果服务器支持）
      if (this.config.url) {
        await this.establishSSEConnection();
      }
      
      this.setStatus(TransportStatus.CONNECTED);
      this.reconnectAttempts = 0;
      
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    if (this._status === TransportStatus.DISCONNECTED) return;
    
    this.setStatus(TransportStatus.DISCONNECTING);
    log.info(`[StreamableHTTP] 断开连接: ${this.config.name}`);
    
    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    // 关闭SSE连接
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    
    // 发送会话终止请求
    if (this.sessionId && this.config.url) {
      try {
        await fetch(this.config.url, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': this.sessionId,
            ...this.getAuthHeaders()
          }
        });
      } catch (error) {
        log.warn('[StreamableHTTP] 会话终止失败:', error);
      }
    }
    
    // 清理待处理请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Transport disconnected'));
    });
    this.pendingRequests.clear();
    
    this.sessionId = undefined;
    this.setStatus(TransportStatus.DISCONNECTED);
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Transport not connected');
    }
    
    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-03-26',
        ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
        ...this.getAuthHeaders(),
        ...this.config.headers
      },
      body: JSON.stringify(message)
    });
    
    this.updateStats(message, 'out');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // 处理直接的JSON响应
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json();
      this.handleIncomingMessage(result);
    }
    // SSE响应会通过EventSource处理
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
  
  getSessionId(): string | undefined {
    return this.sessionId;
  }
  
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }
  
  async reconnect(): Promise<void> {
    if (this._status === TransportStatus.CONNECTING) return;
    
    log.info(`[StreamableHTTP] 尝试重连: ${this.config.name} (尝试 ${this.reconnectAttempts + 1})`);
    
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
        
        log.info(`[StreamableHTTP] 将在 ${delay}ms 后重试`);
        
        this.reconnectTimer = setTimeout(() => {
          this.reconnect();
        }, delay);
      } else {
        log.error(`[StreamableHTTP] 重连失败，已达最大尝试次数`);
        this.handleError(error as Error);
      }
    }
  }
  
  destroy(): void {
    this.disconnect();
  }
  
  private async sendInitializeRequest(): Promise<any> {
    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2025-03-26',
        ...this.getAuthHeaders(),
        ...this.config.headers
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'DeeChat',
            version: '1.0.0'
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Initialize failed: HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      body: result,
      headers: Object.fromEntries(response.headers.entries())
    };
  }
  
  private async establishSSEConnection(): Promise<void> {
    if (!this.config.url) return;
    
    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'MCP-Protocol-Version': '2025-03-26',
      ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
      ...this.getAuthHeaders(),
      ...this.config.headers
    };
    
    this.eventSource = new EventSource(this.config.url, {
      headers,
      withCredentials: !!this.config.auth
    });
    
    this.eventSource.onopen = () => {
      log.info('[StreamableHTTP] SSE连接已建立');
    };
    
    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        this.handleIncomingMessage(message);
      } catch (error) {
        log.error('[StreamableHTTP] SSE消息解析失败:', error);
      }
    };
    
    this.eventSource.onerror = (error: Event) => {
      log.error('[StreamableHTTP] SSE错误:', error);
      if (this.config.autoReconnect !== false) {
        this.reconnect();
      }
    };
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