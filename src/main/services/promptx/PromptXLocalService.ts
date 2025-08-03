import * as path from 'path';
import { IPromptXService, PromptXCommand } from '../../../shared/interfaces/IPromptXService';

/**
 * PromptX本地调用服务
 * 直接调用内置的PromptX模块，避免MCP协议开销
 */
export class PromptXLocalService implements IPromptXService {
  private promptxCLI: any;
  private initialized: boolean = false;
  private availableCommands: Set<string> = new Set();

  constructor() {
    this.initialize();
  }

  /**
   * 初始化PromptX CLI
   */
  private initialize(): void {
    try {
      // 确定PromptX模块路径
      let promptxPath: string;
      
      if (process.env.NODE_ENV === 'development') {
        // 开发环境：直接使用resources目录
        promptxPath = path.join(__dirname, '../../../../resources/promptx/package');
      } else {
        // 生产环境：使用打包后的resources路径
        promptxPath = path.join(process.resourcesPath, 'promptx/package');
      }

      console.log(`[PromptXLocalService] 加载PromptX模块: ${promptxPath}`);

      // 加载PromptX CLI
      const pouchModule = require(path.join(promptxPath, 'src/lib/core/pouch'));
      this.promptxCLI = pouchModule.cli;

      // 收集可用命令
      this.collectAvailableCommands();
      
      this.initialized = true;
      console.log('[PromptXLocalService] PromptX模块加载成功');
    } catch (error) {
      console.error('[PromptXLocalService] 初始化失败:', error);
      throw new Error(`无法加载PromptX模块: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 收集所有可用的命令
   */
  private collectAvailableCommands(): void {
    // 基于PromptXCommand枚举添加已知命令
    Object.values(PromptXCommand).forEach(command => {
      this.availableCommands.add(command);
    });

    // 从CLI的registry获取命令列表
    if (this.promptxCLI && this.promptxCLI.registry && typeof this.promptxCLI.registry.list === 'function') {
      const commands = this.promptxCLI.registry.list();
      commands.forEach((cmd: string) => this.availableCommands.add(cmd));
    } else if (this.promptxCLI && typeof this.promptxCLI.getCommands === 'function') {
      // 备用方案：如果有getCommands方法
      const commands = this.promptxCLI.getCommands();
      commands.forEach((cmd: string) => this.availableCommands.add(cmd));
    }
  }

  /**
   * 执行PromptX命令
   */
  async execute(command: string, args: any[] = []): Promise<any> {
    if (!this.initialized) {
      throw new Error('PromptXLocalService未初始化');
    }

    if (!this.isCommandAvailable(command)) {
      throw new Error(`未知的PromptX命令: ${command}`);
    }

    try {
      console.log(`[PromptXLocalService] 执行命令: ${command}`, args);
      
      // 调用PromptX CLI执行命令
      const result = await this.promptxCLI.execute(command, args);
      
      console.log(`[PromptXLocalService] 命令执行成功: ${command}`);
      return result;
    } catch (error) {
      console.error(`[PromptXLocalService] 命令执行失败: ${command}`, error);
      throw error;
    }
  }

  /**
   * 检查命令是否可用
   */
  isCommandAvailable(command: string): boolean {
    return this.availableCommands.has(command);
  }

  /**
   * 获取所有可用命令列表
   */
  getAvailableCommands(): string[] {
    return Array.from(this.availableCommands);
  }

  /**
   * 便捷方法：获取角色列表
   * welcome命令不需要参数
   */
  async getAvailableRoles(): Promise<any> {
    return this.execute(PromptXCommand.WELCOME, []);
  }

  /**
   * 便捷方法：激活角色
   * action命令需要roleId作为第一个参数
   */
  async activateRole(roleId: string): Promise<any> {
    return this.execute(PromptXCommand.ACTION, [roleId]);
  }

  /**
   * 便捷方法：学习资源
   * learn命令需要resourceUrl作为参数
   */
  async learn(resourceUrl: string): Promise<any> {
    return this.execute(PromptXCommand.LEARN, [resourceUrl]);
  }

  /**
   * 便捷方法：记忆信息
   * remember命令需要role作为第一个参数，content作为第二个参数
   * 注意：这里的engrams应该是字符串内容，不是对象
   */
  async remember(role: string, content: string): Promise<any> {
    return this.execute(PromptXCommand.REMEMBER, [role, content]);
  }

  /**
   * 便捷方法：回忆信息
   * recall命令需要role作为第一个参数，query作为第二个参数（可选）
   */
  async recall(role: string, query?: string): Promise<any> {
    return this.execute(PromptXCommand.RECALL, query ? [role, query] : [role]);
  }

  /**
   * 便捷方法：初始化工作区
   * init命令支持对象格式参数（MCP格式）或字符串格式（CLI格式）
   */
  async initWorkspace(workspacePath?: string, ideType?: string): Promise<any> {
    if (workspacePath) {
      // 使用MCP格式的对象参数
      return this.execute(PromptXCommand.INIT, [{ 
        workingDirectory: workspacePath,
        ideType: ideType 
      }]);
    }
    return this.execute(PromptXCommand.INIT, []);
  }

  /**
   * 便捷方法：执行工具
   * tool命令需要toolResource和parameters
   */
  async executeTool(toolResource: string, parameters: any): Promise<any> {
    return this.execute(PromptXCommand.TOOL, [toolResource, parameters]);
  }

  /**
   * 便捷方法：思考
   * think命令需要role和thought对象
   */
  async think(role: string, thought: any): Promise<any> {
    return this.execute(PromptXCommand.THINK, [role, thought]);
  }
}

// 创建单例实例
let promptxLocalServiceInstance: PromptXLocalService | null = null;

/**
 * 获取PromptX本地服务单例
 */
export function getPromptXLocalService(): PromptXLocalService {
  if (!promptxLocalServiceInstance) {
    promptxLocalServiceInstance = new PromptXLocalService();
  }
  return promptxLocalServiceInstance;
}