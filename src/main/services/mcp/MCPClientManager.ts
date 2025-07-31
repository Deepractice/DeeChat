/**
 * MCP客户端管理器
 * 负责管理多个MCP客户端的连接和生命周期
 */

import log from 'electron-log'
import { MCPServerEntity } from '../../../shared/entities/MCPServerEntity'
import {
  IMCPClient,
  MCPEvent,
  MCPEventType
} from '../../../shared/interfaces/IMCPProvider'
import { RealMCPClient } from './RealMCPClient'

/**
 * MCP客户端管理器
 */
export class MCPClientManager {
  private clients: Map<string, IMCPClient> = new Map();
  private eventListeners: ((event: MCPEvent) => void)[] = [];

  /**
   * 创建客户端
   */
  async createClient(server: MCPServerEntity): Promise<IMCPClient> {
    log.info(`[MCP Manager] 🔧 开始创建真实MCP客户端: ${server.name}`);

    try {
      const client = new RealMCPClient(server);
      log.info(`[MCP Manager] ✅ 客户端实例创建成功: ${server.name}`);

      log.info(`[MCP Manager] 🔗 开始连接客户端: ${server.name}`);
      await client.connect(server);
      log.info(`[MCP Manager] ✅ 客户端连接成功: ${server.name}`);

      return client;
    } catch (error) {
      log.error(`[MCP Manager] ❌ 创建客户端失败: ${server.name}`);
      log.error(`[MCP Manager] 💥 详细错误:`, error);
      throw error; // 重新抛出错误
    }
  }

  /**
   * 连接客户端
   */
  async connectClient(server: MCPServerEntity): Promise<void> {
    log.info(`[MCP Manager] 🚀 开始连接客户端: ${server.name}`);

    // 如果已存在客户端，先断开
    if (this.clients.has(server.id)) {
      log.info(`[MCP Manager] 🔄 发现已存在客户端，先断开: ${server.name}`);
      await this.disconnectClient(server.id);
    }

    try {
      log.info(`[MCP Manager] 🔧 调用createClient: ${server.name}`);
      const client = await this.createClient(server);
      log.info(`[MCP Manager] ✅ createClient成功，保存客户端: ${server.name}`);

      this.clients.set(server.id, client);
      log.info(`[MCP Manager] 📦 客户端已保存到管理器: ${server.name}`);

      this.emitEvent({
        type: MCPEventType.SERVER_CONNECTED,
        serverId: server.id,
        timestamp: new Date(),
        data: { serverName: server.name }
      });
      log.info(`[MCP Manager] 📡 已发送连接成功事件: ${server.name}`);

    } catch (error) {
      log.error(`[MCP Manager] ❌ 连接客户端失败: ${server.name}`);
      log.error(`[MCP Manager] 💥 错误详情:`, error);

      this.emitEvent({
        type: MCPEventType.SERVER_ERROR,
        serverId: server.id,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : '连接失败'
      });
      log.info(`[MCP Manager] 📡 已发送连接失败事件: ${server.name}`);

      throw error; // 重新抛出错误，让上层知道连接失败
    }
  }

  /**
   * 断开客户端连接
   */
  async disconnectClient(serverId: string): Promise<void> {
    log.info(`[MCP Manager] 断开客户端: ${serverId}`);

    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);

      this.emitEvent({
        type: MCPEventType.SERVER_DISCONNECTED,
        serverId,
        timestamp: new Date()
      });
    }
  }

  /**
   * 获取客户端
   */
  getClient(serverId: string): IMCPClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * 获取所有连接的客户端
   */
  getAllClients(): Map<string, IMCPClient> {
    return new Map(this.clients);
  }

  /**
   * 设置事件监听器
   */
  onEvent(callback: (event: MCPEvent) => void): void {
    this.eventListeners.push(callback);
  }

  /**
   * 清理所有客户端
   */
  async cleanup(): Promise<void> {
    log.info('[MCP Manager] 清理所有客户端');

    const disconnectPromises = Array.from(this.clients.keys()).map(serverId =>
      this.disconnectClient(serverId)
    );

    await Promise.all(disconnectPromises);
    this.eventListeners.length = 0;
  }

  /**
   * 发送事件
   */
  private emitEvent(event: MCPEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        log.error('[MCP Manager] 事件监听器错误:', error);
      }
    }
  }
}
