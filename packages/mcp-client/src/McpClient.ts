/**
 * MCP Client - 充血模型主类
 *
 * 集成所有 MCP 相关功能：配置管理、连接管理、协议处理
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type {
  McpServerConfig,
  TransportConfig,
  StdioTransportConfig,
  HttpTransportConfig,
  WebSocketTransportConfig,
  StreamableHttpTransportConfig,
  ToolInfo,
  ResourceInfo,
  PromptInfo,
  ToolCallResult,
  ResourceContent,
  PromptResult,
  JsonRpcRequest,
  JsonRpcResponse
} from './types/index.js';
import {
  McpClientError,
  ConnectionError,
  ToolNotFoundError,
  ResourceNotFoundError,
  PromptNotFoundError,
  toMcpError
} from './utils/errors.js';

// 简化的传输接口
interface Transport {
  connect(): Promise<void>;
  sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse>;
  close(): Promise<void>;
  isConnected(): boolean;
  on(event: 'error' | 'close', handler: (...args: any[]) => void): void;
}

// 服务器状态接口
interface ServerState {
  id: string;
  name: string;
  config: TransportConfig;
  transport?: Transport;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools?: ToolInfo[];
  resources?: ResourceInfo[];
  error?: string;
  connectedAt?: Date;
  reconnectAttempts: number;
  isReconnecting: boolean;
}

// 连接状态枚举
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface McpClientOptions {
  /** 配置文件路径 */
  configFile?: string;
  /** 是否自动保存配置 */
  autoSaveConfig?: boolean;
  /** 默认超时时间 */
  defaultTimeout?: number;
  /** 默认自动重连 */
  defaultAutoReconnect?: boolean;
}

export class McpClient extends EventEmitter {
  // ============== 核心数据存储 ==============
  private servers = new Map<string, ServerState>();
  private configPath: string;
  private autoSaveConfig: boolean;
  private defaultTimeout: number;
  private defaultAutoReconnect: boolean;
  private initialized = false;
  private requestIdCounter = 0;

  constructor(options: McpClientOptions = {}) {
    super();

    this.configPath = options.configFile || this.getDefaultConfigPath();
    this.autoSaveConfig = options.autoSaveConfig !== false;
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.defaultAutoReconnect = options.defaultAutoReconnect !== false;
  }

  // ============== 初始化 ==============

  /**
   * 初始化客户端 - 合并原 ConfigManager 功能
   */
  async initialize(configFile?: string): Promise<void> {
    if (this.initialized) {
      throw new McpClientError('Client already initialized', 'ALREADY_INITIALIZED');
    }

    try {
      if (configFile) {
        this.configPath = configFile;
      }

      await this.loadConfig();
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
      // 断开所有连接
      const disconnectPromises = Array.from(this.servers.keys()).map(serverId =>
        this.disconnect(serverId)
      );
      await Promise.allSettled(disconnectPromises);

      this.servers.clear();
      this.initialized = false;
      this.removeAllListeners();
      this.emit('disposed');
    } catch (error) {
      throw toMcpError(error);
    }
  }

  // ============== 配置管理（原 ConfigManager 功能）==============

