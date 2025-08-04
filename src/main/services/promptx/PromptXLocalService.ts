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
  private promptxPath: string;

  constructor() {
    // 确定PromptX模块路径
    if (process.env.NODE_ENV === 'development') {
      this.promptxPath = path.join(__dirname, '../../../../resources/promptx/package');
    } else {
      this.promptxPath = path.join(process.resourcesPath, 'promptx/package');
    }
    // 延迟初始化，等待首次使用时再初始化
  }

  /**
   * 初始化PromptX，按照正确的流程：ServerEnvironment -> CLI -> 工作区
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log(`[PromptXLocalService] 开始初始化PromptX: ${this.promptxPath}`);

      // 1. 先初始化 ServerEnvironment（模拟 CLI 模式）
      const { getGlobalServerEnvironment } = require(path.join(this.promptxPath, 'src/lib/utils/ServerEnvironment'));
      const serverEnv = getGlobalServerEnvironment();
      
      if (!serverEnv.isInitialized()) {
        serverEnv.initialize({
          transport: 'stdio',  // CLI 模式使用 stdio
          host: null,
          port: null
        });
        console.log('[PromptXLocalService] ServerEnvironment初始化成功');
      }

      // 2. 加载并初始化 PromptX CLI
      const { cli } = require(path.join(this.promptxPath, 'src/lib/core/pouch'));
      await cli.initialize();
      this.promptxCLI = cli;
      console.log('[PromptXLocalService] PromptX CLI初始化成功');

      // 3. 收集可用命令
      this.collectAvailableCommands();
      
      this.initialized = true;
      console.log('[PromptXLocalService] PromptX模块初始化完成');
    } catch (error) {
      console.error('[PromptXLocalService] 初始化失败:', error);
      throw new Error(`无法初始化PromptX: ${error instanceof Error ? error.message : String(error)}`);
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
    // 延迟初始化：首次使用时才初始化
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.isCommandAvailable(command)) {
      throw new Error(`未知的PromptX命令: ${command}`);
    }

    try {
      console.log(`[PromptXLocalService] 执行命令: ${command}`, args);
      
      // 调用PromptX CLI执行命令
      const result = await this.promptxCLI.execute(command, args);
      
      console.log(`[PromptXLocalService] 命令执行成功: ${command}`);
      console.log(`[PromptXLocalService] 结果类型: ${typeof result}`, result ? Object.keys(result) : 'null');
      
      // 对于welcome命令，返回content字段（包含角色列表的纯文本）
      if (command === 'welcome' && result) {
        console.log(`[PromptXLocalService] welcome命令返回result类型:`, typeof result);
        console.log(`[PromptXLocalService] welcome命令返回result keys:`, Object.keys(result));
        
        // 检查是否有content字段
        if (result.content && typeof result.content === 'string') {
          console.log(`[PromptXLocalService] welcome命令返回content长度: ${result.content.length}`);
          console.log(`[PromptXLocalService] welcome命令返回content前500字符:`, result.content.substring(0, 500));
          return result.content;
        }
        
        // 如果没有content字段，检查是否有toString方法
        if (result.toString && typeof result.toString === 'function') {
          const stringResult = result.toString();
          console.log(`[PromptXLocalService] welcome命令使用toString()转换，长度: ${stringResult.length}`);
          console.log(`[PromptXLocalService] welcome命令toString前500字符:`, stringResult.substring(0, 500));
          return stringResult;
        }
        
        // 兜底：返回整个对象
        console.warn(`[PromptXLocalService] welcome命令返回意外格式，返回原始结果`);
        return result;
      }
      
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