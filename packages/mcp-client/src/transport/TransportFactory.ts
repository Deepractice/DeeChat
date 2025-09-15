/**
 * Transport Factory
 * 
 * 根据传输配置创建相应的传输实例
 */

import type { 
  TransportConfig, 
  StdioTransportConfig, 
  HttpTransportConfig, 
  WebSocketTransportConfig 
} from '../types/index.js';
import type { Transport } from './types.js';
import { StdioTransport } from './StdioTransport.js';
import { HttpTransport } from './HttpTransport.js';
import { WebSocketTransport } from './WebSocketTransport.js';
import { ConfigurationError } from '../utils/errors.js';

export class TransportFactory {
  /**
   * 根据配置创建传输实例
   */
  static createTransport(config: TransportConfig): Transport {
    switch (config.type) {
      case 'stdio':
        return TransportFactory.createStdioTransport(config);
      
      case 'http':
        return TransportFactory.createHttpTransport(config);
      
      case 'websocket':
        return TransportFactory.createWebSocketTransport(config);
      
      default:
        throw new ConfigurationError(`Unsupported transport type: ${(config as any).type}`);
    }
  }

  /**
   * 创建 Stdio 传输
   */
  private static createStdioTransport(config: StdioTransportConfig): StdioTransport {
    return new StdioTransport({
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env
    });
  }

  /**
   * 创建 HTTP 传输
   */
  private static createHttpTransport(config: HttpTransportConfig): HttpTransport {
    return new HttpTransport({
      url: config.url,
      headers: config.headers
    });
  }

  /**
   * 创建 WebSocket 传输
   */
  private static createWebSocketTransport(config: WebSocketTransportConfig): WebSocketTransport {
    return new WebSocketTransport({
      url: config.url,
      headers: config.headers
    });
  }

  /**
   * 验证传输配置是否受支持
   */
  static validateTransportType(type: string): boolean {
    return ['stdio', 'http', 'websocket'].includes(type);
  }

  /**
   * 获取支持的传输类型列表
   */
  static getSupportedTypes(): string[] {
    return ['stdio', 'http', 'websocket'];
  }
}