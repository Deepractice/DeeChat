/**
 * Configuration Manager for MCP Client
 * 
 * 负责管理 MCP 服务器配置的持久化存储
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { 
  McpServerConfig, 
  McpConfigFile,
  TransportConfig 
} from '../types/index.js';
import { ConfigurationError } from '../utils/errors.js';
import { ConfigAdapter } from './ConfigAdapter.js';
import { validateServerConfig } from './validator.js';

export class ConfigManager {
  private configFile: string;
  private config: McpConfigFile;
  private autoSave: boolean;

  constructor(configFile?: string, autoSave = true) {
    this.configFile = configFile || this.getDefaultConfigPath();
    this.autoSave = autoSave;
    this.config = this.createDefaultConfig();
  }

  // ============== Public API ==============

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
    } catch (error) {
      // 如果配置文件不存在，创建默认配置
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        await this.saveConfig();
      } else {
        throw error;
      }
    }
  }

  /**
   * 添加服务器配置
   */
  async addServer(config: McpServerConfig): Promise<void> {
    // 验证配置
    validateServerConfig(config);

    // 检查 ID 是否已存在
    if (this.config.servers[config.id]) {
      throw new ConfigurationError(`Server with ID '${config.id}' already exists`);
    }

    // 添加时间戳
    const now = new Date().toISOString();
    const serverConfig: McpServerConfig = {
      ...config,
      createdAt: now,
      updatedAt: now
    };

    // 添加到配置
    this.config.servers[config.id] = serverConfig;

    // 自动保存
    if (this.autoSave) {
      await this.saveConfig();
    }
  }

  /**
   * 更新服务器配置
   */
  async updateServer(id: string, updates: Partial<McpServerConfig>): Promise<void> {
    const existing = this.config.servers[id];
    if (!existing) {
      throw new ConfigurationError(`Server with ID '${id}' not found`);
    }

    // 不允许修改 ID
    if (updates.id && updates.id !== id) {
      throw new ConfigurationError('Cannot modify server ID');
    }

    // 合并更新
    const updated: McpServerConfig = {
      ...existing,
      ...updates,
      id, // 确保 ID 不变
      createdAt: existing.createdAt, // 保持创建时间
      updatedAt: new Date().toISOString() // 更新时间
    };

    // 验证更新后的配置
    validateServerConfig(updated);

    // 保存更新
    this.config.servers[id] = updated;

    // 自动保存
    if (this.autoSave) {
      await this.saveConfig();
    }
  }

  /**
   * 删除服务器配置
   */
  async removeServer(id: string): Promise<void> {
    if (!this.config.servers[id]) {
      throw new ConfigurationError(`Server with ID '${id}' not found`);
    }

    delete this.config.servers[id];

    // 自动保存
    if (this.autoSave) {
      await this.saveConfig();
    }
  }

  /**
   * 获取服务器配置
   */
  getServer(id: string): McpServerConfig | null {
    return this.config.servers[id] || null;
  }

  /**
   * 列出所有服务器配置
   */
  listServers(filters?: {
    enabled?: boolean;
    tags?: string[];
  }): McpServerConfig[] {
    let servers = Object.values(this.config.servers);

    if (filters) {
      if (filters.enabled !== undefined) {
        servers = servers.filter(server => server.enabled === filters.enabled);
      }

      if (filters.tags && filters.tags.length > 0) {
        servers = servers.filter(server => 
          server.tags && filters.tags!.some(tag => server.tags!.includes(tag))
        );
      }
    }

    return servers;
  }

  /**
   * 获取默认配置
   */
  getDefaults() {
    return this.config.defaults || {};
  }

  /**
   * 手动保存配置
   */
  async saveConfig(): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.configFile);
      await fs.mkdir(dir, { recursive: true });

      // 写入配置文件
      const configJson = JSON.stringify(this.config, null, 2);
      await fs.writeFile(this.configFile, configJson, 'utf-8');
    } catch (error) {
      throw new ConfigurationError(
        `Failed to save configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 重新加载配置
   */
  async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configFile, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // 使用配置适配器解析不同格式
      const servers = ConfigAdapter.parseConfig(parsedConfig);
      
      // 转换为我们的内部格式
      const mcpConfigFile: McpConfigFile = {
        version: '1.0.0',
        servers: {}
      };

      // 将数组转换为对象映射
      for (const server of servers) {
        mcpConfigFile.servers[server.id] = server;
      }
      
      // 验证配置结构
      this.validateConfigFile(mcpConfigFile);
      
      this.config = mcpConfigFile;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ConfigurationError(`Invalid JSON in configuration file: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigFilePath(): string {
    return this.configFile;
  }

  /**
   * 导出配置为Claude Desktop格式
   */
  exportToClaudeDesktop(): any {
    const servers = this.listServers();
    return ConfigAdapter.generateConfig(servers, 'claude-desktop');
  }

  /**
   * 导出配置为DeeChat格式
   */
  exportToDeeChat(): any {
    const servers = this.listServers();
    return ConfigAdapter.generateConfig(servers, 'deechat');
  }

  // ============== Private Methods ==============

  private getDefaultConfigPath(): string {
    const homeDir = os.homedir();
    const configDir = path.join(homeDir, '.deechat');
    return path.join(configDir, 'mcp-servers.json');
  }

  private createDefaultConfig(): McpConfigFile {
    return {
      version: '1.0.0',
      servers: {},
      defaults: {
        timeout: 30000,
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 1000
      }
    };
  }

  private validateConfigFile(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new ConfigurationError('Configuration must be an object');
    }

    if (!config.version || typeof config.version !== 'string') {
      throw new ConfigurationError('Configuration must have a version string');
    }

    if (!config.servers || typeof config.servers !== 'object') {
      throw new ConfigurationError('Configuration must have a servers object');
    }

    // 验证每个服务器配置
    for (const [id, serverConfig] of Object.entries(config.servers)) {
      if (!serverConfig || typeof serverConfig !== 'object') {
        throw new ConfigurationError(`Invalid server configuration for '${id}'`);
      }
      
      validateServerConfig(serverConfig as McpServerConfig);
    }
  }
}