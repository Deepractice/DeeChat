/**
 * PromptX本地调用服务接口
 * 提供直接调用PromptX命令的能力，避免通过MCP协议的开销
 */

export interface IPromptXService {
  /**
   * 执行PromptX命令
   * @param command 命令名称 (init, welcome, action, learn, recall, remember, tool等)
   * @param args 命令参数
   * @returns 命令执行结果
   */
  execute(command: string, args?: any[]): Promise<any>;
  
  /**
   * 检查命令是否可用
   * @param command 命令名称
   * @returns 是否可用
   */
  isCommandAvailable(command: string): boolean;
  
  /**
   * 获取所有可用命令列表
   * @returns 命令名称数组
   */
  getAvailableCommands(): string[];
}

/**
 * PromptX命令类型枚举
 */
export enum PromptXCommand {
  INIT = 'init',
  WELCOME = 'welcome',
  ACTION = 'action',
  LEARN = 'learn',
  RECALL = 'recall',
  REMEMBER = 'remember',
  TOOL = 'tool',
  THINK = 'think'
}