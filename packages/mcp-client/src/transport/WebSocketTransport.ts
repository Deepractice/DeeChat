/**
 * WebSocket Transport Implementation
 * 
 * 通过 WebSocket 与 MCP 服务器进行双向通信
 */

import WebSocket from 'ws';
import { BaseTransport } from './BaseTransport.js';
import type { WebSocketTransportOptions } from './types.js';
import { ConnectionError } from '../utils/errors.js';

export class WebSocketTransport extends BaseTransport {
  private ws: WebSocket | null = null;
  private url: string;
  private wsOptions: any;

  constructor(private websocketOptions: WebSocketTransportOptions) {
    super(websocketOptions);
    this.url = websocketOptions.url;
    this.wsOptions = {
      headers: websocketOptions.headers || {}
    };
  }

  // ============== Transport Implementation ==============

  async connect(): Promise<void> {
    if (this.connected) {
      throw new ConnectionError('Already connected');
    }

    try {
      await this.withTimeout(this.createWebSocketConnection());
      this.setConnected(true);
    } catch (error) {
      throw this.createConnectionError(
        `Failed to connect to WebSocket server: ${this.url}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async send(message: string): Promise<void> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new ConnectionError('Not connected');
    }

    try {
      return new Promise((resolve, reject) => {
        this.ws!.send(message, (error: Error | undefined) => {
          if (error) {
            reject(this.createConnectionError('Failed to send message', error));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw this.createConnectionError(
        'Failed to send WebSocket message',
        error instanceof Error ? error : undefined
      );
    }
  }

  async receive(): Promise<string | null> {
    // WebSocket 是事件驱动的，消息通过事件处理
    // 这个方法返回 null，实际消息通过 onMessage 事件处理
    return null;
  }

  async close(): Promise<void> {
    if (!this.connected || !this.ws) {
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        if (!this.ws) {
          resolve();
          return;
        }

        // 设置关闭超时
        const timeout = setTimeout(() => {
          this.cleanup();
          resolve();
        }, 5000);

        this.ws.once('close', () => {
          clearTimeout(timeout);
          resolve();
        });

        // 发起关闭
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Client closing connection');
        } else {
          resolve();
        }
      });

      this.cleanup();
    } catch (error) {
      this.cleanup();
      throw this.createConnectionError(
        'Error during WebSocket close',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============== Private Methods ==============

  private async createWebSocketConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, this.wsOptions);

        this.ws.once('open', () => {
          this.setupWebSocketHandlers();
          resolve();
        });

        this.ws.once('error', (error) => {
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
        this.emitMessage(message);
      } catch (error) {
        this.emitError(new ConnectionError(`Failed to process WebSocket message: ${error}`));
      }
    });

    // 错误处理
    this.ws.on('error', (error) => {
      this.emitError(this.createConnectionError('WebSocket error', error));
    });

    // 关闭处理
    this.ws.on('close', (code, reason) => {
      this.cleanup();
      
      // 如果不是正常关闭，发出错误
      if (code !== 1000 && code !== 1001) {
        this.emitError(new ConnectionError(
          `WebSocket closed unexpectedly: ${code} ${reason}`,
          { code, reason: reason?.toString() }
        ));
      }
    });

    // Ping/Pong 处理（保持连接活跃）
    this.ws.on('ping', (data) => {
      this.ws?.pong(data);
    });
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

    this.setConnected(false);
  }
}