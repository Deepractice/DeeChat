/**
 * 简化的 WebSocket Transport Implementation
 *
 * 通过 WebSocket 与 MCP 服务器进行双向通信
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { WebSocketTransportConfig, JsonRpcRequest, JsonRpcResponse } from '../types/index.js';

export class WebSocketTransport extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(private config: WebSocketTransportConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    try {
      await this.createWebSocketConnection();
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to WebSocket server: ${error}`);
    }
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      // 设置请求超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout: ${request.method}`));
      }, 30000);

      this.pendingRequests.set(request.id, { resolve, reject, timeout });

      // 发送请求
      const message = JSON.stringify(request);
      this.ws!.send(message, (error) => {
        if (error) {
          this.pendingRequests.delete(request.id);
          clearTimeout(timeout);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.ws) {
      return;
    }

    try {
      // 清理所有待处理的请求
      Array.from(this.pendingRequests.entries()).forEach(([id, { reject, timeout }]) => {
        clearTimeout(timeout);
        reject(new Error('Connection closed'));
      });
      this.pendingRequests.clear();

      // 关闭 WebSocket
      await new Promise<void>((resolve) => {
        if (!this.ws) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          this.cleanup();
          resolve();
        }, 5000);

        this.ws.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });

        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Client closing connection');
        } else {
          resolve();
        }
      });

      this.cleanup();
      this.emit('close');
    } catch (error) {
      // 忽略关闭错误
    }
  }

  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private async createWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, {
          headers: this.config.headers
        });

        this.ws!.once('open', () => {
          this.setupWebSocketHandlers();
          resolve();
        });

        this.ws!.once('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    // 消息处理
    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = data.toString('utf-8');
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
      }
    });

    // 错误处理
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.cleanup();
      this.emit('error', error);
    });

    // 关闭处理
    this.ws.on('close', (code, reason) => {
      console.log(`WebSocket closed with code ${code}, reason ${reason}`);
      this.cleanup();
      this.emit('close');
    });

    // Ping/Pong 处理（保持连接活跃）
    this.ws.on('ping', (data) => {
      this.ws?.pong(data);
    });
  }

  private handleMessage(message: string): void {
    try {
      const parsed = JSON.parse(message) as JsonRpcResponse;

      if (parsed.id !== undefined) {
        // 这是一个响应
        const pending = this.pendingRequests.get(parsed.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(parsed.id);

          if (parsed.error) {
            pending.reject(new Error(parsed.error.message));
          } else {
            pending.resolve(parsed);
          }
        }
      } else {
        // 这是一个通知，暂时忽略
        console.log('Received notification:', parsed);
      }

    } catch (error) {
      console.error('Failed to parse message:', error, 'Message:', message);
    }
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.removeAllListeners();

      // 强制关闭连接
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.terminate();
      }

      this.ws = null;
    }

    this.connected = false;
  }
}