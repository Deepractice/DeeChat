/**
 * MCP Client - Main Class
 * 
 * DeeChat MCP 客户端的主要入口点
 */

import { EventEmitter } from 'events';
import { ConfigManager } from './config/ConfigManager.js';
import { ConnectionManager } from './connection/ConnectionManager.js';
import type {
  McpServerConfig,
  ToolInfo,
  ResourceInfo,
  PromptInfo,
  ToolCallResult,
  ResourceContent,
  PromptResult
} from './types/index.js';
import { ConnectionStatus } from './connection/types.js';
import type { Connection } from './connection/types.js';
import { 
  McpClientError,
  ConnectionError,
  ToolNotFoundError,
  ResourceNotFoundError,
  PromptNotFoundError,
  toMcpError
} from './utils/errors.js';

export interface McpClientOptions {
  /** 配置文件路径 */
  configFile?: string;
  /** 是否自动保存配置 */
  autoSaveConfig?: boolean;
}

export class McpClient extends EventEmitter {
  private configManager: ConfigManager;
  private connectionManager: ConnectionManager;
  private initialized = false;

  constructor(options: McpClientOptions = {}) {
    super();
    
    this.configManager = new ConfigManager(options.configFile, options.autoSaveConfig);
    this.connectionManager = new ConnectionManager();

    this.setupEventHandlers();
  }

  // ============== Initialization ==============

  /**
   * 初始化客户端
   */
  async initialize(configFile?: string): Promise<void> {
    if (this.initialized) {
      throw new McpClientError('Client already initialized', 'ALREADY_INITIALIZED');
    }

    try {
      // 初始化配置管理器
      if (configFile) {
        this.configManager = new ConfigManager(configFile);
      }
      await this.configManager.initialize();

      // 将已有的服务器配置添加到连接管理器
      const servers = this.configManager.listServers();
      for (const server of servers) {
        this.connectionManager.addConnection(server);
      }

      this.initialized = true;
      this.emit('initialized');

    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.connectionManager.dispose();
      this.initialized = false;
      this.removeAllListeners();
      this.emit('disposed');
    } catch (error) {
      throw toMcpError(error);
    }
  }

  // ============== Configuration Management ==============

  /**
   * 添加服务器配置
   */
  async addServer(config: McpServerConfig): Promise<void> {
    this.ensureInitialized();

    try {
      await this.configManager.addServer(config);
      this.connectionManager.addConnection(config);
      this.emit('server-added', config.id);
    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 更新服务器配置
   */
  async updateServer(serverId: string, updates: Partial<McpServerConfig>): Promise<void> {
    this.ensureInitialized();

    try {
      // 如果服务器正在连接，先断开
      if (this.connectionManager.isConnected(serverId)) {
        await this.connectionManager.disconnect(serverId);
      }

      await this.configManager.updateServer(serverId, updates);

      // 更新连接管理器中的配置
      const updatedConfig = this.configManager.getServer(serverId);
      if (updatedConfig) {
        await this.connectionManager.removeConnection(serverId);
        this.connectionManager.addConnection(updatedConfig);
      }

      this.emit('server-updated', serverId);
    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 删除服务器配置
   */
  async removeServer(serverId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.configManager.removeServer(serverId);
      await this.connectionManager.removeConnection(serverId);
      this.emit('server-removed', serverId);
    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 获取服务器配置
   */
  getServer(serverId: string): McpServerConfig | null {
    this.ensureInitialized();
    return this.configManager.getServer(serverId);
  }

  /**
   * 列出所有服务器配置
   */
  listServers(): McpServerConfig[] {
    this.ensureInitialized();
    return this.configManager.listServers();
  }

  // ============== Connection Management ==============

  /**
   * 连接到服务器
   */
  async connect(serverId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.connectionManager.connect(serverId);
      this.emit('connected', serverId);
    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnect(serverId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.connectionManager.disconnect(serverId);
      this.emit('disconnected', serverId);
    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 检查服务器是否已连接
   */
  isConnected(serverId: string): boolean {
    this.ensureInitialized();
    return this.connectionManager.isConnected(serverId);
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(serverId: string): ConnectionStatus {
    this.ensureInitialized();
    const connection = this.connectionManager.getConnection(serverId);
    return connection?.status || ConnectionStatus.DISCONNECTED;
  }

  /**
   * 列出所有连接信息
   */
  listConnections(): Connection[] {
    this.ensureInitialized();
    return this.connectionManager.listConnections();
  }

  // ============== MCP Protocol Operations ==============

  /**
   * 调用工具
   */
  async callTool(serverId: string, toolName: string, args?: any): Promise<ToolCallResult> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      const result = await protocol.sendRequest('tools/call', {
        name: toolName,
        arguments: args
      });

      this.emit('tool-called', serverId, toolName, result);
      return result;

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new ToolNotFoundError(toolName, serverId);
      }
      throw toMcpError(error);
    }
  }

  /**
   * 读取资源
   */
  async readResource(serverId: string, uri: string): Promise<ResourceContent> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      const result = await protocol.sendRequest('resources/read', { uri });

      this.emit('resource-read', serverId, uri, result);
      return result;

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new ResourceNotFoundError(uri, serverId);
      }
      throw toMcpError(error);
    }
  }

  /**
   * 获取提示词
   */
  async getPrompt(serverId: string, name: string, args?: any): Promise<PromptResult> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      const result = await protocol.sendRequest('prompts/get', {
        name,
        arguments: args
      });

      this.emit('prompt-retrieved', serverId, name, result);
      return result;

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new PromptNotFoundError(name, serverId);
      }
      throw toMcpError(error);
    }
  }

  // ============== Discovery Operations ==============

  /**
   * 列出服务器的工具
   */
  async listTools(serverId: string): Promise<ToolInfo[]> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      const result = await protocol.sendRequest('tools/list');
      return result.tools || [];

    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 列出服务器的资源
   */
  async listResources(serverId: string): Promise<ResourceInfo[]> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      const result = await protocol.sendRequest('resources/list');
      return result.resources || [];

    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 列出服务器的提示词
   */
  async listPrompts(serverId: string): Promise<PromptInfo[]> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      const result = await protocol.sendRequest('prompts/list');
      return result.prompts || [];

    } catch (error) {
      throw toMcpError(error);
    }
  }

  // ============== Advanced Operations ==============

  /**
   * 发送原始请求
   */
  async sendRequest(serverId: string, method: string, params?: any): Promise<any> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const protocol = this.connectionManager.getProtocol(serverId);
      if (!protocol) {
        throw new ConnectionError(`No protocol handler for server '${serverId}'`);
      }

      return await protocol.sendRequest(method, params);

    } catch (error) {
      throw toMcpError(error);
    }
  }

  // ============== Private Methods ==============

  private setupEventHandlers(): void {
    // 转发连接管理器的事件
    this.connectionManager.on('connection-status-changed', (serverId, status) => {
      this.emit('connection-status-changed', serverId, status);
    });

    this.connectionManager.on('connection-error', (serverId, error) => {
      this.emit('connection-error', serverId, error);
    });

    this.connectionManager.on('reconnect-scheduled', (serverId, delay) => {
      this.emit('reconnect-scheduled', serverId, delay);
    });
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new McpClientError('Client not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }
  }

  private async ensureConnected(serverId: string): Promise<void> {
    const connection = this.connectionManager.getConnection(serverId);
    if (!connection) {
      throw new ConnectionError(`Server '${serverId}' not found`);
    }

    if (connection.status !== ConnectionStatus.CONNECTED) {
      throw new ConnectionError(`Server '${serverId}' is not connected. Status: ${connection.status}`);
    }
  }
}