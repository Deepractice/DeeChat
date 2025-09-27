/**
 * 简化的 Stdio Transport Implementation
 *
 * 通过标准输入/输出与子进程通信
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { StdioTransportConfig, JsonRpcRequest, JsonRpcResponse } from '../types/index.js';

export class StdioTransport extends EventEmitter {
  private process: ChildProcess | null = null;
  private messageBuffer = '';
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(private config: StdioTransportConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnected()) {
      return;
    }

    try {
      this.process = spawn(this.config.command, this.config.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env }
      });

      this.setupProcessHandlers();

      // 等待进程启动
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Process startup timeout'));
        }, 5000);

        this.process!.on('spawn', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.process!.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to start process: ${error}`);
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
      const message = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(message, 'utf-8', (error) => {
        if (error) {
          this.pendingRequests.delete(request.id);
          clearTimeout(timeout);
          reject(new Error(`Failed to send request: ${error.message}`));
        }
      });
    });
  }

  async close(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      // 清理所有待处理的请求
      for (const [id, { reject, timeout }] of this.pendingRequests) {
        clearTimeout(timeout);
        reject(new Error('Connection closed'));
      }
      this.pendingRequests.clear();

      // 关闭子进程
      if (this.process.stdin) {
        this.process.stdin.end();
      }

      this.process.kill();
      this.process = null;

      this.emit('close');
    } catch (error) {
      // 忽略关闭错误
    }
  }

  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    // 处理标准输出
    this.process.stdout!.on('data', (data: Buffer) => {
      this.handleData(data.toString());
    });

    // 处理标准错误
    this.process.stderr!.on('data', (data: Buffer) => {
      console.error(`Process stderr: ${data.toString()}`);
    });

    // 处理进程退出
    this.process.on('exit', (code, signal) => {
      console.log(`Process exited with code ${code}, signal ${signal}`);
      this.cleanup();
      this.emit('close');
    });

    // 处理进程错误
    this.process.on('error', (error) => {
      console.error('Process error:', error);
      this.cleanup();
      this.emit('error', error);
    });
  }

  private handleData(data: string): void {
    this.messageBuffer += data;

    // 按行分割消息
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // 保留最后一个可能不完整的行

    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line.trim());
      }
    }
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
    if (this.process) {
      this.process.removeAllListeners();
      this.process = null;
    }
  }
}