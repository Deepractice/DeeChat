/**
 * MCP传输适配器基类和实现
 * 支持Stdio和SSE两种传输方式
 */

import log from 'electron-log'
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { MCPServerEntity } from '../../shared/entities/MCPServerEntity.js';
import {
  IMCPTransportAdapter,
  MCPEvent,
  MCPEventType
} from '../../shared/interfaces/IMCPProvider.js';
import { MCPSandboxManager } from '../services/runtime/MCPSandboxManager';

/**
 * MCP传输适配器基类
 */
export abstract class MCPTransportAdapter extends EventEmitter implements IMCPTransportAdapter {
  protected server: MCPServerEntity;
  protected connected: boolean = false;
  protected eventCallback?: (event: MCPEvent) => void;

  constructor(server: MCPServerEntity) {
    super();
    this.server = server;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract sendRequest(request: any): Promise<any>;

  isConnected(): boolean {
    return this.connected;
  }

  onEvent(callback: (event: MCPEvent) => void): void {
    this.eventCallback = callback;
  }

  protected emitEvent(type: MCPEventType, data?: any, error?: string): void {
    const event: MCPEvent = {
      type,
      serverId: this.server.id,
      timestamp: new Date(),
      data,
      error
    };

    if (this.eventCallback) {
      this.eventCallback(event);
    }
    this.emit('event', event);
  }
}

/**
 * Stdio传输适配器
 */
export class StdioMCPAdapter extends MCPTransportAdapter {
  private process?: ChildProcess;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private sandboxManager: MCPSandboxManager;

