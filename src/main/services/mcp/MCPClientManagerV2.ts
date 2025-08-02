/**
 * MCP客户端管理器 V2
 * 基于新架构的统一客户端管理
 */

import log from 'electron-log';
import { IMCPTransport } from './transports/IMCPTransport';
import { MCPTransportFactory } from './transports/MCPTransportFactory';
import { MCPConfigManager, ConfigChangeEvent } from './MCPConfigManager';
import { MCPServerConfig } from '../../../shared/entities/MCPServerConfigV2';
import { MCPToolEntity } from '../../../shared/entities/MCPToolEntity';
import {
  MCPToolCallRequest,
  MCPToolCallResponse,
  MCPEvent,
  MCPEventType
} from '../../../shared/interfaces/IMCPProvider';
import { InProcessMCPServer } from './InProcessMCPServer';
import { MCPServerStatus } from '../../../shared/types/mcp-protocol';

/**
 * MCP客户端接口
 * 封装传输层提供标准MCP协议接口
 */
interface IMCPClient {
  transport: IMCPTransport;
  config: MCPServerConfig;
  capabilities?: any;
  
  // 标准MCP方法
  initialize(): Promise<void>;
  listTools(): Promise<any[]>;
  callTool(name: string, args: any): Promise<any>;
  listResources?(): Promise<any[]>;
  readResource?(uri: string): Promise<any>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

/**
 * MCP客户端实现
 */
class MCPClient implements IMCPClient {
  constructor(
    public transport: IMCPTransport,
    public config: MCPServerConfig,
    public capabilities?: any
  ) {}
  
  async initialize(): Promise<void> {
    const response = await this.transport.request('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: this.capabilities || {},
      clientInfo: {
        name: 'DeeChat',
        version: '1.0.0'
      }
    });
    
    log.info(`[MCPClient] 初始化成功: ${this.config.name}`, response);
  }
  
  async listTools(): Promise<any[]> {
    const response = await this.transport.request('tools/list');
    return response.tools || [];
  }
  
  async callTool(name: string, args: any): Promise<any> {
    return await this.transport.request('tools/call', {
      name,
      arguments: args
    });
  }
  
  async listResources(): Promise<any[]> {
    const response = await this.transport.request('resources/list');
    return response.resources || [];
  }
  
  async readResource(uri: string): Promise<any> {
    return await this.transport.request('resources/read', { uri });
  }
  
  async ping(): Promise<void> {
    await this.transport.request('ping');
  }
  
  async close(): Promise<void> {
    await this.transport.disconnect();
  }
}

/**
 * MCP客户端管理器 V2
 * 特性：
 * - 统一的传输层抽象
 * - 配置驱动的客户端创建
 * - 智能执行模式选择
 * - 进程内服务器优化
 * - 完整的生命周期管理
 */
export class MCPClientManagerV2 {
  private clients = new Map<string, IMCPClient>();
  private pendingClients = new Map<string, Promise<IMCPClient>>();
  private inProcessServers = new Map<string, InProcessMCPServer>();
  private eventListeners: ((event: MCPEvent) => void)[] = [];
  private configManager: MCPConfigManager;
  private configChangeUnsubscribe?: () => void;
  
  constructor(projectPath?: string) {
    this.configManager = new MCPConfigManager(projectPath);
    log.info('[MCPClientManagerV2] 初始化客户端管理器');
  }
  
  /**
   * 初始化管理器
   */
  async initialize(): Promise<void> {
    // 初始化配置管理器
    await this.configManager.initialize();
    
    // 监听配置变更
    this.configChangeUnsubscribe = this.configManager.onChange(this.handleConfigChange.bind(this));
    
    log.info('[MCPClientManagerV2] 管理器初始化完成');
  }
  
  /**
   * 获取或创建客户端
   */
  async getClient(serverId: string): Promise<IMCPClient> {
    // 检查现有客户端
    const existing = this.clients.get(serverId);
    if (existing) {
      // 验证连接状态
      if (existing.transport.isConnected()) {
        return existing;
      }
      // 移除无效客户端
      this.clients.delete(serverId);
    }
    
    // 检查pending客户端
    const pending = this.pendingClients.get(serverId);
    if (pending) {
      try {
        return await pending;
      } catch (error) {
        // pending失败，清理后重试
        this.pendingClients.delete(serverId);
      }
    }
    
    // 创建新客户端
    const createPromise = this.createClient(serverId);
    this.pendingClients.set(serverId, createPromise);
    
    try {
      const client = await createPromise;
      this.clients.set(serverId, client);
      return client;
    } finally {
      this.pendingClients.delete(serverId);
    }
  }
  
