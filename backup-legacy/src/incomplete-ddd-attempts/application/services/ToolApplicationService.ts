/**
 * 工具应用服务
 * 协调MCP工具管理的业务用例
 */

import { HybridApplicationService, IApplicationContext } from './ApplicationService'
import { Result } from '../../domain/shared/primitives/Result'
import { 
  ToolDomainService,
  IToolExecutionRequest,
  IToolRecommendationCriteria,
  IToolHealthCheck,
  MCPTool,
  ToolId,
  ToolName,
  ToolCapabilities,
  ToolExecutionContext,
  ToolExecutionResult,
  IToolRepository
} from '../../domain/models/tool'

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
  result: ToolExecutionResult
  cached: boolean
  executionTime: number
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
  tool: MCPTool
  registered: boolean
}

export interface IListToolsRequest {
  page?: number
  limit?: number
  sortBy?: 'name' | 'registeredAt' | 'usageCount' | 'successRate'
  sortOrder?: 'asc' | 'desc'
  status?: 'available' | 'unavailable' | 'maintenance' | 'error'
  capabilities?: string[]
  category?: string
  isSystemTool?: boolean
}

export interface IListToolsResponse {
  tools: MCPTool[]
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
    tool: MCPTool
    matchScore: number
    reason: string
    confidence: number
  }>
}

export interface IToolHealthCheckResponse {
  healthChecks: IToolHealthCheck[]
  summary: {
    total: number
    healthy: number
    unhealthy: number
    averageHealthScore: number
  }
}

export class ToolApplicationService extends HybridApplicationService {
  constructor(
    private readonly toolDomainService: ToolDomainService,
    private readonly toolRepository: IToolRepository
  ) {
    super('ToolService')
  }

  /**
   * 执行工具
   */
  async executeTool(request: IExecuteToolRequest): Promise<Result<IExecuteToolResponse, Error>> {
    const context = this.createContext(
      request.context?.userId,
      request.context?.sessionId
    )

    return this.executeCommand('executeTool', context, async () => {
      const toolId = ToolId.fromString(request.toolId)

      // 创建执行上下文
      const executionContext = ToolExecutionContext.create(
        request.parameters,
        {
          userId: request.context?.userId,
          sessionId: request.context?.sessionId,
          workspaceId: request.context?.workspaceId
        },
        {
          // 基于工具类型设置默认权限
          canReadFiles: true,
          canWriteFiles: false, // 默认只读
          canExecuteCommands: false,
          canAccessNetwork: false
        },
        {
          timeout: request.options?.timeout || 30000,
          priority: request.options?.priority || 'normal',
          validateInput: true,
          validateOutput: false
        }
      )

      // 构建工具执行请求
      const toolExecutionRequest: IToolExecutionRequest = {
        toolId,
        context: executionContext,
        retryOnFailure: request.options?.retryOnFailure || false,
        useCache: request.options?.useCache || false
      }

      const startTime = Date.now()

      // 通过领域服务执行工具
      const result = await this.toolDomainService.executeToolSafely(toolExecutionRequest)
      if (result.isError()) {
        // 发布工具执行失败事件
        await this.publishEvent('tool.execution.failed', {
          toolId: request.toolId,
          error: result.getError().message,
          executionTime: Date.now() - startTime,
          userId: request.context?.userId
        }, context)

        return Result.error(result.getError())
      }

      const executionResult = result.getValue()
      const executionTime = Date.now() - startTime

      // 发布工具执行完成事件
      await this.publishEvent('tool.execution.completed', {
        toolId: request.toolId,
        success: executionResult.isSuccess(),
        executionTime,
        cached: executionResult.isCacheHit(),
        userId: request.context?.userId
      }, context)

      return Result.success({
        result: executionResult,
        cached: executionResult.isCacheHit(),
        executionTime
      })
    })
  }

  /**
   * 注册工具
   */
  async registerTool(request: IRegisterToolRequest): Promise<Result<IRegisterToolResponse, Error>> {
    const context = this.createContext()

    return this.executeCommand('registerTool', context, async () => {
      const toolId = ToolId.fromToolName(request.name)
      const toolName = ToolName.create(request.name)
      const capabilities = ToolCapabilities.create(request.capabilities)

      // 创建工具
      const tool = MCPTool.create(
        toolId,
        toolName,
        request.schema,
        capabilities,
        request.metadata || {}
      )

      // 保存工具
      const saveResult = await this.toolRepository.save(tool)
      if (saveResult.isError()) {
        return Result.error(saveResult.getError())
      }

      // 发布工具注册事件
      await this.publishEvent('tool.registered', {
        toolId: tool.getId().getValue(),
        toolName: request.name,
        capabilities: request.capabilities,
        isSystemTool: request.metadata?.isSystemTool || false
      }, context)

      return Result.success({
        toolId: tool.getId().getValue(),
        tool,
        registered: true
      })
    })
  }

