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

    return this.refreshNodeCommand();
  }

  /**
   * 强制刷新Node命令（清除缓存并重新检测）
   */
  async refreshNodeCommand(): Promise<string> {
    // 清除缓存
    this.nodeCommand = null;
    log.info(`[NodeRuntime] 强制刷新Node命令，重新检测...`);

    // 🔥 1. 检查是否在Electron环境中，避免使用Electron的execPath
    const currentNodePath = process.execPath;
    const isElectronEnv = currentNodePath.includes('Electron') || process.versions.electron;
    
    if (!isElectronEnv && currentNodePath && await this.checkNodePath(currentNodePath)) {
      log.info(`✅ [NodeRuntime] 使用当前进程Node.js: ${currentNodePath}`);
      log.info(`[NodeRuntime] 🔍 版本一致性保证: ${process.version}`);
      this.nodeCommand = currentNodePath;
      return this.nodeCommand;
    } else if (isElectronEnv) {
      log.info(`[NodeRuntime] ⚠️ 检测到Electron环境，跳过process.execPath: ${currentNodePath}`);
    }

    // 2. 检查系统Node（但验证版本一致性）
    if (await this.checkSystemNodeWithVersion()) {
      // 获取系统Node的完整路径
      const systemNodePath = await this.getSystemNodePath();
      log.info(`✅ [NodeRuntime] 使用版本匹配的系统Node.js: ${systemNodePath}`);
      this.nodeCommand = systemNodePath;
      return this.nodeCommand;
    }

    // 3. 检查内置Node
    try {
      const builtinNode = await this.ensureBuiltinNode();
      log.info(`✅ [NodeRuntime] 使用内置Node.js: ${builtinNode}`);
      this.nodeCommand = builtinNode;
      return this.nodeCommand;
    } catch (error) {
      log.error(`❌ [NodeRuntime] 内置Node不可用:`, error);
    }

    // 4. 尝试从构建资源复制
    try {
      const copiedNode = await this.copyBuiltinRuntimeFromResources();
      log.info(`✅ [NodeRuntime] 从构建资源复制Node: ${copiedNode}`);
      this.nodeCommand = copiedNode;
      return this.nodeCommand;
    } catch (error) {
      log.error(`❌ [NodeRuntime] 从构建资源复制失败:`, error);
    }

    // 🔥 5. 最后尝试自动下载Node.js运行时（零Node.js环境支持）
    try {
      log.info(`[NodeRuntime] 🚀 尝试自动下载Node.js运行时，实现零依赖环境...`);
      
      // 通知用户开始下载
      this.notifyUser('info', '正在为您下载Node.js运行时，首次下载可能需要几分钟...');
      
      const downloadedNode = await this.downloadNodeRuntime();
      log.info(`✅ [NodeRuntime] 自动下载Node.js成功: ${downloadedNode}`);
      
      // 通知用户下载成功
      this.notifyUser('success', 'Node.js运行时下载完成！AI工具功能已就绪。');
      
      this.nodeCommand = downloadedNode;
      return this.nodeCommand;
    } catch (error) {
      log.error(`❌ [NodeRuntime] 自动下载Node.js失败:`, error);
      
      // 通知用户下载失败
      this.notifyUser('error', `Node.js运行时下载失败：${error instanceof Error ? error.message : String(error)}`);
    }

    // 🔥 提供用户友好的错误信息和解决方案
    const userFriendlyMessage = this.generateUserFriendlyErrorMessage();
    log.error(`[NodeRuntime] ❌ 所有Node.js获取方式都失败了`);
    log.error(`[NodeRuntime] 💡 用户指导信息: ${userFriendlyMessage}`);
    
    throw new Error(userFriendlyMessage);
  }

  /**
   * 检查系统Node是否可用且版本匹配
   */
  private async checkSystemNodeWithVersion(): Promise<boolean> {
    try {
      const version = execSync('node --version', { 
        stdio: 'pipe', 
        timeout: 5000,
        encoding: 'utf8'
      }).trim();
      
      log.info(`[NodeRuntime] 检测到系统Node版本: ${version}`);
      log.info(`[NodeRuntime] 当前进程Node版本: ${process.version}`);
      
      // 🔥 检查版本是否与当前进程完全匹配
      if (version === process.version) {
        log.info(`[NodeRuntime] ✅ 系统Node版本与当前进程匹配`);
        return true;
      } else {
        log.warn(`[NodeRuntime] ⚠️ 系统Node版本不匹配: ${version} vs ${process.version}`);
        return false;
      }
    } catch (error) {
      log.info(`[NodeRuntime] 系统Node不可用: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 获取系统Node.js的完整路径
   */
  private async getSystemNodePath(): Promise<string> {
    try {
      const nodePath = execSync('which node', { 
        stdio: 'pipe', 
        timeout: 5000,
        encoding: 'utf8'
      }).trim();
      
      if (nodePath && nodePath.length > 0) {
        log.info(`[NodeRuntime] 系统Node路径: ${nodePath}`);
        return nodePath;
      }
      
      // 如果which命令失败，回退到默认的node命令
      log.warn(`[NodeRuntime] 无法获取Node完整路径，使用默认'node'命令`);
      return 'node';
    } catch (error) {
      log.warn(`[NodeRuntime] 获取Node路径失败，使用默认'node'命令:`, error);
      return 'node';
    }
  }

  /**
   * 确保内置Node可用
   */
  private async ensureBuiltinNode(): Promise<string> {
    // 🔥 修复路径：Node.js在bin子目录中
    const nodePath = join(this.runtimePath, 'bin', this.nodeExecutable);
    
    // 检查是否已存在且可用
    if (await this.checkNodePath(nodePath)) {
      log.info(`[NodeRuntime] ✅ 发现内置Node.js: ${nodePath}`);
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
   * 自动下载Node.js运行时（零Node.js环境支持）
   */
  private async downloadNodeRuntime(): Promise<string> {
    const https = require('https');
    const { createWriteStream } = require('fs');

    // 确定要下载的Node.js版本和平台信息
    const nodeVersion = process.version; // 使用当前Electron内置的Node版本
    const platform = this.getNodePlatform();
    const arch = this.getNodeArch();
    
    log.info(`[NodeRuntime] 🎯 准备下载Node.js ${nodeVersion} for ${platform}-${arch}`);
    
    // 构建下载URL
    const downloadUrl = `https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-${platform}-${arch}.tar.gz`;
    const downloadPath = join(this.runtimePath, `node-${nodeVersion}-${platform}-${arch}.tar.gz`);
    
    try {
      // 创建运行时目录
      await fs.mkdir(this.runtimePath, { recursive: true });
      
      log.info(`[NodeRuntime] 📥 开始下载Node.js运行时: ${downloadUrl}`);
      log.info(`[NodeRuntime] ⏳ 这可能需要几分钟时间，请耐心等待...`);
      
      // 下载Node.js运行时包
      await new Promise<void>((resolve, reject) => {
        const file = createWriteStream(downloadPath);
        let downloadedBytes = 0;
        let totalBytes = 0;
        let lastLogTime = 0;
        
        const request = https.get(downloadUrl, (response: any) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // 处理重定向
            const redirectUrl = response.headers.location;
            log.info(`[NodeRuntime] 🔄 重定向到: ${redirectUrl}`);
            file.close();
            
            // 递归处理重定向
            const redirectRequest = https.get(redirectUrl, (redirectResponse: any) => {
              if (redirectResponse.statusCode !== 200) {
                reject(new Error(`下载失败，HTTP状态码: ${redirectResponse.statusCode}`));
                return;
              }
              
              totalBytes = parseInt(redirectResponse.headers['content-length'] || '0', 10);
              log.info(`[NodeRuntime] 📊 文件大小: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
              
              const newFile = createWriteStream(downloadPath);
              redirectResponse.pipe(newFile);
              this.setupDownloadHandlers(redirectResponse, newFile, resolve, reject, downloadPath);
            });
            
            redirectRequest.on('error', (err: Error) => {
              reject(new Error(`重定向下载失败: ${err.message}`));
            });
            
            return;
          }
          
          if (response.statusCode !== 200) {
            reject(new Error(`下载失败，HTTP状态码: ${response.statusCode}。请检查网络连接或稍后重试。`));
            return;
          }
          
          totalBytes = parseInt(response.headers['content-length'] || '0', 10);
          log.info(`[NodeRuntime] 📊 文件大小: ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
          
          response.pipe(file);
          this.setupDownloadHandlers(response, file, resolve, reject, downloadPath);
          
          // 显示下载进度
          response.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            const currentTime = Date.now();
            
            // 每5秒显示一次进度
            if (currentTime - lastLogTime > 5000) {
              const progress = totalBytes > 0 ? (downloadedBytes / totalBytes * 100).toFixed(1) : '未知';
              const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
              log.info(`[NodeRuntime] 📈 下载进度: ${progress}% (${downloadedMB}MB)`);
              lastLogTime = currentTime;
            }
          });
        });
        
        request.on('error', (err: Error) => {
          reject(new Error(`网络请求失败: ${err.message}。请检查网络连接或防火墙设置。`));
        });
        
        // 设置10分钟超时
        request.setTimeout(600000, () => {
          request.destroy();
          reject(new Error('下载超时（10分钟）。请检查网络连接速度或稍后重试。'));
        });
      });
      
      log.info(`[NodeRuntime] ✅ 下载完成，开始解压...`);
      
      // 解压下载的包
      await this.extractNodeRuntime(downloadPath);
      
      // 清理下载的压缩包
      await fs.unlink(downloadPath);
      
      // 验证解压后的Node.js
      const nodePath = join(this.runtimePath, 'bin', this.nodeExecutable);
      if (await this.checkNodePath(nodePath)) {
        log.info(`[NodeRuntime] 🎉 Node.js运行时自动下载并配置成功`);
        return nodePath;
      } else {
        throw new Error('下载的Node.js运行时无法正常工作');
      }
      
    } catch (error) {
      // 清理失败的下载
      try {
        await fs.unlink(downloadPath);
      } catch (cleanupError) {
        // 忽略清理错误
      }
      
      throw new Error(`Node.js运行时下载失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 解压Node.js运行时包
   */
  private async extractNodeRuntime(tarPath: string): Promise<void> {
    const tar = require('tar');
    
    try {
      // 解压到运行时目录，去掉顶层目录
      await tar.extract({
        file: tarPath,
        cwd: this.runtimePath,
        strip: 1 // 去掉顶层目录结构
      });
      
      // 设置可执行权限（非Windows系统）
      if (process.platform !== 'win32') {
        const nodePath = join(this.runtimePath, 'bin', this.nodeExecutable);
        await fs.chmod(nodePath, 0o755);
      }
      
      log.info(`[NodeRuntime] ✅ Node.js运行时解压完成`);
      
    } catch (error) {
      throw new Error(`解压Node.js运行时失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 通知用户（通过系统通知或UI消息）
   */
  private notifyUser(type: 'info' | 'success' | 'error', message: string): void {
    try {
      // 尝试使用Electron的系统通知
      const { Notification } = require('electron');
      
      if (Notification.isSupported()) {
        const notification = new Notification({
          title: 'DeeChat',
          body: message,
          icon: undefined // 可以添加应用图标路径
        });
        
        notification.show();
      }
      
      // 同时记录到日志
      switch (type) {
        case 'info':
          log.info(`[NodeRuntime] 📢 用户通知: ${message}`);
          break;
        case 'success':
          log.info(`[NodeRuntime] ✅ 成功通知: ${message}`);
          break;
        case 'error':
          log.error(`[NodeRuntime] ❌ 错误通知: ${message}`);
          break;
      }
      
    } catch (error) {
      // 如果通知失败，至少记录到日志
      log.warn(`[NodeRuntime] 通知发送失败，消息: ${message}`, error);
    }
  }

  /**
   * 设置下载处理器
   */
  private setupDownloadHandlers(
    response: any,
    file: any,
    resolve: () => void,
    reject: (error: Error) => void,
    downloadPath: string
  ): void {
    file.on('finish', () => {
      file.close();
      log.info(`[NodeRuntime] ✅ 文件下载完成`);
      resolve();
    });
    
    file.on('error', (err: Error) => {
      fs.unlink(downloadPath).catch(() => {}); // 清理失败的下载
      reject(new Error(`文件写入失败: ${err.message}`));
    });
    
    response.on('error', (err: Error) => {
      fs.unlink(downloadPath).catch(() => {}); // 清理失败的下载
      reject(new Error(`响应流错误: ${err.message}`));
    });
  }

  /**
   * 生成用户友好的错误信息和解决方案
   */
  private generateUserFriendlyErrorMessage(): string {
    const platform = process.platform;
    const nodeVersion = process.version;
    
    let installGuide = '';
    
    switch (platform) {
      case 'win32':
        installGuide = `
Windows用户安装指南：
1. 访问 https://nodejs.org/zh-cn/ 下载Node.js
2. 选择"长期支持版"(推荐版本${nodeVersion})
3. 下载并运行安装程序，按提示完成安装
4. 重启DeeChat应用`;
        break;
      case 'darwin':
        installGuide = `
macOS用户安装指南：
1. 使用Homebrew: brew install node@18
2. 或访问 https://nodejs.org/zh-cn/ 下载安装包
3. 推荐安装版本${nodeVersion}兼容的Node.js
4. 重启DeeChat应用`;
        break;
      case 'linux':
        installGuide = `
Linux用户安装指南：
1. Ubuntu/Debian: sudo apt install nodejs npm
2. CentOS/RHEL: sudo yum install nodejs npm  
3. 或使用nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
4. 重启DeeChat应用`;
        break;
      default:
        installGuide = `请访问 https://nodejs.org/zh-cn/ 下载适合您系统的Node.js版本`;
    }
    
    return `🚫 DeeChat需要Node.js运行时才能使用AI工具功能

❌ 问题原因：
• 系统未安装Node.js
• 网络连接问题导致自动下载失败
• 防火墙阻止了运行时下载

💡 解决方案：
${installGuide}

🔧 临时解决方案：
• 检查网络连接后重试
• 配置代理服务器（如需要）
• 联系管理员开放网络访问权限

📞 获取帮助：
如果问题持续存在，请访问 https://github.com/your-repo/issues 提交问题反馈`;
  }

  /**
   * 清理缓存，强制重新检测
   */
  clearCache(): void {
    this.nodeCommand = null;
    log.info(`[NodeRuntime] 已清理Node命令缓存`);
  }
}