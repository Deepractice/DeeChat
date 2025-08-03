import { ipcMain } from 'electron';
import { getPromptXLocalService } from '../services/promptx/PromptXLocalService';

/**
 * 注册PromptX相关的IPC处理器
 */
export function registerPromptXHandlers(): void {
  const promptxService = getPromptXLocalService();

  /**
   * 执行PromptX命令
   */
  ipcMain.handle('promptx:execute', async (_, command: string, args?: any[]) => {
    try {
      const result = await promptxService.execute(command, args);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] PromptX命令执行失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 检查命令是否可用
   */
  ipcMain.handle('promptx:isCommandAvailable', async (_, command: string) => {
    return promptxService.isCommandAvailable(command);
  });

  /**
   * 获取所有可用命令
   */
  ipcMain.handle('promptx:getAvailableCommands', async () => {
    return promptxService.getAvailableCommands();
  });

  /**
   * 便捷方法：获取角色列表
   */
  ipcMain.handle('promptx:getAvailableRoles', async () => {
    try {
      const result = await promptxService.getAvailableRoles();
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 获取角色列表失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 便捷方法：激活角色
   */
  ipcMain.handle('promptx:activateRole', async (_, roleId: string) => {
    try {
      const result = await promptxService.activateRole(roleId);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 激活角色失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 便捷方法：学习资源
   */
  ipcMain.handle('promptx:learn', async (_, resourceUrl: string) => {
    try {
      const result = await promptxService.learn(resourceUrl);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 学习资源失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 便捷方法：初始化工作区
   */
  ipcMain.handle('promptx:initWorkspace', async (_, workspacePath?: string, ideType?: string) => {
    try {
      const result = await promptxService.initWorkspace(workspacePath, ideType);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 初始化工作区失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 便捷方法：记忆信息
   */
  ipcMain.handle('promptx:remember', async (_, role: string, content: string) => {
    try {
      const result = await promptxService.remember(role, content);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 记忆信息失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 便捷方法：回忆信息
   */
  ipcMain.handle('promptx:recall', async (_, role: string, query?: string) => {
    try {
      const result = await promptxService.recall(role, query);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 回忆信息失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  /**
   * 便捷方法：思考
   */
  ipcMain.handle('promptx:think', async (_, role: string, thought: any) => {
    try {
      const result = await promptxService.think(role, thought);
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC] 思考失败:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  });

  console.log('[IPC] PromptX处理器注册完成');
}