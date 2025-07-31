/**
 * MCP集成服务
 * 提供MCP服务器和工具的统一管理接口
 */

import log from 'electron-log'
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
// import { MCPSandboxManager } from '../runtime/MCPSandboxManager'

export class MCPIntegrationService implements IMCPProvider {
  private static instance: MCPIntegrationService | null = null;
  private clientManager: MCPClientManager;
  private configService: MCPConfigService;
  private cacheService: MCPCacheService;
  private eventListeners: ((event: MCPEvent) => void)[] = [];
  private serverStatusCache: Map<string, MCPServerStatus> = new Map();
  private isInitialized: boolean = false;
  private isInitializing: boolean = false; // 🔥 新增：初始化中状态

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
   * 初始化服务（只执行一次，添加进程锁定）
   */
  public async initialize(): Promise<void> {
    // 🔥 防止重复初始化
    if (this.isInitialized) {
      log.info('🔄 [MCP] 服务已初始化，跳过重复初始化');
      return;
    }
    
    if (this.isInitializing) {
      log.info('⏳ [MCP] 服务正在初始化中，等待完成...');
      // 🔥 简化等待逻辑，避免复杂的死锁场景
      // 直接返回，让调用方处理重试逻辑
      return;
    }

    // 🔥 设置初始化中状态
    this.isInitializing = true;

    // 🔥 防止多进程同时初始化的锁定机制
    const lockKey = 'mcp_initialization_lock';
    const { app } = require('electron');
    const fs = require('fs');
    const path = require('path');
    
    const lockFile = path.join(app.getPath('userData'), `${lockKey}.lock`);
    
    try {
      // 检查锁文件是否存在
      if (fs.existsSync(lockFile)) {
        const lockTime = fs.statSync(lockFile).mtime.getTime();
        const now = Date.now();
        
        // 如果锁文件超过30秒，认为是僵尸锁，清除它
        if (now - lockTime > 30000) {
          log.warn('🧹 [MCP] 清除过期的初始化锁');
          fs.unlinkSync(lockFile);
        } else {
          log.info('⏳ [MCP] 其他进程正在初始化，等待完成...');
          this.isInitializing = false; // 重置初始化状态
          return;
        }
      }
      
      // 创建锁文件
      fs.writeFileSync(lockFile, process.pid.toString());
      log.info('🔒 [MCP] 获得初始化锁');
      
    } catch (error) {
      log.warn('⚠️ [MCP] 无法创建初始化锁文件，继续初始化');
    }

    try {
      log.info('🚀 [MCP] 开始初始化MCP集成服务...');

      // 🔥 自动初始化已启用的服务器（添加异常处理）
      try {
        log.info('🚀 [MCP] 开始执行initializeEnabledServers...');
        await this.initializeEnabledServers();
        log.info('✅ [MCP] initializeEnabledServers执行完成');
      } catch (error) {
        log.error('❌ [MCP] initializeEnabledServers()失败:', error);
        if (error instanceof Error) {
          log.error('🔍 [MCP] 错误详情:', {
            message: error.message,
            stack: error.stack,
            name: error.name
          });
        }
        // 🔥 初始化失败时抛出异常，不设置isInitialized为true
        throw error;
      }

      // 启动工具发现预热（异步执行，不阻塞初始化）
      this.startToolDiscoveryPrewarm();
      
      // 🔥 只有所有关键步骤成功后才标记为已初始化
      this.isInitialized = true;
      log.info('✅ [MCP] 集成服务初始化完成');
      
    } catch (error) {
      log.error('❌ [MCP] 集成服务初始化失败:', error);
      // 🔥 初始化失败时重置状态
      this.isInitialized = false;
      throw error; // 重新抛出异常
    } finally {
      // 🔥 无论成功失败都要重置初始化中状态和清理锁文件
      this.isInitializing = false;
      
      try {
        if (fs.existsSync(lockFile)) {
          fs.unlinkSync(lockFile);
          log.info('🔓 [MCP] 释放初始化锁');
        }
      } catch (error) {
        log.warn('⚠️ [MCP] 无法清理初始化锁文件:', error);
      }
    }
  }


