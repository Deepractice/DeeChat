/**
 * PromptX服务 - 渲染进程端
 * 提供调用PromptX本地服务的接口
 */

// import { PromptXCommand } from '../../../shared/interfaces/IPromptXService'; // 暂时不使用

export interface PromptXResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class PromptXService {
  /**
   * 执行PromptX命令
   */
  async execute(command: string, args?: any[]): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.execute(command, args);
  }

  /**
   * 检查命令是否可用
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    return await (window as any).electronAPI.promptx.isCommandAvailable(command);
  }

  /**
   * 获取所有可用命令
   */
  async getAvailableCommands(): Promise<string[]> {
    return await (window as any).electronAPI.promptx.getAvailableCommands();
  }

  /**
   * 获取可用角色列表
   */
  async getAvailableRoles(): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.getAvailableRoles();
  }

  /**
   * 激活指定角色
   */
  async activateRole(roleId: string): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.activateRole(roleId);
  }

  /**
   * 学习资源
   */
  async learn(resourceUrl: string): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.learn(resourceUrl);
  }

  /**
   * 初始化工作区
   */
  async initWorkspace(workspacePath?: string, ideType?: string): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.initWorkspace(workspacePath, ideType);
  }

  /**
   * 记忆信息
   */
  async remember(role: string, content: string): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.remember(role, content);
  }

  /**
   * 回忆信息
   */
  async recall(role: string, query?: string): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.recall(role, query);
  }

  /**
   * 思考
   */
  async think(role: string, thought: any): Promise<PromptXResult> {
    return await (window as any).electronAPI.promptx.think(role, thought);
  }

  /**
   * 解析角色列表文本
   * 从welcome命令返回的文本中提取角色信息
   */
  parseRoleList(_welcomeOutput: string): Array<{
    id: string;
    name: string;
    description: string;
    source: 'system' | 'project' | 'user';
  }> {
    // 解析welcome命令输出格式
    return [];
  }
}

// 创建单例实例
export const promptXService = new PromptXService();