  constructor(server: MCPServerEntity) {
    super(server);
    this.sandboxManager = MCPSandboxManager.getInstance();
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    log.info(`[Stdio Adapter] 连接服务器: ${this.server.name}`);

    if (!this.server.command) {
      throw new Error('Stdio服务器命令未配置');
    }

    try {
      // 🔥 智能沙箱检测：检测沙箱协议或支持的MCP服务器类型
      if (this.shouldUseSandbox()) {
        log.info(`[Stdio Adapter] 🏗️ 检测到支持沙箱的服务器，使用沙箱模式: ${this.server.name}`);
        await this.connectViaSandbox();
        return;
      }

      // 解析命令和参数
      const commandParts = this.server.command.trim().split(' ');
      const command = commandParts[0];
      const args = [...commandParts.slice(1), ...(this.server.args || [])];

      log.info(`[Stdio Adapter] 🚀 启动进程: ${command} ${args.join(' ')}`);
      log.info(`[Stdio Adapter] 🔧 工作目录: ${this.server.workingDirectory || '未设置'}`);
      log.info(`[Stdio Adapter] 🔧 当前进程环境信息:`);
      log.info(`  - Node版本: ${process.version}`);
      log.info(`  - 平台: ${process.platform}`);
      log.info(`  - 架构: ${process.arch}`);
      log.info(`  - 是否打包: ${process.env.NODE_ENV === 'production' ? '是' : '否'}`);
      log.info(`  - 当前PATH: ${process.env.PATH?.substring(0, 200)}...`);

      // 🔥 使用Electron内置Node.js，无需检测外部工具链
      log.info(`[Stdio Adapter] 🔧 使用Electron内置Node.js工具链:`);
      log.info(`  - 内置Node版本: ${process.version}`);
      log.info(`  - Node可执行路径: ${process.execPath}`);
      log.info(`  - 所有工具将使用内置Node.js执行`);
      log.info(`  - 不再依赖系统PATH环境变量`);

      // 🔥 确保工作目录存在（特别是PromptX需要）
      if (this.server.workingDirectory) {
        const fs = require('fs');
        try {
          log.info(`[Stdio Adapter] 🔧 检查工作目录: ${this.server.workingDirectory}`);
          if (!fs.existsSync(this.server.workingDirectory)) {
            log.info(`[Stdio Adapter] 🔧 工作目录不存在，开始创建...`);
            fs.mkdirSync(this.server.workingDirectory, { recursive: true, mode: 0o755 });
            log.info(`[Stdio Adapter] ✅ 创建工作目录: ${this.server.workingDirectory}`);
          } else {
            log.info(`[Stdio Adapter] ✅ 工作目录已存在: ${this.server.workingDirectory}`);
          }
          // 验证权限
          fs.accessSync(this.server.workingDirectory, fs.constants.R_OK | fs.constants.W_OK);
          log.info(`[Stdio Adapter] ✅ 工作目录权限验证通过: ${this.server.workingDirectory}`);
        } catch (error) {
          log.error(`[Stdio Adapter] ❌ 工作目录准备失败: ${this.server.workingDirectory}`, error);
          throw error;
        }
      }

      // 🔥 始终使用系统Node.js，避免启动新的Electron实例
      let finalCommand = 'node';  // 直接使用系统Node.js
      let finalArgs: string[] = [];
      let useShell = false;

      // 🔥 检查系统是否有Node.js，没有就明确报错
      const { execSync } = require('child_process');
      try {
        execSync('which node', { stdio: 'ignore' });
        log.info(`[Stdio Adapter] ✅ 使用系统Node.js: node`);
      } catch (error) {
        const errorMsg = 'PromptX需要Node.js运行环境。请先安装Node.js (https://nodejs.org) 然后重启应用。';
        log.error(`[Stdio Adapter] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // 🔥 简化命令转换逻辑，避免复杂嵌套和外部依赖
      if (command === 'npx') {
        // 对于npx命令，使用内置资源或安全的require机制
        log.info(`[Stdio Adapter] 🔄 npx命令检测到: ${args.join(' ')}`);
        
        // 检查是否是PromptX本地服务
        if (args[0] === '@promptx/local-server') {
          // 🔥 使用Electron应用资源路径而非process.cwd()
          const path = require('path');
          const appPath = process.env.NODE_ENV === 'development' 
            ? path.join(process.cwd(), 'resources/promptx/package/src/bin/promptx.js')
            : path.join(process.resourcesPath, 'resources/promptx/package/src/bin/promptx.js');
          
          finalArgs = [appPath, ...args.slice(1)];
          log.info(`[Stdio Adapter] ✅ 使用预下载的PromptX: ${appPath}`);
        } else {
          // 其他npx命令，使用简单的require方式
          finalArgs = ['-e', `
            try {
              // 尝试直接require模块
              const modulePath = '${args[0]}';
              log.info('尝试加载模块:', modulePath);
              require(modulePath);
            } catch (error) {
              log.error('模块加载失败:', error.message);
              log.error('请确保模块已安装或使用预下载版本');
              process.exit(1);
            }
          `];
          log.info(`[Stdio Adapter] 🔄 npx命令转换为模块require: ${args[0]}`);
        }
      } else if (command === 'node') {
        // 直接使用参数
        finalArgs = args;
        log.info(`[Stdio Adapter] 🔄 node命令直接使用内置Node.js`);
      } else {
        // 其他命令记录警告但不执行复杂逻辑
        log.warn(`[Stdio Adapter] ⚠️ 不支持的命令: ${command}, 参数: ${args.join(' ')}`);
        log.warn(`[Stdio Adapter] 💡 建议使用node或npx命令`);
        
        // 简单的fallback：尝试作为node脚本执行
        finalArgs = ['-e', `log.error('不支持的命令: ${command}'); process.exit(1);`];
      }

      log.info(`[Stdio Adapter] 🔧 最终命令: ${finalCommand}, 参数: [${finalArgs.join(', ')}], 使用shell: ${useShell}`);

      // 🔥 简化的环境变量设置，使用Electron内置Node.js无需复杂PATH处理
      const enhancedEnv = {
        ...process.env,
        ...this.server.env,
        // 🔥 设置Node.js选项，优化内存使用
        NODE_OPTIONS: '--max-old-space-size=4096',
        // 🔥 确保npm配置可用（如果需要）
        npm_config_cache: process.env.npm_config_cache || (process.env.HOME ? `${process.env.HOME}/.npm` : undefined),
        // 🔥 禁用单例检测，解决Electron环境下的冲突
        ELECTRON_DISABLE_SINGLE_INSTANCE: '1',
        // 🔥 标记当前运行在Electron子进程中
        ELECTRON_SUBPROCESS: '1'
      };

      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
        env: enhancedEnv,
        shell: useShell,
        cwd: this.server.workingDirectory // 🔥 设置工作目录
      };

      log.info(`[Stdio Adapter] 🔧 Spawn选项详情:`);
      log.info(`  - 最终命令: ${finalCommand}`);
      log.info(`  - 最终参数: [${finalArgs.join(', ')}]`);
      log.info(`  - 工作目录: ${spawnOptions.cwd}`);
      log.info(`  - 使用shell: ${spawnOptions.shell}`);
      log.info(`  - 环境变量数量: ${Object.keys(enhancedEnv).length}`);
      log.info(`  - 使用系统Node.js: ✅`);

      log.info(`[Stdio Adapter] 🚀 开始执行spawn...`);
      try {
        log.info(`[Stdio Adapter] 📋 Spawn详细参数:`);
        log.info(`  - 命令: ${finalCommand}`);
        log.info(`  - 参数: [${finalArgs.map(arg => `"${arg}"`).join(', ')}]`);
        log.info(`  - 工作目录: ${spawnOptions.cwd}`);
        log.info(`  - 使用shell: ${spawnOptions.shell}`);
        log.info(`  - 环境变量数量: ${Object.keys(enhancedEnv).length}`);
        
        this.process = spawn(finalCommand, finalArgs, spawnOptions);
        log.info(`[Stdio Adapter] ✅ spawn执行成功，PID: ${this.process.pid}`);
        log.info(`[Stdio Adapter] 🔍 进程初始状态:`);
        log.info(`  - PID: ${this.process.pid}`);
        log.info(`  - killed: ${this.process.killed}`);
        log.info(`  - exitCode: ${this.process.exitCode}`);
        log.info(`  - connected: ${this.process.connected}`);
        log.info(`  - stdio配置: [${spawnOptions.stdio.join(', ')}]`);
      } catch (spawnError) {
        log.error(`[Stdio Adapter] ❌ spawn执行失败:`, spawnError);
        throw spawnError;
      }

      // 设置进程事件监听
      log.info(`[Stdio Adapter] 🔧 设置进程事件监听...`);
      this.setupProcessListeners();

      // 等待进程启动
      log.info(`[Stdio Adapter] ⏳ 等待进程启动...`);
      try {
        await this.waitForProcessReady();
        log.info(`[Stdio Adapter] ✅ 进程启动完成`);
      } catch (readyError) {
        log.error(`[Stdio Adapter] ❌ 进程启动失败:`, readyError);
        throw readyError;
      }

      this.connected = true;
      log.info(`[Stdio Adapter] 连接成功: ${this.server.name}`);
      this.emitEvent(MCPEventType.SERVER_CONNECTED, { serverName: this.server.name });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接失败';
      log.error(`[Stdio Adapter] 连接失败: ${this.server.name}`, error);

      // 特殊处理npx相关错误
      if (errorMessage.includes('ENOENT') && this.server.command?.includes('npx')) {
        const enhancedError = new Error(
          `无法启动MCP服务器: npx命令不可用。\n` +
          `请确保已安装Node.js和npm，或者尝试以下解决方案：\n` +
          `1. 重新安装Node.js (https://nodejs.org/)\n` +
          `2. 检查PATH环境变量是否包含Node.js路径\n` +
          `3. 在终端中运行 'npx --version' 验证npx可用性\n` +
          `原始错误: ${errorMessage}`
        );
        this.emitEvent(MCPEventType.SERVER_ERROR, null, enhancedError.message);
        throw enhancedError;
      }

      this.emitEvent(MCPEventType.SERVER_ERROR, null, errorMessage);
      throw error;
    }
  }



  async sendRequest(request: any): Promise<any> {
    log.info(`[Stdio Adapter] 🔧 检查发送请求条件: ${this.server.name}`);
    log.info(`  - 连接状态: ${this.connected}`);
    log.info(`  - 进程存在: ${!!this.process}`);
    log.info(`  - 进程PID: ${this.process?.pid}`);
    log.info(`  - 进程已退出: ${this.process?.killed}`);
    log.info(`  - 进程退出码: ${this.process?.exitCode}`);

    if (!this.connected) {
      log.error(`[Stdio Adapter] ❌ 适配器未连接: ${this.server.name}`);
      throw new Error('适配器未连接');
    }

    if (!this.process) {
      log.error(`[Stdio Adapter] ❌ 进程不存在: ${this.server.name}`);
      this.connected = false;
      throw new Error('进程不存在');
    }

    if (this.process.killed || this.process.exitCode !== null) {
      log.error(`[Stdio Adapter] ❌ 进程已退出: ${this.server.name}, 退出码: ${this.process.exitCode}`);
      this.connected = false;
      throw new Error(`进程已退出，退出码: ${this.process.exitCode}`);
    }

    const id = ++this.requestId;
    const message = {
      jsonrpc: '2.0',
      id,
      ...request
    };

    log.info(`[Stdio Adapter] 发送请求 ${id}:`, request.method);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`请求超时: ${request.method}`));
      }, this.server.timeout || 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      try {
        // 检查进程是否仍然活跃
        if (!this.process || this.process.killed || this.process.exitCode !== null) {
          throw new Error(`进程已退出，无法发送消息: ${this.server.name}`);
        }

        // 检查stdin是否可写
        if (!this.process.stdin || this.process.stdin.destroyed) {
          throw new Error(`进程stdin不可用，无法发送消息: ${this.server.name}`);
        }

        const messageStr = JSON.stringify(message) + '\n';
        log.info(`[Stdio Adapter] 📤 发送消息到 ${this.server.name}: ${message.method}`);
        log.info(`[Stdio Adapter] 📤 消息内容: ${messageStr.trim()}`);

        // 🔥 增强写入错误处理和EPIPE检测
        try {
          const writeResult = this.process.stdin.write(messageStr, (error) => {
            if (error) {
              log.error(`[Stdio Adapter] ❌ 写入回调错误: ${this.server.name}`, error);
              if ((error as any).code === 'EPIPE') {
                log.error(`[Stdio Adapter] 💥 检测到EPIPE错误 - 进程管道已断开: ${this.server.name}`);
                this.connected = false;
                this.emitEvent(MCPEventType.SERVER_ERROR, null, `进程管道断开: ${error.message}`);
              }
              clearTimeout(timeout);
              this.pendingRequests.delete(id);
              reject(error);
            }
          });
          
          if (!writeResult) {
            log.warn(`[Stdio Adapter] ⚠️ 写入缓冲区已满: ${this.server.name}`);
          }
        } catch (writeError: any) {
          log.error(`[Stdio Adapter] ❌ 写入同步错误: ${this.server.name}`, writeError);
          if (writeError.code === 'EPIPE') {
            log.error(`[Stdio Adapter] 💥 检测到同步EPIPE错误: ${this.server.name}`);
            this.connected = false;
            this.emitEvent(MCPEventType.SERVER_ERROR, null, `进程管道断开: ${writeError.message}`);
          }
          throw writeError;
        }
      } catch (error) {
        log.error(`[Stdio Adapter] ❌ 发送消息失败: ${this.server.name}`, error);
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }


