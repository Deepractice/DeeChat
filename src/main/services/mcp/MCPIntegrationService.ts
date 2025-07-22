/**
 * MCP集成服务
 * 提供MCP服务器和工具的统一管理接口
 */

import { MCPServerEntity } from '../../../shared/entities/MCPServerEntity'
import { MCPToolEntity } from '../../../shared/entities/MCPToolEntity'
import {
  IMCPProvider,
  MCPConnectionStatus,
  MCPServerStatus,
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPEvent,
  MCPEventType
} from '../../../shared/interfaces/IMCPProvider'
import { MCPClientManager } from './MCPClientManager'
import { MCPConfigService } from './MCPConfigService'
import { MCPCacheService } from './MCPCacheService'

export class MCPIntegrationService implements IMCPProvider {
  private static instance: MCPIntegrationService | null = null;
  private clientManager: MCPClientManager;
  private configService: MCPConfigService;
  private cacheService: MCPCacheService;
  private eventListeners: ((event: MCPEvent) => void)[] = [];
  private serverStatusCache: Map<string, MCPServerStatus> = new Map();
  private isInitialized: boolean = false;

  private constructor() {
    this.clientManager = new MCPClientManager();
    this.configService = new MCPConfigService();
    this.cacheService = new MCPCacheService();

    // 监听客户端管理器事件
    this.clientManager.onEvent((event) => {
      this.handleClientEvent(event);
    });
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MCPIntegrationService {
    if (!MCPIntegrationService.instance) {
      MCPIntegrationService.instance = new MCPIntegrationService();
    }
    return MCPIntegrationService.instance;
  }

  /**
   * 初始化服务（只执行一次）
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔄 [MCP] 服务已初始化，跳过重复初始化');
      return;
    }

    console.log('🚀 [MCP] 开始初始化MCP集成服务...');
    this.isInitialized = true;

    // 🔥 自动初始化已启用的服务器（添加异常处理）
    try {
      console.log('🔧 [MCP] 开始调用initializeEnabledServers()...');
      await this.initializeEnabledServers();
      console.log('✅ [MCP] initializeEnabledServers()完成');
    } catch (error) {
      console.error('❌ [MCP] initializeEnabledServers()失败:', error);
      // 不抛出异常，允许服务继续初始化
    }

    // 启动工具发现预热（异步执行，不阻塞初始化）
    console.log('🔧 [MCP] 开始启动工具发现预热...');
    this.startToolDiscoveryPrewarm();
    console.log('✅ [MCP] MCP集成服务初始化完成');
  }

  /**
   * 启动工具发现预热
   */
  private startToolDiscoveryPrewarm(): void {
    // 延迟5秒后开始预热，确保服务器连接稳定
    setTimeout(async () => {
      try {
        console.log('🔥 [MCP] 开始工具发现预热...');
        const servers = await this.configService.getAllServerConfigs();
        const enabledServers = servers.filter(server => server.isEnabled);

        for (const server of enabledServers) {
          try {
            // 检查是否已有缓存
            const cachedTools = this.cacheService.getCachedServerTools(server.id);
            if (!cachedTools || cachedTools.length === 0) {
              console.log(`🔥 [MCP] 预热发现工具: ${server.name}`);
              await this.discoverServerTools(server.id);
            } else {
              console.log(`✅ [MCP] 工具已缓存，跳过预热: ${server.name} (${cachedTools.length}个工具)`);
            }
          } catch (error) {
            console.warn(`⚠️ [MCP] 预热失败: ${server.name}`, error);
          }
        }
        console.log('✅ [MCP] 工具发现预热完成');
      } catch (error) {
        console.warn('⚠️ [MCP] 工具发现预热过程出错:', error);
      }
    }, 5000);
  }

  /**
   * 初始化所有已启用的服务器
   */
  private async initializeEnabledServers(): Promise<void> {
    try {
      console.log('🚀 [MCP] 开始初始化已启用的服务器...');

      console.log('🔧 [MCP] 调用configService.getAllServerConfigs()...');
      const servers = await this.configService.getAllServerConfigs();
      console.log(`📊 [MCP] 获取到 ${servers.length} 个服务器配置`);

      // 🔥 详细显示每个服务器的状态
      servers.forEach((server, index) => {
        console.log(`  ${index + 1}. ${server.name} (${server.id}) - 启用: ${server.isEnabled}`);
      });

      const enabledServers = servers.filter(server => server.isEnabled);
      console.log(`📋 [MCP] 发现 ${enabledServers.length} 个已启用的服务器`);

      if (enabledServers.length === 0) {
        console.warn('⚠️ [MCP] 没有找到已启用的服务器！');
        return;
      }

      for (const server of enabledServers) {
        try {
          console.log(`🔌 [MCP] 初始化服务器: ${server.name}`);
          console.log(`🔧 [MCP] 服务器详情:`, {
            id: server.id,
            name: server.name,
            type: server.type,
            command: server.command,
            isEnabled: server.isEnabled
          });

          await this.connectServer(server.id);
          console.log(`✅ [MCP] 服务器初始化成功: ${server.name}`);
        } catch (error) {
          console.error(`❌ [MCP] 服务器初始化失败: ${server.name}`);
          console.error(`💥 [MCP] 错误详情:`, error);
        }
      }

      console.log('🎉 [MCP] 服务器初始化完成');
    } catch (error) {
      console.error('❌ [MCP] 服务器初始化过程出错:', error);
      console.error('💥 [MCP] 错误详情:', error);
      if (error instanceof Error) {
        console.error('📍 [MCP] 错误堆栈:', error.stack);
      }
      throw error; // 重新抛出，让上层的try-catch处理
    }
  }

  /**
   * 添加MCP服务器
   */
  async addServer(server: MCPServerEntity): Promise<void> {
    console.log(`🔧 [MCP] 添加服务器: ${server.name} (ID: ${server.id})`);

    // 验证服务器配置
    const validation = server.validate();
    if (!validation.isValid) {
      throw new Error(`服务器配置无效: ${validation.errors.join(', ')}`);
    }

    // 保存配置
    console.log(`💾 [MCP] 保存服务器配置: ${server.name}`);
    await this.configService.saveServerConfig(server);

    // 如果服务器启用，尝试连接
    if (server.isEnabled) {
      try {
        console.log(`🔌 [MCP] 尝试连接服务器: ${server.name}`);
        await this.connectServer(server.id);
        console.log(`✅ [MCP] 服务器连接成功: ${server.name}`);
      } catch (error) {
        console.warn(`⚠️ [MCP] 服务器连接失败: ${server.name}`, error);
        // 不抛出错误，允许保存配置但标记为连接失败
      }
    } else {
      console.log(`⏸️ [MCP] 服务器已禁用，跳过连接: ${server.name}`);
    }

    this.emitEvent({
      type: MCPEventType.SERVER_CONNECTED,
      serverId: server.id,
      timestamp: new Date(),
      data: { serverName: server.name }
    });

    console.log(`🎉 [MCP] 服务器添加完成: ${server.name}`);
  }

  /**
   * 移除MCP服务器
   */
  async removeServer(serverId: string): Promise<void> {
    console.log(`[MCP] 移除服务器: ${serverId}`);

    // 断开连接
    await this.clientManager.disconnectClient(serverId);

    // 删除配置
    await this.configService.deleteServerConfig(serverId);

    // 清理缓存
    this.cacheService.invalidateServer(serverId);
    this.serverStatusCache.delete(serverId);

    this.emitEvent({
      type: MCPEventType.SERVER_DISCONNECTED,
      serverId,
      timestamp: new Date()
    });
  }

  /**
   * 获取所有服务器
   */
  async getAllServers(): Promise<MCPServerEntity[]> {
    return await this.configService.getAllServerConfigs();
  }

  /**
   * 更新服务器配置
   */
  async updateServer(serverId: string, updates: any): Promise<void> {
    console.log(`🔧 [MCP] 更新服务器: ${serverId}`, updates);

    // 获取当前配置
    const currentServer = await this.configService.getServerConfig(serverId);
    if (!currentServer) {
      throw new Error(`服务器不存在: ${serverId}`);
    }

    console.log(`📋 [MCP] 更新前状态: isEnabled=${currentServer.isEnabled}`);

    // 更新配置
    currentServer.update(updates);

    console.log(`📋 [MCP] 更新后状态: isEnabled=${currentServer.isEnabled}`);

    // 保存配置
    await this.configService.saveServerConfig(currentServer);
    console.log(`💾 [MCP] 配置已保存到存储`);

    // 如果启用状态发生变化，处理连接
    if (updates.hasOwnProperty('isEnabled')) {
      if (updates.isEnabled) {
        console.log(`🔌 [MCP] 启用服务器: ${serverId}`);
        try {
          await this.connectServer(serverId);
          console.log(`✅ [MCP] 服务器启用成功: ${serverId}`);
        } catch (error) {
          console.error(`❌ [MCP] 服务器启用失败: ${serverId}`, error);
          // 启用失败时，将状态回滚为禁用
          currentServer.isEnabled = false;
          await this.configService.saveServerConfig(currentServer);
          throw error; // 重新抛出错误
        }
      } else {
        // 禁用服务器：断开连接并清理缓存
        console.log(`⏸️ [MCP] 禁用服务器: ${serverId}`);
        await this.clientManager.disconnectClient(serverId);

        // 清理工具缓存
        const hadCache = this.cacheService.getCachedServerTools(serverId) !== null;
        this.cacheService.invalidateServerTools(serverId);
        console.log(`🗑️ [MCP] 已清理服务器工具缓存: ${serverId}, 之前有缓存: ${hadCache}`);

        // 清理服务器状态缓存
        this.serverStatusCache.delete(serverId);
        console.log(`🗑️ [MCP] 已清理服务器状态缓存: ${serverId}`);
      }
    }

    console.log(`✅ [MCP] 服务器更新完成`);
  }

  /**
   * 获取服务器状态
   */
  async getServerStatus(serverId: string): Promise<MCPServerStatus> {
    // 检查缓存
    const cached = this.serverStatusCache.get(serverId);
    if (cached) {
      return cached;
    }

    // 获取服务器配置
    const server = await this.configService.getServerConfig(serverId);
    if (!server) {
      throw new Error(`服务器不存在: ${serverId}`);
    }

    // 获取客户端状态
    const client = this.clientManager.getClient(serverId);
    const cachedTools = this.cacheService.getCachedServerTools(serverId);
    const status: MCPServerStatus = {
      serverId,
      status: client ? client.getStatus() : MCPConnectionStatus.DISCONNECTED,
      toolCount: cachedTools?.length || 0
    };

    // 如果连接，获取服务器信息
    if (client && status.status === MCPConnectionStatus.CONNECTED) {
      try {
        const serverInfo = await client.getServerInfo();
        status.version = serverInfo.version;
        status.lastConnected = new Date();
      } catch (error) {
        console.warn(`[MCP] 获取服务器信息失败: ${serverId}`, error);
      }
    }

    // 缓存状态
    this.serverStatusCache.set(serverId, status);
    return status;
  }

  /**
   * 测试服务器连接
   */
  async testServerConnection(serverId: string): Promise<boolean> {
    console.log(`[MCP] 测试服务器连接: ${serverId}`);

    try {
      const server = await this.configService.getServerConfig(serverId);
      if (!server) {
        return false;
      }

      // 创建临时客户端进行测试
      const client = await this.clientManager.createClient(server);
      const result = await client.testConnection();
      
      // 测试完成后断开连接
      await client.disconnect();
      
      return result;
    } catch (error) {
      console.error(`[MCP] 连接测试失败: ${serverId}`, error);
      return false;
    }
  }

  /**
   * 发现服务器工具
   */
  async discoverServerTools(serverId: string): Promise<MCPToolEntity[]> {
    console.log(`🔍 [MCP] 发现服务器工具: ${serverId}`);

    // 检查缓存
    const cachedTools = this.cacheService.getCachedServerTools(serverId);
    if (cachedTools) {
      console.log(`📦 [MCP] 使用缓存的工具列表: ${serverId} (${cachedTools.length}个工具)`);
      return cachedTools;
    }

    const client = this.clientManager.getClient(serverId);
    if (!client) {
      console.error(`❌ [MCP] 服务器未连接: ${serverId}`);
      throw new Error(`服务器未连接: ${serverId}`);
    }

    try {
      console.log(`🔎 [MCP] 开始发现工具: ${serverId}`);
      const tools = await client.discoverTools();
      console.log(`✅ [MCP] 发现 ${tools.length} 个工具: ${serverId}`);

      // 缓存工具列表
      this.cacheService.cacheServerTools(serverId, tools);
      console.log(`💾 [MCP] 工具已缓存: ${serverId}`);

      this.emitEvent({
        type: MCPEventType.TOOL_DISCOVERED,
        serverId,
        timestamp: new Date(),
        data: { toolCount: tools.length }
      });

      return tools;
    } catch (error) {
      console.error(`❌ [MCP] 工具发现失败: ${serverId}`, error);
      throw error;
    }
  }

  /**
   * 获取所有可用工具
   */
  async getAllTools(): Promise<MCPToolEntity[]> {
    const allTools = this.cacheService.getAllCachedTools();
    const serverIds = this.cacheService.getAllCachedServerIds();

    console.log(`📋 [MCP] 获取所有工具，当前缓存服务器数: ${serverIds.length}`);

    // 按服务器分组显示日志
    for (const serverId of serverIds) {
      const serverTools = this.cacheService.getCachedServerTools(serverId);
      if (serverTools) {
        console.log(`📦 [MCP] 服务器 ${serverId} 有 ${serverTools.length} 个工具`);
      }
    }

    console.log(`✅ [MCP] 总共获取到 ${allTools.length} 个工具`);
    return allTools;
  }

  /**
   * 调用工具
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    console.log(`[MCP] 调用工具: ${request.serverId}:${request.toolName}`);

    // 检查缓存
    const cachedResponse = this.cacheService.getCachedToolCall(
      request.serverId,
      request.toolName,
      request.arguments
    );
    if (cachedResponse) {
      console.log(`[MCP] 使用缓存的工具调用结果: ${request.toolName}`);
      return cachedResponse;
    }

    const client = this.clientManager.getClient(request.serverId);
    if (!client) {
      throw new Error(`服务器未连接: ${request.serverId}`);
    }

    const startTime = Date.now();

    try {
      const response = await client.callTool(request);
      const duration = Date.now() - startTime;

      // 缓存成功的调用结果
      if (response.success) {
        this.cacheService.cacheToolCall(
          request.serverId,
          request.toolName,
          request.arguments,
          response
        );
      }

      // 更新工具使用统计
      const tools = this.cacheService.getCachedServerTools(request.serverId) || [];
      const tool = tools.find((t: MCPToolEntity) => t.name === request.toolName);
      if (tool) {
        tool.recordUsage();
      }

      this.emitEvent({
        type: MCPEventType.TOOL_CALLED,
        serverId: request.serverId,
        timestamp: new Date(),
        data: {
          toolName: request.toolName,
          duration,
          success: response.success
        }
      });

      return {
        ...response,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.emitEvent({
        type: MCPEventType.TOOL_ERROR,
        serverId: request.serverId,
        timestamp: new Date(),
        data: {
          toolName: request.toolName,
          duration
        },
        error: error instanceof Error ? error.message : '未知错误'
      });

      throw error;
    }
  }

  /**
   * 搜索工具
   */
  async searchTools(query: string): Promise<MCPToolEntity[]> {
    const allTools = await this.getAllTools();
    return allTools.filter(tool => tool.matches(query));
  }

  /**
   * 获取工具使用统计
   */
  async getToolUsageStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};
    const allTools = this.cacheService.getAllCachedTools();

