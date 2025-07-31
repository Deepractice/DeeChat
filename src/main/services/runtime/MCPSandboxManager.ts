/**
 * MCP沙箱管理器
 * 统一管理所有MCP服务器的沙箱环境，解决用户无Node环境问题
 */

import { app } from 'electron';
import { join } from 'path';
import { ChildProcess } from 'child_process';
import log from 'electron-log';

import { NodeRuntimeManager } from './NodeRuntimeManager';
import { SandboxIsolationManager } from './SandboxIsolationManager';
import { MCPServerEntity } from '../../../shared/entities/MCPServerEntity';

export interface MCPSandboxInfo {
  id: string;
  path: string;
  isReady: boolean;
  nodeCommand: string;
  dependencies: string[];
  createdAt: Date;
  lastUsed: Date;
}

export interface SandboxStartOptions {
  timeout?: number;
  forceReinstall?: boolean;
  analysisMode?: boolean;
}

/**
 * MCP沙箱实例
 */
class MCPSandbox {
  public readonly id: string;
  public readonly path: string;
  private isolationManager: SandboxIsolationManager;
  private nodeCommand: string;
  private isInitialized: boolean = false;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(id: string, path: string, nodeCommand: string) {
    this.id = id;
    this.path = path;
    this.nodeCommand = nodeCommand;
    
    // 🔥 为PromptX服务器启用文件系统访问权限
    const sandboxOptions = {
      enableDependencyLoading: true,
      enableBuiltinModules: true,
      enableFileSystemAccess: id.includes('promptx'), // PromptX需要文件访问权限
      analysisMode: false,
      timeout: 30000
    };
    
    this.isolationManager = new SandboxIsolationManager(path, nodeCommand, sandboxOptions);
    
    log.info(`[MCPSandbox] 创建沙箱实例: ${id} -> ${path}, 文件系统访问: ${sandboxOptions.enableFileSystemAccess}`);
  }

  /**
   * 初始化沙箱环境
   */
  async initialize(dependencies: string[] = []): Promise<void> {
    if (this.isInitialized) {
      log.info(`[MCPSandbox] 沙箱 ${this.id} 已初始化，跳过`);
      return;
    }

    try {
      log.info(`[MCPSandbox] 初始化沙箱 ${this.id}，依赖数量: ${dependencies.length}`);
      
      // 1. 确保沙箱目录结构
      await this.isolationManager.ensureSandboxStructure();
      
      // 2. 创建package.json
      if (dependencies.length > 0) {
        await this.isolationManager.createSandboxPackageJson(dependencies);
        
        // 3. 安装依赖
        await this.isolationManager.installDependencies();
      }
      
      this.isInitialized = true;
      log.info(`[MCPSandbox] 沙箱 ${this.id} 初始化完成`);
      
    } catch (error) {
      log.error(`[MCPSandbox] 沙箱 ${this.id} 初始化失败:`, error);
      throw new Error(`沙箱初始化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 在沙箱中启动MCP服务器
   */
  async startMCPServer(
    serverConfig: MCPServerEntity, 
    options: SandboxStartOptions = {}
  ): Promise<ChildProcess> {
    
    if (!this.isInitialized) {
      throw new Error(`沙箱 ${this.id} 尚未初始化`);
    }

    try {
      // 构建启动命令和参数
      const { command, args } = this.buildMCPCommand(serverConfig);
      
      log.info(`[MCPSandbox] 在沙箱 ${this.id} 中启动MCP服务器: ${command} ${args.join(' ')}`);
      
      // 在沙箱中启动进程
      const childProcess = await this.isolationManager.spawnInSandbox(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'], // MCP stdio协议
        timeout: options.timeout || 30000
      });

      // 记录运行的进程
      const processKey = `${serverConfig.id}-${Date.now()}`;
      this.runningProcesses.set(processKey, childProcess);
      
      // 清理退出的进程
      childProcess.on('exit', () => {
        this.runningProcesses.delete(processKey);
      });

      return childProcess;
      
    } catch (error) {
      log.error(`[MCPSandbox] 启动MCP服务器失败:`, error);
      throw new Error(`启动MCP服务器失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 构建MCP启动命令
   */
  private buildMCPCommand(serverConfig: MCPServerEntity): { command: string; args: string[] } {
    // 处理不同类型的MCP服务器配置
    
    if (serverConfig.command?.startsWith('sandbox://')) {
      // 沙箱协议：sandbox://promptx -> 启动PromptX
      const mcpType = serverConfig.command?.replace('sandbox://', '') || '';
      
      switch (mcpType) {
        case 'promptx':
          return this.buildPromptXCommand();
        default:
          throw new Error(`不支持的沙箱MCP类型: ${mcpType}`);
      }
    } else {
      // 传统命令格式
      const args = serverConfig.args || [];
      return {
        command: serverConfig.command || '',
        args
      };
    }
  }

  /**
   * 构建PromptX启动命令
   */
  private buildPromptXCommand(): { command: string; args: string[] } {
    // PromptX入口文件路径（在沙箱的node_modules中）
    const promptxEntry = join(this.path, 'node_modules', 'dpml-prompt', 'src', 'bin', 'promptx.js');
    
    return {
      command: promptxEntry,
      args: ['mcp-server']
    };
  }

  /**
   * 停止所有运行的进程
   */
  async stopAllProcesses(): Promise<void> {
    log.info(`[MCPSandbox] 停止沙箱 ${this.id} 中的所有进程，数量: ${this.runningProcesses.size}`);
    
    for (const [processKey, childProcess] of this.runningProcesses) {
      try {
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGTERM');
          
          // 等待进程优雅退出
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              if (!childProcess.killed) {
                childProcess.kill('SIGKILL');
              }
              resolve();
            }, 5000);
            
            childProcess.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
        }
        
        this.runningProcesses.delete(processKey);
      } catch (error) {
        log.error(`[MCPSandbox] 停止进程 ${processKey} 失败:`, error);
      }
    }
  }

