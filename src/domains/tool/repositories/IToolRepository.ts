/**
 * 工具仓储接口
 * 🏗️ DDD重构: 定义工具持久化的契约
 */

import { MCPTool } from '../entities/MCPTool';
import { ToolId } from '../value-objects/ToolId';

export interface IToolRepository {
  /**
   * 根据ID查找工具
   */
  findById(id: ToolId): Promise<MCPTool | null>;

  /**
   * 根据服务器ID查找所有工具
   */
  findByServerId(serverId: string): Promise<MCPTool[]>;

  /**
   * 搜索工具
   */
  search(criteria: ToolSearchCriteria): Promise<MCPTool[]>;

  /**
   * 获取所有可用的工具
   */
  findAvailable(): Promise<MCPTool[]>;

  /**
   * 保存工具
   */
  save(tool: MCPTool): Promise<void>;

  /**
   * 批量保存工具
   */
  saveBatch(tools: MCPTool[]): Promise<void>;

  /**
   * 删除工具
   */
  delete(id: ToolId): Promise<void>;

  /**
   * 根据服务器ID删除所有工具
   */
  deleteByServerId(serverId: string): Promise<void>;

  /**
   * 获取工具使用统计
   */
  getUsageStats(id: ToolId): Promise<ToolUsageStats | null>;

  /**
   * 更新工具可用性
   */
  updateAvailability(id: ToolId, isAvailable: boolean): Promise<void>;
}

export interface ToolSearchCriteria {
  searchTerm?: string;
  category?: string;
  tags?: string[];
  serverId?: string;
  isAvailable?: boolean;
  limit?: number;
  offset?: number;
}

export interface ToolUsageStats {
  toolId: string;
  totalUsage: number;
  lastUsed?: Date;
  averageExecutionTime?: number;
  successRate?: number;
}