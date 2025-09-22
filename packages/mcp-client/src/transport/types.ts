/**
 * Transport layer types
 */

export interface Transport {
  /** 连接到传输目标 */
  connect(): Promise<void>;
  
  /** 发送消息 */
  send(message: string): Promise<void>;
  
  /** 接收消息（可能为空） */
  receive(): Promise<string | null>;
  
  /** 关闭连接 */
  close(): Promise<void>;
  
  /** 检查是否已连接 */
  isConnected(): boolean;
  
  /** 设置消息处理器 */
  onMessage(handler: (message: string) => void): void;
  
  /** 设置错误处理器 */
  onError(handler: (error: Error) => void): void;
  
  /** 设置关闭处理器 */
  onClose(handler: () => void): void;
}

export interface TransportOptions {
  /** 连接超时时间 */
  timeout?: number;
}

export interface StdioTransportOptions extends TransportOptions {
  /** 命令 */
  command: string;
  /** 参数 */
  args?: string[];
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

export interface HttpTransportOptions extends TransportOptions {
  /** URL */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

export interface WebSocketTransportOptions extends TransportOptions {
  /** URL */
  url: string;
  /** 请求头 */
  headers?: Record<string, string>;
}

export interface StreamableHttpTransportOptions extends TransportOptions {
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