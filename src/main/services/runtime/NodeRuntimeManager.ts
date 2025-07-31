/**
 * Node.js运行时管理器
 * 解决用户无Node环境问题，提供内置便携Node运行时
 */

import { app } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import log from 'electron-log';

export interface NodeRuntimeInfo {
  available: boolean;
  version?: string;
  source: 'system' | 'builtin' | 'none';
  command?: string;
  path?: string;
}

export class NodeRuntimeManager {
  private static instance: NodeRuntimeManager | null = null;
  private nodeCommand: string | null = null;
  private runtimePath: string;
  private nodeExecutable: string;

  private constructor() {
    // DeeChat专用Node运行时目录
    this.runtimePath = join(app.getPath('userData'), 'node-runtime');
    this.nodeExecutable = process.platform === 'win32' ? 'node.exe' : 'node';
    
    log.info(`[NodeRuntime] 初始化Node运行时管理器`);
    log.info(`[NodeRuntime] 运行时目录: ${this.runtimePath}`);
  }

  public static getInstance(): NodeRuntimeManager {
    if (!NodeRuntimeManager.instance) {
      NodeRuntimeManager.instance = new NodeRuntimeManager();
    }
    return NodeRuntimeManager.instance;
  }

  /**
   * 获取可用的Node命令
   * 优先级：系统Node > 内置Node > 抛出错误
   */
  async getNodeCommand(): Promise<string> {
    if (this.nodeCommand) {
      log.info(`[NodeRuntime] 使用缓存的Node命令: ${this.nodeCommand}`);
      return this.nodeCommand;
    }

    // 1. 检查系统Node
    if (await this.checkSystemNode()) {
      log.info(`✅ [NodeRuntime] 使用系统Node.js`);
      this.nodeCommand = 'node';
      return this.nodeCommand;
    }

    // 2. 检查内置Node
    try {
      const builtinNode = await this.ensureBuiltinNode();
      log.info(`✅ [NodeRuntime] 使用内置Node.js: ${builtinNode}`);
      this.nodeCommand = builtinNode;
      return this.nodeCommand;
    } catch (error) {
      log.error(`❌ [NodeRuntime] 内置Node不可用:`, error);
    }

    // 3. 尝试从构建资源复制
    try {
      const copiedNode = await this.copyBuiltinRuntimeFromResources();
      log.info(`✅ [NodeRuntime] 从构建资源复制Node: ${copiedNode}`);
      this.nodeCommand = copiedNode;
      return this.nodeCommand;
    } catch (error) {
      log.error(`❌ [NodeRuntime] 从构建资源复制失败:`, error);
    }

    throw new Error('Node.js运行时不可用，请手动安装Node.js或联系技术支持');
  }

