/**
 * 工具发现领域服务
 * 🏗️ DDD重构: 负责从MCP服务器发现和同步工具
 */

import { MCPTool } from '../entities/MCPTool';
import { IToolRepository } from '../repositories/IToolRepository';
import { ToolDiscovered } from '../events/ToolDiscovered';
import { ToolUnavailable } from '../events/ToolUnavailable';

export interface MCPServerConnection {
  serverId: string;
  serverName: string;
  isConnected: boolean;
  listTools(): Promise<any[]>;
}

export class ToolDiscoveryService {
  constructor(
    private readonly toolRepository: IToolRepository,
    private readonly eventPublisher: (event: any) => void
  ) {}

  /**
   * 从MCP服务器发现工具
   */
  async discoverToolsFromServer(connection: MCPServerConnection): Promise<MCPTool[]> {
    if (!connection.isConnected) {
      throw new Error(`MCP服务器未连接: ${connection.serverName}`);
    }

    try {
      const rawTools = await connection.listTools();
      const discoveredTools: MCPTool[] = [];

      for (const rawTool of rawTools) {
        const tool = this.createToolFromRawData(rawTool, connection);
        discoveredTools.push(tool);

        // 发布工具发现事件
        this.eventPublisher(new ToolDiscovered(tool.id, tool.name, connection.serverId));
      }

      // 批量保存到仓储
      await this.toolRepository.saveBatch(discoveredTools);

      return discoveredTools;
    } catch (error) {
      throw new Error(`工具发现失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 刷新服务器的所有工具
   */
  async refreshServerTools(connection: MCPServerConnection): Promise<void> {
    // 获取现有工具
    const existingTools = await this.toolRepository.findByServerId(connection.serverId);
    
    // 发现当前工具
    const currentTools = await this.discoverToolsFromServer(connection);
    const currentToolNames = new Set(currentTools.map(t => t.name));

    // 标记不再存在的工具为不可用
    for (const existingTool of existingTools) {
      if (!currentToolNames.has(existingTool.name)) {
        existingTool.updateAvailability(false);
        await this.toolRepository.save(existingTool);
        
        // 发布工具不可用事件
        this.eventPublisher(new ToolUnavailable(existingTool.id, existingTool.name, connection.serverId));
      }
    }
  }

  /**
   * 验证工具是否仍然可用
   */
  async validateToolAvailability(tool: MCPTool, connection: MCPServerConnection): Promise<boolean> {
    try {
      const rawTools = await connection.listTools();
      const exists = rawTools.some(rawTool => rawTool.name === tool.name);
      
      if (exists !== tool.isAvailable) {
        tool.updateAvailability(exists);
        await this.toolRepository.save(tool);
      }
      
      return exists;
    } catch (error) {
      // 连接失败，标记为不可用
      if (tool.isAvailable) {
        tool.updateAvailability(false);
        await this.toolRepository.save(tool);
        this.eventPublisher(new ToolUnavailable(tool.id, tool.name, connection.serverId));
      }
      return false;
    }
  }

  /**
   * 从原始数据创建工具实体
   */
  private createToolFromRawData(rawTool: any, connection: MCPServerConnection): MCPTool {
    return MCPTool.create({
      name: rawTool.name,
      description: rawTool.description,
      serverId: connection.serverId,
      serverName: connection.serverName,
      inputSchema: rawTool.inputSchema,
      fullDefinition: rawTool,
      category: rawTool.category,
      tags: rawTool.tags || [],
      version: rawTool.version
    });
  }

  /**
   * 按分类发现工具
   */
  async discoverToolsByCategory(connection: MCPServerConnection, category: string): Promise<MCPTool[]> {
    const allTools = await this.discoverToolsFromServer(connection);
    return allTools.filter(tool => tool.category === category);
  }

  /**
   * 获取发现统计信息
   */
  async getDiscoveryStats(): Promise<DiscoveryStats> {
    const availableTools = await this.toolRepository.findAvailable();
    const serverGroups = availableTools.reduce((groups, tool) => {
      const serverId = tool.serverId;
      if (!groups[serverId]) {
        groups[serverId] = { serverId, serverName: tool.serverName, toolCount: 0 };
      }
      groups[serverId].toolCount++;
      return groups;
    }, {} as Record<string, { serverId: string; serverName: string; toolCount: number }>);

    return {
      totalTools: availableTools.length,
      serverStats: Object.values(serverGroups),
      categoriesStats: this.getCategoryStats(availableTools)
    };
  }

  private getCategoryStats(tools: MCPTool[]): Array<{ category: string; count: number }> {
    const categories = tools.reduce((counts, tool) => {
      const category = tool.category || 'uncategorized';
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return Object.entries(categories)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }
}

export interface DiscoveryStats {
  totalTools: number;
  serverStats: Array<{
    serverId: string;
    serverName: string;
    toolCount: number;
  }>;
  categoriesStats: Array<{
    category: string;
    count: number;
  }>;
}