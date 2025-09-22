/**
 * Configuration Format Adapter
 *
 * 统一使用 Claude Desktop 标准格式
 */

import type { McpServerConfig } from '../types/index.js';

// Claude Desktop格式接口 - 扩展支持多种传输类型
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, ClaudeDesktopServerConfig>;
}

export interface ClaudeDesktopServerConfig {
  // stdio 传输类型
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;

  // HTTP 传输类型
  url?: string;

  // WebSocket 传输类型
  websocket?: string;

  // 传输类型标识（可选，如果没有会自动推断）
  transport?: 'stdio' | 'http' | 'websocket' | 'streamable-http';
}

/**
 * 配置格式适配器 - 统一使用 Claude Desktop 格式
 */
export class ConfigAdapter {
  /**
   * 从 Claude Desktop 格式解析配置
   */
  static parseConfig(configData: any): McpServerConfig[] {
    if (!configData || typeof configData !== 'object') {
      throw new Error('Configuration must be an object');
    }

    if (!('mcpServers' in configData)) {
      throw new Error('Configuration must contain "mcpServers" field (Claude Desktop format)');
    }

    return this.fromClaudeDesktop(configData as ClaudeDesktopConfig);
  }

  /**
   * 从 Claude Desktop 格式转换到内部格式
   */
  static fromClaudeDesktop(config: ClaudeDesktopConfig): McpServerConfig[] {
    const servers: McpServerConfig[] = [];

    for (const [serverId, serverConfig] of Object.entries(config.mcpServers)) {
      // 推断传输类型
      let transportType: 'stdio' | 'http' | 'websocket' = 'stdio';

      if (serverConfig.transport) {
        // 标准化传输类型
        switch (serverConfig.transport) {
          case 'streamable-http':
          case 'http':
            transportType = 'http';
            break;
          case 'websocket':
            transportType = 'websocket';
            break;
          case 'stdio':
          default:
            transportType = 'stdio';
            break;
        }
      } else if (serverConfig.url) {
        transportType = 'http';
      } else if (serverConfig.websocket) {
        transportType = 'websocket';
      } else if (serverConfig.command) {
        transportType = 'stdio';
      }

      let transport: any;

      switch (transportType) {
        case 'http':
          transport = {
            type: 'http',
            url: serverConfig.url || ''
          };
          break;
        case 'websocket':
          transport = {
            type: 'websocket',
            url: serverConfig.websocket || ''
          };
          break;
        case 'stdio':
        default:
          transport = {
            type: 'stdio',
            command: serverConfig.command || '',
            args: serverConfig.args || [],
            cwd: serverConfig.cwd,
            env: serverConfig.env
          };
          break;
      }

      const mcpConfig: McpServerConfig = {
        id: serverId,
        name: serverId, // 使用ID作为名称
        description: `MCP Server: ${serverId}`,
        transport,
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
   * 转换为 Claude Desktop 格式
   */
  static generateConfig(servers: McpServerConfig[]): ClaudeDesktopConfig {
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
}