  /**
   * 添加服务器配置
   */
  async addServer(config: McpServerConfig): Promise<void> {
    this.ensureInitialized();

    try {
      // 验证配置
      this.validateServerConfig(config);

      // 创建服务器状态
      const serverState: ServerState = {
        id: config.id,
        name: config.name,
        config: config.transport,
        status: 'disconnected',
        reconnectAttempts: 0,
        isReconnecting: false
      };

      this.servers.set(config.id, serverState);

      // 自动保存配置
      if (this.autoSaveConfig) {
        await this.saveConfig();
      }

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
      const server = this.servers.get(serverId);
      if (!server) {
        throw new ConnectionError(`Server '${serverId}' not found`);
      }

      // 如果服务器正在连接，先断开
      if (server.status === 'connected') {
        await this.disconnect(serverId);
      }

      // 更新配置
      if (updates.name) server.name = updates.name;
      if (updates.transport) server.config = updates.transport;

      // 自动保存配置
      if (this.autoSaveConfig) {
        await this.saveConfig();
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
      const server = this.servers.get(serverId);
      if (!server) {
        return; // 服务器不存在，静默返回
      }

      // 先断开连接
      if (server.status === 'connected') {
        await this.disconnect(serverId);
      }

      this.servers.delete(serverId);

      // 自动保存配置
      if (this.autoSaveConfig) {
        await this.saveConfig();
      }

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
    const server = this.servers.get(serverId);
    if (!server) return null;

    return {
      id: server.id,
      name: server.name,
      transport: server.config,
      enabled: true,
      autoReconnect: this.defaultAutoReconnect,
      timeout: this.defaultTimeout
    };
  }

  /**
   * 列出所有服务器配置
   */
  listServers(): McpServerConfig[] {
    this.ensureInitialized();
    return Array.from(this.servers.values()).map(server => ({
      id: server.id,
      name: server.name,
      transport: server.config,
      enabled: true,
      autoReconnect: this.defaultAutoReconnect,
      timeout: this.defaultTimeout
    }));
  }

  // ============== 连接管理（原 ConnectionManager 功能）==============

  /**
   * 连接到服务器
   */
  async connect(serverId: string): Promise<void> {
    this.ensureInitialized();

    try {
      const server = this.servers.get(serverId);
      if (!server) {
        throw new ConnectionError(`Server '${serverId}' not found`);
      }

      if (server.status === 'connected') {
        return; // 已经连接
      }

      if (server.status === 'connecting') {
        throw new ConnectionError(`Already connecting to server '${serverId}'`);
      }

      this.updateServerStatus(server, 'connecting');

      // 创建传输
      server.transport = await this.createTransport(server.config);
      this.setupTransportHandlers(server);

      // 连接传输
      await this.withTimeout(server.transport.connect(), this.defaultTimeout);

      // 执行 MCP 初始化握手
      await this.performMcpHandshake(server);

      // 更新状态
      server.connectedAt = new Date();
      server.reconnectAttempts = 0;
      server.error = undefined;
      this.updateServerStatus(server, 'connected');

      this.emit('connected', serverId);
    } catch (error) {
      const server = this.servers.get(serverId);
      if (server) {
        server.error = error instanceof Error ? error.message : String(error);
        this.updateServerStatus(server, 'error');
        this.cleanupServerConnection(server);
      }
      throw toMcpError(error);
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnect(serverId: string): Promise<void> {
    this.ensureInitialized();

    try {
      const server = this.servers.get(serverId);
      if (!server) {
        return; // 服务器不存在
      }

      server.isReconnecting = false;

      if (server.transport && server.transport.isConnected()) {
        try {
          await server.transport.close();
        } catch (error) {
          // 忽略关闭时的错误
        }
      }

      this.cleanupServerConnection(server);
      this.updateServerStatus(server, 'disconnected');
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
    const server = this.servers.get(serverId);
    return server?.status === 'connected';
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(serverId: string): ConnectionStatus {
    this.ensureInitialized();
    const server = this.servers.get(serverId);
    return (server?.status as ConnectionStatus) || ConnectionStatus.DISCONNECTED;
  }

  /**
   * 列出所有连接信息
   */
  listConnections(): Array<{
    serverId: string;
    status: ConnectionStatus;
    connectedAt?: Date;
    error?: string;
  }> {
    this.ensureInitialized();
    return Array.from(this.servers.values()).map(server => ({
      serverId: server.id,
      status: server.status as ConnectionStatus,
      connectedAt: server.connectedAt,
      error: server.error
    }));
  }

  // ============== MCP 协议操作（原 ProtocolHandler 功能）==============

  /**
   * 调用工具
   */
  async callTool(serverId: string, toolName: string, args?: any): Promise<ToolCallResult> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const server = this.servers.get(serverId)!;
      const response = await this.sendRequest(server, 'tools/call', {
        name: toolName,
        arguments: args
      });

      this.emit('tool-called', serverId, toolName, response);
      return response;

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
      const server = this.servers.get(serverId)!;
      const response = await this.sendRequest(server, 'resources/read', { uri });

      this.emit('resource-read', serverId, uri, response);
      return response;

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
      const server = this.servers.get(serverId)!;
      const response = await this.sendRequest(server, 'prompts/get', {
        name,
        arguments: args
      });

      this.emit('prompt-retrieved', serverId, name, response);
      return response;

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new PromptNotFoundError(name, serverId);
      }
      throw toMcpError(error);
    }
  }

  /**
   * 列出服务器的工具
   */
  async listTools(serverId: string): Promise<ToolInfo[]> {
    this.ensureInitialized();
    await this.ensureConnected(serverId);

    try {
      const server = this.servers.get(serverId)!;
      const response = await this.sendRequest(server, 'tools/list');
      return response.tools || [];
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
      const server = this.servers.get(serverId)!;
      const response = await this.sendRequest(server, 'resources/list');
      return response.resources || [];
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
      const server = this.servers.get(serverId)!;
      const response = await this.sendRequest(server, 'prompts/list');
      return response.prompts || [];
    } catch (error) {
      throw toMcpError(error);
    }
  }

  /**
   * 发送原始请求
   */
  async sendRequest(server: ServerState, method: string, params?: any): Promise<any> {
    if (!server.transport) {
      throw new ConnectionError(`No transport for server '${server.id}'`);
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.generateRequestId(),
      method,
      ...(params !== undefined && { params })
    };

    const response = await server.transport.sendRequest(request);

    if (response.error) {
      throw new ConnectionError(`RPC Error: ${response.error.message}`);
    }

    return response.result;
  }

  // ============== 私有辅助方法 ==============

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new McpClientError('Client not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }
  }

  private async ensureConnected(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new ConnectionError(`Server '${serverId}' not found`);
    }

    if (server.status !== 'connected') {
      await this.connect(serverId);
    }
  }

  private async createTransport(config: TransportConfig): Promise<Transport> {
    switch (config.type) {
      case 'stdio':
        return await this.createStdioTransport(config as StdioTransportConfig);
      case 'http':
        return await this.createHttpTransport(config as HttpTransportConfig);
      case 'websocket':
        return await this.createWebSocketTransport(config as WebSocketTransportConfig);
      case 'streamable-http':
        return await this.createStreamableHttpTransport(config as StreamableHttpTransportConfig);
      default:
        throw new Error(`Unsupported transport type: ${(config as any).type}`);
    }
  }

  private async createStdioTransport(config: StdioTransportConfig): Promise<Transport> {
    const { StdioTransport } = await import('./transport/StdioTransport.js');
    return new StdioTransport(config);
  }

  private async createHttpTransport(config: HttpTransportConfig | StreamableHttpTransportConfig): Promise<Transport> {
    const { HttpTransport } = await import('./transport/HttpTransport.js');
    return new HttpTransport(config);
  }

  private async createWebSocketTransport(config: WebSocketTransportConfig): Promise<Transport> {
    const { WebSocketTransport } = await import('./transport/WebSocketTransport.js');
    return new WebSocketTransport(config);
  }

  private async createStreamableHttpTransport(config: StreamableHttpTransportConfig): Promise<Transport> {
    const { StreamableHttpTransport } = await import('./transport/StreamableHttpTransport.js');
    return new StreamableHttpTransport(config);
  }

  private setupTransportHandlers(server: ServerState): void {
    if (!server.transport) return;

    server.transport.on('error', (error) => {
      this.handleConnectionError(server, error);
    });

    server.transport.on('close', () => {
      this.handleConnectionClose(server);
    });
  }

  private async performMcpHandshake(server: ServerState): Promise<void> {
    try {
      // 对于 streamable-http 传输，初始化已在 connect() 中完成
      if (server.config.type === 'streamable-http') {
        // StreamableHttpTransport 已经在 connect() 中处理了初始化
        return;
      }

      // 其他传输类型需要额外的握手
      await this.sendRequest(server, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: '@deechat/mcp-client',
          version: '1.0.0'
        }
      });
    } catch (error) {
      throw new ConnectionError(`MCP handshake failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private handleConnectionError(server: ServerState, error: Error): void {
    server.error = error.message;
    this.updateServerStatus(server, 'error');
    this.emit('connection-error', server.id, error);
  }

  private handleConnectionClose(server: ServerState): void {
    this.cleanupServerConnection(server);
    // 清理错误信息，因为这是正常断开连接
    server.error = undefined;
    this.updateServerStatus(server, 'disconnected');
    this.emit('connection-closed', server.id);
  }

  private updateServerStatus(server: ServerState, status: ServerState['status']): void {
    const oldStatus = server.status;
    server.status = status;

    if (oldStatus !== status) {
      this.emit('connection-status-changed', server.id, status, oldStatus);
    }
  }

  private cleanupServerConnection(server: ServerState): void {
    server.transport = undefined;
    server.tools = undefined;
    server.resources = undefined;
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${++this.requestIdCounter}`;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new ConnectionError(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private validateServerConfig(config: McpServerConfig): void {
    if (!config.id || !config.name || !config.transport) {
      throw new Error('Invalid server configuration');
    }
  }

  private getDefaultConfigPath(): string {
    const configDir = path.join(os.homedir(), '.deechat');
    return path.join(configDir, 'mcp-servers.json');
  }

  private async loadConfig(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const data = JSON.parse(content);

      // 支持 Claude Desktop 格式
      if (data.mcpServers) {
        await this.importClaudeDesktopConfig(data);
      } else if (data.servers) {
        await this.importNativeConfig(data);
      }
    } catch (error) {
      // 配置文件不存在或格式错误，使用默认配置
      if ((error as any).code !== 'ENOENT') {
        console.warn('Failed to load config:', error);
      }
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });

      const config = {
        version: '1.0.0',
        servers: Object.fromEntries(
          Array.from(this.servers.entries()).map(([id, server]) => [
            id,
            {
              id: server.id,
              name: server.name,
              transport: server.config,
              enabled: true,
              autoReconnect: this.defaultAutoReconnect,
              timeout: this.defaultTimeout
            }
          ])
        )
      };

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  private async importClaudeDesktopConfig(data: any): Promise<void> {
    for (const [serverId, serverConfig] of Object.entries(data.mcpServers)) {
      const config = serverConfig as any;

      let transport: TransportConfig;

      // 支持扩展的 type 字段，优先使用 type 字段确定传输类型
      const transportType = config.type || this.detectTransportType(config);

      switch (transportType) {
        case 'stdio':
          if (!config.command) {
            console.warn(`Server '${serverId}': stdio transport requires command field`);
            continue;
          }
          transport = {
            type: 'stdio',
            command: config.command,
            args: config.args || [],
            env: config.env,
            cwd: config.cwd
          };
          break;

        case 'http':
          if (!config.url) {
            console.warn(`Server '${serverId}': http transport requires url field`);
            continue;
          }
          transport = {
            type: 'http',
            url: config.url,
            headers: config.headers
          };
          break;

        case 'websocket':
          if (!config.url) {
            console.warn(`Server '${serverId}': websocket transport requires url field`);
            continue;
          }
          transport = {
            type: 'websocket',
            url: config.url,
            headers: config.headers
          };
          break;

        case 'streamable-http':
        case 'sse':
          if (!config.url) {
            console.warn(`Server '${serverId}': streamable-http transport requires url field`);
            continue;
          }
          transport = {
            type: 'streamable-http',
            url: config.url,
            headers: config.headers,
            sessionId: config.sessionId,
            enableDnsRebindingProtection: config.enableDnsRebindingProtection,
            allowedHosts: config.allowedHosts,
            reconnectDelay: config.reconnectDelay,
            maxReconnectAttempts: config.maxReconnectAttempts
          };
          break;

        default:
          console.warn(`Server '${serverId}': unsupported transport type '${transportType}'`);
          continue;
      }

      const serverState: ServerState = {
        id: serverId,
        name: config.name || serverId,
        config: transport,
        status: 'disconnected',
        reconnectAttempts: 0,
        isReconnecting: false
      };

      this.servers.set(serverId, serverState);
    }
  }

  /**
   * 自动检测传输类型（向后兼容）
   */
  private detectTransportType(config: any): string {
    if (config.command) {
      return 'stdio';
    } else if (config.url) {
      // 根据 URL 协议自动判断
      if (config.url.startsWith('ws://') || config.url.startsWith('wss://')) {
        return 'websocket';
      } else {
        return 'http';
      }
    } else if (config.websocket) {
      return 'websocket';
    }
    return 'stdio'; // 默认值
  }

  private async importNativeConfig(data: any): Promise<void> {
    for (const [serverId, serverConfig] of Object.entries(data.servers)) {
      const config = serverConfig as McpServerConfig;

      const serverState: ServerState = {
        id: config.id,
        name: config.name,
        config: config.transport,
        status: 'disconnected',
        reconnectAttempts: 0,
        isReconnecting: false
      };

      this.servers.set(serverId, serverState);
    }
  }
}