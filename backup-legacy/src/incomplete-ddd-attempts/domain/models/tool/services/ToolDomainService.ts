/**
 * Tool领域服务
 * 处理跨聚合根的MCP工具管理业务逻辑
 */

import { Result } from '../../../shared/primitives/Result'
import { MCPTool } from '../entities/MCPTool'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolCapabilities } from '../value-objects/ToolCapabilities'
import { ToolExecutionContext } from '../value-objects/ToolExecutionContext'
import { ToolExecutionResult } from '../value-objects/ToolExecutionResult'
import { IToolRepository } from '../repositories/IToolRepository'

export interface IToolDiscoveryResult {
  discovered: MCPTool[]
  registered: MCPTool[]
  updated: MCPTool[]
  failed: Array<{ name: string; error: string }>
}

export interface IToolExecutionRequest {
  toolId: ToolId
  context: ToolExecutionContext
  retryOnFailure?: boolean
  useCache?: boolean
}

export interface IToolRecommendationCriteria {
  requiredCapabilities: string[]
  context?: string
  excludeToolIds?: ToolId[]
  preferSystemTools?: boolean
  maxResults?: number
  minSuccessRate?: number
}

export interface IToolHealthCheck {
  toolId: ToolId
  isHealthy: boolean
  healthScore: number
  issues: string[]
  recommendations: string[]
  lastChecked: Date
}

export class ToolDomainService {
  constructor(
    private readonly toolRepository: IToolRepository
  ) {}