  private setupProcessListeners(): void {
    if (!this.process) return;

    // 🔥 增强进程状态监控
    log.info(`[Stdio Adapter] 🔧 进程初始状态:`);
    log.info(`  - PID: ${this.process.pid}`);
    log.info(`  - killed: ${this.process.killed}`);
    log.info(`  - exitCode: ${this.process.exitCode}`);
    log.info(`  - connected: ${this.process.connected}`);

    // 处理标准输出
    let buffer = '';
    this.process.stdout?.on('data', (data: Buffer) => {
      const rawData = data.toString();
      
      buffer += rawData;
      
      // 处理完整的JSON消息
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (line.trim()) {
          // 🔥 过滤掉非JSON消息（如调试日志），只处理MCP协议消息
          const trimmedLine = line.trim();
          
          // 检查是否是JSON格式的MCP消息
          if (trimmedLine.startsWith('{') && trimmedLine.includes('"jsonrpc"')) {
            log.info(`[Stdio Adapter] 🔍 检测到MCP消息: ${this.server.name}`);
            log.info(`[Stdio Adapter] 📝 原始消息内容: ${trimmedLine.substring(0, 200)}${trimmedLine.length > 200 ? '...' : ''}`);
            try {
              const message = JSON.parse(trimmedLine);
              log.info(`[Stdio Adapter] ✅ 成功解析MCP消息:`, {
                id: message.id,
                method: message.method,
                hasResult: !!message.result,
                hasError: !!message.error,
                hasParams: !!message.params
              });
              log.info(`[Stdio Adapter] 📋 完整消息:`, message);
              this.handleMessage(message);
            } catch (error) {
              log.error(`[Stdio Adapter] ❌ MCP消息解析失败: ${this.server.name}`);
              log.error(`[Stdio Adapter] 📝 失败的消息: ${trimmedLine}`);
              log.error(`[Stdio Adapter] 💥 解析错误:`, error);
            }
          } else {
            // 🔥 非JSON消息当作调试日志处理，不尝试解析
            log.info(`[Stdio Adapter] 📝 服务器日志: ${this.server.name} - ${trimmedLine}`);
          }
        }
      }
    });

