/**
 * MCP功能的IPC处理器
 * 为渲染进程提供MCP功能的访问接口
 */

import { ipcMain } from 'electron';
import { MCPIntegrationService } from '../services/mcp/MCPIntegrationService.js';
import { MCPConfigService } from '../services/mcp/MCPConfigService.js';
import { MCPServerEntity } from '../../shared/entities/MCPServerEntity.js';

console.log('🔧 [MCP] mcpHandlers模块开始加载...')

// 获取MCP服务单例实例
let mcpIntegrationService: MCPIntegrationService | null = null;
let mcpConfigService: MCPConfigService | null = null;

// 初始化MCP服务
async function initializeMCPServices() {
  try {
    if (!mcpConfigService) {
      mcpConfigService = new MCPConfigService();
    }
    
    if (!mcpIntegrationService) {
      mcpIntegrationService = MCPIntegrationService.getInstance();
      
      // 🔥 添加重试机制和超时处理
      const maxRetries = 3;
      const retryDelay = 2000; // 2秒
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 [MCP] 初始化尝试 ${attempt}/${maxRetries}...`);
          await mcpIntegrationService.initialize();
          console.log(`✅ [MCP] 初始化成功（尝试 ${attempt}/${maxRetries}）`);
          break; // 成功后跳出循环
        } catch (error) {
          console.error(`❌ [MCP] 初始化失败（尝试 ${attempt}/${maxRetries}）:`, error);
          
          if (attempt === maxRetries) {
            // 最后一次尝试失败
            throw new Error(`MCP服务初始化失败，已重试${maxRetries}次: ${error instanceof Error ? error.message : String(error)}`);
          }
          
          // 等待后重试
          console.log(`⏳ [MCP] ${retryDelay/1000}秒后重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  } catch (error) {
    console.error('❌ [MCP] 服务初始化最终失败:', error);
    // 重置服务实例，允许下次重新初始化
    mcpIntegrationService = null;
    throw error;
  }
}

console.log('🔧 [MCP] mcpHandlers模块导入完成，准备导出函数...')

// 标记handlers是否已经注册
let handlersRegistered = false;

/**
 * 预注册所有MCP IPC处理器（不初始化服务）
 */
function preRegisterMCPHandlers(): void {
  if (handlersRegistered) {
    console.log('🔧 [MCP] IPC处理器已注册，跳过重复注册');
    return;
  }

  console.log('🔧 [MCP] 预注册MCP IPC处理器...');

  // 🔥 先注册基础的IPC处理器（避免"No handler registered"错误）
  const createErrorResponse = (message: string, userFriendlyMessage?: string) => {
    // 🔥 提供用户友好的错误提示
    const friendlyMessage = userFriendlyMessage || getFriendlyErrorMessage(message);
    
    return {
      success: false,
      error: `MCP服务未就绪: ${message}`,
      userMessage: friendlyMessage, // 给用户看的友好提示
      suggestion: getErrorSuggestion(message) // 解决建议
    };
  };

  // 🔥 获取用户友好的错误提示
  const getFriendlyErrorMessage = (error: string): string => {
    if (error.includes('集成服务未初始化')) {
      return 'PromptX插件正在启动中，请稍候再试';
    }
    if (error.includes('初始化失败')) {
      return 'PromptX插件启动失败，请检查应用权限';
    }
    if (error.includes('初始化超时')) {
      return 'PromptX插件启动超时，可能需要重启应用';
    }
    if (error.includes('工具调用失败')) {
      return '工具执行遇到问题，请重试';
    }
    if (error.includes('连接失败')) {
      return '与PromptX服务连接中断，正在尝试重连';
    }
    return '服务暂时不可用，请稍后再试';
  };

  // 🔥 获取错误解决建议
  const getErrorSuggestion = (error: string): string => {
    if (error.includes('集成服务未初始化')) {
      return '请稍等几秒钟让服务完成启动，或重启应用';
    }
    if (error.includes('初始化失败')) {
      return '请检查应用是否有足够的系统权限，或尝试重启应用';
    }
    if (error.includes('初始化超时')) {
      return '请重启应用，如果问题持续请检查系统资源';
    }
    if (error.includes('工具调用失败')) {
      return '请检查工具参数是否正确，或稍后重试';
    }
    return '如果问题持续，请尝试重启应用';
  };

  // 注册所有处理器，避免前端调用时出现"No handler registered"错误
  ipcMain.handle('mcp:getAllServers', async () => {
    if (!mcpConfigService) {
      return createErrorResponse('配置服务未初始化');
    }
    try {
      const servers = await mcpConfigService.getAllServerConfigs();
      const serverData = servers.map(server => server.toData());
      console.log('🔍 [MCP Debug] 发送到前端的服务器数据:', JSON.stringify(serverData, null, 2));
      return { success: true, data: serverData };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '获取服务器列表失败');
    }
  });

  // 🔥 注释掉重复的getAllTools处理器，已在main/index.ts中实现
  // ipcMain.handle('mcp:getAllTools', async () => {
  //   if (!mcpIntegrationService) {
  //     return createErrorResponse('集成服务未初始化');
  //   }
  //   try {
  //     const tools = await mcpIntegrationService.getAllTools();
  //     const toolData = tools.map(tool => tool.toData());
  //     return { success: true, data: toolData };
  //   } catch (error) {
  //     return createErrorResponse(error instanceof Error ? error.message : '获取工具列表失败');
  //   }
  // });

  // 服务器管理处理器
  ipcMain.handle('mcp:addServer', async (_, serverConfig) => {
    if (!mcpConfigService || !mcpIntegrationService) {
      return createErrorResponse('服务未初始化');
    }
    try {
      const server = MCPServerEntity.create({
        name: serverConfig.name,
        description: serverConfig.description || '',
        type: serverConfig.type || 'stdio',
        isEnabled: serverConfig.isEnabled !== false,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env || {},
        timeout: serverConfig.timeout || 30000,
        retryCount: serverConfig.retryCount || 3
      });

      await mcpConfigService.saveServerConfig(server);
      await mcpIntegrationService.addServer(server);

      return { success: true, data: server.toData() };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '添加服务器失败');
    }
  });

  ipcMain.handle('mcp:removeServer', async (_, serverId) => {
    if (!mcpConfigService || !mcpIntegrationService) {
      return createErrorResponse('服务未初始化');
    }
    try {
      await mcpIntegrationService.removeServer(serverId);
      await mcpConfigService.deleteServerConfig(serverId);
      return { success: true };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '删除服务器失败');
    }
  });

  ipcMain.handle('mcp:updateServerConfig', async (_, serverId, updates) => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const result = await mcpIntegrationService.updateServer(serverId, updates);
      return { success: true, data: result };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '更新服务器配置失败');
    }
  });

  // 服务器状态和连接处理器
  ipcMain.handle('mcp:getServerStatus', async (_, serverId) => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const status = await mcpIntegrationService.getServerStatus(serverId);
      return { success: true, data: status };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '获取服务器状态失败');
    }
  });

  ipcMain.handle('mcp:testServerConnection', async (_, serverId) => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const result = await mcpIntegrationService.testServerConnection(serverId);
      return { success: true, data: { connected: result } };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '测试连接失败');
    }
  });

  // 工具相关处理器
  ipcMain.handle('mcp:discoverServerTools', async (_, serverId) => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const tools = await mcpIntegrationService.discoverServerTools(serverId);
      const toolData = tools.map(tool => tool.toData());
      return { success: true, data: toolData };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '发现工具失败');
    }
  });

  ipcMain.handle('mcp:callTool', async (_, request) => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const response = await mcpIntegrationService.callTool(request);
      return { success: true, data: response };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '工具调用失败');
    }
  });

  ipcMain.handle('mcp:searchTools', async (_, query) => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const tools = await mcpIntegrationService.searchTools(query);
      const toolData = tools.map(tool => tool.toData());
      return { success: true, data: toolData };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '工具搜索失败');
    }
  });

  ipcMain.handle('mcp:getToolUsageStats', async () => {
    if (!mcpIntegrationService) {
      return createErrorResponse('集成服务未初始化');
    }
    try {
      const stats = await mcpIntegrationService.getToolUsageStats();
      return { success: true, data: stats };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '获取工具使用统计失败');
    }
  });

  // 配置管理处理器
  ipcMain.handle('mcp:exportConfigs', async () => {
    if (!mcpConfigService) {
      return createErrorResponse('配置服务未初始化');
    }
    try {
      const configs = await mcpConfigService.exportConfigs();
      return { success: true, data: configs };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '导出配置失败');
    }
  });

  ipcMain.handle('mcp:importConfigs', async (_, configData) => {
    if (!mcpConfigService) {
      return createErrorResponse('配置服务未初始化');
    }
    try {
      await mcpConfigService.importConfigs(configData);
      return { success: true };
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '导入配置失败');
    }
  });

  // 测试处理器
  ipcMain.handle('mcp:test', async () => {
    return { success: true, message: 'MCP IPC处理器工作正常' };
  });

  handlersRegistered = true;
  console.log('✅ [MCP] 所有IPC处理器预注册完成');
}

