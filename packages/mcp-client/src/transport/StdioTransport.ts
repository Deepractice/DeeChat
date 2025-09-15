/**
 * Stdio Transport Implementation
 * 
 * 通过标准输入/输出与子进程通信
 */

import { spawn, ChildProcess } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { BaseTransport } from './BaseTransport.js';
import type { StdioTransportOptions } from './types.js';
import { ConnectionError } from '../utils/errors.js';

export class StdioTransport extends BaseTransport {
  private process: ChildProcess | null = null;
  private messageBuffer = '';
  private messageHandlers: Array<(message: string) => void> = [];

  constructor(private stdioOptions: StdioTransportOptions) {
    super(stdioOptions);
  }

  // ============== Transport Implementation ==============

  async connect(): Promise<void> {
    if (this.connected) {
      throw new ConnectionError('Already connected');
    }

    try {
      await this.withTimeout(this.startProcess());
      this.setConnected(true);
    } catch (error) {
      throw this.createConnectionError(
        `Failed to start process: ${this.stdioOptions.command}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  async send(message: string): Promise<void> {
    if (!this.connected || !this.process || !this.process.stdin) {
      throw new ConnectionError('Not connected');
    }

    try {
      // 确保消息以换行符结尾
      const messageToSend = message.endsWith('\\n') ? message : message + '\\n';
      
      return new Promise((resolve, reject) => {
        this.process!.stdin!.write(messageToSend, 'utf-8', (error) => {
          if (error) {
            reject(this.createConnectionError('Failed to send message', error));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw this.createConnectionError(
        'Failed to send message',
        error instanceof Error ? error : undefined
      );
    }
  }

  async receive(): Promise<string | null> {
    // Stdio transport 主要通过事件驱动，这个方法返回 null
    // 实际消息通过 onMessage 事件处理
    return null;
  }

  async close(): Promise<void> {
    if (!this.connected || !this.process) {
      return;
    }

    try {
      // 优雅关闭：先发送 SIGTERM
      this.process.kill('SIGTERM');

      // 等待进程结束，或在超时后强制结束
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.cleanup();
    } catch (error) {
      this.cleanup();
      throw this.createConnectionError(
        'Error during close',
        error instanceof Error ? error : undefined
      );
    }
  }

  // ============== Private Methods ==============

  private async startProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.stdioOptions.command, this.stdioOptions.args || [], {
          cwd: this.stdioOptions.cwd,
          env: {
            ...process.env,
            ...this.stdioOptions.env
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // 设置事件处理器
        this.setupProcessHandlers();

        // 等待进程启动
        this.process.once('spawn', () => {
          resolve();
        });

        this.process.once('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    // 处理标准输出（消息接收）
    this.process.stdout?.setEncoding('utf-8');
    this.process.stdout?.on('data', (data: string) => {
      this.handleIncomingData(data);
    });

    // 处理标准错误
    this.process.stderr?.setEncoding('utf-8');
    this.process.stderr?.on('data', (data: string) => {
      // 可以选择记录错误日志或忽略
      console.warn(`MCP Server stderr: ${data}`);
    });

    // 处理进程退出
    this.process.on('exit', (code, signal) => {
      this.cleanup();
      if (code !== 0 && code !== null) {
        this.emitError(new ConnectionError(`Process exited with code ${code}`));
      }
    });

    // 处理进程错误
    this.process.on('error', (error) => {
      this.cleanup();
      this.emitError(this.createConnectionError('Process error', error));
    });
  }

  private handleIncomingData(data: string): void {
    this.messageBuffer += data;

    // 按行分割消息
    const lines = this.messageBuffer.split('\\n');
    
    // 保留最后一个可能不完整的行
    this.messageBuffer = lines.pop() || '';

    // 处理完整的行
    for (const line of lines) {
      if (line.trim()) {
        this.emitMessage(line.trim());
      }
    }
  }

  private cleanup(): void {
    if (this.process) {
      this.process.removeAllListeners();
      this.process.stdout?.removeAllListeners();
      this.process.stderr?.removeAllListeners();
      this.process.stdin?.removeAllListeners();
      this.process = null;
    }

    this.messageBuffer = '';
    this.setConnected(false);
  }
}