    // 🔥 增强stdout错误处理
    this.process.stdout?.on('error', (error) => {
      log.error(`[Stdio Adapter] ❌ stdout错误: ${this.server.name}`, error);
      this.connected = false;
      this.emitEvent(MCPEventType.SERVER_ERROR, null, `stdout错误: ${error.message}`);
    });

    this.process.stdout?.on('close', () => {
      log.info(`[Stdio Adapter] 🔴 stdout关闭: ${this.server.name}`);
      this.connected = false;
    });

    // 处理标准错误
    this.process.stderr?.on('data', (data: Buffer) => {
      const errorMsg = data.toString();
      log.error(`[Stdio Adapter] 📢 进程stderr输出: ${this.server.name}`);
      log.error(`  内容: ${errorMsg}`);

      // 🔥 分析常见错误模式
      if (errorMsg.includes('command not found') || errorMsg.includes('not found')) {
        log.error(`[Stdio Adapter] 💡 诊断: 命令未找到错误`);
      } else if (errorMsg.includes('permission denied') || errorMsg.includes('EACCES')) {
        log.error(`[Stdio Adapter] 💡 诊断: 权限错误`);
      } else if (errorMsg.includes('ENOENT')) {
        log.error(`[Stdio Adapter] 💡 诊断: 文件或目录不存在`);
      } else if (errorMsg.includes('npm ERR!')) {
        log.error(`[Stdio Adapter] 💡 诊断: npm错误`);
      }
    });

