/**
 * Stdio传输实现
 * 通过标准输入输出与子进程通信
 */

import { BaseTransport, IMCPTransport, JSONRPCMessage, TransportStatus } from './IMCPTransport';
import { MCPServerConfig } from '../../../../shared/entities/MCPServerConfigV2';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import log from 'electron-log';

/**
 * Stdio传输
 * 特性：
 * - 本地进程通信
 * - 低延迟
 * - 适合本地工具
 * - 支持流式输出
 */
export class StdioTransport extends BaseTransport implements IMCPTransport {
  private process?: ChildProcess;
  private rl?: readline.Interface;
  private pendingRequests = new Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private requestIdCounter = 0;
  
  readonly features = {
    streaming: true,
    notifications: true,
    sessions: false,
    reconnect: false
  };
  
  constructor(config: MCPServerConfig) {
    super(config);
    log.info(`[Stdio] 创建传输: ${config.name}`);
  }
  
  async connect(): Promise<void> {
    if (this.isConnected()) return;
    
    this.setStatus(TransportStatus.CONNECTING);
    log.info(`[Stdio] 启动进程: ${this.config.command} ${this.config.args?.join(' ') || ''}`);
    
    return new Promise((resolve, reject) => {
      const connectTimeout = setTimeout(() => {
        reject(new Error('Process start timeout'));
      }, this.timeout);
      
      try {
        // 准备环境变量
        const env = {
          ...process.env,
          ...this.config.env
        };
        
        // 启动子进程
        this.process = spawn(this.config.command!, this.config.args || [], {
          cwd: this.config.workingDirectory || process.cwd(),
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // 创建readline接口
        this.rl = readline.createInterface({
          input: this.process.stdout!,
          crlfDelay: Infinity
        });
        
        // 处理输出行
        this.rl.on('line', (line) => {
          this.handleLine(line);
        });
        
        // 处理错误输出
        this.process.stderr!.on('data', (data) => {
          const message = data.toString();
          log.error(`[Stdio] 进程错误输出: ${message}`);
        });
        
        // 进程退出处理
        this.process.on('exit', (code, signal) => {
          log.info(`[Stdio] 进程退出: code=${code}, signal=${signal}`);
          this.handleProcessExit(code, signal);
        });
        
        // 进程错误处理
        this.process.on('error', (error) => {
          clearTimeout(connectTimeout);
          log.error('[Stdio] 进程错误:', error);
          this.handleError(error);
          reject(error);
        });
        
        // 等待进程启动
        this.process.on('spawn', () => {
          clearTimeout(connectTimeout);
          log.info('[Stdio] 进程已启动');
          
          this.setStatus(TransportStatus.CONNECTED);
          
          // 发送初始化请求
          this.sendInitializeRequest()
            .then(() => resolve())
            .catch(reject);
        });
        
      } catch (error) {
        clearTimeout(connectTimeout);
        this.handleError(error as Error);
        reject(error);
      }
    });
  }
  
  async disconnect(): Promise<void> {
    if (this._status === TransportStatus.DISCONNECTED) return;
    
    this.setStatus(TransportStatus.DISCONNECTING);
    log.info(`[Stdio] 断开连接: ${this.config.name}`);
    
    // 关闭readline
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
    
    // 终止进程
    if (this.process) {
      if (!this.process.killed) {
        // 先尝试正常关闭
        this.process.kill('SIGTERM');
        
        // 等待进程退出
        await new Promise<void>((resolve) => {
          let resolved = false;
          
          const timeout = setTimeout(() => {
            if (!resolved && this.process && !this.process.killed) {
              log.warn('[Stdio] 进程未响应SIGTERM，强制终止');
              this.process.kill('SIGKILL');
            }
            resolved = true;
            resolve();
          }, 5000);
          
          this.process!.once('exit', () => {
            if (!resolved) {
              clearTimeout(timeout);
              resolved = true;
              resolve();
            }
          });
        });
      }
      
      this.process = undefined;
    }
    
    // 清理待处理请求
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Transport disconnected'));
    });
    this.pendingRequests.clear();
    
    this.setStatus(TransportStatus.DISCONNECTED);
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected() || !this.process || !this.process.stdin) {
      throw new Error('Process not connected');
    }
    
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(message) + '\n';
      
      this.process!.stdin!.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          this.updateStats(message, 'out');
          resolve();
        }
      });
    });
  }
  
  async request(method: string, params?: any): Promise<any> {
    const id = ++this.requestIdCounter;
    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);
      
      // 存储请求
      this.pendingRequests.set(id, { resolve, reject, timeout });
      
      // 发送请求
      this.send(message).catch(error => {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  async notify(method: string, params?: any): Promise<void> {
    const message: JSONRPCMessage = {
      jsonrpc: '2.0',
      method,
      params
    };
    await this.send(message);
  }
  
  destroy(): void {
    this.disconnect();
  }
  
  private async sendInitializeRequest(): Promise<void> {
    const response = await this.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: {
        name: 'DeeChat',
        version: '1.0.0'
      }
    });
    
    log.info('[Stdio] 初始化成功:', response);
  }
  
  private handleLine(line: string): void {
    // 忽略空行
    if (!line.trim()) return;
    
    try {
      // 尝试解析JSON
      const message = JSON.parse(line);
      
      if (message.jsonrpc === '2.0') {
        this.handleIncomingMessage(message);
      } else {
        log.warn('[Stdio] 非JSON-RPC消息:', line);
      }
    } catch (error) {
      // 不是JSON，可能是日志或其他输出
      log.debug('[Stdio] 非JSON输出:', line);
    }
  }
  
  private handleIncomingMessage(message: JSONRPCMessage): void {
    this.updateStats(message, 'in');
    
    // 处理响应
    if (message.id !== undefined && !message.method) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    
    // 发送消息事件
    this.emit('message', message);
  }
  
  private handleProcessExit(code: number | null, signal: string | null): void {
    if (this._status === TransportStatus.DISCONNECTING) {
      // 正常关闭
      return;
    }
    
    // 异常退出
    const reason = signal ? `Signal: ${signal}` : `Exit code: ${code}`;
    log.error(`[Stdio] 进程异常退出: ${reason}`);
    
    this.handleError(new Error(`Process exited unexpectedly: ${reason}`));
    
    // 清理资源
    this.disconnect();
  }
}