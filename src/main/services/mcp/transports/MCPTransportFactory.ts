/**
 * MCP传输工厂
 * 负责创建和管理各种传输协议的实例
 */

import { MCPServerConfig, validateConfig } from '../../../../shared/entities/MCPServerConfigV2';
import { MCPTransportType } from '../../../../shared/types/mcp-protocol';
import { IMCPTransport, TransportFactory, ConfigValidator } from './IMCPTransport';
import { StdioTransport } from './StdioTransport';
import { StreamableHTTPTransport } from './StreamableHTTPTransport';
import { WebSocketTransport } from './WebSocketTransport';
import { SSETransport } from './SSETransport';
import { InMemoryTransport } from './InMemoryTransport';
import log from 'electron-log';

/**
 * 配置错误
 */
export class MCPConfigError extends Error {
  constructor(public errors: string[]) {
    super(`Configuration validation failed: ${errors.join(', ')}`);
    this.name = 'MCPConfigError';
  }
}

/**
 * 传输注册信息
 */
interface TransportRegistration {
  validator: ConfigValidator;
  factory: TransportFactory;
  description?: string;
}

/**
 * MCP传输工厂类
 */
export class MCPTransportFactory {
  private static registrations = new Map<MCPTransportType, TransportRegistration>();
  private static initialized = false;
  
  /**
   * 初始化内置传输协议
   */
  private static initialize(): void {
    if (this.initialized) return;
    
    // 注册Stdio传输
    this.register('stdio', 
      (config) => {
        const errors: string[] = [];
        if (!config.command?.trim()) {
          errors.push('command is required for stdio transport');
        }
        return errors;
      },
      async (config) => new StdioTransport(config),
      '标准输入输出传输，用于本地进程通信'
    );
    
    // 注册Streamable HTTP传输
    this.register('streamable-http',
      (config) => {
        const errors: string[] = [];
        if (!config.url?.trim()) {
          errors.push('url is required for streamable-http transport');
        }
        try {
          if (config.url) new URL(config.url);
        } catch {
          errors.push('invalid URL format');
        }
        return errors;
      },
      async (config) => new StreamableHTTPTransport(config),
      'HTTP流式传输，支持双向通信和服务器推送'
    );
    
    // 注册WebSocket传输
    this.register('websocket',
      (config) => {
        const errors: string[] = [];
        if (!config.url?.trim()) {
          errors.push('url is required for websocket transport');
        }
        if (config.url && !config.url.match(/^wss?:\/\//)) {
          errors.push('WebSocket URL must start with ws:// or wss://');
        }
        return errors;
      },
      async (config) => new WebSocketTransport(config),
      'WebSocket双向通信'
    );
    
    // 注册SSE传输（已弃用）
    this.register('sse',
      (config) => {
        const errors: string[] = [];
        if (!config.url?.trim()) {
          errors.push('url is required for sse transport');
        }
        return errors;
      },
      async (config) => new SSETransport(config),
      'Server-Sent Events（已弃用，建议使用streamable-http）'
    );
    
    // 注册InMemory传输
    this.register('inmemory',
      () => [], // 无需特殊验证
      async (config) => new InMemoryTransport(config),
      '内存传输，用于测试和进程内通信'
    );
    
    this.initialized = true;
    log.info('[MCPTransportFactory] 初始化完成，已注册5种传输协议');
  }
  
  /**
   * 注册新的传输协议
   */
  static register(
    type: MCPTransportType,
    validator: ConfigValidator,
    factory: TransportFactory,
    description?: string
  ): void {
    this.registrations.set(type, { validator, factory, description });
    log.info(`[MCPTransportFactory] 注册传输协议: ${type}`, description);
  }
  
  /**
   * 创建传输实例
   */
  static async create(config: MCPServerConfig): Promise<IMCPTransport> {
    this.initialize();
    
    log.info(`[MCPTransportFactory] 创建传输: ${config.name} (${config.type})`);
    
    // 1. 基础配置验证
    const baseErrors = validateConfig(config);
    if (baseErrors.length > 0) {
      throw new MCPConfigError(baseErrors.map(e => e.message));
    }
    
    // 2. 获取传输注册信息
    const registration = this.registrations.get(config.type);
    if (!registration) {
      throw new Error(`Unsupported transport type: ${config.type}`);
    }
    
    // 3. 协议特定验证
    const protocolErrors = registration.validator(config);
    if (protocolErrors.length > 0) {
      throw new MCPConfigError(protocolErrors);
    }
    
    // 4. 创建传输实例
    try {
      const transport = await registration.factory(config);
      
      // 5. 应用通用配置
      this.applyCommonConfig(transport, config);
      
      log.info(`[MCPTransportFactory] ✅ 传输创建成功: ${config.name}`);
      return transport;
      
    } catch (error) {
      log.error(`[MCPTransportFactory] ❌ 传输创建失败: ${config.name}`, error);
      throw error;
    }
  }
  
  /**
   * 应用通用配置
   */
  private static applyCommonConfig(
    transport: IMCPTransport,
    config: MCPServerConfig
  ): void {
    // 设置超时
    if (config.timeout) {
      transport.setTimeout(config.timeout);
    }
    
    // 设置重试策略
    if (config.retryConfig) {
      transport.setRetryPolicy({
        count: config.retryConfig.maxRetries,
        delay: config.retryConfig.initialDelay,
        maxDelay: config.retryConfig.maxDelay,
        backoffFactor: config.retryConfig.backoffFactor
      });
    }
    
    // 设置事件监听器
    transport.on('error', (error) => {
      log.error(`[MCPTransport] ${config.name} error:`, error);
    });
    
    transport.on('statusChange', (status) => {
      log.info(`[MCPTransport] ${config.name} status: ${status}`);
    });
  }
  
  /**
   * 获取支持的传输类型列表
   */
  static getSupportedTypes(): MCPTransportType[] {
    this.initialize();
    return Array.from(this.registrations.keys());
  }
  
  /**
   * 获取传输类型信息
   */
  static getTypeInfo(type: MCPTransportType): TransportRegistration | undefined {
    this.initialize();
    return this.registrations.get(type);
  }
  
  /**
   * 检查是否支持某种传输类型
   */
  static isSupported(type: MCPTransportType): boolean {
    this.initialize();
    return this.registrations.has(type);
  }
  
  /**
   * 自动检测协议类型（基于URL）
   */
  static detectProtocolType(url: string): MCPTransportType | null {
    try {
      const parsedUrl = new URL(url);
      
      // WebSocket
      if (parsedUrl.protocol === 'ws:' || parsedUrl.protocol === 'wss:') {
        return 'websocket';
      }
      
      // HTTP/HTTPS - 默认使用streamable-http
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        // 检查路径是否暗示SSE
        if (parsedUrl.pathname.includes('/sse') || parsedUrl.pathname.includes('/events')) {
          return 'sse';
        }
        return 'streamable-http';
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * 清理资源
   */
  static cleanup(): void {
    this.registrations.clear();
    this.initialized = false;
  }
}