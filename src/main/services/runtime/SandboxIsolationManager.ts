/**
 * 沙箱隔离管理器
 * 参考鲁班ToolSandbox的隔离机制，为MCP子进程提供完全隔离的运行环境
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createRequire } from 'module';
import log from 'electron-log';

export interface SandboxOptions {
  enableDependencyLoading?: boolean;
  enableBuiltinModules?: boolean;
  enableFileSystemAccess?: boolean;
  analysisMode?: boolean;
  timeout?: number;
}

export interface SandboxEnvironment {
  NODE_PATH: string;
  PATH: string;
  HOME?: string;
  USERPROFILE?: string;
  [key: string]: string | undefined;
}

/**
 * 沙箱隔离管理器 - 核心隔离逻辑
 */
export class SandboxIsolationManager {
  private sandboxPath: string;
  private options: Required<SandboxOptions>;
  private nodeCommand: string;

  constructor(sandboxPath: string, nodeCommand: string, options: SandboxOptions = {}) {
    this.sandboxPath = sandboxPath;
    this.nodeCommand = nodeCommand;
    this.options = {
      enableDependencyLoading: true,
      enableBuiltinModules: true,
      enableFileSystemAccess: false,
      analysisMode: false,
      timeout: 30000,
      ...options
    };

    log.info(`[SandboxIsolation] 初始化沙箱隔离管理器: ${sandboxPath}`);
  }

