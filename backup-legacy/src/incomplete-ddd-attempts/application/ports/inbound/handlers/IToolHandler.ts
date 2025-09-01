/**
 * 工具处理器接口（入站端口）
 * 定义MCP工具相关操作的抽象契约
 */

import { Result } from '../../../../domain/shared/primitives/Result'

export interface IExecuteToolRequest {
  toolId: string
  parameters: Record<string, any>
  context?: {
    userId?: string
    sessionId?: string
    workspaceId?: string
  }
  options?: {
    timeout?: number
    retryOnFailure?: boolean
    useCache?: boolean
    priority?: 'low' | 'normal' | 'high'
  }
}

export interface IExecuteToolResponse {
  success: boolean
  data?: any
  message?: string
  executionTime: number
  cached: boolean
  metadata?: {
    toolName: string
    version?: string
    capabilities: string[]
  }
}

export interface IRegisterToolRequest {
  name: string
  schema: any
  capabilities: string[]
  metadata?: {
    description?: string
    version?: string
    author?: string
    category?: string
    tags?: string[]
    isSystemTool?: boolean
  }
}

export interface IRegisterToolResponse {
  toolId: string
  success: boolean
  message?: string
}

export interface IListToolsRequest {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
  capabilities?: string[]
  category?: string
  isSystemTool?: boolean
}

export interface IListToolsResponse {
  tools: Array<{
    toolId: string
    name: string
    status: string
    capabilities: string[]
    category?: string
    description?: string
    usageCount: number
    successRate: number
    isHealthy: boolean
  }>
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

export interface IRecommendToolsRequest {
  requiredCapabilities: string[]
  context?: string
  excludeToolIds?: string[]
  preferSystemTools?: boolean
  minSuccessRate?: number
  maxResults?: number
}

export interface IRecommendToolsResponse {
  recommendations: Array<{
    toolId: string
    toolName: string
    matchScore: number
    reason: string
    confidence: number
    capabilities: string[]
  }>
}

export interface IToolHealthCheckResponse {
  healthChecks: Array<{
    toolId: string
    toolName: string
    isHealthy: boolean
    healthScore: number
    issues: string[]
    recommendations: string[]
    lastChecked: Date
  }>
  summary: {
    total: number
    healthy: number
    unhealthy: number
    averageHealthScore: number
  }
}

export interface IToolStatisticsResponse {
  totalTools: number
  availableTools: number
  systemTools: number
  userTools: number
  mostUsedCapabilities: Array<{ capability: string; count: number }>
  toolsByCategory: Record<string, number>
  toolsByStatus: Record<string, number>
  averageSuccessRate: number
  healthyToolsPercentage: number
}

/**
 * 工具处理器接口
 * 定义所有MCP工具相关操作的契约
 */
export interface IToolHandler {
  /**
   * 执行工具
   */
  executeTool(request: IExecuteToolRequest): Promise<Result<IExecuteToolResponse, Error>>

  /**
   * 注册工具
   */
  registerTool(request: IRegisterToolRequest): Promise<Result<IRegisterToolResponse, Error>>

  /**
   * 发现并注册工具
   */
  discoverAndRegisterTools(mcpServers: string[]): Promise<Result<{
    discovered: number
    registered: number
    updated: number
    failed: number
  }, Error>>

  /**
   * 获取工具列表
   */
  listTools(request: IListToolsRequest): Promise<Result<IListToolsResponse, Error>>

  /**
   * 推荐工具
   */
  recommendTools(request: IRecommendToolsRequest): Promise<Result<IRecommendToolsResponse, Error>>

  /**
   * 执行健康检查
   */
  performHealthCheck(toolIds?: string[]): Promise<Result<IToolHealthCheckResponse, Error>>

  /**
   * 清理不健康的工具
   */
  cleanupUnhealthyTools(): Promise<Result<{
    checked: number
    deactivated: number
    removed: number
  }, Error>>

  /**
   * 获取工具统计
   */
  getToolStatistics(): Promise<Result<IToolStatisticsResponse, Error>>

  /**
   * 启用/禁用工具
   */
  toggleToolStatus(toolId: string, enable: boolean): Promise<Result<{
    toolId: string
    toolName: string
    newStatus: string
    success: boolean
  }, Error>>

  /**
   * 获取工具详情
   */
  getToolDetails(toolId: string): Promise<Result<{
    tool: any // 将来会定义具体的Tool DTO
    found: boolean
  }, Error>>

  /**
   * 删除工具
   */
  deleteTool(toolId: string): Promise<Result<void, Error>>
}