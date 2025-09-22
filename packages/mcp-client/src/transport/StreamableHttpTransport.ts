/**
 * Streamable HTTP Transport Implementation
 *
 * 实现 MCP Streamable HTTP 传输协议 (2025-03-26 版本)
 * 支持 POST 请求和 SSE 通知流
 */

import { BaseTransport } from './BaseTransport.js';
import type { StreamableHttpTransportOptions } from './types.js';
import { ConnectionError } from '../utils/errors.js';

export class StreamableHttpTransport extends BaseTransport {
  private baseUrl: string;
  private headers: Record<string, string>;
  private sessionId?: string;
  private eventSource?: EventSource;
  private reconnectDelay: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private enableDnsRebindingProtection: boolean;
  private allowedHosts: string[];

  constructor(private streamableOptions: StreamableHttpTransportOptions) {
    super(streamableOptions);
    this.baseUrl = streamableOptions.url.replace(/\/$/, ''); // 移除末尾斜杠
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...streamableOptions.headers
    };
    this.sessionId = streamableOptions.sessionId;
    this.reconnectDelay = streamableOptions.reconnectDelay || 1000;
    this.maxReconnectAttempts = streamableOptions.maxReconnectAttempts || 5;
    this.enableDnsRebindingProtection = streamableOptions.enableDnsRebindingProtection || false;
    this.allowedHosts = streamableOptions.allowedHosts || [];
  }

  // ============== Transport Implementation ==============

  async connect(): Promise<void> {
    if (this.connected) {
      throw new ConnectionError('Already connected');
    }

    try {
      // 如果没有会话 ID，先初始化一个新会话
      if (!this.sessionId) {
        await this.initializeSession();
      } else {
        // 尝试恢复现有会话
        await this.resumeSession();
      }

      // 建立 SSE 连接用于接收服务器通知
      await this.establishSSEConnection();

      this.setConnected(true);
      this.reconnectAttempts = 0;
    } catch (error) {
      throw this.createConnectionError(
        `Failed to connect to Streamable HTTP server: ${this.baseUrl}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async send(message: string): Promise<void> {
    if (!this.connected) {
      throw new ConnectionError('Not connected');
    }

    if (!this.sessionId) {
      throw new ConnectionError('No session ID available');
    }

    try {
      const requestHeaders: Record<string, string> = {
        ...this.headers,
        'mcp-session-id': this.sessionId
      };

      // DNS 重绑定保护
      if (this.enableDnsRebindingProtection) {
        requestHeaders['Host'] = this.getHostFromUrl(this.baseUrl);
      }

      const response = await this.withTimeout(
        fetch(this.baseUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: message
        })
      );

      if (!response.ok) {
        if (response.status === 400) {
          // 会话可能已过期，尝试重新初始化
          this.sessionId = undefined;
          await this.connect();
          return this.send(message); // 重试
        }
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
        'Failed to send Streamable HTTP request',
        error instanceof Error ? error : undefined
      );
    }
  }

  async receive(): Promise<string | null> {
    // Streamable HTTP 通过 SSE 接收消息，在 SSE 事件处理器中处理
    // 这个方法返回 null
    return null;
  }

  async close(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      // 关闭 SSE 连接
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = undefined;
      }

      // 如果有会话 ID，发送删除请求来清理会话
      if (this.sessionId) {
        await this.terminateSession();
      }

    } catch (error) {
      // 忽略清理错误，因为我们正在关闭连接
      console.warn('Error during StreamableHttpTransport cleanup:', error);
    } finally {
      this.sessionId = undefined;
      this.setConnected(false);
    }
  }

  // ============== Session Management ==============

  private async initializeSession(): Promise<void> {
    const initRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'mcp-client',
          version: '1.0.0'
        }
      }
    };

    const response = await this.withTimeout(
      fetch(this.baseUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(initRequest)
      })
    );

    if (!response.ok) {
      throw new Error(`Failed to initialize session: HTTP ${response.status}`);
    }

    // 从响应头中获取会话 ID
    const sessionId = response.headers.get('mcp-session-id');
    if (!sessionId) {
      throw new Error('No session ID returned from server');
    }
    this.sessionId = sessionId;

    // 处理初始化响应
    const responseText = await response.text();
    if (responseText.trim()) {
      this.emitMessage(responseText);
    }
  }

  private async resumeSession(): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No session ID to resume');
    }

    const requestHeaders = {
      ...this.headers,
      'mcp-session-id': this.sessionId
    };

    // 发送一个简单的请求来测试会话是否仍然有效
    const testRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method: 'ping'
    };

    try {
      const response = await this.withTimeout(
        fetch(this.baseUrl, {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify(testRequest)
        })
      );

      if (response.status === 400) {
        // 会话无效，需要重新初始化
        this.sessionId = undefined;
        await this.initializeSession();
      } else if (!response.ok) {
        throw new Error(`Session resume failed: HTTP ${response.status}`);
      }
    } catch (error) {
      // 如果恢复失败，尝试创建新会话
      this.sessionId = undefined;
      await this.initializeSession();
    }
  }

  private async terminateSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    try {
      const requestHeaders = {
        ...this.headers,
        'mcp-session-id': this.sessionId
      };

      await this.withTimeout(
        fetch(this.baseUrl, {
          method: 'DELETE',
          headers: requestHeaders
        })
      );
    } catch (error) {
      // 忽略终止错误
      console.warn('Failed to terminate session:', error);
    }
  }

  // ============== SSE Connection ==============

  private async establishSSEConnection(): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Cannot establish SSE connection without session ID');
    }

    return new Promise((resolve, reject) => {
      const sseUrl = new URL(this.baseUrl);
      const eventSource = new EventSource(sseUrl.toString(), {
        withCredentials: false
      });

      // 设置会话 ID 头（注意：EventSource 不支持自定义头，需要通过 URL 参数传递）
      // 或者服务器需要支持通过其他方式识别会话

      eventSource.onopen = () => {
        this.eventSource = eventSource;
        resolve();
      };

      eventSource.onmessage = (event) => {
        try {
          // 处理服务器发送的消息
          this.emitMessage(event.data);
        } catch (error) {
          this.emitError(new Error(`Failed to process SSE message: ${error}`));
        }
      };

      eventSource.onerror = (event) => {
        if (this.eventSource === eventSource) {
          if (eventSource.readyState === EventSource.CLOSED) {
            // 连接被关闭，尝试重连
            this.handleSSEReconnect();
          } else {
            // 连接错误
            this.emitError(new Error('SSE connection error'));
            reject(new Error('Failed to establish SSE connection'));
          }
        }
      };

      // 设置连接超时
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          eventSource.close();
          reject(new Error('SSE connection timeout'));
        }
      }, this.options.timeout || 10000);
    });
  }

  private async handleSSEReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitError(new Error('Max SSE reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;

    setTimeout(async () => {
      try {
        await this.establishSSEConnection();
        this.reconnectAttempts = 0;
      } catch (error) {
        await this.handleSSEReconnect();
      }
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)); // 指数退避
  }

  // ============== Utility Methods ==============

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getHostFromUrl(url: string): string {
    try {
      return new URL(url).host;
    } catch {
      return '';
    }
  }

  // ============== Getters ==============

  /**
   * 获取当前会话 ID
   */
  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * 是否支持会话恢复
   */
  public supportsSessionResume(): boolean {
    return !!this.sessionId;
  }
}