  /**
   * 发现并注册工具
   */
  async discoverAndRegisterTools(mcpServers: string[]): Promise<Result<{
    discovered: number
    registered: number
    updated: number
    failed: number
    details: any
  }, Error>> {
    const context = this.createContext()

    return this.executeCommand('discoverAndRegisterTools', context, async () => {
      const result = await this.toolDomainService.discoverAndRegisterTools(mcpServers)
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const discoveryResult = result.getValue()

      // 发布工具发现事件
      await this.publishEvent('tools.discovery.completed', {
        discovered: discoveryResult.discovered.length,
        registered: discoveryResult.registered.length,
        updated: discoveryResult.updated.length,
        failed: discoveryResult.failed.length,
        mcpServers
      }, context)

      return Result.success({
        discovered: discoveryResult.discovered.length,
        registered: discoveryResult.registered.length,
        updated: discoveryResult.updated.length,
        failed: discoveryResult.failed.length,
        details: discoveryResult
      })
    })
  }

  /**
   * 获取工具列表
   */
  async listTools(request: IListToolsRequest): Promise<Result<IListToolsResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('listTools', context, async () => {
      const page = Math.max(1, request.page || 1)
      const limit = Math.min(100, Math.max(1, request.limit || 10))

      const criteria = {
        status: request.status,
        capabilities: request.capabilities,
        category: request.category,
        isSystemTool: request.isSystemTool
      }

      const options = {
        offset: (page - 1) * limit,
        limit,
        sortBy: request.sortBy || 'usageCount',
        sortOrder: request.sortOrder || 'desc'
      }

      // 获取工具列表
      const toolsResult = await this.toolRepository.findByCriteria(criteria, options)
      if (toolsResult.isError()) {
        return Result.error(toolsResult.getError())
      }

      // 获取总数
      const countResult = await this.toolRepository.count(criteria)
      if (countResult.isError()) {
        return Result.error(countResult.getError())
      }

      const tools = toolsResult.getValue()
      const total = countResult.getValue()

      return Result.success({
        tools,
        total,
        page,
        limit,
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      })
    })
  }

  /**
   * 推荐工具
   */
  async recommendTools(request: IRecommendToolsRequest): Promise<Result<IRecommendToolsResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('recommendTools', context, async () => {
      const criteria: IToolRecommendationCriteria = {
        requiredCapabilities: request.requiredCapabilities,
        context: request.context,
        excludeToolIds: request.excludeToolIds?.map(id => ToolId.fromString(id)),
        preferSystemTools: request.preferSystemTools,
        minSuccessRate: request.minSuccessRate,
        maxResults: request.maxResults || 5
      }

      const result = await this.toolDomainService.recommendTools(criteria)
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const tools = result.getValue()
      
      // 构建推荐结果
      const recommendations = tools.map(tool => {
        const matchScore = this.calculateMatchScore(tool, request.requiredCapabilities)
        const confidence = this.calculateConfidence(tool)
        const reason = this.generateRecommendationReason(tool, request.requiredCapabilities)
        
        return {
          tool,
          matchScore,
          reason,
          confidence
        }
      })

      return Result.success({ recommendations })
    })
  }

  /**
   * 执行工具健康检查
   */
  async performHealthCheck(toolIds?: string[]): Promise<Result<IToolHealthCheckResponse, Error>> {
    const context = this.createContext()

    return this.executeQuery('performHealthCheck', context, async () => {
      let healthChecks: IToolHealthCheck[]

      if (toolIds && toolIds.length > 0) {
        // 检查指定工具
        healthChecks = []
        for (const toolIdStr of toolIds) {
          const toolId = ToolId.fromString(toolIdStr)
          const healthResult = await this.toolDomainService.checkToolHealth(toolId)
          if (healthResult.isSuccess()) {
            healthChecks.push(healthResult.getValue())
          }
        }
      } else {
        // 检查所有工具
        const bulkHealthResult = await this.toolDomainService.performBulkHealthCheck()
        if (bulkHealthResult.isError()) {
          return Result.error(bulkHealthResult.getError())
        }
        healthChecks = bulkHealthResult.getValue()
      }

      // 计算摘要统计
      const total = healthChecks.length
      const healthy = healthChecks.filter(hc => hc.isHealthy).length
      const unhealthy = total - healthy
      const averageHealthScore = total > 0 
        ? healthChecks.reduce((sum, hc) => sum + hc.healthScore, 0) / total 
        : 0

      return Result.success({
        healthChecks,
        summary: {
          total,
          healthy,
          unhealthy,
          averageHealthScore
        }
      })
    })
  }

  /**
   * 清理不健康的工具
   */
  async cleanupUnhealthyTools(): Promise<Result<{
    checked: number
    deactivated: number
    removed: number
  }, Error>> {
    const context = this.createContext()

    return this.executeCommand('cleanupUnhealthyTools', context, async () => {
      const result = await this.toolDomainService.cleanupUnhealthyTools()
      if (result.isError()) {
        return Result.error(result.getError())
      }

      const cleanupResult = result.getValue()

      // 发布清理事件
      await this.publishEvent('tools.cleanup.completed', {
        checked: cleanupResult.checked,
        deactivated: cleanupResult.deactivated,
        removed: cleanupResult.removed
      }, context)

      return Result.success(cleanupResult)
    })
  }

  /**
   * 获取工具统计
   */
  async getToolStatistics(): Promise<Result<{
    totalTools: number
    availableTools: number
    systemTools: number
    userTools: number
    mostUsedCapabilities: Array<{ capability: string; count: number }>
    toolsByCategory: Record<string, number>
    toolsByStatus: Record<string, number>
    averageSuccessRate: number
    healthyToolsPercentage: number
  }, Error>> {
    const context = this.createContext()

    return this.executeQuery('getToolStatistics', context, async () => {
      const result = await this.toolRepository.getStatistics()
      if (result.isError()) {
        return Result.error(result.getError())
      }

      return Result.success(result.getValue())
    })
  }

  /**
   * 启用/禁用工具
   */
  async toggleToolStatus(toolId: string, enable: boolean): Promise<Result<MCPTool, Error>> {
    const context = this.createContext()
    const operation = enable ? 'enableTool' : 'disableTool'

    return this.executeCommand(operation, context, async () => {
      const id = ToolId.fromString(toolId)
      
      // 获取工具
      const toolResult = await this.toolRepository.findById(id)
      if (toolResult.isError()) {
        return Result.error(toolResult.getError())
      }

      const tool = toolResult.getValue()
      if (!tool) {
        return Result.error(new Error(`Tool not found: ${toolId}`))
      }

      // 更新状态
      if (enable) {
        tool.activate()
      } else {
        tool.deactivate('Manually disabled')
      }

      // 保存更新
      const saveResult = await this.toolRepository.save(tool)
      if (saveResult.isError()) {
        return Result.error(saveResult.getError())
      }

      // 发布状态变更事件
      await this.publishEvent('tool.status.changed', {
        toolId,
        toolName: tool.getName().getValue(),
        newStatus: tool.getStatus().getStatus(),
        enabled: enable
      }, context)

      return Result.success(tool)
    })
  }

  /**
   * 计算匹配分数
   */
  private calculateMatchScore(tool: MCPTool, requiredCapabilities: string[]): number {
    const toolCapabilities = tool.getCapabilities().getCapabilities()
    const matches = requiredCapabilities.filter(cap => toolCapabilities.includes(cap)).length
    return requiredCapabilities.length > 0 ? matches / requiredCapabilities.length : 0
  }

  /**
   * 计算可信度
   */
  private calculateConfidence(tool: MCPTool): number {
    const successRate = tool.getSuccessRate()
    const usageCount = tool.getUsageCount()
    const healthiness = tool.isHealthy() ? 1 : 0.5
    
    // 基于成功率、使用次数和健康状态计算可信度
    const usageFactor = Math.min(usageCount / 10, 1) // 使用次数越多越可信，最多10次
    return (successRate * 0.5 + usageFactor * 0.3 + healthiness * 0.2)
  }

  /**
   * 生成推荐理由
   */
  private generateRecommendationReason(tool: MCPTool, requiredCapabilities: string[]): string {
    const toolCapabilities = tool.getCapabilities().getCapabilities()
    const matches = requiredCapabilities.filter(cap => toolCapabilities.includes(cap))
    
    if (matches.length === 0) {
      return `基于使用频率推荐 (使用${tool.getUsageCount()}次, 成功率${Math.round(tool.getSuccessRate() * 100)}%)`
    }
    
    if (matches.length === requiredCapabilities.length) {
      return `完全匹配所需能力: ${matches.join(', ')}`
    }
    
    return `匹配 ${matches.length}/${requiredCapabilities.length} 个能力: ${matches.join(', ')}`
  }
}