    // 处理进程退出
    this.process.on('exit', (code, signal) => {
      log.info(`[Stdio Adapter] 🔴 进程退出: ${this.server.name}, code: ${code}, signal: ${signal}`);
      if (code !== 0) {
        log.error(`[Stdio Adapter] ❌ 进程异常退出: ${this.server.name}, 退出码: ${code}`);
      }
      this.connected = false;
      this.emitEvent(MCPEventType.SERVER_DISCONNECTED);
    });

    // 处理进程错误
    this.process.on('error', (error) => {
      log.error(`[Stdio Adapter] ❌ 进程错误: ${this.server.name}`);
      log.error(`  - 错误类型: ${error.name}`);
      log.error(`  - 错误消息: ${error.message}`);
      log.error(`  - 错误代码: ${(error as any).code}`);
      log.error(`  - 错误路径: ${(error as any).path}`);
      log.error(`  - 完整错误:`, error);

      // 🔥 针对常见错误提供诊断信息
      if ((error as any).code === 'ENOENT') {
        log.error(`[Stdio Adapter] 💡 诊断: 命令未找到，可能原因:`);
        log.error(`  - npx命令不在PATH中`);
        log.error(`  - Node.js未正确安装`);
        log.error(`  - 打包后的应用无法访问系统命令`);
      } else if ((error as any).code === 'EACCES') {
        log.error(`[Stdio Adapter] 💡 诊断: 权限被拒绝，可能原因:`);
        log.error(`  - 文件没有执行权限`);
        log.error(`  - 工作目录权限不足`);
      }

      this.connected = false;
      this.emitEvent(MCPEventType.SERVER_ERROR, null, error.message);
    });

