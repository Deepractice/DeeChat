/**
 * 简化的 HTTP Transport Implementation
 *
 * 通过 HTTP POST 请求与服务器通信
 */

import { EventEmitter } from 'events';
import type { HttpTransportConfig, StreamableHttpTransportConfig, JsonRpcRequest, JsonRpcResponse } from '../types/index.js';

export class HttpTransport extends EventEmitter {
  private connected = false;

  constructor(private config: HttpTransportConfig | StreamableHttpTransportConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // 使用 MCP 标准的 initialize 方法测试连接
      const initializeRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'initialize-' + Date.now(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'deechat-mcp-client',
            version: '1.0.4'
          }
        }
      };

      await this.sendRequest(initializeRequest);
      this.connected = true;

    } catch (error) {
      throw new Error(`Failed to connect to HTTP server: ${error}`);
    }
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2024-11-05',
      ...this.config.headers
    };

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseText = await response.text();

      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }

      // 处理 SSE 格式的响应
      let jsonResponse: JsonRpcResponse;
      if (responseText.startsWith('event: message\ndata: ')) {
        // 解析 SSE 格式
        const lines = responseText.split('\n');
        const dataLine = lines.find(line => line.startsWith('data: '));
        if (dataLine) {
          const jsonData = dataLine.substring(6); // 移除 "data: " 前缀
          jsonResponse = JSON.parse(jsonData) as JsonRpcResponse;
        } else {
          throw new Error('Invalid SSE response format');
        }
      } else {
        // 标准 JSON 响应
        jsonResponse = JSON.parse(responseText) as JsonRpcResponse;
      }

      if (jsonResponse.error) {
        throw new Error(`RPC Error: ${jsonResponse.error.message}`);
      }

      return jsonResponse;

    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`HTTP request failed: ${error}`);
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    this.emit('close');
  }

  isConnected(): boolean {
    return this.connected;
  }
}