  /**
   * 发现并注册新的MCP工具
   */
  async discoverAndRegisterTools(mcpServers: string[]): Promise<Result<IToolDiscoveryResult, Error>> {
    try {
      const result: IToolDiscoveryResult = {
        discovered: [],
        registered: [],
        updated: [],
        failed: []
      }

      for (const serverUrl of mcpServers) {
        try {
          // 这里实际的工具发现逻辑将在基础设施层实现
          // 当前只是模拟发现过程
          const discoveredTools = await this.discoverToolsFromServer(serverUrl)
          result.discovered.push(...discoveredTools)

          for (const tool of discoveredTools) {
            const existingTool = await this.toolRepository.findByName(tool.getName())
            
            if (existingTool.isError()) {
              result.failed.push({
                name: tool.getName().getValue(),
                error: existingTool.getError().message
              })
              continue
            }

            if (existingTool.getValue()) {
              // 更新现有工具
              const updateResult = await this.toolRepository.save(tool)
              if (updateResult.isSuccess()) {
                result.updated.push(tool)
              } else {
                result.failed.push({
                  name: tool.getName().getValue(),
                  error: updateResult.getError().message
                })
              }
            } else {
              // 注册新工具
              const registerResult = await this.toolRepository.save(tool)
              if (registerResult.isSuccess()) {
                result.registered.push(tool)
              } else {
                result.failed.push({
                  name: tool.getName().getValue(),
                  error: registerResult.getError().message
                })
              }
            }
          }
        } catch (error) {
          result.failed.push({
            name: serverUrl,
            error: (error as Error).message
          })
        }
      }

      return Result.success(result)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 执行工具并处理结果
   */
  async executeToolSafely(request: IToolExecutionRequest): Promise<Result<ToolExecutionResult, Error>> {
    try {
      // 1. 获取工具
      const toolResult = await this.toolRepository.findById(request.toolId)
      if (toolResult.isError()) {
        return Result.error(toolResult.getError())
      }

      const tool = toolResult.getValue()
      if (!tool) {
        return Result.error(new Error(`Tool not found: ${request.toolId.getValue()}`))
      }

      // 2. 检查工具状态和健康度
      const healthCheck = await this.checkToolHealth(tool.getId())
      if (healthCheck.isError()) {
        return Result.error(healthCheck.getError())
      }

      const health = healthCheck.getValue()
      if (!health.isHealthy && health.healthScore < 0.5) {
        return Result.error(new Error(`Tool ${tool.getName().getValue()} is unhealthy: ${health.issues.join(', ')}`))
      }

      // 3. 验证执行权限
      const permissionResult = this.validateExecutionPermissions(tool, request.context)
      if (permissionResult.isError()) {
        return Result.error(permissionResult.getError())
      }

      // 4. 检查缓存（如果启用）
      if (request.useCache && request.context.isCacheEnabled()) {
        const cachedResult = await this.getCachedResult(tool.getId(), request.context)
        if (cachedResult) {
          return Result.success(cachedResult)
        }
      }

      // 5. 执行工具
      let executionResult: ToolExecutionResult
      try {
        executionResult = await tool.execute(request.context)
      } catch (error) {
        // 6. 处理重试逻辑
        if (request.retryOnFailure && request.context.getMaxRetries() > 0) {
          const retryResult = await this.retryExecution(tool, request.context)
          if (retryResult.isSuccess()) {
            executionResult = retryResult.getValue()
          } else {
            return Result.error(error as Error)
          }
        } else {
          return Result.error(error as Error)
        }
      }

      // 7. 更新统计信息
      await this.updateToolStatistics(tool.getId(), executionResult)

      // 8. 缓存结果（如果符合条件）
      if (request.useCache && executionResult.isCacheable()) {
        await this.cacheResult(tool.getId(), request.context, executionResult)
      }

      return Result.success(executionResult)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 推荐合适的工具
   */
  async recommendTools(criteria: IToolRecommendationCriteria): Promise<Result<MCPTool[], Error>> {
    try {
      // 1. 根据能力查找工具
      const toolsResult = await this.toolRepository.findByCapabilities(
        criteria.requiredCapabilities,
        false, // 不需要全部匹配
        { 
          limit: criteria.maxResults || 10,
          sortBy: 'usageCount',
          sortOrder: 'desc'
        }
      )

      if (toolsResult.isError()) {
        return Result.error(toolsResult.getError())
      }

      let tools = toolsResult.getValue()

      // 2. 过滤排除的工具
      if (criteria.excludeToolIds) {
        const excludeIds = new Set(criteria.excludeToolIds.map(id => id.getValue()))
        tools = tools.filter(tool => !excludeIds.has(tool.getId().getValue()))
      }

      // 3. 过滤成功率
      if (criteria.minSuccessRate !== undefined) {
        tools = tools.filter(tool => tool.getSuccessRate() >= criteria.minSuccessRate!)
      }

      // 4. 根据系统工具偏好排序
      if (criteria.preferSystemTools) {
        tools.sort((a, b) => {
          if (a.isSystemTool() && !b.isSystemTool()) return -1
          if (!a.isSystemTool() && b.isSystemTool()) return 1
          return 0
        })
      }

      // 5. 根据能力匹配度排序
      tools.sort((a, b) => {
        const aMatchCount = this.countCapabilityMatches(a, criteria.requiredCapabilities)
        const bMatchCount = this.countCapabilityMatches(b, criteria.requiredCapabilities)
        return bMatchCount - aMatchCount
      })

      // 6. 只返回健康的工具
      const healthyTools = []
      for (const tool of tools) {
        if (tool.isHealthy()) {
          healthyTools.push(tool)
        }
      }

      return Result.success(healthyTools.slice(0, criteria.maxResults || 10))
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 检查工具健康状态
   */
  async checkToolHealth(toolId: ToolId): Promise<Result<IToolHealthCheck, Error>> {
    try {
      const toolResult = await this.toolRepository.findById(toolId)
      if (toolResult.isError()) {
        return Result.error(toolResult.getError())
      }

      const tool = toolResult.getValue()
      if (!tool) {
        return Result.error(new Error(`Tool not found: ${toolId.getValue()}`))
      }

      // 基本健康检查
      const issues: string[] = []
      const recommendations: string[] = []
      let healthScore = 1.0

      // 检查状态
      if (!tool.getStatus().isAvailable()) {
        issues.push(`Tool is ${tool.getStatus().getStatus()}`)
        healthScore -= 0.5
      }

      // 检查成功率
      const successRate = tool.getSuccessRate()
      if (successRate < 0.8 && tool.getUsageCount() > 5) {
        issues.push(`Low success rate: ${Math.round(successRate * 100)}%`)
        recommendations.push('Review tool implementation or usage patterns')
        healthScore -= (0.8 - successRate) * 0.5
      }

      // 检查错误率
      const errorRate = tool.getErrorRate()
      if (errorRate > 0.2 && tool.getUsageCount() > 5) {
        issues.push(`High error rate: ${Math.round(errorRate * 100)}%`)
        recommendations.push('Investigate common error causes')
        healthScore -= errorRate * 0.3
      }

      // 检查最近使用情况
      const lastUsed = tool.getLastUsedAt()
      if (lastUsed) {
        const daysSinceLastUse = (Date.now() - lastUsed.toDate().getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceLastUse > 30) {
          issues.push(`Not used for ${Math.round(daysSinceLastUse)} days`)
          recommendations.push('Consider deprecating if no longer needed')
          healthScore -= 0.1
        }
      }

      // 检查能力完整性
      if (!tool.getCapabilities().hasAnyCapabilities()) {
        issues.push('No capabilities defined')
        recommendations.push('Define tool capabilities for better discoverability')
        healthScore -= 0.2
      }

      healthScore = Math.max(0, Math.min(1, healthScore))
      const isHealthy = healthScore >= 0.7 && issues.length === 0

      const healthCheck: IToolHealthCheck = {
        toolId,
        isHealthy,
        healthScore,
        issues,
        recommendations,
        lastChecked: new Date()
      }

      return Result.success(healthCheck)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 批量健康检查
   */
  async performBulkHealthCheck(): Promise<Result<IToolHealthCheck[], Error>> {
    try {
      const allToolsResult = await this.toolRepository.findAll()
      if (allToolsResult.isError()) {
        return Result.error(allToolsResult.getError())
      }

      const tools = allToolsResult.getValue()
      const healthChecks: IToolHealthCheck[] = []

      for (const tool of tools) {
        const healthResult = await this.checkToolHealth(tool.getId())
        if (healthResult.isSuccess()) {
          healthChecks.push(healthResult.getValue())
        }
      }

      return Result.success(healthChecks)
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 清理不健康的工具
   */
  async cleanupUnhealthyTools(): Promise<Result<{
    checked: number
    deactivated: number
    removed: number
  }, Error>> {
    try {
      const healthChecks = await this.performBulkHealthCheck()
      if (healthChecks.isError()) {
        return Result.error(healthChecks.getError())
      }

      const checks = healthChecks.getValue()
      let deactivated = 0
      let removed = 0

      for (const check of checks) {
        if (!check.isHealthy) {
          const toolResult = await this.toolRepository.findById(check.toolId)
          if (toolResult.isSuccess()) {
            const tool = toolResult.getValue()
            if (tool) {
              if (check.healthScore < 0.3) {
                // 移除极不健康的工具
                await this.toolRepository.delete(check.toolId)
                removed++
              } else {
                // 停用不健康的工具
                tool.deactivate('Automatic deactivation due to health issues')
                await this.toolRepository.save(tool)
                deactivated++
              }
            }
          }
        }
      }

      return Result.success({
        checked: checks.length,
        deactivated,
        removed
      })
    } catch (error) {
      return Result.error(error as Error)
    }
  }

  /**
   * 从MCP服务器发现工具（模拟实现）
   */
  private async discoverToolsFromServer(serverUrl: string): Promise<MCPTool[]> {
    // 这里实际应该调用MCP协议来发现工具
    // 当前返回空数组作为模拟实现
    return []
  }

  /**
   * 验证执行权限
   */
  private validateExecutionPermissions(tool: MCPTool, context: ToolExecutionContext): Result<void, Error> {
    // 检查系统工具权限
    if (tool.isSystemTool() && !context.hasSystemPermission()) {
      return Result.error(new Error(`System tool ${tool.getName().getValue()} requires system permission`))
    }

    // 检查工具特定能力权限
    const requiredCapabilities = context.getRequiredCapabilities()
    if (requiredCapabilities.length > 0) {
      const hasRequiredCapabilities = tool.hasAllCapabilities(requiredCapabilities)
      if (!hasRequiredCapabilities) {
        return Result.error(new Error(`Tool ${tool.getName().getValue()} lacks required capabilities: ${requiredCapabilities.join(', ')}`))
      }
    }

    return Result.success()
  }

  /**
   * 重试执行
   */
  private async retryExecution(tool: MCPTool, context: ToolExecutionContext): Promise<Result<ToolExecutionResult, Error>> {
    const maxRetries = context.getMaxRetries()
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 增加延迟
        await this.delay(attempt * 1000)
        
        const result = await tool.execute(context)
        return Result.success(result)
      } catch (error) {
        lastError = error as Error
        console.warn(`Tool execution attempt ${attempt} failed:`, error)
      }
    }

    return Result.error(lastError || new Error('All retry attempts failed'))
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 获取缓存结果（模拟实现）
   */
  private async getCachedResult(toolId: ToolId, context: ToolExecutionContext): Promise<ToolExecutionResult | null> {
    // 这里应该实现实际的缓存查找逻辑
    return null
  }

  /**
   * 缓存结果（模拟实现）
   */
  private async cacheResult(toolId: ToolId, context: ToolExecutionContext, result: ToolExecutionResult): Promise<void> {
    // 这里应该实现实际的缓存存储逻辑
  }

  /**
   * 更新工具统计信息
   */
  private async updateToolStatistics(toolId: ToolId, result: ToolExecutionResult): Promise<void> {
    const performance = result.getPerformanceMetrics()
    await this.toolRepository.updateUsageStatistics(
      toolId,
      performance.executionTime,
      performance.memoryUsed,
      result.isSuccess()
    )
  }

  /**
   * 计算能力匹配数量
   */
  private countCapabilityMatches(tool: MCPTool, requiredCapabilities: string[]): number {
    const toolCapabilities = new Set(tool.getCapabilities().getCapabilities())
    return requiredCapabilities.filter(required => toolCapabilities.has(required)).length
  }
}