  /**
   * 启动工具发现预热
   */
  private startToolDiscoveryPrewarm(): void {
    // 延迟5秒后开始预热，确保服务器连接稳定
    setTimeout(async () => {
      try {
        log.info('🔥 [MCP] 开始工具发现预热...');
        const servers = await this.configService.getAllServerConfigs();
        const enabledServers = servers.filter(server => server.isEnabled);

        for (const server of enabledServers) {
          try {
            // 检查是否已有缓存
            const cachedTools = this.cacheService.getCachedServerTools(server.id);
            if (!cachedTools || cachedTools.length === 0) {
              log.info(`🔥 [MCP] 预热发现工具: ${server.name}`);
              await this.discoverServerTools(server.id);
            } else {
              log.info(`✅ [MCP] 工具已缓存，跳过预热: ${server.name} (${cachedTools.length}个工具)`);
            }
          } catch (error) {
            log.warn(`⚠️ [MCP] 预热失败: ${server.name}`, error);
          }
        }
        log.info('✅ [MCP] 工具发现预热完成');
      } catch (error) {
        log.warn('⚠️ [MCP] 工具发现预热过程出错:', error);
      }
    }, 5000);
  }

  /**
   * 初始化所有已启用的服务器
   */
  private async initializeEnabledServers(): Promise<void> {
    try {
      log.info('🔧 [MCP] 开始获取所有服务器配置...');
      const servers = await this.configService.getAllServerConfigs();
      log.info(`📋 [MCP] 获取到 ${servers.length} 个服务器配置`);
      
      const enabledServers = servers.filter(server => server.isEnabled);
      log.info(`🔍 [MCP] 其中 ${enabledServers.length} 个服务器已启用`);
      
      if (enabledServers.length > 0) {
        log.info(`📋 [MCP] 即将初始化 ${enabledServers.length} 个已启用服务器:`);
        enabledServers.forEach((server, index) => {
          log.info(`  ${index + 1}. ${server.name} (${server.id}) - ${server.type}`);
        });
      }

      if (enabledServers.length === 0) {
        log.warn('⚠️ [MCP] 没有找到已启用的服务器！');
        log.info('🔍 [MCP] 所有服务器状态:');
        servers.forEach((server, index) => {
          log.info(`  ${index + 1}. ${server.name} - 启用状态: ${server.isEnabled}`);
        });
        return;
      }

      // 🔥 使用Promise.allSettled避免一个服务器失败影响其他服务器
      log.info('🚀 [MCP] 开始并行连接所有启用的服务器...');
      const initPromises = enabledServers.map(async (server, index) => {
        try {
          log.info(`🔌 [MCP] [${index + 1}/${enabledServers.length}] 开始初始化服务器: ${server.name}`);
          log.info(`🔧 [MCP] 服务器详情:`, {
            id: server.id,
            name: server.name,
            type: server.type,
            command: server.command,
            args: server.args,
            workingDirectory: server.workingDirectory,
            isEnabled: server.isEnabled
          });

          log.info(`🔗 [MCP] 调用connectServer: ${server.id}`);
          await this.connectServer(server.id);
          log.info(`✅ [MCP] [${index + 1}/${enabledServers.length}] 服务器连接成功: ${server.name}`);
          log.info(`✅ [MCP] 服务器初始化成功: ${server.name}`);
          return { success: true, serverId: server.id, serverName: server.name };
        } catch (error) {
          log.error(`❌ [MCP] 服务器初始化失败: ${server.name}`);
          log.error(`💥 [MCP] 错误详情:`, error);
          return { success: false, serverId: server.id, serverName: server.name, error };
        }
      });

      const results = await Promise.allSettled(initPromises);
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          failureCount++;
          log.error(`❌ [MCP] 服务器初始化Promise失败: ${enabledServers[index].name}`, result.reason);
        }
      });

      log.info(`🎉 [MCP] 服务器初始化完成: 成功 ${successCount}/${enabledServers.length}, 失败 ${failureCount}`);
    } catch (error) {
      log.error('❌ [MCP] 服务器初始化过程出错:', error);
      log.error('💥 [MCP] 错误详情:', error);
      if (error instanceof Error) {
        log.error('📍 [MCP] 错误堆栈:', error.stack);
      }
      throw error; // 重新抛出，让上层的try-catch处理
    }
  }

  /**
   * 添加MCP服务器
   */
  async addServer(server: MCPServerEntity): Promise<void> {
    log.info(`🔧 [MCP] 添加服务器: ${server.name} (ID: ${server.id})`);

    // 验证服务器配置
    const validation = server.validate();
    if (!validation.isValid) {
      throw new Error(`服务器配置无效: ${validation.errors.join(', ')}`);
    }

    // 保存配置
    log.info(`💾 [MCP] 保存服务器配置: ${server.name}`);
    await this.configService.saveServerConfig(server);

    // 如果服务器启用，尝试连接
    if (server.isEnabled) {
      try {
        log.info(`🔌 [MCP] 尝试连接服务器: ${server.name}`);
        await this.connectServer(server.id);
        log.info(`✅ [MCP] 服务器连接成功: ${server.name}`);
      } catch (error) {
        log.warn(`⚠️ [MCP] 服务器连接失败: ${server.name}`, error);
        // 不抛出错误，允许保存配置但标记为连接失败
      }
    } else {
      log.info(`⏸️ [MCP] 服务器已禁用，跳过连接: ${server.name}`);
    }

    this.emitEvent({
      type: MCPEventType.SERVER_CONNECTED,
      serverId: server.id,
      timestamp: new Date(),
      data: { serverName: server.name }
    });

    log.info(`🎉 [MCP] 服务器添加完成: ${server.name}`);
  }

  /**
   * 移除MCP服务器
   */
  async removeServer(serverId: string): Promise<void> {
    log.info(`[MCP] 移除服务器: ${serverId}`);

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
    log.info(`🔧 [MCP] 更新服务器: ${serverId}`, updates);

    // 获取当前配置
    const currentServer = await this.configService.getServerConfig(serverId);
    if (!currentServer) {
      throw new Error(`服务器不存在: ${serverId}`);
    }

    log.info(`📋 [MCP] 更新前状态: isEnabled=${currentServer.isEnabled}`);

    // 更新配置
    currentServer.update(updates);

    log.info(`📋 [MCP] 更新后状态: isEnabled=${currentServer.isEnabled}`);

    // 保存配置
    await this.configService.saveServerConfig(currentServer);
    log.info(`💾 [MCP] 配置已保存到存储`);

    // 如果启用状态发生变化，处理连接
    if (updates.hasOwnProperty('isEnabled')) {
      if (updates.isEnabled) {
        log.info(`🔌 [MCP] 启用服务器: ${serverId}`);
        try {
          await this.connectServer(serverId);
          log.info(`✅ [MCP] 服务器启用成功: ${serverId}`);
        } catch (error) {
          log.error(`❌ [MCP] 服务器启用失败: ${serverId}`, error);
          // 启用失败时，将状态回滚为禁用
          currentServer.isEnabled = false;
          await this.configService.saveServerConfig(currentServer);
          throw error; // 重新抛出错误
        }
      } else {
        // 禁用服务器：断开连接并清理缓存
        log.info(`⏸️ [MCP] 禁用服务器: ${serverId}`);
        await this.clientManager.disconnectClient(serverId);

        // 清理工具缓存
        const hadCache = this.cacheService.getCachedServerTools(serverId) !== null;
        this.cacheService.invalidateServerTools(serverId);
        log.info(`🗑️ [MCP] 已清理服务器工具缓存: ${serverId}, 之前有缓存: ${hadCache}`);

        // 清理服务器状态缓存
        this.serverStatusCache.delete(serverId);
        log.info(`🗑️ [MCP] 已清理服务器状态缓存: ${serverId}`);
      }
    }

    log.info(`✅ [MCP] 服务器更新完成`);
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
        log.warn(`[MCP] 获取服务器信息失败: ${serverId}`, error);
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
    log.info(`[MCP] 测试服务器连接: ${serverId}`);

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
      log.error(`[MCP] 连接测试失败: ${serverId}`, error);
      return false;
    }
  }

  /**
   * 发现服务器工具
   */
  async discoverServerTools(serverId: string): Promise<MCPToolEntity[]> {
    log.info(`🔍 [MCP] 发现服务器工具: ${serverId}`);

    // 检查缓存
    const cachedTools = this.cacheService.getCachedServerTools(serverId);
    if (cachedTools) {
      log.info(`📦 [MCP] 使用缓存的工具列表: ${serverId} (${cachedTools.length}个工具)`);
      return cachedTools;
    }

    const client = this.clientManager.getClient(serverId);
    if (!client) {
      log.error(`❌ [MCP] 服务器未连接: ${serverId}`);
      throw new Error(`服务器未连接: ${serverId}`);
    }

    try {
      log.info(`🔎 [MCP] 开始发现工具: ${serverId}`);
      const tools = await client.discoverTools();
      log.info(`✅ [MCP] 发现 ${tools.length} 个工具: ${serverId}`);

      // 缓存工具列表
      this.cacheService.cacheServerTools(serverId, tools);
      log.info(`💾 [MCP] 工具已缓存: ${serverId}`);

      this.emitEvent({
        type: MCPEventType.TOOL_DISCOVERED,
        serverId,
        timestamp: new Date(),
        data: { toolCount: tools.length }
      });

      return tools;
    } catch (error) {
      log.error(`❌ [MCP] 工具发现失败: ${serverId}`, error);
      throw error;
    }
  }

  /**
   * 获取所有可用工具
   */
  async getAllTools(): Promise<MCPToolEntity[]> {
    const allTools = this.cacheService.getAllCachedTools();
    const serverIds = this.cacheService.getAllCachedServerIds();

    log.info(`📋 [MCP] 获取所有工具，当前缓存服务器数: ${serverIds.length}`);

    // 按服务器分组显示日志
    for (const serverId of serverIds) {
      const serverTools = this.cacheService.getCachedServerTools(serverId);
      if (serverTools) {
        log.info(`📦 [MCP] 服务器 ${serverId} 有 ${serverTools.length} 个工具`);
      }
    }

    log.info(`✅ [MCP] 总共获取到 ${allTools.length} 个工具`);
    return allTools;
  }

  /**
   * 调用工具
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    log.info(`[MCP] 调用工具: ${request.serverId}:${request.toolName}`);

    // 检查缓存
    const cachedResponse = this.cacheService.getCachedToolCall(
      request.serverId,
      request.toolName,
      request.arguments
    );
    if (cachedResponse) {
      log.info(`[MCP] 使用缓存的工具调用结果: ${request.toolName}`);
      return cachedResponse;
    }

    const client = this.clientManager.getClient(request.serverId);
    if (!client) {
      throw new Error(`客户端未连接: ${request.serverId}`);
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
    log.info('[MCP] 清理资源');

    await this.clientManager.cleanup();
    this.cacheService.destroy();
    this.serverStatusCache.clear();
    this.eventListeners.length = 0;
  }

  /**
   * 连接服务器
   */
  private async connectServer(serverId: string): Promise<void> {
    log.info(`🔗 [MCP] 开始连接服务器: ${serverId}`);
    const server = await this.configService.getServerConfig(serverId);
    if (!server) {
      throw new Error(`服务器配置不存在: ${serverId}`);
    }

    log.info(`🔗 [MCP] 调用clientManager.connectClient: ${serverId}`);
    await this.clientManager.connectClient(server);
    log.info(`✅ [MCP] 客户端连接完成: ${serverId}`);

    // 🔥 PromptX插件需要先初始化再发现工具
    if (serverId === 'promptx-builtin') {
      try {
        log.info(`🎯 [MCP] 开始PromptX自动初始化: ${serverId}`);
        await this.initializePromptXPlugin(serverId);
        log.info(`✅ [MCP] PromptX初始化完成: ${serverId}`);
      } catch (error) {
        log.warn(`⚠️ [MCP] PromptX初始化失败: ${serverId}`, error);
        // 初始化失败时，仍然尝试发现工具（可能有基础工具可用）
      }
    }

    // 连接成功后发现工具（PromptX初始化后或其他服务器直接发现）
    try {
      log.info(`🔍 [MCP] 开始发现工具: ${serverId}`);
      // 优化重试机制：减少重试次数，提高响应速度
      const maxRetries = serverId === 'promptx-builtin' ? 3 : 2;
      await this.discoverServerToolsWithRetry(serverId, maxRetries);
      log.info(`✅ [MCP] 工具发现完成: ${serverId}`);
    } catch (error) {
      log.error(`❌ [MCP] 工具发现失败: ${serverId}`, error);
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

    log.info(`🎯 [MCP] PromptX工作目录: ${workingDirectory}`);

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

      log.info(`✅ [MCP] PromptX初始化响应:`, response.result);
    } catch (error) {
      log.error(`❌ [MCP] PromptX初始化调用失败:`, error);
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
        log.info(`🔍 [MCP] 工具发现尝试 ${attempt}/${maxRetries}: ${serverId}`);
        await this.discoverServerTools(serverId);

        // 检查是否成功发现了工具
        const tools = this.cacheService.getCachedServerTools(serverId);
        if (tools && tools.length > 0) {
          log.info(`✅ [MCP] 成功发现 ${tools.length} 个工具: ${serverId}`);
          return; // 成功，退出重试循环
        } else {
          log.warn(`⚠️ [MCP] 尝试 ${attempt} 未发现工具: ${serverId}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(`⚠️ [MCP] 工具发现尝试 ${attempt} 失败: ${serverId}`, error);
      }

      // 如果不是最后一次尝试，等待后重试（优化延迟时间）
      if (attempt < maxRetries) {
        const delay = attempt * 1000; // 1秒、2秒（大幅减少延迟）
        log.info(`⏳ [MCP] 等待 ${delay}ms 后重试: ${serverId}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // 所有重试都失败了
    if (lastError) {
      log.error(`❌ [MCP] 工具发现最终失败 (${maxRetries} 次尝试): ${serverId}`, lastError);
      throw lastError;
    } else {
      const error = new Error(`工具发现失败，未发现任何工具 (${maxRetries} 次尝试)`);
      log.error(`❌ [MCP] ${error.message}: ${serverId}`);
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
        log.error('[MCP] 事件监听器错误:', error);
      }
    }
  }
}