  /**
   * 确保沙箱目录结构存在
   */
  async ensureSandboxStructure(): Promise<void> {
    try {
      // 创建主沙箱目录
      await fs.mkdir(this.sandboxPath, { recursive: true });
      
      // 创建node_modules目录
      const nodeModulesPath = join(this.sandboxPath, 'node_modules');
      await fs.mkdir(nodeModulesPath, { recursive: true });
      
      log.info(`[SandboxIsolation] 沙箱目录结构已创建: ${this.sandboxPath}`);
    } catch (error) {
      throw new Error(`创建沙箱目录失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 创建沙箱package.json
   */
  async createSandboxPackageJson(dependencies: string[] = []): Promise<void> {
    const packageJsonPath = join(this.sandboxPath, 'package.json');
    
    const packageJson = {
      name: `deechat-sandbox-${Date.now()}`,
      version: '1.0.0',
      description: 'DeeChat MCP Sandbox Environment',
      private: true,
      dependencies: {} as Record<string, string>
    };

    // 解析依赖格式 ["package@version", "package"]
    for (const dep of dependencies) {
      if (dep.includes('@')) {
        const atIndex = dep.lastIndexOf('@'); // 处理@scoped/package@version的情况
        const name = dep.substring(0, atIndex);
        const version = dep.substring(atIndex + 1);
        packageJson.dependencies[name] = version;
      } else {
        packageJson.dependencies[dep] = 'latest';
      }
    }

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    log.info(`[SandboxIsolation] 创建package.json，依赖数量: ${Object.keys(packageJson.dependencies).length}`);
  }

  /**
   * 在沙箱中安装依赖
   */
  async installDependencies(): Promise<void> {
    const packageJsonPath = join(this.sandboxPath, 'package.json');
    
    try {
      // 检查package.json是否存在
      await fs.access(packageJsonPath);
    } catch (error) {
      log.warn(`[SandboxIsolation] package.json不存在，跳过依赖安装`);
      return;
    }

    log.info(`[SandboxIsolation] 开始在沙箱中安装依赖...`);

    return new Promise((resolve, reject) => {
      // 使用系统npm/yarn安装依赖
      const installProcess = spawn('npm', ['install'], {
        cwd: this.sandboxPath,
        stdio: 'pipe',
        env: this.createIsolatedEnvironment()
      });

      let stdout = '';
      let stderr = '';

      installProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      installProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      installProcess.on('close', (code) => {
        if (code === 0) {
          log.info(`[SandboxIsolation] 依赖安装成功`);
          resolve();
        } else {
          log.error(`[SandboxIsolation] 依赖安装失败 (code: ${code}): ${stderr}`);
          reject(new Error(`依赖安装失败: ${stderr}`));
        }
      });

      installProcess.on('error', (error) => {
        log.error(`[SandboxIsolation] 启动npm进程失败:`, error);
        reject(new Error(`启动npm进程失败: ${error.message}`));
      });

      // 设置超时
      setTimeout(() => {
        installProcess.kill();
        reject(new Error('依赖安装超时'));
      }, this.options.timeout);
    });
  }

  /**
   * 创建隔离的环境变量
   */
  createIsolatedEnvironment(): SandboxEnvironment {
    const env: SandboxEnvironment = {
      // Node.js模块路径隔离
      NODE_PATH: join(this.sandboxPath, 'node_modules'),
      
      // PATH隔离 - 只包含必要的系统路径
      PATH: this.buildIsolatedPath(),
      
      // 沙箱标识
      DEECHAT_SANDBOX: 'true',
      DEECHAT_SANDBOX_PATH: this.sandboxPath,
      
      // 保留必要的系统环境变量
      NODE_ENV: process.env.NODE_ENV || 'production',
      
      // 🔥 为PromptX提供更多必要的环境变量
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
      SHELL: process.env.SHELL || '/bin/bash',
      
      // 🔥 改进文件系统访问权限
      ...(this.options.enableFileSystemAccess ? {
        // 允许访问用户文档目录
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        // 允许访问常用目录
        TMPDIR: process.env.TMPDIR || '/tmp',
        // 保持原始工作目录访问权限
        PWD: process.cwd()
      } : {
        HOME: this.sandboxPath,
        USERPROFILE: this.sandboxPath
      })
    };

    // 在分析模式下添加特殊标识
    if (this.options.analysisMode) {
      env.DEECHAT_ANALYSIS_MODE = 'true';
    }

    return env;
  }

  /**
   * 构建隔离的PATH环境变量
   */
  private buildIsolatedPath(): string {
    const systemPaths = [
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin'
    ];

    // Windows系统路径
    if (process.platform === 'win32') {
      systemPaths.push(
        'C:\\Windows\\System32',
        'C:\\Windows',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0'
      );
    }

    // 🔥 添加Node.js和npm路径（从当前环境中获取）
    if (process.env.PATH) {
      const currentPaths = process.env.PATH.split(process.platform === 'win32' ? ';' : ':');
      
      // 查找包含node、npm的路径
      const nodePaths = currentPaths.filter(path => 
        path.includes('node') || 
        path.includes('npm') || 
        path.includes('.nvm') ||
        path.includes('bin')
      );
      
      // 添加这些路径到沙箱PATH中
      systemPaths.push(...nodePaths);
    }

    // 添加沙箱node_modules/.bin路径
    const sandboxBinPath = join(this.sandboxPath, 'node_modules', '.bin');
    systemPaths.unshift(sandboxBinPath);

    return systemPaths.join(process.platform === 'win32' ? ';' : ':');
  }

  /**
   * 创建隔离的require函数（参考鲁班实现）
   */
  createIsolatedRequire(): NodeRequire {
    // 使用Module.createRequire绑定到沙箱上下文
    const contextFile = join(this.sandboxPath, 'package.json');
    let sandboxRequire: NodeRequire;
    
    try {
      sandboxRequire = createRequire(contextFile);
    } catch (error) {
      // fallback: 使用虚拟路径
      const virtualContextFile = join(this.sandboxPath, 'virtual-context.js');
      sandboxRequire = createRequire(virtualContextFile);
    }

    // 返回增强的require函数
    return ((moduleName: string) => {
      try {
        // 优先使用沙箱require
        return sandboxRequire(moduleName);
      } catch (error) {
        // 智能fallback处理
        return this.handleRequireFallback(moduleName, error as Error);
      }
    }) as NodeRequire;
  }

  /**
   * 处理require失败的智能fallback
   */
  private handleRequireFallback(moduleName: string, error: Error): any {
    // 1. 尝试加载Node.js内置模块
    if (this.options.enableBuiltinModules && this.isBuiltinModule(moduleName)) {
      try {
        return require(moduleName);
      } catch (builtinError) {
        log.warn(`[SandboxIsolation] 内置模块加载失败: ${moduleName}`);
      }
    }

    // 2. 如果是分析阶段且模块不存在，返回mock对象
    if (this.options.analysisMode && this.isModuleNotFoundError(error)) {
      log.info(`[SandboxIsolation] 分析模式：mock模块 ${moduleName}`);
      return this.createMockModule(moduleName);
    }

    // 3. 其他情况直接抛出原始错误
    throw error;
  }

  /**
   * 检查是否为Node.js内置模块
   */
  private isBuiltinModule(moduleName: string): boolean {
    const builtinModules = [
      'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram',
      'dns', 'domain', 'events', 'fs', 'http', 'https', 'net', 'os',
      'path', 'punycode', 'querystring', 'readline', 'repl', 'stream',
      'string_decoder', 'sys', 'timers', 'tls', 'tty', 'url', 'util',
      'vm', 'zlib'
    ];
    
    return builtinModules.includes(moduleName) || moduleName.startsWith('node:');
  }

  /**
   * 检查是否为模块未找到错误
   */
  private isModuleNotFoundError(error: Error): boolean {
    return error.message.includes('Cannot find module') || 
           error.message.includes('MODULE_NOT_FOUND');
  }

  /**
   * 创建mock模块对象
   */
  private createMockModule(_moduleName: string): any {
    return new Proxy({}, {
      get: () => () => ({}),  // 所有属性和方法都返回空函数/对象
      apply: () => ({}),      // 如果被当作函数调用
      construct: () => ({})   // 如果被当作构造函数
    });
  }

  /**
   * 在沙箱中启动子进程
   */
  async spawnInSandbox(
    command: string, 
    args: string[] = [], 
    options: any = {}
  ): Promise<ChildProcess> {
    
    // 🔥 修复Node.js命令执行逻辑
    let actualCommand: string;
    let actualArgs: string[];
    
    if (command === 'node' || command.endsWith('node') || command.endsWith('node.exe')) {
      // 如果command是node，直接使用nodeCommand，args保持不变
      actualCommand = this.nodeCommand;
      actualArgs = [...args]; // 复制数组以避免修改原始参数
      log.info(`[SandboxIsolation] 使用沙箱Node.js执行: ${actualCommand}`);
      log.info(`[SandboxIsolation] 参数: [${actualArgs.map(arg => `"${arg}"`).join(', ')}]`);
    } else {
      // 其他命令，通过Node.js执行
      actualCommand = this.nodeCommand;
      actualArgs = [command, ...args];
      log.info(`[SandboxIsolation] 通过Node.js执行: ${actualCommand}`);
      log.info(`[SandboxIsolation] 参数: [${actualArgs.map(arg => `"${arg}"`).join(', ')}]`);
    }
    
    // 🔥 确保参数是字符串数组，防止参数传递问题
    const safeArgs = actualArgs.map(arg => String(arg).trim()).filter(arg => arg.length > 0);
    
    log.info(`[SandboxIsolation] 最终执行命令: ${actualCommand}`);
    log.info(`[SandboxIsolation] 最终参数: [${safeArgs.map(arg => `"${arg}"`).join(', ')}]`);
    
    // 🔥 验证第一个参数是否为有效的脚本文件
    if (safeArgs.length > 0 && command === 'node') {
      const scriptPath = safeArgs[0];
      try {
        const fs = require('fs');
        if (fs.existsSync(scriptPath)) {
          log.info(`[SandboxIsolation] ✅ 验证脚本文件存在: ${scriptPath}`);
        } else {
          log.error(`[SandboxIsolation] ❌ 脚本文件不存在: ${scriptPath}`);
        }
      } catch (error) {
        log.warn(`[SandboxIsolation] ⚠️ 无法验证脚本文件: ${scriptPath}`, error);
      }
    }
    
    const childProcess = spawn(actualCommand, safeArgs, {
      cwd: options.cwd || this.sandboxPath, // 优先使用传入的工作目录
      env: this.createIsolatedEnvironment(),
      stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
      ...options
    });

    log.info(`[SandboxIsolation] 在沙箱中启动子进程: ${actualCommand} ${safeArgs.join(' ')}`);
    
    // 记录进程信息
    childProcess.on('spawn', () => {
      log.info(`[SandboxIsolation] 子进程已启动，PID: ${childProcess.pid}`);
    });

    childProcess.on('error', (error) => {
      log.error(`[SandboxIsolation] 子进程错误:`, error);
    });

    childProcess.on('exit', (code, signal) => {
      log.info(`[SandboxIsolation] 子进程退出，code: ${code}, signal: ${signal}`);
    });

    // 🔥 添加子进程输出监听来调试问题
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          log.error(`[SandboxIsolation] 子进程stderr: ${output}`);
        }
      });
    }
    
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output && !output.includes('Content-Length:')) { // 过滤MCP协议消息
          log.info(`[SandboxIsolation] 子进程stdout: ${output}`);
        }
      });
    }

    return childProcess;
  }

  /**
   * 检查沙箱是否已准备就绪
   */
  async isSandboxReady(): Promise<boolean> {
    try {
      // 检查沙箱目录
      await fs.access(this.sandboxPath);
      
      // 检查package.json
      const packageJsonPath = join(this.sandboxPath, 'package.json');
      await fs.access(packageJsonPath);
      
      // 检查node_modules（如果有依赖的话）
      const nodeModulesPath = join(this.sandboxPath, 'node_modules');
      const nodeModulesExists = await fs.access(nodeModulesPath).then(() => true).catch(() => false);
      
      return nodeModulesExists;
    } catch (error) {
      return false;
    }
  }

  /**
   * 清理沙箱环境
   */
  async cleanup(): Promise<void> {
    try {
      log.info(`[SandboxIsolation] 清理沙箱环境: ${this.sandboxPath}`);
      
      // 可选择性删除沙箱目录（谨慎操作）
      // await fs.rmdir(this.sandboxPath, { recursive: true });
      
      log.info(`[SandboxIsolation] 沙箱环境清理完成`);
    } catch (error) {
      log.error(`[SandboxIsolation] 沙箱清理失败:`, error);
    }
  }

  /**
   * 获取沙箱状态信息
   */
  async getSandboxStatus() {
    const isReady = await this.isSandboxReady();
    
    return {
      sandboxPath: this.sandboxPath,
      nodeCommand: this.nodeCommand,
      options: this.options,
      isReady,
      timestamp: new Date().toISOString()
    };
  }
}