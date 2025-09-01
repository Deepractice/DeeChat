/**
 * MCP功能的IPC处理器 - 简化版
 * 为渲染进程提供基础MCP功能的访问接口
 * 使用简化的MCPClient直接连接
 */

import { ipcMain } from 'electron';
// import log from 'electron-log'; // 未使用
import { MCPClient, MCPConfigService } from '../services/mcp/client/index.js';

console.log('🔧 [MCP] mcpHandlers模块开始加载...')

// 全局MCP客户端实例
let mcpClient: MCPClient | null = null;
let mcpConfigService: MCPConfigService | null = null;

// 初始化MCP服务
async function initializeMCPServices() {
  try {
    if (!mcpConfigService) {
      mcpConfigService = new MCPConfigService();
    }
    
    if (!mcpClient) {
      mcpClient = new MCPClient();
      console.log(`✅ [MCP] MCPClient初始化完成`);
    }
  } catch (error) {
    console.error('❌ [MCP] 服务初始化失败:', error);
    throw error;
  }
}

// 创建错误响应的辅助函数
function createErrorResponse(message: string) {
  return { success: false, error: message };
}

// 创建成功响应的辅助函数
function createSuccessResponse(data: any = null) {
  return { success: true, data };
}

export function registerMCPHandlers() {
  console.log('🔧 [MCP] 注册MCP IPC处理器...')

  // 初始化MCP服务
  ipcMain.handle('mcp:initialize', async () => {
    try {
      await initializeMCPServices();
      return createSuccessResponse({ message: 'MCP服务初始化成功' });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '初始化失败');
    }
  });

  // 连接到MCP服务器
  ipcMain.handle('mcp:connectServer', async (_, config: {
    serverId: string;
    transport: 'stdio' | 'http' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
  }) => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      await mcpClient.connectServer(config);
      return createSuccessResponse({ message: `已连接到服务器: ${config.serverId}` });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '连接失败');
    }
  });

  // 断开MCP服务器
  ipcMain.handle('mcp:disconnectServer', async (_, serverId: string) => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      await mcpClient.disconnectServer(serverId);
      return createSuccessResponse({ message: `已断开服务器: ${serverId}` });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '断开连接失败');
    }
  });

  // 获取服务器工具列表
  ipcMain.handle('mcp:listTools', async (_, serverId: string) => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      const tools = await mcpClient.listTools(serverId);
      return createSuccessResponse(tools);
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '获取工具列表失败');
    }
  });

  // 调用工具
  ipcMain.handle('mcp:callTool', async (_, request: {
    serverId: string;
    toolName: string;
    arguments: any;
  }) => {
    console.log('🔧 [MCP-IPC] 收到工具调用请求:', {
      serverId: request.serverId,
      toolName: request.toolName,
      arguments: request.arguments,
      argumentsType: typeof request.arguments,
      argumentsKeys: Object.keys(request.arguments || {}),
      argumentsJSON: JSON.stringify(request.arguments, null, 2)
    });
    
    if (!mcpClient) {
      console.log('❌ [MCP-IPC] MCP客户端未初始化');
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      console.log('🚀 [MCP-IPC] 开始调用MCP客户端...');
      const result = await mcpClient.callTool(request.serverId, request.toolName, request.arguments);
      console.log('✅ [MCP-IPC] MCP工具调用成功:', result);
      return createSuccessResponse(result);
    } catch (error) {
      console.log('❌ [MCP-IPC] MCP工具调用失败:', error);
      return createErrorResponse(error instanceof Error ? error.message : '工具调用失败');
    }
  });

  // 获取已连接的服务器列表
  ipcMain.handle('mcp:getConnectedServers', async () => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      const servers = mcpClient.getConnectedServers();
      return createSuccessResponse(servers);
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '获取服务器列表失败');
    }
  });

  // 检查服务器连接状态
  ipcMain.handle('mcp:isServerConnected', async (_, serverId: string) => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      const connected = mcpClient.isServerConnected(serverId);
      return createSuccessResponse({ connected });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '检查连接状态失败');
    }
  });

  // 获取客户端统计信息
  ipcMain.handle('mcp:getStats', async () => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      const stats = mcpClient.getStats();
      return createSuccessResponse(stats);
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '获取统计信息失败');
    }
  });

  // 关闭所有连接
  ipcMain.handle('mcp:close', async () => {
    if (!mcpClient) {
      return createErrorResponse('MCP客户端未初始化');
    }
    
    try {
      await mcpClient.close();
      mcpClient = null; // 重置实例
      return createSuccessResponse({ message: '所有MCP连接已关闭' });
    } catch (error) {
      return createErrorResponse(error instanceof Error ? error.message : '关闭连接失败');
    }
  });

  console.log('✅ [MCP] MCP IPC处理器注册完成')
}

// 自动注册处理器
registerMCPHandlers();