  /**
   * 检查系统Node是否可用
   */
  private async checkSystemNode(): Promise<boolean> {
    try {
      const version = execSync('node --version', { 
        stdio: 'pipe', 
        timeout: 5000,
        encoding: 'utf8'
      }).trim();
      
      log.info(`[NodeRuntime] 检测到系统Node版本: ${version}`);
      
      // 检查版本是否满足要求 (>=16.0.0)
      const versionNumber = version.replace('v', '');
      const majorVersion = parseInt(versionNumber.split('.')[0]);
      
      if (majorVersion >= 16) {
        return true;
      } else {
        log.warn(`[NodeRuntime] 系统Node版本过低: ${version}, 需要 >= v16.0.0`);
        return false;
      }
    } catch (error) {
      log.info(`[NodeRuntime] 系统Node不可用: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 确保内置Node可用
   */
  private async ensureBuiltinNode(): Promise<string> {
    const nodePath = join(this.runtimePath, this.nodeExecutable);
    
    // 检查是否已存在且可用
    if (await this.checkNodePath(nodePath)) {
      return nodePath;
    }
    
    // 创建运行时目录
    await fs.mkdir(this.runtimePath, { recursive: true });
    
    throw new Error('内置Node运行时不存在，需要从构建资源复制');
  }

  /**
   * 从构建资源复制Node运行时
   */
  private async copyBuiltinRuntimeFromResources(): Promise<string> {
    const isDev = process.env.NODE_ENV === 'development';
    
    let resourcePath: string;
    if (isDev) {
      // 开发环境：从项目根目录的resources复制
      resourcePath = join(__dirname, '..', '..', '..', '..', 'resources', 'node-runtime');
    } else {
      // 生产环境：从app资源目录复制
      const basePath = process.resourcesPath || join(__dirname, '..', '..', '..', '..');
      resourcePath = join(basePath, 'resources', 'node-runtime');
    }

    const platform = this.getNodePlatform();
    const arch = this.getNodeArch();
    const platformResourcePath = join(resourcePath, `${platform}-${arch}`);
    
    log.info(`[NodeRuntime] 尝试从资源路径复制: ${platformResourcePath}`);
    
    try {
      // 检查资源是否存在
      await fs.access(platformResourcePath);
      
      // 复制到运行时目录
      await this.copyDirectory(platformResourcePath, this.runtimePath);
      
      // 设置可执行权限（非Windows系统）
      const nodePath = join(this.runtimePath, this.nodeExecutable);
      if (process.platform !== 'win32') {
        await fs.chmod(nodePath, 0o755);
      }
      
      // 验证复制的Node是否可用
      if (await this.checkNodePath(nodePath)) {
        return nodePath;
      } else {
        throw new Error('复制的Node运行时无法执行');
      }
      
    } catch (error) {
      throw new Error(`从构建资源复制Node失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查指定路径的Node是否可用
   */
  private async checkNodePath(nodePath: string): Promise<boolean> {
    try {
      // 检查文件是否存在
      await fs.access(nodePath);
      
      // 尝试执行node --version
      const version = execSync(`"${nodePath}" --version`, { 
        stdio: 'pipe', 
        timeout: 5000,
        encoding: 'utf8'
      }).trim();
      
      log.info(`[NodeRuntime] Node路径 ${nodePath} 可用，版本: ${version}`);
      return true;
    } catch (error) {
      log.warn(`[NodeRuntime] Node路径 ${nodePath} 不可用: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 递归复制目录
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 获取Node.js平台标识
   */
  private getNodePlatform(): string {
    switch (process.platform) {
      case 'win32': return 'win';
      case 'darwin': return 'darwin';
      case 'linux': return 'linux';
      default: throw new Error(`不支持的平台: ${process.platform}`);
    }
  }

  /**
   * 获取Node.js架构标识
   */
  private getNodeArch(): string {
    switch (process.arch) {
      case 'x64': return 'x64';
      case 'arm64': return 'arm64';
      case 'ia32': return 'x86';
      default: throw new Error(`不支持的架构: ${process.arch}`);
    }
  }

  /**
   * 获取Node版本信息
   */
  async getNodeVersion(): Promise<string | null> {
    try {
      const nodeCmd = await this.getNodeCommand();
      const version = execSync(`"${nodeCmd}" --version`, { 
        encoding: 'utf8', 
        timeout: 5000 
      }).trim();
      return version;
    } catch (error) {
      log.error(`[NodeRuntime] 获取Node版本失败:`, error);
      return null;
    }
  }

  /**
   * 获取Node环境完整信息
   */
  async getNodeRuntimeInfo(): Promise<NodeRuntimeInfo> {
    try {
      const command = await this.getNodeCommand();
      const version = await this.getNodeVersion();
      
      let source: 'system' | 'builtin' = 'system';
      if (command !== 'node') {
        source = 'builtin';
      }

      return {
        available: true,
        version: version || undefined,
        source,
        command,
        path: command === 'node' ? undefined : command
      };
    } catch (error) {
      log.error(`[NodeRuntime] Node环境不可用:`, error);
      return {
        available: false,
        source: 'none'
      };
    }
  }

  /**
   * 清理缓存，强制重新检测
   */
  clearCache(): void {
    this.nodeCommand = null;
    log.info(`[NodeRuntime] 已清理Node命令缓存`);
  }
}