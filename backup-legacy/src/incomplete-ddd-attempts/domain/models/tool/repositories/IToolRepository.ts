/**
 * 工具仓储接口
 * 定义MCP工具数据访问的抽象契约
 */

import { MCPTool } from '../entities/MCPTool'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolStatus } from '../value-objects/ToolStatus'
import { ToolCapabilities } from '../value-objects/ToolCapabilities'
import { Result } from '../../../shared/primitives/Result'

export interface ToolSearchCriteria {
  name?: string
  status?: 'available' | 'unavailable' | 'maintenance' | 'deprecated' | 'error'
  capabilities?: string[]
  category?: string
  tags?: string[]
  isSystemTool?: boolean
  hasAnyCapability?: string[]
  hasAllCapabilities?: string[]
  registeredAfter?: Date
  registeredBefore?: Date
  lastUsedAfter?: Date
  lastUsedBefore?: Date
  minUsageCount?: number
  maxUsageCount?: number
  minSuccessRate?: number
  maxErrorRate?: number
  isHealthy?: boolean
}

export interface ToolListOptions {
  offset?: number
  limit?: number
  sortBy?: 'name' | 'registeredAt' | 'lastUsedAt' | 'usageCount' | 'successRate' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

export interface IToolRepository {
  /**
   * 根据ID查找工具
   */
  findById(id: ToolId): Promise<Result<MCPTool | null, Error>>

  /**
   * 根据名称查找工具
   */
  findByName(name: ToolName): Promise<Result<MCPTool | null, Error>>

  /**
   * 保存工具（创建或更新）
   */
  save(tool: MCPTool): Promise<Result<void, Error>>

  /**
   * 删除工具
   */
  delete(id: ToolId): Promise<Result<void, Error>>

  /**
   * 查找所有工具
   */
  findAll(options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 根据条件搜索工具
   */
  findByCriteria(
    criteria: ToolSearchCriteria,
    options?: ToolListOptions
  ): Promise<Result<MCPTool[], Error>>

  /**
   * 获取工具总数
   */
  count(criteria?: ToolSearchCriteria): Promise<Result<number, Error>>

  /**
   * 检查工具是否存在
   */
  exists(id: ToolId): Promise<Result<boolean, Error>>

  /**
   * 检查工具名称是否存在
   */
  existsByName(name: ToolName): Promise<Result<boolean, Error>>

  /**
   * 获取可用的工具
   */
  findAvailable(options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 获取系统工具
   */
  findSystemTools(options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 获取用户工具
   */
  findUserTools(options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 根据能力查找工具
   */
  findByCapabilities(
    requiredCapabilities: string[],
    requireAll: boolean = false,
    options?: ToolListOptions
  ): Promise<Result<MCPTool[], Error>>

  /**
   * 获取最常用的工具
   */
  findMostUsed(limit: number): Promise<Result<MCPTool[], Error>>

  /**
   * 获取最近使用的工具
   */
  findRecentlyUsed(limit: number): Promise<Result<MCPTool[], Error>>

  /**
   * 获取健康的工具（成功率高）
   */
  findHealthyTools(options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 获取有问题的工具（成功率低）
   */
  findProblematicTools(options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 根据类别获取工具
   */
  findByCategory(category: string, options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 根据标签获取工具
   */
  findByTags(tags: string[], options?: ToolListOptions): Promise<Result<MCPTool[], Error>>

  /**
   * 批量激活工具
   */
  activateMany(ids: ToolId[]): Promise<Result<number, Error>>

  /**
   * 批量停用工具
   */
  deactivateMany(ids: ToolId[], reason?: string): Promise<Result<number, Error>>

  /**
   * 批量删除工具
   */
  deleteMany(ids: ToolId[]): Promise<Result<number, Error>>

  /**
   * 获取所有可用的能力列表
   */
  getAllCapabilities(): Promise<Result<string[], Error>>

  /**
   * 获取所有工具类别
   */
  getAllCategories(): Promise<Result<string[], Error>>

  /**
   * 获取所有标签
   */
  getAllTags(): Promise<Result<string[], Error>>

  /**
   * 获取工具统计信息
   */
  getStatistics(): Promise<Result<{
    totalTools: number
    availableTools: number
    systemTools: number
    userTools: number
    mostUsedCapabilities: Array<{ capability: string; count: number }>
    toolsByCategory: Record<string, number>
    toolsByStatus: Record<string, number>
    averageSuccessRate: number
    averageUsageCount: number
    toolsRegisteredThisWeek: number
    toolsUsedThisWeek: number
    healthyToolsPercentage: number
  }, Error>>

  /**
   * 获取工具性能指标
   */
  getPerformanceMetrics(toolId: ToolId): Promise<Result<{
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    successRate: number
    errorRate: number
    averageExecutionTime: number
    averageMemoryUsage: number
    lastExecutionAt?: Date
    peakUsagePeriod: string
    commonErrorReasons: string[]
  }, Error>>

  /**
   * 清理长时间未使用的工具
   */
  cleanupUnusedTools(unusedDays: number): Promise<Result<number, Error>>

  /**
   * 更新工具使用统计
   */
  updateUsageStatistics(
    toolId: ToolId,
    executionTime: number,
    memoryUsed: number,
    success: boolean
  ): Promise<Result<void, Error>>

  /**
   * 获取工具依赖关系
   */
  getToolDependencies(toolId: ToolId): Promise<Result<{
    dependsOn: ToolId[]
    dependents: ToolId[]
  }, Error>>

  /**
   * 根据相似性推荐工具
   */
  findSimilarTools(
    toolId: ToolId,
    limit: number = 5
  ): Promise<Result<Array<{ tool: MCPTool; similarity: number }>, Error>>

  /**
   * 搜索工具（全文搜索）
   */
  search(
    query: string,
    options?: ToolListOptions
  ): Promise<Result<Array<{ tool: MCPTool; relevance: number }>, Error>>

  /**
   * 获取工具执行历史
   */
  getExecutionHistory(
    toolId: ToolId,
    limit: number = 100
  ): Promise<Result<Array<{
    executedAt: Date
    userId?: string
    sessionId?: string
    success: boolean
    executionTime: number
    errorMessage?: string
  }>, Error>>

  /**
   * 批量注册工具
   */
  registerMany(tools: MCPTool[]): Promise<Result<{ successful: number; failed: number }, Error>>

  /**
   * 检查工具健康状态
   */
  checkHealth(toolId: ToolId): Promise<Result<{
    isHealthy: boolean
    healthScore: number
    issues: string[]
    recommendations: string[]
  }, Error>>

  /**
   * 备份工具配置
   */
  backupConfiguration(): Promise<Result<{
    backup: string
    timestamp: Date
    toolCount: number
  }, Error>>

  /**
   * 恢复工具配置
   */
  restoreConfiguration(backup: string): Promise<Result<{
    restored: number
    skipped: number
    errors: string[]
  }, Error>>
}