    // 监控进程状态
    this.process.on('spawn', () => {
      log.info(`[Stdio Adapter] ✅ 进程启动成功: ${this.server.name}, PID: ${this.process?.pid}`);
      log.info(`[Stdio Adapter] 🎯 进程spawn事件触发，开始MCP通信准备...`);
      log.info(`[Stdio Adapter] 🔍 spawn后进程状态检查:`);
      log.info(`  - PID: ${this.process?.pid}`);
      log.info(`  - stdin可写: ${!this.process?.stdin?.destroyed}`);
      log.info(`  - stdout可读: ${!this.process?.stdout?.destroyed}`);
      log.info(`  - stderr可读: ${!this.process?.stderr?.destroyed}`);
    });

    this.process.on('close', (code, signal) => {
      log.info(`[Stdio Adapter] 🔴 进程关闭: ${this.server.name}, code: ${code}, signal: ${signal}`);
    });

    // 🔥 增强stdin错误处理
    if (this.process.stdin) {
      this.process.stdin.on('error', (error: any) => {
        log.error(`[Stdio Adapter] ❌ stdin错误: ${this.server.name}`, error);
        log.error(`  - 错误类型: ${error.name}`);
        log.error(`  - 错误代码: ${error.code}`);
        log.error(`  - 错误消息: ${error.message}`);
        
        if ((error as any).code === 'EPIPE') {
          log.error(`[Stdio Adapter] 💥 stdin EPIPE错误 - 进程管道断开: ${this.server.name}`);
          this.connected = false;
          this.emitEvent(MCPEventType.SERVER_ERROR, null, `stdin管道断开: ${error.message}`);
        }
      });

      this.process.stdin.on('close', () => {
        log.info(`[Stdio Adapter] 🔴 stdin关闭: ${this.server.name}`);
        this.connected = false;
      });

      this.process.stdin.on('drain', () => {
        log.info(`[Stdio Adapter] 💧 stdin缓冲区已清空: ${this.server.name}`);
      });
    }

