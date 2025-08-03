/**
 * PromptX服务 - 渲染进程端
 * 提供调用PromptX本地服务的接口
 */

import { PromptXCommand } from '../../../shared/interfaces/IPromptXService';

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
    return await window.electronAPI.promptx.execute(command, args);
  }

  /**
   * 检查命令是否可用
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    return await window.electronAPI.promptx.isCommandAvailable(command);
  }

  /**
   * 获取所有可用命令
   */
  async getAvailableCommands(): Promise<string[]> {
    return await window.electronAPI.promptx.getAvailableCommands();
  }

  /**
   * 获取可用角色列表
   */
  async getAvailableRoles(): Promise<PromptXResult> {
    return await window.electronAPI.promptx.getAvailableRoles();
  }

  /**
   * 激活指定角色
   */
  async activateRole(roleId: string): Promise<PromptXResult> {
    return await window.electronAPI.promptx.activateRole(roleId);
  }

  /**
   * 学习资源
   */
  async learn(resourceUrl: string): Promise<PromptXResult> {
    return await window.electronAPI.promptx.learn(resourceUrl);
  }

  /**
   * 初始化工作区
   */
  async initWorkspace(workspacePath?: string, ideType?: string): Promise<PromptXResult> {
    return await window.electronAPI.promptx.initWorkspace(workspacePath, ideType);
  }

  /**
   * 记忆信息
   */
  async remember(role: string, content: string): Promise<PromptXResult> {
    return await window.electronAPI.promptx.remember(role, content);
  }

  /**
   * 回忆信息
   */
  async recall(role: string, query?: string): Promise<PromptXResult> {
    return await window.electronAPI.promptx.recall(role, query);
  }

  /**
   * 思考
   */
  async think(role: string, thought: any): Promise<PromptXResult> {
    return await window.electronAPI.promptx.think(role, thought);
  }

  /**
   * 解析角色列表文本
   * 从welcome命令返回的文本中提取角色信息
   */
  parseRoleList(welcomeOutput: string): Array<{
    id: string;
    name: string;
    description: string;
    source: 'system' | 'project' | 'user';
  }> {
    // TODO: 实现解析逻辑
    // 这里需要根据welcome命令的实际输出格式来解析
    // 暂时返回空数组
    return [];
  }
}

// 创建单例实例
export const promptXService = new PromptXService();