/**
 * 注册所有MCP相关的IPC处理器
 */
export async function registerMCPHandlers(): Promise<void> {
  console.log('🔧 [MCP] 开始注册MCP IPC处理器...');

  // 先预注册handlers
  preRegisterMCPHandlers();

  try {
    // 初始化MCP服务
    await initializeMCPServices();

    console.log('✅ [MCP] 所有MCP IPC处理器注册完成');
  } catch (error) {
    console.error('❌ [MCP] MCP IPC处理器注册失败:', error);
    throw error;
  }

  console.log('🎉 [MCP] MCP IPC处理器注册完成！');
}

/**
 * 仅预注册MCP IPC处理器（供主进程早期调用）
 */
export function preRegisterMCPHandlersOnly(): void {
  preRegisterMCPHandlers();
}

/**
 * 注销所有MCP相关的IPC处理器
 */
export function unregisterMCPHandlers(): void {
  console.log('注销MCP IPC处理器...');
  
  // 注销服务器管理处理器
  ipcMain.removeAllListeners('mcp:addServer');
  ipcMain.removeAllListeners('mcp:removeServer');
  ipcMain.removeAllListeners('mcp:getAllServers');
  ipcMain.removeAllListeners('mcp:getServerStatus');
  ipcMain.removeAllListeners('mcp:testServerConnection');
  ipcMain.removeAllListeners('mcp:updateServerConfig');
  
  // 注销工具管理处理器
  ipcMain.removeAllListeners('mcp:discoverServerTools');
  // ipcMain.removeAllListeners('mcp:getAllTools'); // 🔥 由main/index.ts管理
  ipcMain.removeAllListeners('mcp:callTool');
  ipcMain.removeAllListeners('mcp:searchTools');
  ipcMain.removeAllListeners('mcp:getToolUsageStats');
  
  // 注销配置管理处理器
  ipcMain.removeAllListeners('mcp:exportConfigs');
  ipcMain.removeAllListeners('mcp:importConfigs');
  
  // 注销测试处理器
  ipcMain.removeAllListeners('mcp:test');
  
  console.log('MCP IPC处理器注销完成');
}

/**
 * 清理MCP服务资源
 */
export async function cleanupMCPService(): Promise<void> {
  console.log('清理MCP服务资源...');
  console.log('MCP服务资源清理完成');
}