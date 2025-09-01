import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import log from 'electron-log';
import { LogForwardingService } from '../../core/LogForwardingService';

/**
 * 简化的MCP客户端 - 直接使用官方SDK
 * 
 * 基于@modelcontextprotocol/sdk v1.17.1实现
 * 支持多种传输协议：stdio、http、sse
 * 包含向后兼容性（Streamable HTTP → SSE fallback）
 */
export class MCPClient {
  private clients: Map<string, Client> = new Map();
  private connections: Map<string, any> = new Map(); // Transport connections
  private logForwarding: LogForwardingService;

  constructor() {
    log.info('✅ [MCPClient] 初始化MCP客户端');
    this.logForwarding = LogForwardingService.getInstance();
  }

  /**
   * 连接到MCP服务器
   */
  async connectServer(config: {
    serverId: string;
    transport: 'stdio' | 'http' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
  }): Promise<void> {
    try {
      log.info(`🔗 [MCPClient] 连接服务器: ${config.serverId} (${config.transport})`);
      this.logForwarding.sendMCPLog('info', `🔗 连接服务器: ${config.serverId} (${config.transport})`);

      let transport;
      let connection;

      switch (config.transport) {
        case 'stdio':
          if (!config.command) {
            throw new Error('Stdio transport requires command');
          }
          transport = new StdioClientTransport({
            command: config.command,
            args: config.args || []
          });
          break;

        case 'http':
          if (!config.url) {
            throw new Error('HTTP transport requires url');
          }
          try {
            // 尝试Streamable HTTP
            transport = new StreamableHTTPClientTransport(new URL(config.url));
            log.info(`✅ [MCPClient] 使用Streamable HTTP连接: ${config.serverId}`);
          } catch (error) {
            // 回退到SSE
            log.warn(`⚠️ [MCPClient] Streamable HTTP失败，回退到SSE: ${config.serverId}`);
            transport = new SSEClientTransport(new URL(config.url));
          }
          break;

        case 'sse':
          if (!config.url) {
            throw new Error('SSE transport requires url');
          }
          transport = new SSEClientTransport(new URL(config.url));
          break;

        default:
          throw new Error(`Unsupported transport: ${config.transport}`);
      }

      const client = new Client(
        {
          name: "DeeChat",
          version: "1.0.0"
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      // 使用transport创建连接
      connection = transport;
      await client.connect(connection);

      this.clients.set(config.serverId, client);
      this.connections.set(config.serverId, { transport, connection });

      log.info(`✅ [MCPClient] 服务器连接成功: ${config.serverId}`);
      this.logForwarding.sendMCPLog('info', `✅ 服务器连接成功: ${config.serverId}`);

    } catch (error) {
      log.error(`❌ [MCPClient] 连接服务器失败: ${config.serverId}`, error);
      this.logForwarding.sendMCPLog('error', `❌ 连接服务器失败: ${config.serverId}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnectServer(serverId: string): Promise<void> {
    try {
      const client = this.clients.get(serverId);
      const connectionInfo = this.connections.get(serverId);

      if (client) {
        await client.close();
        this.clients.delete(serverId);
      }

      if (connectionInfo) {
        await connectionInfo.connection.close();
        this.connections.delete(serverId);
      }

      log.info(`🔌 [MCPClient] 服务器断开连接: ${serverId}`);

    } catch (error) {
      log.error(`❌ [MCPClient] 断开连接失败: ${serverId}`, error);
      throw error;
    }
  }

  /**
   * 获取服务器工具列表
   */
  async listTools(serverId: string): Promise<any[]> {
    try {
      const client = this.clients.get(serverId);
      if (!client) {
        throw new Error(`Server not connected: ${serverId}`);
      }

      const response = await client.listTools();
      log.debug(`🔧 [MCPClient] 获取工具列表: ${serverId}`, response.tools?.length || 0);
      
      // 🚨 详细调试工具信息
      if (response.tools && response.tools.length > 0) {
        log.info(`🔍 [MCPClient-TOOLS-DEBUG] 服务器 ${serverId} 工具详情:`);
        response.tools.forEach((tool, index) => {
          log.info(`🔍 [MCPClient-TOOLS-DEBUG] 工具 ${index + 1}: ${tool.name}`);
          log.info(`🔍 [MCPClient-TOOLS-DEBUG] - 描述: ${tool.description || '无描述'}`);
          log.info(`🔍 [MCPClient-TOOLS-DEBUG] - inputSchema存在: ${!!tool.inputSchema}`);
          if (tool.inputSchema) {
            log.info(`🔍 [MCPClient-TOOLS-DEBUG] - inputSchema:`, JSON.stringify(tool.inputSchema, null, 2));
          }
        });
      }
      
      return response.tools || [];

    } catch (error) {
      log.error(`❌ [MCPClient] 获取工具列表失败: ${serverId}`, error);
      throw error;
    }
  }

  /**
   * 调用工具 - 核心方法
   */
  async callTool(serverId: string, toolName: string, arguments_: any): Promise<any> {
    try {
      // 发送工具调用开始日志到前端
      this.logForwarding.sendMCPLog('info', `🔧 调用工具: ${serverId}/${toolName}`, {
        serverId,
        toolName,
        arguments: arguments_
      });
      
      log.debug(`🔧 [MCPClient] 调用工具: ${serverId}/${toolName}`, arguments_);

      const client = this.clients.get(serverId);
      if (!client) {
        this.logForwarding.sendMCPLog('error', `❌ 服务器未连接: ${serverId}`);
        throw new Error(`Server not connected: ${serverId}`);
      }

      const result = await client.callTool({
        name: toolName,
        arguments: arguments_ || {}
      });

      // 发送工具调用成功日志到前端
      this.logForwarding.sendMCPLog('info', `✅ 工具调用成功: ${toolName}`, {
        serverId,
        toolName,
        resultType: typeof result
      });
      
      log.info(`✅ [MCPClient] 工具调用成功: ${serverId}/${toolName}`);
      return result;

    } catch (error) {
      // 发送工具调用失败日志到前端
      this.logForwarding.sendMCPLog('error', `❌ 工具调用失败: ${toolName}`, {
        serverId,
        toolName,
        error: error instanceof Error ? error.message : String(error)
      });
      
      log.error(`❌ [MCPClient] 工具调用失败: ${serverId}/${toolName}`, error);
      throw error;
    }
  }

  /**
   * 获取服务器资源列表
   */
  async listResources(serverId: string): Promise<any[]> {
    try {
      const client = this.clients.get(serverId);
      if (!client) {
        throw new Error(`Server not connected: ${serverId}`);
      }

      const response = await client.listResources();
      return response.resources || [];

    } catch (error) {
      log.error(`❌ [MCPClient] 获取资源列表失败: ${serverId}`, error);
      throw error;
    }
  }

  /**
   * 读取资源内容
   */
  async readResource(serverId: string, uri: string): Promise<any> {
    try {
      const client = this.clients.get(serverId);
      if (!client) {
        throw new Error(`Server not connected: ${serverId}`);
      }

      const result = await client.readResource({ uri });
      return result;

    } catch (error) {
      log.error(`❌ [MCPClient] 读取资源失败: ${serverId}/${uri}`, error);
      throw error;
    }
  }

  /**
   * 获取已连接的服务器列表
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 检查服务器连接状态
   */
  isServerConnected(serverId: string): boolean {
    return this.clients.has(serverId);
  }

  /**
   * 获取客户端统计信息
   */
  getStats(): {
    connectedServers: number;
    serverIds: string[];
  } {
    return {
      connectedServers: this.clients.size,
      serverIds: this.getConnectedServers()
    };
  }

  /**
   * 关闭所有连接
   */
  async close(): Promise<void> {
    log.info('🔌 [MCPClient] 关闭所有MCP连接');

    const serverIds = this.getConnectedServers();
    await Promise.all(
      serverIds.map(serverId => this.disconnectServer(serverId))
    );

    log.info('✅ [MCPClient] 所有MCP连接已关闭');
  }
}