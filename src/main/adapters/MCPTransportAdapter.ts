/**
 * MCP传输适配器基类和实现
 * 支持Stdio和SSE两种传输方式
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { MCPServerEntity } from '../../shared/entities/MCPServerEntity.js';
import {
  IMCPTransportAdapter,
  MCPEvent,
  MCPEventType
} from '../../shared/interfaces/IMCPProvider.js';

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

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    console.log(`[Stdio Adapter] 连接服务器: ${this.server.name}`);

    if (!this.server.command) {
      throw new Error('Stdio服务器命令未配置');
    }

    try {
      // 解析命令和参数
      const commandParts = this.server.command.trim().split(' ');
      const command = commandParts[0];
      const args = [...commandParts.slice(1), ...(this.server.args || [])];

      console.log(`[Stdio Adapter] 🚀 启动进程: ${command} ${args.join(' ')}`);
      console.log(`[Stdio Adapter] 🔧 工作目录: ${this.server.workingDirectory || '未设置'}`);
      console.log(`[Stdio Adapter] 🔧 当前进程环境信息:`);
      console.log(`  - Node版本: ${process.version}`);
      console.log(`  - 平台: ${process.platform}`);
      console.log(`  - 架构: ${process.arch}`);
      console.log(`  - 是否打包: ${process.env.NODE_ENV === 'production' ? '是' : '否'}`);
      console.log(`  - 当前PATH: ${process.env.PATH?.substring(0, 200)}...`);

      // 🔥 检测Node.js工具链可用性
      console.log(`[Stdio Adapter] 🔧 检测Node.js工具链可用性:`);
      try {
        const { execSync } = require('child_process');

        // 检测node
        try {
          const nodeVersion = execSync('node --version', { encoding: 'utf8', timeout: 3000 }).trim();
          console.log(`  - node命令: ✅ 可用 (${nodeVersion})`);
        } catch (e) {
          console.log(`  - node命令: ❌ 不可用`);
        }

        // 检测npm
        try {
          const npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 3000 }).trim();
          console.log(`  - npm命令: ✅ 可用 (${npmVersion})`);
        } catch (e) {
          console.log(`  - npm命令: ❌ 不可用`);
        }

        // 检测npx
        try {
          const npxVersion = execSync('npx --version', { encoding: 'utf8', timeout: 3000 }).trim();
          console.log(`  - npx命令: ✅ 可用 (${npxVersion})`);
        } catch (e) {
          console.log(`  - npx命令: ❌ 不可用`);
        }

        // 检测which命令
        try {
          const whichNode = execSync('which node', { encoding: 'utf8', timeout: 3000 }).trim();
          console.log(`  - node路径: ${whichNode}`);
        } catch (e) {
          console.log(`  - node路径: ❌ 无法获取`);
        }

      } catch (error) {
        console.error(`[Stdio Adapter] ❌ 工具链检测失败:`, error);
      }

      // 🔥 确保工作目录存在（特别是PromptX需要）
      if (this.server.workingDirectory) {
        const fs = require('fs');
        try {
          console.log(`[Stdio Adapter] 🔧 检查工作目录: ${this.server.workingDirectory}`);
          if (!fs.existsSync(this.server.workingDirectory)) {
            console.log(`[Stdio Adapter] 🔧 工作目录不存在，开始创建...`);
            fs.mkdirSync(this.server.workingDirectory, { recursive: true, mode: 0o755 });
            console.log(`[Stdio Adapter] ✅ 创建工作目录: ${this.server.workingDirectory}`);
          } else {
            console.log(`[Stdio Adapter] ✅ 工作目录已存在: ${this.server.workingDirectory}`);
          }
          // 验证权限
          fs.accessSync(this.server.workingDirectory, fs.constants.R_OK | fs.constants.W_OK);
          console.log(`[Stdio Adapter] ✅ 工作目录权限验证通过: ${this.server.workingDirectory}`);
        } catch (error) {
          console.error(`[Stdio Adapter] ❌ 工作目录准备失败: ${this.server.workingDirectory}`, error);
          throw error;
        }
      }

      // 🔥 改进npx命令处理，提供多种fallback机制
      let finalCommand = command;
      let finalArgs = args;
      let useShell = command === 'npx' || command.includes('npx');

      // 🔥 对于npx命令，使用智能解析
      if (command === 'npx') {
        console.log(`[Stdio Adapter] 🔧 检测到npx命令，开始智能解析...`);
        try {
          const npxResult = await this.resolveNpxCommand(args);
          if (npxResult.success) {
            finalCommand = npxResult.command;
            finalArgs = npxResult.args;
            useShell = npxResult.useShell;
            console.log(`[Stdio Adapter] ✅ npx解析成功: ${finalCommand} ${finalArgs.join(' ')}`);
          } else {
            console.warn(`[Stdio Adapter] ⚠️ npx解析失败，使用原始命令: ${npxResult.error}`);
          }
        } catch (error) {
          console.error(`[Stdio Adapter] ❌ npx解析过程出错:`, error);
          console.log(`[Stdio Adapter] 🔄 回退到原始npx命令`);
        }
      }

      console.log(`[Stdio Adapter] 🔧 最终命令: ${finalCommand}, 参数: [${finalArgs.join(', ')}], 使用shell: ${useShell}`);

      // 🔥 增强的环境变量设置，确保Node.js工具链在打包后的应用中可用
      const enhancedEnv = {
        ...process.env,
        ...this.server.env,
        // 🔥 修复：确保PATH包含常见的Node.js安装路径，特别是打包后的应用
        PATH: this.buildEnhancedPath(),
        // 🔥 修复：确保npm配置可用
        npm_config_cache: process.env.npm_config_cache || (process.env.HOME ? `${process.env.HOME}/.npm` : undefined),
        // 🔥 修复：设置Node.js选项，避免打包后的权限问题
        NODE_OPTIONS: '--max-old-space-size=4096'
      };

      const spawnOptions = {
        stdio: ['pipe', 'pipe', 'pipe'] as ['pipe', 'pipe', 'pipe'],
        env: enhancedEnv,
        shell: useShell,
        cwd: this.server.workingDirectory // 🔥 设置工作目录
      };

      console.log(`[Stdio Adapter] 🔧 Spawn选项详情:`);
      console.log(`  - 命令: ${command}`);
      console.log(`  - 参数: [${args.join(', ')}]`);
      console.log(`  - 工作目录: ${spawnOptions.cwd}`);
      console.log(`  - 使用shell: ${spawnOptions.shell}`);
      console.log(`  - 环境变量数量: ${Object.keys(enhancedEnv).length}`);
      console.log(`  - 增强后PATH前200字符: ${enhancedEnv.PATH?.substring(0, 200)}...`);

      console.log(`[Stdio Adapter] 🚀 开始执行spawn...`);
      try {
        this.process = spawn(command, args, spawnOptions);
        console.log(`[Stdio Adapter] ✅ spawn执行成功，PID: ${this.process.pid}`);
      } catch (spawnError) {
        console.error(`[Stdio Adapter] ❌ spawn执行失败:`, spawnError);
        throw spawnError;
      }

      // 设置进程事件监听
      console.log(`[Stdio Adapter] 🔧 设置进程事件监听...`);
      this.setupProcessListeners();

      // 等待进程启动
      console.log(`[Stdio Adapter] ⏳ 等待进程启动...`);
      try {
        await this.waitForProcessReady();
        console.log(`[Stdio Adapter] ✅ 进程启动完成`);
      } catch (readyError) {
        console.error(`[Stdio Adapter] ❌ 进程启动失败:`, readyError);
        throw readyError;
      }

      this.connected = true;
      console.log(`[Stdio Adapter] 连接成功: ${this.server.name}`);
      this.emitEvent(MCPEventType.SERVER_CONNECTED, { serverName: this.server.name });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '连接失败';
      console.error(`[Stdio Adapter] 连接失败: ${this.server.name}`, error);

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
    console.log(`[Stdio Adapter] 🔧 检查发送请求条件: ${this.server.name}`);
    console.log(`  - 连接状态: ${this.connected}`);
    console.log(`  - 进程存在: ${!!this.process}`);
    console.log(`  - 进程PID: ${this.process?.pid}`);
    console.log(`  - 进程已退出: ${this.process?.killed}`);
    console.log(`  - 进程退出码: ${this.process?.exitCode}`);

    if (!this.connected) {
      console.error(`[Stdio Adapter] ❌ 适配器未连接: ${this.server.name}`);
      throw new Error('适配器未连接');
    }

    if (!this.process) {
      console.error(`[Stdio Adapter] ❌ 进程不存在: ${this.server.name}`);
      this.connected = false;
      throw new Error('进程不存在');
    }

    if (this.process.killed || this.process.exitCode !== null) {
      console.error(`[Stdio Adapter] ❌ 进程已退出: ${this.server.name}, 退出码: ${this.process.exitCode}`);
      this.connected = false;
      throw new Error(`进程已退出，退出码: ${this.process.exitCode}`);
    }

    const id = ++this.requestId;
    const message = {
      jsonrpc: '2.0',
      id,
      ...request
    };

    console.log(`[Stdio Adapter] 发送请求 ${id}:`, request.method);

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
        console.log(`[Stdio Adapter] 📤 发送消息到 ${this.server.name}: ${message.method}`);

        // 添加写入错误处理
        const writeResult = this.process.stdin.write(messageStr);
        if (!writeResult) {
          console.warn(`[Stdio Adapter] ⚠️ 写入缓冲区已满: ${this.server.name}`);
        }
      } catch (error) {
        console.error(`[Stdio Adapter] ❌ 发送消息失败: ${this.server.name}`, error);
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * 🔥 构建增强的PATH环境变量，解决打包后的路径问题
   */
  private buildEnhancedPath(): string {
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const currentPath = process.env.PATH || '';

    // 常见的Node.js安装路径
    const commonPaths = [
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin'
    ];

    // 用户特定的路径
    const userPaths = [];
    if (process.env.HOME) {
      userPaths.push(
        `${process.env.HOME}/.npm/bin`,
        `${process.env.HOME}/.yarn/bin`,
        `${process.env.HOME}/.local/bin`
      );
    }

    // Windows特定路径
    if (process.platform === 'win32') {
      if (process.env.APPDATA) {
        userPaths.push(`${process.env.APPDATA}\\npm`);
      }
      if (process.env.LOCALAPPDATA) {
        userPaths.push(`${process.env.LOCALAPPDATA}\\Yarn\\bin`);
      }
    }

    // 合并所有路径，去重
    const allPaths = [currentPath, ...commonPaths, ...userPaths]
      .filter(Boolean)
      .filter((path, index, arr) => arr.indexOf(path) === index);

    return allPaths.join(pathSeparator);
  }

  private setupProcessListeners(): void {
    if (!this.process) return;

    // 处理标准输出
    let buffer = '';
    this.process.stdout?.on('data', (data: Buffer) => {
      const rawData = data.toString();
      console.log(`[Stdio Adapter] 🔍 收到stdout数据: ${this.server.name}`);
      console.log(`  原始数据长度: ${rawData.length} 字节`);
      console.log(`  原始数据内容: ${JSON.stringify(rawData)}`);
      
      buffer += rawData;
      
      // 处理完整的JSON消息
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      console.log(`[Stdio Adapter] 🔍 分割后行数: ${lines.length}`);
      
      for (const line of lines) {
        if (line.trim()) {
          console.log(`[Stdio Adapter] 🔍 处理行: ${JSON.stringify(line.trim())}`);
          try {
            const message = JSON.parse(line);
            console.log(`[Stdio Adapter] ✅ 成功解析消息:`, message);
            this.handleMessage(message);
          } catch (error) {
            console.warn(`[Stdio Adapter] ❌ 解析消息失败:`, line, error);
          }
        }
      }
    });

    // 处理标准错误
    this.process.stderr?.on('data', (data: Buffer) => {
      const errorMsg = data.toString();
      console.error(`[Stdio Adapter] 📢 进程stderr输出: ${this.server.name}`);
      console.error(`  内容: ${errorMsg}`);

      // 🔥 分析常见错误模式
      if (errorMsg.includes('command not found') || errorMsg.includes('not found')) {
        console.error(`[Stdio Adapter] 💡 诊断: 命令未找到错误`);
      } else if (errorMsg.includes('permission denied') || errorMsg.includes('EACCES')) {
        console.error(`[Stdio Adapter] 💡 诊断: 权限错误`);
      } else if (errorMsg.includes('ENOENT')) {
        console.error(`[Stdio Adapter] 💡 诊断: 文件或目录不存在`);
      } else if (errorMsg.includes('npm ERR!')) {
        console.error(`[Stdio Adapter] 💡 诊断: npm错误`);
      }
    });

    // 处理进程退出
    this.process.on('exit', (code, signal) => {
      console.log(`[Stdio Adapter] 🔴 进程退出: ${this.server.name}, code: ${code}, signal: ${signal}`);
      if (code !== 0) {
        console.error(`[Stdio Adapter] ❌ 进程异常退出: ${this.server.name}, 退出码: ${code}`);
      }
      this.connected = false;
      this.emitEvent(MCPEventType.SERVER_DISCONNECTED);
    });

    // 处理进程错误
    this.process.on('error', (error) => {
      console.error(`[Stdio Adapter] ❌ 进程错误: ${this.server.name}`);
      console.error(`  - 错误类型: ${error.name}`);
      console.error(`  - 错误消息: ${error.message}`);
      console.error(`  - 错误代码: ${(error as any).code}`);
      console.error(`  - 错误路径: ${(error as any).path}`);
      console.error(`  - 完整错误:`, error);

      // 🔥 针对常见错误提供诊断信息
      if ((error as any).code === 'ENOENT') {
        console.error(`[Stdio Adapter] 💡 诊断: 命令未找到，可能原因:`);
        console.error(`  - npx命令不在PATH中`);
        console.error(`  - Node.js未正确安装`);
        console.error(`  - 打包后的应用无法访问系统命令`);
      } else if ((error as any).code === 'EACCES') {
        console.error(`[Stdio Adapter] 💡 诊断: 权限被拒绝，可能原因:`);
        console.error(`  - 文件没有执行权限`);
        console.error(`  - 工作目录权限不足`);
      }

      this.connected = false;
      this.emitEvent(MCPEventType.SERVER_ERROR, null, error.message);
    });

    // 监控进程状态
    this.process.on('spawn', () => {
      console.log(`[Stdio Adapter] ✅ 进程启动成功: ${this.server.name}, PID: ${this.process?.pid}`);
    });

    this.process.on('close', (code, signal) => {
      console.log(`[Stdio Adapter] 🔴 进程关闭: ${this.server.name}, code: ${code}, signal: ${signal}`);
    });

    // 监听stdin错误
    if (this.process.stdin) {
      this.process.stdin.on('error', (error) => {
        console.error(`[Stdio Adapter] ❌ stdin错误: ${this.server.name}`, error);
        // 不要抛出错误，只记录日志
      });

      this.process.stdin.on('close', () => {
        console.log(`[Stdio Adapter] 🔴 stdin关闭: ${this.server.name}`);
      });
    }

    // 启动健康检查
    this.startHealthCheck();
  }

  private startHealthCheck(): void {
    // 每30秒检查一次进程健康状态
    this.healthCheckInterval = setInterval(() => {
      if (!this.process || this.process.killed || this.process.exitCode !== null) {
        console.warn(`[Stdio Adapter] ⚠️ 进程健康检查失败: ${this.server.name}`);
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
      console.log(`[Stdio Adapter] 收到通知: ${message.method}`, message.params);
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
   * 🔥 解析npx命令，提供多种fallback机制
   */
  private async resolveNpxCommand(args: string[]): Promise<{
    success: boolean;
    command: string;
    args: string[];
    useShell: boolean;
    error?: string;
  }> {
    console.log(`[Stdio Adapter] 🔧 开始解析npx命令，参数: [${args.join(', ')}]`);

    // 方法1: 尝试直接使用npx
    try {
      const { execSync } = require('child_process');
      const npxPath = execSync('which npx', { encoding: 'utf8', timeout: 3000 }).trim();
      if (npxPath) {
        console.log(`[Stdio Adapter] ✅ 找到npx路径: ${npxPath}`);
        return {
          success: true,
          command: npxPath,
          args: args,
          useShell: false
        };
      }
    } catch (error) {
      console.warn(`[Stdio Adapter] ⚠️ 方法1失败 - which npx:`, error);
    }

    // 方法2: 尝试使用npm exec
    try {
      const { execSync } = require('child_process');
      const npmPath = execSync('which npm', { encoding: 'utf8', timeout: 3000 }).trim();
      if (npmPath) {
        console.log(`[Stdio Adapter] ✅ 找到npm路径，使用npm exec: ${npmPath}`);
        return {
          success: true,
          command: npmPath,
          args: ['exec', '--', ...args],
          useShell: false
        };
      }
    } catch (error) {
      console.warn(`[Stdio Adapter] ⚠️ 方法2失败 - npm exec:`, error);
    }

    // 方法3: 尝试直接使用node + 包路径
    if (args.length > 0) {
      const packageName = args[0];
      try {
        const { execSync } = require('child_process');
        // 尝试获取全局包路径
        const globalPath = execSync('npm root -g', { encoding: 'utf8', timeout: 3000 }).trim();
        const packagePath = require('path').join(globalPath, packageName, 'bin');

        if (require('fs').existsSync(packagePath)) {
          console.log(`[Stdio Adapter] ✅ 找到全局包路径: ${packagePath}`);
          return {
            success: true,
            command: 'node',
            args: [packagePath, ...args.slice(1)],
            useShell: false
          };
        }
      } catch (error) {
        console.warn(`[Stdio Adapter] ⚠️ 方法3失败 - 全局包路径:`, error);
      }
    }

    // 方法4: 使用shell执行npx（最后的fallback）
    console.log(`[Stdio Adapter] 🔄 使用shell fallback执行npx`);
    return {
      success: true,
      command: 'npx',
      args: args,
      useShell: true
    };
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

    console.log(`[SSE Adapter] 连接服务器: ${this.server.name}`);

    if (!this.server.url) {
      throw new Error('SSE服务器URL未配置');
    }

    try {
      // 注意：Node.js环境中需要使用polyfill或替代方案
      // 这里提供基本框架，实际实现可能需要使用fetch或其他HTTP客户端
      console.log(`[SSE Adapter] 连接到: ${this.server.url}`);
      
      // 模拟SSE连接
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.connected = true;
      console.log(`[SSE Adapter] 连接成功: ${this.server.name}`);
      this.emitEvent(MCPEventType.SERVER_CONNECTED, { serverName: this.server.name });

    } catch (error) {
      console.error(`[SSE Adapter] 连接失败: ${this.server.name}`, error);
      this.emitEvent(MCPEventType.SERVER_ERROR, null, error instanceof Error ? error.message : '连接失败');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    console.log(`[SSE Adapter] 断开连接: ${this.server.name}`);

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
    console.log(`[SSE Adapter] 断开连接完成: ${this.server.name}`);
    this.emitEvent(MCPEventType.SERVER_DISCONNECTED);
  }

  async sendRequest(request: any): Promise<any> {
    if (!this.connected) {
      throw new Error('未连接到服务器');
    }

    const id = ++this.requestId;
    console.log(`[SSE Adapter] 发送请求 ${id}:`, request.method);

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
