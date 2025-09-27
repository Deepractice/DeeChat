/**
 * Complete Streamable HTTP Transport Implementation
 *
 * 实现 MCP Streamable HTTP 传输协议
 * 支持会话管理、POST 请求和 SSE 响应解析
 */

import { EventEmitter } from 'events';
import type { StreamableHttpTransportConfig, JsonRpcRequest, JsonRpcResponse } from '../types/index.js';

export class StreamableHttpTransport extends EventEmitter {
  private connected = false;
  private sessionId: string | null = null;

  constructor(private config: StreamableHttpTransportConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // 发送初始化请求建立会话
      const initRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 'init-' + Date.now(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'deepractice-mcp-client',
            version: '1.0.0'
          }
        }
      };

      const response = await this.performRequest(initRequest, true);
      this.connected = true;

      console.log('✅ Streamable HTTP connection established with session ID:', this.sessionId);
    } catch (error) {
      console.error('❌ Streamable HTTP connection failed:', error);
      throw new Error(`Failed to connect: ${error}`);
    }
  }

  async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.connected) {
      throw new Error('Not connected - call connect() first');
    }

    if (!this.sessionId) {
      throw new Error('No session ID available');
    }

    return await this.performRequest(request, false);
  }

  private async performRequest(request: JsonRpcRequest, isInitializing: boolean): Promise<JsonRpcResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream', // 关键：必须同时接受两种类型
        'MCP-Protocol-Version': '2024-11-05',
        ...this.config.headers
      };

      // 如果有会话ID，添加到请求头
      if (this.sessionId && !isInitializing) {
        headers['mcp-session-id'] = this.sessionId;
      }

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 在初始化时，获取会话ID
      if (isInitializing) {
        const sessionIdHeader = response.headers.get('mcp-session-id');
        if (sessionIdHeader) {
          this.sessionId = sessionIdHeader;
        } else {
          console.warn('⚠️ No session ID returned from server');
        }
      }

      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('Empty response from server');
      }

      // 解析SSE格式响应
      const jsonResponse = this.parseSSEResponse(responseText);

      if (jsonResponse.error) {
        throw new Error(`RPC Error: ${jsonResponse.error.message}`);
      }

      return jsonResponse;
    } catch (error) {
      throw new Error(`Streamable HTTP request failed: ${error}`);
    }
  }

  /**
   * 解析SSE格式的响应
   * 格式：event: message\ndata: {JSON}\n\n
   */
  private parseSSEResponse(sseText: string): JsonRpcResponse {
    try {
      // 查找data行
      const lines = sseText.split('\n');
      let jsonData = '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          jsonData = line.substring(6); // 移除 "data: " 前缀
          break;
        }
      }

      if (!jsonData) {
        throw new Error('No JSON data found in SSE response');
      }

      return JSON.parse(jsonData) as JsonRpcResponse;
    } catch (error) {
      console.error('SSE parsing error:', error);
      console.error('Raw SSE text:', sseText);
      throw new Error(`Failed to parse SSE response: ${error}`);
    }
  }

  async close(): Promise<void> {
    this.connected = false;
    this.sessionId = null;
    this.emit('close');
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}