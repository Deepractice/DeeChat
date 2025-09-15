/**
 * Configuration Format Adapter
 * 
 * 支持多种MCP配置格式：
 * 1. 官方Claude Desktop格式
 * 2. 我们的扩展格式
 */

import type { McpServerConfig } from '../types/index.js';

// Claude Desktop格式接口
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, ClaudeDesktopServerConfig>;
}

export interface ClaudeDesktopServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

// 我们的扩展格式接口
export interface DeeChatConfig {
  servers: McpServerConfig[];
}

/**
 * 配置格式适配器
 */
export class ConfigAdapter {
  /**
   * 检测配置文件格式
   */
  static detectFormat(config: any): 'claude-desktop' | 'deechat' | 'unknown' {
    if (config && typeof config === 'object') {
      if ('mcpServers' in config) {
        return 'claude-desktop';
      }
      if ('servers' in config && Array.isArray(config.servers)) {
        return 'deechat';
      }
    }
    return 'unknown';
  }

  /**
   * 从Claude Desktop格式转换到统一格式
   */
  static fromClaudeDesktop(config: ClaudeDesktopConfig): McpServerConfig[] {
    const servers: McpServerConfig[] = [];

    for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
      const mcpConfig: McpServerConfig = {
        id: serverId,
        name: serverId, // 使用ID作为名称
        description: `MCP Server: ${serverId}`,
        transport: {
          type: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args || [],
          cwd: serverConfig.cwd,
          env: serverConfig.env
        },
        enabled: true,
        autoReconnect: true,
        timeout: 30000,
        tags: []
      };

      servers.push(mcpConfig);
    }

    return servers;
  }

  /**
   * 从我们的格式读取
   */
  static fromDeeChat(config: DeeChatConfig): McpServerConfig[] {
    return config.servers;
  }

  /**
   * 转换为Claude Desktop格式
   */
  static toClaudeDesktop(servers: McpServerConfig[]): ClaudeDesktopConfig {
    const mcpServers: Record<string, ClaudeDesktopServerConfig> = {};

    for (const server of servers) {
      if (server.transport.type === 'stdio') {
        mcpServers[server.id] = {
          command: server.transport.command,
          args: server.transport.args,
          env: server.transport.env,
          cwd: server.transport.cwd
        };
      }
      // 注意：Claude Desktop格式只支持stdio传输
      // HTTP和WebSocket传输会被忽略
    }

    return { mcpServers };
  }

  /**
   * 转换为我们的格式
   */
  static toDeeChat(servers: McpServerConfig[]): DeeChatConfig {
    return { servers };
  }

  /**
   * 统一解析配置
   */
  static parseConfig(configData: any): McpServerConfig[] {
    const format = this.detectFormat(configData);
    
    switch (format) {
      case 'claude-desktop':
        return this.fromClaudeDesktop(configData as ClaudeDesktopConfig);
      case 'deechat':
        return this.fromDeeChat(configData as DeeChatConfig);
      default:
        throw new Error(`Unsupported configuration format. Expected 'mcpServers' (Claude Desktop) or 'servers' (DeeChat) format.`);
    }
  }

  /**
   * 生成配置文件内容
   */
  static generateConfig(servers: McpServerConfig[], format: 'claude-desktop' | 'deechat' = 'deechat'): any {
    switch (format) {
      case 'claude-desktop':
        return this.toClaudeDesktop(servers);
      case 'deechat':
        return this.toDeeChat(servers);
      default:
        throw new Error(`Unsupported output format: ${format}`);
    }
  }
}