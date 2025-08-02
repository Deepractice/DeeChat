/**
 * 内存传输实现
 * 用于测试和进程内通信
 */

import { BaseTransport, IMCPTransport, JSONRPCMessage, TransportStatus } from './IMCPTransport';
import { MCPServerConfig } from '../../../../shared/entities/MCPServerConfigV2';
import log from 'electron-log';

/**
 * 内存消息总线
 * 允许同一进程内的多个传输实例通信
 */
class InMemoryBus {
  private channels = new Map<string, Set<InMemoryTransport>>();
  
  register(channel: string, transport: InMemoryTransport): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(transport);
  }
  
  unregister(channel: string, transport: InMemoryTransport): void {
    this.channels.get(channel)?.delete(transport);
    if (this.channels.get(channel)?.size === 0) {
      this.channels.delete(channel);
    }
  }
  
  broadcast(channel: string, message: JSONRPCMessage, sender: InMemoryTransport): void {
    const receivers = this.channels.get(channel);
    if (receivers) {
      receivers.forEach(receiver => {
        if (receiver !== sender && receiver.isConnected()) {
          // 异步投递消息
          setImmediate(() => {
            receiver.receiveMessage(message);
          });
        }
      });
    }
  }
  
  getChannelInfo(channel: string): { count: number; transports: string[] } {
    const transports = this.channels.get(channel);
    if (!transports) {
      return { count: 0, transports: [] };
    }
    return {
      count: transports.size,
      transports: Array.from(transports).map(t => t.config.name)
    };
  }
}

// 全局消息总线
const globalBus = new InMemoryBus();

/**
 * 内存传输
 * 特性：
 * - 零延迟
 * - 进程内通信
 * - 无需网络或IPC
 * - 主要用于测试
 */
export class InMemoryTransport extends BaseTransport implements IMCPTransport {
  private channel: string = 'default';
  private messageHandlers = new Map<string, (params: any) => any>();
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private requestIdCounter = 0;
  
  readonly features = {
    streaming: true,
    notifications: true,
    sessions: false,
    reconnect: false
  };
  
  constructor(config: MCPServerConfig) {
    super(config);
    // 使用配置中的通道或默认通道
    this.channel = config.extra?.channel || `inmemory-${config.id}`;
    log.info(`[InMemory] 创建传输: ${config.name} (通道: ${this.channel})`);
    
    // 注册默认处理器
    this.registerDefaultHandlers();
  }
  
  async connect(): Promise<void> {
    if (this.isConnected()) return;
    
    this.setStatus(TransportStatus.CONNECTING);
    log.info(`[InMemory] 连接到通道: ${this.channel}`);
    
    // 注册到总线
    globalBus.register(this.channel, this);
    
    // 模拟连接延迟
    await new Promise(resolve => setTimeout(resolve, 10));
    
    this.setStatus(TransportStatus.CONNECTED);
    
    // 只有在自处理模式下才发送初始化请求
    if (this.config.extra?.selfHandle) {
      // 发送初始化
      const initResponse = await this.request('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'DeeChat',
          version: '1.0.0'
        }
      });
      
      log.info('[InMemory] 初始化成功:', initResponse);
      log.info('[InMemory] 通道信息:', globalBus.getChannelInfo(this.channel));
    }
  }
  
  async disconnect(): Promise<void> {
    if (this._status === TransportStatus.DISCONNECTED) return;
    
    this.setStatus(TransportStatus.DISCONNECTING);
    log.info(`[InMemory] 断开连接: ${this.config.name}`);
    
    // 从总线注销
    globalBus.unregister(this.channel, this);
    
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
      throw new Error('InMemory transport not connected');
    }
    
    // 广播消息
    globalBus.broadcast(this.channel, message, this);
    
    this.updateStats(message, 'out');
    
    // 如果是请求，自己也要处理（用于测试）
    if (message.method && !message.id && this.config.extra?.selfHandle) {
      this.handleLocalMessage(message);
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
      
      // 如果启用自处理模式（测试用）
      if (this.config.extra?.selfHandle) {
        setImmediate(() => {
          this.handleLocalRequest(message);
        });
      } else {
        // 发送请求
        this.send(message).catch(error => {
          this.pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(error);
        });
      }
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
  
  destroy(): void {
    this.disconnect();
  }
  
  /**
   * 接收消息（由总线调用）
   */
  receiveMessage(message: JSONRPCMessage): void {
    this.updateStats(message, 'in');
    
    // 处理响应
    if (message.id !== undefined && !message.method) {
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
  
  /**
   * 注册消息处理器（用于测试）
   */
  registerHandler(method: string, handler: (params: any) => any): void {
    this.messageHandlers.set(method, handler);
  }
  
  /**
   * 注销消息处理器
   */
  unregisterHandler(method: string): void {
    this.messageHandlers.delete(method);
  }
  
  /**
   * 获取通道信息
   */
  getChannelInfo(): { channel: string; participants: number } {
    const info = globalBus.getChannelInfo(this.channel);
    return {
      channel: this.channel,
      participants: info.count
    };
  }
  
  private registerDefaultHandlers(): void {
    // 初始化处理器
    this.registerHandler('initialize', () => {
      return {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: this.config.name,
          version: '1.0.0'
        }
      };
    });
    
    // 工具列表处理器
    this.registerHandler('tools/list', () => {
      return {
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool for InMemory transport',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' }
              }
            }
          }
        ]
      };
    });
    
    // 工具调用处理器
    this.registerHandler('tools/call', (params) => {
      if (params.name === 'test-tool') {
        return {
          toolResult: `Processed: ${params.arguments?.input || 'no input'}`
        };
      }
      throw new Error(`Unknown tool: ${params.name}`);
    });
  }
  
  private handleLocalMessage(message: JSONRPCMessage): void {
    if (message.method) {
      const handler = this.messageHandlers.get(message.method);
      if (handler) {
        try {
          const result = handler(message.params);
          if (message.id !== undefined) {
            // 发送响应
            const response: JSONRPCMessage = {
              jsonrpc: '2.0',
              id: message.id,
              result
            };
            this.receiveMessage(response);
          }
        } catch (error) {
          if (message.id !== undefined) {
            // 发送错误响应
            const response: JSONRPCMessage = {
              jsonrpc: '2.0',
              id: message.id,
              error: {
                code: -32603,
                message: (error as Error).message
              }
            };
            this.receiveMessage(response);
          }
        }
      }
    }
  }
  
  private handleLocalRequest(message: JSONRPCMessage): void {
    const handler = this.messageHandlers.get(message.method!);
    if (handler) {
      try {
        const result = handler(message.params);
        const response: JSONRPCMessage = {
          jsonrpc: '2.0',
          id: message.id,
          result
        };
        this.receiveMessage(response);
      } catch (error) {
        const response: JSONRPCMessage = {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32603,
            message: (error as Error).message
          }
        };
        this.receiveMessage(response);
      }
    } else {
      const response: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      };
      this.receiveMessage(response);
    }
  }
}