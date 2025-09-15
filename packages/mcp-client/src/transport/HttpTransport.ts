/**
 * HTTP Transport Implementation
 * 
 * 通过 HTTP POST 请求与 MCP 服务器通信
 */

import { BaseTransport } from './BaseTransport.js';
import type { HttpTransportOptions } from './types.js';
import { ConnectionError } from '../utils/errors.js';

export class HttpTransport extends BaseTransport {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(private httpOptions: HttpTransportOptions) {
    super(httpOptions);
    this.baseUrl = httpOptions.url.replace(/\/$/, ''); // 移除末尾斜杠
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...httpOptions.headers
    };
  }

  // ============== Transport Implementation ==============

  async connect(): Promise<void> {
    if (this.connected) {
      throw new ConnectionError('Already connected');
    }

    try {
      // 测试连接 - 发送一个简单的健康检查请求
      await this.withTimeout(this.testConnection());
      this.setConnected(true);
    } catch (error) {
      throw this.createConnectionError(
        `Failed to connect to HTTP server: ${this.baseUrl}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async send(message: string): Promise<void> {
    if (!this.connected) {
      throw new ConnectionError('Not connected');
    }

    try {
      const response = await this.withTimeout(
        fetch(this.baseUrl, {
          method: 'POST',
          headers: this.headers,
          body: message
        })
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 处理响应
      const responseText = await response.text();
      if (responseText.trim()) {
        // 如果有响应内容，立即发出消息事件
        this.emitMessage(responseText);
      }

    } catch (error) {
      throw this.createConnectionError(
        'Failed to send HTTP request',
        error instanceof Error ? error : undefined
      );
    }
  }

  async receive(): Promise<string | null> {
    // HTTP 是请求-响应模式，消息在 send 方法中直接处理
    // 这个方法返回 null
    return null;
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // HTTP 连接是无状态的，只需要标记为断开连接
    this.setConnected(false);
  }

  // ============== Private Methods ==============

  private async testConnection(): Promise<void> {
    try {
      // 发送一个简单的 OPTIONS 请求来测试连接
      const response = await fetch(this.baseUrl, {
        method: 'OPTIONS',
        headers: {
          'Accept': 'application/json'
        }
      });

      // 不要求 OPTIONS 必须成功，但至少要能建立连接
      // 如果服务器不支持 OPTIONS，我们尝试一个简单的 POST
      if (!response.ok && response.status !== 405) {
        // 405 Method Not Allowed 是可以接受的，说明服务器可达
        if (response.status >= 500) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }
      }

    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach server');
      }
      throw error;
    }
  }
}