  /**
   * 创建客户端
   */
  private async createClient(serverId: string): Promise<IMCPClient> {
    const config = this.configManager.getConfig(serverId);
    if (!config) {
      throw new Error(`服务器配置不存在: ${serverId}`);
    }
    
    log.info(`[MCPClientManagerV2] 创建客户端: ${config.name} (${config.type})`);
    
    // 更新状态
    this.updateServerStatus(serverId, MCPServerStatus.STARTING);
    
    try {
      // 进程内模式特殊处理
      if (config.execution === 'inprocess') {
        return await this.createInProcessClient(config);
      }
      
      // 创建传输层
      const transport = await MCPTransportFactory.create(config);
      
      // 监听传输事件
      this.setupTransportListeners(transport, config);
      
      // 连接传输
      await transport.connect();
      
      // 创建客户端
      const client = new MCPClient(transport, config);
      
      // 初始化协议
      await client.initialize();
      
      // 更新状态
      this.updateServerStatus(serverId, MCPServerStatus.RUNNING);
      
      // 发送连接成功事件
      this.emitEvent({
        type: MCPEventType.SERVER_CONNECTED,
        serverId: config.id,
        timestamp: new Date()
      });
      
      log.info(`[MCPClientManagerV2] ✅ 客户端创建成功: ${config.name}`);
      return client;
      
    } catch (error) {
      log.error(`[MCPClientManagerV2] ❌ 客户端创建失败: ${config.name}`, error);
      
      // 更新状态
      this.updateServerStatus(serverId, MCPServerStatus.ERROR, error);
      
      // 发送错误事件
      this.emitEvent({
        type: MCPEventType.SERVER_ERROR,
        serverId: config.id,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  /**
   * 创建进程内客户端
   */
  private async createInProcessClient(config: MCPServerConfig): Promise<IMCPClient> {
    log.info(`[MCPClientManagerV2] 创建进程内客户端: ${config.name}`);
    
    // 获取或创建进程内服务器
    let server = this.inProcessServers.get(config.id);
    if (!server) {
      // 直接使用原始配置对象创建MCPServerEntity
      const { MCPServerEntity } = await import('../../../shared/entities/MCPServerEntity.js');
      const inProcessConfig = new MCPServerEntity({
        id: config.id,
        name: config.name,
        type: 'stdio',
        command: config.command || 'node',
        args: config.args,
        workingDirectory: config.workingDirectory,
        isEnabled: true,
        timeout: config.timeout || 30000,
        retryCount: 3,
        env: config.env,
        headers: config.headers,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      });
      server = new InProcessMCPServer(inProcessConfig);
      await server.start();
      this.inProcessServers.set(config.id, server);
    }
    
    // 创建假客户端（直接调用进程内服务器）
    const client: IMCPClient = {
      transport: {} as IMCPTransport, // 进程内不需要真实传输
      config,
      
      async initialize() {
        // 进程内服务器已初始化
      },
      
      async listTools() {
        return await server!.listTools();
      },
      
      async callTool(name: string, args: any) {
        return await server!.callTool(name, args);
      },
      
      async ping() {
        // 进程内总是成功
      },
      
      async close() {
        // 进程内服务器保持运行
      }
    };
    
    return client;
  }
  
  /**
   * 设置传输层事件监听
   */
  private setupTransportListeners(transport: IMCPTransport, config: MCPServerConfig): void {
    transport.on('error', (error) => {
      log.error(`[MCPClientManagerV2] 传输错误: ${config.name}`, error);
      this.updateServerStatus(config.id, MCPServerStatus.ERROR, error);
    });
    
    transport.on('disconnect', () => {
      log.info(`[MCPClientManagerV2] 传输断开: ${config.name}`);
      this.updateServerStatus(config.id, MCPServerStatus.STOPPED);
    });
    
    transport.on('message', (message) => {
      // 处理服务器通知
      if (message.method && !message.id) {
        this.handleServerNotification(config.id, message);
      }
    });
  }
  
  /**
   * 调用工具
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    const startTime = Date.now();
    
    try {
      const client = await this.getClient(request.serverId);
      const result = await client.callTool(request.toolName, request.arguments || {});
      
      const duration = Date.now() - startTime;
      log.info(`[MCPClientManagerV2] ✅ 工具调用成功: ${request.toolName} (${duration}ms)`);
      
      return {
        success: true,
        result: result.content || [result],
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error(`[MCPClientManagerV2] ❌ 工具调用失败: ${request.toolName}`, error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : '工具调用失败',
        duration
      };
    }
  }
  
  /**
   * 发现工具
   */
  async discoverTools(serverId: string): Promise<MCPToolEntity[]> {
    try {
      const client = await this.getClient(serverId);
      const config = this.configManager.getConfig(serverId);
      if (!config) return [];
      
      const tools = await client.listTools();
      
      return tools.map(tool => MCPToolEntity.create({
        name: tool.name,
        description: tool.description || '',
        serverId: config.id,
        serverName: config.name,
        inputSchema: tool.inputSchema
      }));
      
    } catch (error) {
      log.error(`[MCPClientManagerV2] 工具发现失败: ${serverId}`, error);
      return [];
    }
  }
  
  /**
   * 关闭客户端
   */
  async closeClient(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      try {
        await client.close();
        this.clients.delete(serverId);
        log.info(`[MCPClientManagerV2] 客户端已关闭: ${serverId}`);
      } catch (error) {
        log.error(`[MCPClientManagerV2] 关闭客户端失败: ${serverId}`, error);
      }
    }
    
    // 清理进程内服务器
    const inProcessServer = this.inProcessServers.get(serverId);
    if (inProcessServer) {
      await inProcessServer.stop();
      this.inProcessServers.delete(serverId);
    }
  }
  
  /**
   * 获取所有服务器状态
   */
  getServersStatus(): Map<string, MCPServerStatus> {
    const status = new Map<string, MCPServerStatus>();
    
    for (const config of this.configManager.getAllConfigs()) {
      const runtime = config.runtime;
      if (runtime?.status) {
        status.set(config.id, runtime.status);
      } else {
        status.set(config.id, MCPServerStatus.STOPPED);
      }
    }
    
    return status;
  }
  
  /**
   * 添加事件监听器
   */
  onEvent(listener: (event: MCPEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }
  
  /**
   * 发送事件
   */
  private emitEvent(event: MCPEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log.error('[MCPClientManagerV2] 事件监听器异常:', error);
      }
    }
  }
  
  /**
   * 更新服务器状态
   */
  private updateServerStatus(serverId: string, status: MCPServerStatus, error?: any): void {
    const config = this.configManager.getConfig(serverId);
    if (!config) return;
    
    // 更新运行时信息
    const runtime: {
      status: MCPServerStatus;
      pid?: number;
      startTime?: Date;
      toolCount?: number;
      resourceCount?: number;
      errorCount?: number;
      lastError?: {
        message: string;
        timestamp: Date;
        code?: string;
      };
    } = config.runtime || { status: MCPServerStatus.STOPPED };
    runtime.status = status;
    
    if (status === MCPServerStatus.RUNNING) {
      runtime.startTime = new Date();
      runtime.errorCount = 0;
    } else if (status === MCPServerStatus.ERROR && error) {
      runtime.errorCount = (runtime.errorCount || 0) + 1;
      runtime.lastError = {
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        code: error.code
      };
    }
    
    // 更新配置（不触发保存）
    config.runtime = runtime;
  }
  
  /**
   * 处理服务器通知
   */
  private handleServerNotification(serverId: string, message: any): void {
    log.debug(`[MCPClientManagerV2] 服务器通知: ${serverId}`, message);
    
    // 发送通知事件
    this.emitEvent({
      type: MCPEventType.SERVER_MESSAGE,
      serverId,
      timestamp: new Date(),
      data: message
    });
  }
  
  /**
   * 处理配置变更
   */
  private handleConfigChange(event: ConfigChangeEvent): void {
    log.info(`[MCPClientManagerV2] 配置变更: ${event.type} - ${event.config.name}`);
    
    if (event.type === 'remove' || event.type === 'update') {
      // 关闭相关客户端
      this.closeClient(event.config.id).catch(error => {
        log.error('[MCPClientManagerV2] 处理配置变更失败:', error);
      });
    }
  }
  
  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    log.info('[MCPClientManagerV2] 开始清理资源');
    
    // 取消配置监听
    if (this.configChangeUnsubscribe) {
      this.configChangeUnsubscribe();
    }
    
    // 关闭所有客户端
    const closePromises = Array.from(this.clients.keys()).map(serverId => 
      this.closeClient(serverId)
    );
    
    await Promise.allSettled(closePromises);
    
    // 清理集合
    this.clients.clear();
    this.pendingClients.clear();
    this.inProcessServers.clear();
    this.eventListeners = [];
    
    log.info('[MCPClientManagerV2] 资源清理完成');
  }
  
  /**
   * 获取配置管理器（供外部使用）
   */
  getConfigManager(): MCPConfigManager {
    return this.configManager;
  }
}