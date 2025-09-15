/**
 * Protocol Handler for JSON-RPC and MCP
 * 
 * 处理 JSON-RPC 协议的消息序列化、反序列化和错误处理
 */

import { EventEmitter } from 'events';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcMessage,
  RequestOptions
} from './types.js';
import { JsonRpcError, createJsonRpcError } from './errors.js';
import { ProtocolError, TimeoutError } from '../utils/errors.js';
import type { Transport } from '../transport/types.js';

export class ProtocolHandler extends EventEmitter {
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
  }>();
  
  private requestId = 0;
  private transport: Transport;

  constructor(transport: Transport) {
    super();
    this.transport = transport;
    this.setupTransportHandlers();
  }

  // ============== Public API ==============

  /**
   * 发送 JSON-RPC 请求
   */
  async sendRequest(method: string, params?: any, options?: RequestOptions): Promise<any> {
    const id = options?.id || this.generateRequestId();
    const timeout = options?.timeout || 30000;

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      ...(params !== undefined && { params })
    };

    return new Promise((resolve, reject) => {
      // 设置请求超时
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new TimeoutError(`Request timed out after ${timeout}ms: ${method}`, timeout));
      }, timeout);

      // 保存请求回调
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      // 发送请求
      this.sendMessage(request).catch(error => {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * 发送 JSON-RPC 通知（不需要响应）
   */
  async sendNotification(method: string, params?: any): Promise<void> {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      ...(params !== undefined && { params })
    };

    await this.sendMessage(notification);
  }

  /**
   * 发送响应
   */
  async sendResponse(id: string | number, result?: any, error?: JsonRpcError): Promise<void> {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      ...(error ? { error: error.toErrorObject() } : { result })
    };

    await this.sendMessage(response);
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // 清理所有待处理的请求
    for (const [id, request] of this.pendingRequests.entries()) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new ProtocolError('Protocol handler disposed'));
    }
    this.pendingRequests.clear();
    
    // 移除所有事件监听器
    this.removeAllListeners();
  }

  // ============== Private Methods ==============

  private setupTransportHandlers(): void {
    this.transport.onMessage((message: string) => {
      this.handleIncomingMessage(message);
    });

    this.transport.onError((error: Error) => {
      this.emit('transport-error', error);
    });

    this.transport.onClose(() => {
      this.handleTransportClose();
    });
  }

  private async sendMessage(message: JsonRpcMessage): Promise<void> {
    try {
      const messageStr = JSON.stringify(message);
      await this.transport.send(messageStr);
    } catch (error) {
      throw new ProtocolError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleIncomingMessage(messageStr: string): void {
    try {
      const message = this.parseMessage(messageStr);
      
      if (this.isResponse(message)) {
        this.handleResponse(message);
      } else if (this.isRequest(message)) {
        this.handleRequest(message);
      } else if (this.isNotification(message)) {
        this.handleNotification(message);
      } else {
        console.warn('Received invalid JSON-RPC message:', message);
      }
    } catch (error) {
      console.error('Failed to handle incoming message:', error);
      this.emit('protocol-error', error);
    }
  }

  private parseMessage(messageStr: string): any {
    try {
      const message = JSON.parse(messageStr);
      
      // 基本的 JSON-RPC 格式验证
      if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
        throw createJsonRpcError.invalidRequest('Invalid JSON-RPC format');
      }
      
      return message;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw createJsonRpcError.parseError('Invalid JSON');
      }
      throw error;
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pendingRequest = this.pendingRequests.get(response.id);
    if (!pendingRequest) {
      console.warn('Received response for unknown request:', response.id);
      return;
    }

    // 清理
    this.pendingRequests.delete(response.id);
    if (pendingRequest.timeout) {
      clearTimeout(pendingRequest.timeout);
    }

    // 处理响应
    if (response.error) {
      const error = JsonRpcError.fromErrorObject(response.error);
      pendingRequest.reject(error);
    } else {
      pendingRequest.resolve(response.result);
    }
  }

  private handleRequest(request: JsonRpcRequest): void {
    // 发出请求事件，让上层处理
    this.emit('request', request);
  }

  private handleNotification(notification: JsonRpcNotification): void {
    // 发出通知事件，让上层处理
    this.emit('notification', notification);
  }

  private handleTransportClose(): void {
    // 拒绝所有待处理的请求
    const error = new ProtocolError('Transport connection closed');
    for (const [id, request] of this.pendingRequests.entries()) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(error);
    }
    this.pendingRequests.clear();
    
    this.emit('disconnected');
  }

  private generateRequestId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }

  private isResponse(message: any): message is JsonRpcResponse {
    return typeof message.id !== 'undefined' && 
           (typeof message.result !== 'undefined' || typeof message.error !== 'undefined');
  }

  private isRequest(message: any): message is JsonRpcRequest {
    return typeof message.id !== 'undefined' && 
           typeof message.method === 'string' && 
           typeof message.result === 'undefined' && 
           typeof message.error === 'undefined';
  }

  private isNotification(message: any): message is JsonRpcNotification {
    return typeof message.id === 'undefined' && 
           typeof message.method === 'string';
  }
}