    for (const tool of allTools) {
      stats[tool.id] = tool.usageCount;
    }

    return stats;
  }

  /**
   * 设置事件监听器
   */
  onEvent(callback: (event: MCPEvent) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    console.log('[MCP] 清理资源');

    await this.clientManager.cleanup();
    this.cacheService.destroy();
    this.serverStatusCache.clear();
    this.eventListeners.length = 0;
  }

  /**
   * 连接服务器
   */
  private async connectServer(serverId: string): Promise<void> {
    console.log(`🔗 [MCP] 开始连接服务器: ${serverId}`);
    const server = await this.configService.getServerConfig(serverId);
    if (!server) {
      throw new Error(`服务器配置不存在: ${serverId}`);
    }

    console.log(`🔗 [MCP] 调用clientManager.connectClient: ${serverId}`);
    await this.clientManager.connectClient(server);
    console.log(`✅ [MCP] 客户端连接完成: ${serverId}`);

    // 🔥 PromptX插件需要先初始化再发现工具
    if (serverId === 'promptx-builtin') {
      try {
        console.log(`🎯 [MCP] 开始PromptX自动初始化: ${serverId}`);
        await this.initializePromptXPlugin(serverId);
        console.log(`✅ [MCP] PromptX初始化完成: ${serverId}`);
      } catch (error) {
        console.warn(`⚠️ [MCP] PromptX初始化失败: ${serverId}`, error);
        // 初始化失败时，仍然尝试发现工具（可能有基础工具可用）
      }
    }

    // 连接成功后发现工具（PromptX初始化后或其他服务器直接发现）
    try {
      console.log(`🔍 [MCP] 开始发现工具: ${serverId}`);
      // 优化重试机制：减少重试次数，提高响应速度
      const maxRetries = serverId === 'promptx-builtin' ? 3 : 2;
      await this.discoverServerToolsWithRetry(serverId, maxRetries);
      console.log(`✅ [MCP] 工具发现完成: ${serverId}`);
    } catch (error) {
      console.error(`❌ [MCP] 工具发现失败: ${serverId}`, error);
      throw error; // 重新抛出错误，让上层知道启用失败
    }
  }

  /**
   * 初始化PromptX插件
   */
  private async initializePromptXPlugin(serverId: string): Promise<void> {
    const { app } = require('electron');
    const path = require('path');

    // 获取AppData中的PromptX工作空间路径
    const workingDirectory = path.join(app.getPath('userData'), 'promptx-workspace');

    console.log(`🎯 [MCP] PromptX工作目录: ${workingDirectory}`);

    try {
      // 调用promptx_init工具进行初始化
      const response = await this.callTool({
        serverId: serverId,
        toolName: 'promptx_init',
        arguments: {
          workingDirectory: workingDirectory,
          ideType: 'electron'
        }
      });

      console.log(`✅ [MCP] PromptX初始化响应:`, response.result);
    } catch (error) {
      console.error(`❌ [MCP] PromptX初始化调用失败:`, error);
      throw error;
    }
  }

  /**
   * 处理客户端事件
   */
  private handleClientEvent(event: MCPEvent): void {
    // 更新服务器状态缓存
    if (event.type === MCPEventType.SERVER_CONNECTED || 
        event.type === MCPEventType.SERVER_DISCONNECTED ||
        event.type === MCPEventType.SERVER_ERROR) {
      this.serverStatusCache.delete(event.serverId);
    }

    // 转发事件
    this.emitEvent(event);
  }

  /**
   * 带重试机制的工具发现
   */
  private async discoverServerToolsWithRetry(serverId: string, maxRetries: number = 3): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [MCP] 工具发现尝试 ${attempt}/${maxRetries}: ${serverId}`);
        await this.discoverServerTools(serverId);

        // 检查是否成功发现了工具
        const tools = this.cacheService.getCachedServerTools(serverId);
        if (tools && tools.length > 0) {
          console.log(`✅ [MCP] 成功发现 ${tools.length} 个工具: ${serverId}`);
          return; // 成功，退出重试循环
        } else {
          console.warn(`⚠️ [MCP] 尝试 ${attempt} 未发现工具: ${serverId}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ [MCP] 工具发现尝试 ${attempt} 失败: ${serverId}`, error);
      }

      // 如果不是最后一次尝试，等待后重试（优化延迟时间）
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // 1秒、2秒（大幅减少延迟）
        console.log(`⏳ [MCP] 等待 ${delay}ms 后重试: ${serverId}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 所有重试都失败了
    if (lastError) {
      console.error(`❌ [MCP] 工具发现最终失败 (${maxRetries} 次尝试): ${serverId}`, lastError);
      throw lastError;
    } else {
      const error = new Error(`工具发现失败，未发现任何工具 (${maxRetries} 次尝试)`);
      console.error(`❌ [MCP] ${error.message}: ${serverId}`);
      throw error;
    }
  }

  /**
   * 发送事件
   */
  private emitEvent(event: MCPEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[MCP] 事件监听器错误:', error);
      }
    }
  }
}