    // 启动健康检查
    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    // 每30秒检查一次进程健康状态
    this.healthCheckInterval = setInterval(() => {
      if (!this.process || this.process.killed || this.process.exitCode !== null) {
        log.warn(`[Stdio Adapter] ⚠️ 进程健康检查失败: ${this.server.name}`);
        this.connected = false;
        this.emitEvent(MCPEventType.SERVER_DISCONNECTED);

        // 停止健康检查
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
          this.healthCheckInterval = undefined;
        }
      }
    }, 30000); // 30秒检查一次
  }

  async disconnect(): Promise<void> {
    this.connected = false;

    // 停止健康检查
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // 清理所有待处理的请求
    for (const [, { reject, timeout }] of this.pendingRequests) {
      clearTimeout(timeout);
      reject(new Error('连接已断开'));
    }
    this.pendingRequests.clear();

    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
  }

  private handleMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      // 响应消息
      const { resolve, reject, timeout } = this.pendingRequests.get(message.id)!;
      clearTimeout(timeout);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || '请求失败'));
      } else {
        resolve(message.result);
      }
    } else if (message.method) {
      // 通知消息
      log.info(`[Stdio Adapter] 收到通知: ${message.method}`, message.params);
    }
  }

  private async waitForProcessReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error('进程未启动'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('进程启动超时'));
      }, 10000); // 10秒超时

      // 监听进程启动
      this.process.once('spawn', () => {
        clearTimeout(timeout);
        // 等待一小段时间确保进程完全启动
        setTimeout(resolve, 1000);
      });

      this.process.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 智能判断是否应该使用沙箱
   */
  private shouldUseSandbox(): boolean {
    log.info(`[Stdio Adapter] 🔍 开始智能沙箱检测: ${this.server.name}`);
    
    if (!this.server.command) {
      log.info(`[Stdio Adapter] ❌ 服务器命令为空，跳过沙箱检测`);
      return false;
    }

    // 1. 如果是明确的沙箱协议，直接使用沙箱
    if (this.server.command.startsWith('sandbox://')) {
      log.info(`[Stdio Adapter] ✅ 检测到明确的沙箱协议: ${this.server.command}`);
      return true;
    }

    // 2. 检测PromptX相关的命令和路径
    const command = this.server.command;
    const workingDirectory = this.server.workingDirectory || '';
    const args = this.server.args || [];
    
    log.info(`[Stdio Adapter] 📋 检测条件详情:`);
    log.info(`  - 命令: "${command}"`);
    log.info(`  - 工作目录: "${workingDirectory}"`);
    log.info(`  - 参数: [${args.map(arg => `"${arg}"`).join(', ')}]`);
    log.info(`  - 服务器名称: "${this.server.name}"`);
    log.info(`  - 服务器描述: "${this.server.description || ''}"`);
    
    // 逐项检测PromptX特征
    const conditions = {
      commandIncludesPromptx: command.includes('promptx'),
      workingDirIncludesPromptx: workingDirectory.includes('promptx'),
      argsIncludeMcpServer: args.includes('mcp-server'),
      nameIncludesPromptx: this.server.name.toLowerCase().includes('promptx'),
      descriptionIncludesPromptx: this.server.description?.toLowerCase().includes('promptx') || false,
      commandIncludesDpml: command.includes('dpml-prompt'),
      workingDirIncludesDpml: workingDirectory.includes('dpml-prompt')
    };
    
    log.info(`[Stdio Adapter] 🔍 PromptX特征检测结果:`);
    Object.entries(conditions).forEach(([key, value]) => {
      log.info(`  - ${key}: ${value ? '✅' : '❌'}`);
    });
    
    const isPromptXServer = Object.values(conditions).some(condition => condition);
    
    if (isPromptXServer) {
      log.info(`[Stdio Adapter] 🎯 检测到PromptX服务器特征，将使用沙箱模式`);
      return true;
    } else {
      log.info(`[Stdio Adapter] ⚠️ 未检测到PromptX特征，使用标准执行模式`);
    }

    // 3. 未来可以在这里添加其他需要沙箱的MCP服务器检测逻辑
    
    return false;
  }

  /**
   * 检测MCP服务器类型
   */
  private detectMCPType(): string {
    const command = this.server.command || '';
    const workingDirectory = this.server.workingDirectory || '';
    const args = this.server.args || [];
    
    // 检测PromptX
    if (
      command.includes('promptx') ||
      workingDirectory.includes('promptx') ||
      args.includes('mcp-server') ||
      this.server.name.toLowerCase().includes('promptx') ||
      this.server.description?.toLowerCase().includes('promptx') ||
      command.includes('dpml-prompt') ||
      workingDirectory.includes('dpml-prompt')
    ) {
      return 'promptx';
    }
    
    // 未来可以添加其他MCP服务器类型的检测
    
    throw new Error(`无法识别MCP服务器类型: ${this.server.name}`);
  }

  /**
   * 通过沙箱启动MCP服务器
   */
  private async connectViaSandbox(): Promise<void> {
    try {
      log.info(`[Stdio Adapter] 🏗️ 通过沙箱启动服务器: ${this.server.name}`);
      
      // 智能确定MCP类型和依赖包
      let mcpType: string;
      let dependencies: string[] = [];
      
      if (this.server.command?.startsWith('sandbox://')) {
        // 明确的沙箱协议
        mcpType = this.server.command.replace('sandbox://', '');
      } else {
        // 根据用户配置智能推断MCP类型
        mcpType = this.detectMCPType();
      }
      
      // 根据MCP类型确定依赖包
      switch (mcpType) {
        case 'promptx':
          dependencies = ['dpml-prompt@beta'];
          break;
        default:
          throw new Error(`不支持的沙箱MCP类型: ${mcpType}`);
      }
      
      log.info(`[Stdio Adapter] 📦 沙箱依赖包: ${dependencies.join(', ')}`);
      
      // 通过沙箱管理器启动MCP服务器
      this.process = await this.sandboxManager.startMCPServer(
        this.server,
        dependencies,
        {
          timeout: this.server.timeout || 30000
        }
      );
      
      log.info(`[Stdio Adapter] ✅ 沙箱启动成功, PID: ${this.process.pid}`);
      
      // 设置进程事件监听（复用现有逻辑）
      this.setupProcessListeners();
      
      // 等待进程准备就绪
      await this.waitForProcessReady();
      
      this.connected = true;
      log.info(`[Stdio Adapter] 🎉 沙箱连接成功: ${this.server.name}`);
      this.emitEvent(MCPEventType.SERVER_CONNECTED, { serverName: this.server.name });
      
    } catch (error) {
      log.error(`[Stdio Adapter] ❌ 沙箱启动失败: ${this.server.name}`, error);
      this.emitEvent(MCPEventType.SERVER_ERROR, null, error instanceof Error ? error.message : '沙箱启动失败');
      throw error;
    }
  }

}

