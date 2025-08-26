/**
 * 工具发现用例
 * 🏗️ DDD重构: 发现和同步MCP工具的应用服务
 */

import { ToolDiscoveryService, MCPServerConnection } from '../../domains/tool/services/ToolDiscoveryService';
import { MCPTool } from '../../domains/tool/entities/MCPTool';

export interface DiscoverToolsRequest {
  serverIds?: string[]; // 指定服务器ID，为空则发现所有
  forceRefresh?: boolean; // 是否强制刷新
  categories?: string[]; // 指定分类
}

export interface DiscoverToolsResponse {
  discoveredTools: MCPTool[];
  serverStats: Array<{
    serverId: string;
    serverName: string;
    toolCount: number;
    status: 'connected' | 'error' | 'offline';
    error?: string;
  }>;
  success: boolean;
  error?: string;
  metadata: {
    discoveryTime: number;
    totalServers: number;
    connectedServers: number;
    totalTools: number;
    newTools: number;
    updatedTools: number;
  };
}

/**
 * 工具发现用例 - 协调MCP服务器连接和工具同步
 */
export class DiscoverToolsUseCase {
  constructor(
    private readonly toolDiscoveryService: ToolDiscoveryService,
    private readonly mcpConnectionProvider: any // MCP连接提供者
  ) {}

  /**
   * 执行工具发现用例
   */
  async execute(request: DiscoverToolsRequest): Promise<DiscoverToolsResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 获取所有MCP服务器连接
      const connections = await this.getMCPConnections(request.serverIds);
      
      if (connections.length === 0) {
        return {
          discoveredTools: [],
          serverStats: [],
          success: false,
          error: '没有可用的MCP服务器连接',
          metadata: {
            discoveryTime: Date.now() - startTime,
            totalServers: 0,
            connectedServers: 0,
            totalTools: 0,
            newTools: 0,
            updatedTools: 0
          }
        };
      }

      // 2. 并行发现所有服务器的工具
      const serverResults = await Promise.allSettled(
        connections.map(connection => this.discoverServerTools(connection, request))
      );

      // 3. 汇总结果
      const allDiscoveredTools: MCPTool[] = [];
      const serverStats: any[] = [];
      let connectedServers = 0;

      for (let i = 0; i < serverResults.length; i++) {
        const result = serverResults[i];
        const connection = connections[i];
        
        if (result.status === 'fulfilled') {
          const { tools, stats } = result.value;
          allDiscoveredTools.push(...tools);
          serverStats.push({
            serverId: connection.serverId,
            serverName: connection.serverName,
            toolCount: tools.length,
            status: 'connected' as const
          });
          connectedServers++;
        } else {
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          serverStats.push({
            serverId: connection.serverId,
            serverName: connection.serverName,
            toolCount: 0,
            status: 'error' as const,
            error
          });
        }
      }

      // 4. 分析工具统计
      const discoveryStats = await this.analyzeDiscoveryResults(allDiscoveredTools);
      
      // 5. 构建响应
      const discoveryTime = Date.now() - startTime;
      
      return {
        discoveredTools: allDiscoveredTools,
        serverStats,
        success: connectedServers > 0,
        metadata: {
          discoveryTime,
          totalServers: connections.length,
          connectedServers,
          totalTools: allDiscoveredTools.length,
          newTools: discoveryStats.newTools,
          updatedTools: discoveryStats.updatedTools
        }
      };

    } catch (error) {
      const discoveryTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        discoveredTools: [],
        serverStats: [],
        success: false,
        error: errorMessage,
        metadata: {
          discoveryTime,
          totalServers: 0,
          connectedServers: 0,
          totalTools: 0,
          newTools: 0,
          updatedTools: 0
        }
      };
    }
  }

  /**
   * 获取MCP服务器连接
   */
  private async getMCPConnections(serverIds?: string[]): Promise<MCPServerConnection[]> {
    try {
      // TODO: 从MCP连接提供者获取连接
      // 这里需要集成实际的MCP连接管理
      
      const allConnections = await this.mcpConnectionProvider.getAllConnections();
      
      if (serverIds && serverIds.length > 0) {
        return allConnections.filter((conn: MCPServerConnection) => 
          serverIds.includes(conn.serverId)
        );
      }
      
      return allConnections.filter((conn: MCPServerConnection) => conn.isConnected);
    } catch (error) {
      console.error('获取MCP连接失败:', error);
      return [];
    }
  }

  /**
   * 发现单个服务器的工具
   */
  private async discoverServerTools(
    connection: MCPServerConnection,
    request: DiscoverToolsRequest
  ): Promise<{ tools: MCPTool[]; stats: any }> {
    
    // 如果需要强制刷新，先刷新服务器工具
    if (request.forceRefresh) {
      await this.toolDiscoveryService.refreshServerTools(connection);
    }

    // 发现工具
    let tools = await this.toolDiscoveryService.discoverToolsFromServer(connection);
    
    // 如果指定了分类，进行筛选
    if (request.categories && request.categories.length > 0) {
      tools = tools.filter(tool => 
        tool.category && request.categories!.includes(tool.category)
      );
    }

    return {
      tools,
      stats: {
        serverId: connection.serverId,
        serverName: connection.serverName,
        toolCount: tools.length
      }
    };
  }

  /**
   * 分析发现结果统计
   */
  private async analyzeDiscoveryResults(tools: MCPTool[]): Promise<{
    newTools: number;
    updatedTools: number;
  }> {
    // TODO: 实现工具变更检测逻辑
    // 这里需要与现有工具库对比，识别新增和更新的工具
    
    return {
      newTools: tools.length, // 简化实现，实际需要对比现有工具
      updatedTools: 0
    };
  }

  /**
   * 获取工具发现统计信息
   */
  async getDiscoveryStats(): Promise<{
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
  }> {
    return await this.toolDiscoveryService.getDiscoveryStats();
  }

  /**
   * 验证工具可用性
   */
  async validateToolsAvailability(serverIds?: string[]): Promise<{
    validationResults: Array<{
      serverId: string;
      serverName: string;
      isOnline: boolean;
      validatedTools: number;
      failedTools: number;
    }>;
    overallHealth: 'healthy' | 'degraded' | 'critical';
  }> {
    const connections = await this.getMCPConnections(serverIds);
    const validationResults = [];
    
    let totalHealthy = 0;
    
    for (const connection of connections) {
      try {
        // TODO: 实现工具可用性验证逻辑
        const isOnline = connection.isConnected;
        const validatedTools = isOnline ? 10 : 0; // 简化实现
        const failedTools = isOnline ? 0 : 5;
        
        validationResults.push({
          serverId: connection.serverId,
          serverName: connection.serverName,
          isOnline,
          validatedTools,
          failedTools
        });
        
        if (isOnline) totalHealthy++;
        
      } catch (error) {
        validationResults.push({
          serverId: connection.serverId,
          serverName: connection.serverName,
          isOnline: false,
          validatedTools: 0,
          failedTools: 0
        });
      }
    }
    
    // 计算整体健康状态
    const healthRatio = connections.length > 0 ? totalHealthy / connections.length : 0;
    const overallHealth = healthRatio >= 0.8 ? 'healthy' : 
                         healthRatio >= 0.5 ? 'degraded' : 'critical';
    
    return {
      validationResults,
      overallHealth
    };
  }
}