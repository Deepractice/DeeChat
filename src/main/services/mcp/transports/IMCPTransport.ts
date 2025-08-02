/**
 * MCP传输层接口
 * 定义所有传输实现必须遵循的契约
 */

import { MCPServerConfig } from '../../../../shared/entities/MCPServerConfigV2';

/**
 * JSON-RPC消息类型
 */
export interface JSONRPCMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * 传输状态
 */
export enum TransportStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

/**
 * 传输事件
 */
export interface TransportEvents {
  connect: () => void;
  disconnect: (reason?: string) => void;
  error: (error: Error) => void;
  message: (message: JSONRPCMessage) => void;
  statusChange: (status: TransportStatus) => void;
}

/**
 * 传输统计信息
 */
export interface TransportStats {
  messagesSent: number;
  messagesReceived: number;
  bytesIn: number;
  bytesOut: number;
  connectedAt?: Date;
  lastMessageAt?: Date;
  errors: number;
}

/**
 * 重试策略
 */
export interface RetryPolicy {
  count: number;
  delay: number;
  maxDelay?: number;
  backoffFactor?: number;
}

/**
 * MCP传输接口
 */
export interface IMCPTransport {
  // === 基础属性 ===
  readonly config: MCPServerConfig;
  readonly status: TransportStatus;
  readonly stats: TransportStats;
  
  // === 连接管理 ===
  /**
   * 建立连接
   */
  connect(): Promise<void>;
  
  /**
   * 断开连接
   */
  disconnect(): Promise<void>;
  
  /**
   * 检查连接状态
   */
  isConnected(): boolean;
  
  // === 消息传输 ===
  /**
   * 发送消息
   */
  send(message: JSONRPCMessage): Promise<void>;
  
  /**
   * 发送请求并等待响应
   */
  request(method: string, params?: any): Promise<any>;
  
  /**
   * 发送通知（无需响应）
   */
  notify(method: string, params?: any): Promise<void>;
  
  // === 事件处理 ===
  /**
   * 监听事件
   */
  on<K extends keyof TransportEvents>(
    event: K, 
    handler: TransportEvents[K]
  ): void;
  
  /**
   * 移除事件监听
   */
  off<K extends keyof TransportEvents>(
    event: K, 
    handler: TransportEvents[K]
  ): void;
  
  /**
   * 监听一次事件
   */
  once<K extends keyof TransportEvents>(
    event: K, 
    handler: TransportEvents[K]
  ): void;
  
  // === 配置管理 ===
  /**
   * 设置超时时间
   */
  setTimeout(timeout: number): void;
  
  /**
   * 设置重试策略
   */
  setRetryPolicy(policy: RetryPolicy): void;
  
  // === 高级功能 ===
  /**
   * 支持的功能特性
   */
  readonly features: {
    streaming: boolean;
    notifications: boolean;
    sessions: boolean;
    reconnect: boolean;
  };
  
  /**
   * 获取会话ID（如果支持）
   */
  getSessionId?(): string | undefined;
  
  /**
   * 设置会话ID（如果支持）
   */
  setSessionId?(sessionId: string): void;
  
  /**
   * 重连（如果支持）
   */
  reconnect?(): Promise<void>;
  
  // === 生命周期 ===
  /**
   * 销毁传输实例
   */
  destroy(): void;
}

/**
 * 传输工厂函数
 */
export type TransportFactory = (config: MCPServerConfig) => Promise<IMCPTransport>;

/**
 * 配置验证函数
 */
export type ConfigValidator = (config: MCPServerConfig) => string[];

/**
 * 传输基类（可选继承）
 */
export abstract class BaseTransport implements IMCPTransport {
  protected _status: TransportStatus = TransportStatus.DISCONNECTED;
  protected _stats: TransportStats = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesIn: 0,
    bytesOut: 0,
    errors: 0
  };
  protected timeout: number = 30000;
  protected retryPolicy: RetryPolicy = {
    count: 3,
    delay: 1000,
    backoffFactor: 2
  };
  
  private eventHandlers = new Map<keyof TransportEvents, Set<Function>>();
  
  constructor(public readonly config: MCPServerConfig) {}
  
  get status(): TransportStatus {
    return this._status;
  }
  
  get stats(): TransportStats {
    return { ...this._stats };
  }
  
  isConnected(): boolean {
    return this._status === TransportStatus.CONNECTED;
  }
  
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
  
  setRetryPolicy(policy: RetryPolicy): void {
    this.retryPolicy = { ...policy };
  }
  
  on<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }
  
  off<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    this.eventHandlers.get(event)?.delete(handler);
  }
  
  once<K extends keyof TransportEvents>(event: K, handler: TransportEvents[K]): void {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper as any);
      (handler as Function)(...args);
    };
    this.on(event, wrapper as any);
  }
  
  protected emit<K extends keyof TransportEvents>(event: K, ...args: Parameters<TransportEvents[K]>): void {
    this.eventHandlers.get(event)?.forEach(handler => {
      try {
        (handler as Function)(...args);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }
  
  protected setStatus(status: TransportStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.emit('statusChange', status);
      
      if (status === TransportStatus.CONNECTED) {
        this._stats.connectedAt = new Date();
        this.emit('connect');
      } else if (status === TransportStatus.DISCONNECTED) {
        this.emit('disconnect');
      }
    }
  }
  
  protected handleError(error: Error): void {
    this._stats.errors++;
    this.emit('error', error);
    this.setStatus(TransportStatus.ERROR);
  }
  
  protected updateStats(message: JSONRPCMessage, direction: 'in' | 'out'): void {
    const size = JSON.stringify(message).length;
    if (direction === 'in') {
      this._stats.messagesReceived++;
      this._stats.bytesIn += size;
    } else {
      this._stats.messagesSent++;
      this._stats.bytesOut += size;
    }
    this._stats.lastMessageAt = new Date();
  }
  
  // 抽象方法，子类必须实现
  abstract get features(): IMCPTransport['features'];
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract send(message: JSONRPCMessage): Promise<void>;
  abstract request(method: string, params?: any): Promise<any>;
  abstract notify(method: string, params?: any): Promise<void>;
  abstract destroy(): void;
}