/**
 * SSE传输适配器
 */
export class SSEMCPAdapter extends MCPTransportAdapter {
  private eventSource?: EventSource;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    log.info(`[SSE Adapter] 连接服务器: ${this.server.name}`);

    if (!this.server.url) {
      throw new Error('SSE服务器URL未配置');
    }

    try {
      // 注意：Node.js环境中需要使用polyfill或替代方案
      // 这里提供基本框架，实际实现可能需要使用fetch或其他HTTP客户端
      log.info(`[SSE Adapter] 连接到: ${this.server.url}`);
      
      // 模拟SSE连接
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.connected = true;
      log.info(`[SSE Adapter] 连接成功: ${this.server.name}`);
      this.emitEvent(MCPEventType.SERVER_CONNECTED, { serverName: this.server.name });

    } catch (error) {
      log.error(`[SSE Adapter] 连接失败: ${this.server.name}`, error);
      this.emitEvent(MCPEventType.SERVER_ERROR, null, error instanceof Error ? error.message : '连接失败');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    log.info(`[SSE Adapter] 断开连接: ${this.server.name}`);

    // 清理待处理的请求
    for (const [, { reject, timeout }] of this.pendingRequests.entries()) {
      clearTimeout(timeout);
      reject(new Error('连接已断开'));
    }
    this.pendingRequests.clear();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }

    this.connected = false;
    log.info(`[SSE Adapter] 断开连接完成: ${this.server.name}`);
    this.emitEvent(MCPEventType.SERVER_DISCONNECTED);
  }

  async sendRequest(request: any): Promise<any> {
    if (!this.connected) {
      throw new Error('未连接到服务器');
    }

    const id = ++this.requestId;
    log.info(`[SSE Adapter] 发送请求 ${id}:`, request.method);

    // SSE通常是单向的，这里需要实现双向通信
    // 可能需要使用WebSocket或HTTP POST + SSE的组合
    
    // 模拟请求处理
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: `SSE模拟响应: ${request.method}` });
      }, 500);
    });
  }
}
