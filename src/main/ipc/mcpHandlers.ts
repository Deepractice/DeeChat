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
  if (!mcpConfigService) {
    mcpConfigService = new MCPConfigService();
  }
  if (!mcpIntegrationService) {
    mcpIntegrationService = MCPIntegrationService.getInstance();
    await mcpIntegrationService.initialize();
  }
}

console.log('🔧 [MCP] mcpHandlers模块导入完成，准备导出函数...')

/**
 * 注册所有MCP相关的IPC处理器
 */
export async function registerMCPHandlers(): Promise<void> {
  console.log('🔧 [MCP] 开始注册MCP IPC处理器...');

  try {
    // 初始化MCP服务
    await initializeMCPServices();

    // 服务器管理处理器
    ipcMain.handle('mcp:addServer', async (_, serverConfig) => {
      console.log('🔧 [MCP] addServer被调用:', serverConfig);
      try {
        // 创建服务器实体
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

        // 保存到配置服务
        await mcpConfigService!.saveServerConfig(server);

        // 添加到集成服务
        await mcpIntegrationService!.addServer(server);

        console.log('✅ [MCP] 服务器添加成功:', server.name);
        return { success: true, data: server.toData() };
      } catch (error) {
        console.error('❌ [MCP] 添加服务器失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '添加服务器失败'
        };
      }
    });

    ipcMain.handle('mcp:removeServer', async (_, serverId) => {
      console.log('🔧 [MCP] removeServer被调用:', serverId);
      try {
        // 从集成服务中移除
        await mcpIntegrationService!.removeServer(serverId);

        // 从配置服务中删除
        await mcpConfigService!.deleteServerConfig(serverId);

        console.log('✅ [MCP] 服务器删除成功:', serverId);
        return { success: true };
      } catch (error) {
        console.error('❌ [MCP] 删除服务器失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '删除服务器失败'
        };
      }
    });

    ipcMain.handle('mcp:getAllServers', async () => {
      console.log('🔧 [MCP] getAllServers被调用');
      try {
        const servers = await mcpConfigService!.getAllServerConfigs();
        const serverData = servers.map(server => server.toData());
        console.log(`✅ [MCP] 获取到 ${servers.length} 个服务器配置`);
        return { success: true, data: serverData };
      } catch (error) {
        console.error('❌ [MCP] 获取服务器列表失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '获取服务器列表失败'
        };
      }
    });

    ipcMain.handle('mcp:getServerStatus', async (_, serverId) => {
      console.log('🔧 [MCP] getServerStatus被调用:', serverId);
      // TODO: 实现获取服务器状态逻辑
      return { success: true, data: { status: 'disconnected' } };
    });

    ipcMain.handle('mcp:testServerConnection', async (_, serverId) => {
      console.log('🔧 [MCP] testServerConnection被调用:', serverId);
      // TODO: 实现测试服务器连接逻辑
      return { success: true, data: { connected: false } };
    });

    ipcMain.handle('mcp:updateServerConfig', async (_, serverId, updates) => {
      console.log('🔧 [MCP] updateServerConfig被调用:', serverId, updates);
      try {
        const result = await mcpIntegrationService!.updateServer(serverId, updates);
        return { success: true, data: result };
      } catch (error) {
        console.error('❌ [MCP] updateServerConfig失败:', error);
        return { success: false, error: error instanceof Error ? error.message : '更新服务器配置失败' };
      }
    });

    // 工具管理处理器
    ipcMain.handle('mcp:discoverServerTools', async (_, serverId) => {
      console.log('🔧 [MCP] discoverServerTools被调用:', serverId);
      try {
        const tools = await mcpIntegrationService!.discoverServerTools(serverId);
        const toolData = tools.map(tool => tool.toData());
        console.log(`✅ [MCP] 发现 ${tools.length} 个工具 (服务器: ${serverId})`);
        return { success: true, data: toolData };
      } catch (error) {
        console.error('❌ [MCP] 发现工具失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '发现工具失败'
        };
      }
    });

    ipcMain.handle('mcp:getAllTools', async () => {
      console.log('🔧 [MCP] getAllTools被调用');
      try {
        const tools = await mcpIntegrationService!.getAllTools();
        const toolData = tools.map(tool => tool.toData());
        console.log(`✅ [MCP] 获取到 ${tools.length} 个工具`);
        return { success: true, data: toolData };
      } catch (error) {
        console.error('❌ [MCP] 获取工具列表失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '获取工具列表失败'
        };
      }
    });

    ipcMain.handle('mcp:callTool', async (_, request) => {
      console.log('🔧 [MCP] callTool被调用:', request);
      try {
        const response = await mcpIntegrationService!.callTool(request);
        console.log(`✅ [MCP] 工具调用成功: ${request.toolName}`);
        return { success: true, data: response };
      } catch (error) {
        console.error('❌ [MCP] 工具调用失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '工具调用失败'
        };
      }
    });

    ipcMain.handle('mcp:searchTools', async (_, query) => {
      console.log('🔧 [MCP] searchTools被调用:', query);
      try {
        const tools = await mcpIntegrationService!.searchTools(query);
        const toolData = tools.map(tool => tool.toData());
        console.log(`✅ [MCP] 搜索到 ${tools.length} 个工具`);
        return { success: true, data: toolData };
      } catch (error) {
        console.error('❌ [MCP] 工具搜索失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '工具搜索失败'
        };
      }
    });

    ipcMain.handle('mcp:getToolUsageStats', async () => {
      console.log('🔧 [MCP] getToolUsageStats被调用');
      try {
        const stats = await mcpIntegrationService!.getToolUsageStats();
        console.log('✅ [MCP] 获取工具使用统计成功');
        return { success: true, data: stats };
      } catch (error) {
        console.error('❌ [MCP] 获取工具使用统计失败:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : '获取工具使用统计失败'
        };
      }
    });

    // 配置管理处理器
    ipcMain.handle('mcp:exportConfigs', async () => {
      console.log('🔧 [MCP] exportConfigs被调用');
      // TODO: 实现导出配置逻辑
      return { success: true, data: '{}' };
    });

    ipcMain.handle('mcp:importConfigs', async (_, configData) => {
      console.log('🔧 [MCP] importConfigs被调用:', configData);
      // TODO: 实现导入配置逻辑
      return { success: true };
    });

    // 测试处理器（保留原有功能）
    ipcMain.handle('mcp:test', async () => {
      console.log('🔧 [MCP] 测试处理器被调用');
      return { success: true, message: 'MCP IPC处理器工作正常' };
    });

    console.log('✅ [MCP] 所有MCP IPC处理器注册完成');
  } catch (error) {
    console.error('❌ [MCP] MCP IPC处理器注册失败:', error);
    throw error;
  }

  console.log('🎉 [MCP] MCP IPC处理器注册完成！');
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
  ipcMain.removeAllListeners('mcp:getAllTools');
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