  /**
   * 获取沙箱状态
   */
  async getStatus(): Promise<MCPSandboxInfo> {
    const isReady = await this.isolationManager.isSandboxReady();
    
    return {
      id: this.id,
      path: this.path,
      isReady,
      nodeCommand: this.nodeCommand,
      dependencies: [], // TODO: 从package.json读取
      createdAt: new Date(), // TODO: 从文件系统获取
      lastUsed: new Date()
    };
  }

  /**
   * 清理沙箱
   */
  async cleanup(): Promise<void> {
    // 停止所有进程
    await this.stopAllProcesses();
    
    // 清理沙箱环境
    await this.isolationManager.cleanup();
    
    this.isInitialized = false;
  }
}

/**
 * MCP沙箱管理器 - 主管理类
 */
export class MCPSandboxManager {
  private static instance: MCPSandboxManager | null = null;
  private nodeRuntimeManager: NodeRuntimeManager;
  private sandboxes: Map<string, MCPSandbox> = new Map();
  private sandboxBasePath: string;

  private constructor() {
    this.nodeRuntimeManager = NodeRuntimeManager.getInstance();
    this.sandboxBasePath = join(app.getPath('userData'), 'mcp-sandbox');
    
    log.info(`[MCPSandboxManager] 初始化MCP沙箱管理器`);
    log.info(`[MCPSandboxManager] 沙箱基础路径: ${this.sandboxBasePath}`);
  }

  public static getInstance(): MCPSandboxManager {
    if (!MCPSandboxManager.instance) {
      MCPSandboxManager.instance = new MCPSandboxManager();
    }
    return MCPSandboxManager.instance;
  }

  /**
   * 创建或获取MCP沙箱
   */
  async createMCPSandbox(mcpId: string, dependencies: string[] = []): Promise<MCPSandbox> {
    // 检查是否已存在
    if (this.sandboxes.has(mcpId)) {
      const existingSandbox = this.sandboxes.get(mcpId)!;
      log.info(`[MCPSandboxManager] 使用现有沙箱: ${mcpId}`);
      return existingSandbox;
    }

    try {
      // 获取Node命令
      const nodeCommand = await this.nodeRuntimeManager.getNodeCommand();
      
      // 创建沙箱目录路径
      const sandboxPath = join(this.sandboxBasePath, mcpId);
      
      // 创建沙箱实例
      const sandbox = new MCPSandbox(mcpId, sandboxPath, nodeCommand);
      
      // 初始化沙箱
      await sandbox.initialize(dependencies);
      
      // 缓存沙箱实例
      this.sandboxes.set(mcpId, sandbox);
      
      log.info(`[MCPSandboxManager] 创建新沙箱成功: ${mcpId}`);
      return sandbox;
      
    } catch (error) {
      log.error(`[MCPSandboxManager] 创建沙箱失败: ${mcpId}`, error);
      throw new Error(`创建MCP沙箱失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取已存在的沙箱
   */
  getSandbox(mcpId: string): MCPSandbox | undefined {
    return this.sandboxes.get(mcpId);
  }

  /**
   * 启动MCP服务器（便捷方法）
   */
  async startMCPServer(
    serverConfig: MCPServerEntity, 
    dependencies: string[] = [],
    options: SandboxStartOptions = {}
  ): Promise<ChildProcess> {
    
    const mcpId = serverConfig.id;
    
    // 创建或获取沙箱
    const sandbox = await this.createMCPSandbox(mcpId, dependencies);
    
    // 启动MCP服务器
    return sandbox.startMCPServer(serverConfig, options);
  }

  /**
   * 获取所有沙箱状态
   */
  async getAllSandboxStatus(): Promise<MCPSandboxInfo[]> {
    const statuses: MCPSandboxInfo[] = [];
    
    for (const sandbox of this.sandboxes.values()) {
      try {
        const status = await sandbox.getStatus();
        statuses.push(status);
      } catch (error) {
        log.error(`[MCPSandboxManager] 获取沙箱状态失败: ${sandbox.id}`, error);
      }
    }
    
    return statuses;
  }

  /**
   * 清理指定沙箱
   */
  async cleanupSandbox(mcpId: string): Promise<void> {
    const sandbox = this.sandboxes.get(mcpId);
    if (sandbox) {
      await sandbox.cleanup();
      this.sandboxes.delete(mcpId);
      log.info(`[MCPSandboxManager] 清理沙箱完成: ${mcpId}`);
    }
  }

  /**
   * 清理所有沙箱
   */
  async cleanupAllSandboxes(): Promise<void> {
    log.info(`[MCPSandboxManager] 清理所有沙箱，数量: ${this.sandboxes.size}`);
    
    const cleanupPromises = Array.from(this.sandboxes.keys()).map(mcpId => 
      this.cleanupSandbox(mcpId)
    );
    
    await Promise.allSettled(cleanupPromises);
    
    log.info(`[MCPSandboxManager] 所有沙箱清理完成`);
  }

  /**
   * 获取Node运行时信息
   */
  async getNodeRuntimeInfo() {
    return this.nodeRuntimeManager.getNodeRuntimeInfo();
  }
}