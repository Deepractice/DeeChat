/**
 * 工具IPC处理器
 * 实现IToolHandler入站端口，处理来自渲染进程的MCP工具相关请求
 */

import { IToolHandler } from '../../../../application/ports/inbound/handlers/IToolHandler'
import { 
  IExecuteToolRequest,
  IExecuteToolResponse
} from '../../../../application/services/ToolApplicationService'
import { Result } from '../../../../domain/shared/primitives/Result'
import { BaseIPCHandler } from '../base/BaseIPCHandler'

export interface IIPCToolRequest {
  action: 'executeTool' | 'registerTool' | 'listTools' | 'getTool' | 'toggleToolStatus' | 'discoverAndRegisterTools' | 'performHealthCheck' | 'recommendTools'
  payload: any
  correlationId?: string
}

export interface IIPCToolResponse {
  success: boolean
  data?: any
  error?: string
  correlationId?: string
}

export class ToolIPCHandler extends BaseIPCHandler implements IToolHandler {
  
  /**
   * 处理IPC消息
   */
  async handleIPCMessage(request: IIPCToolRequest): Promise<IIPCToolResponse> {
    const startTime = Date.now()
    
    try {
      this.logger.info(`🔄 [ToolIPC] 处理请求: ${request.action}`, 'ToolIPCHandler', {
        correlationId: request.correlationId,
        action: request.action
      })

      let result: Result<any, Error>

      switch (request.action) {
        case 'executeTool':
          result = await this.executeTool(request.payload)
          break
        case 'registerTool':
          result = await this.registerTool(request.payload)
          break
        case 'listTools':
          result = await this.listTools(request.payload)
          break
        case 'getTool':
          result = await this.getTool(request.payload)
          break
        case 'toggleToolStatus':
          result = await this.toggleToolStatus(request.payload)
          break
        case 'discoverAndRegisterTools':
          result = await this.discoverAndRegisterTools(request.payload)
          break
        case 'performHealthCheck':
          result = await this.performHealthCheck(request.payload)
          break
        case 'recommendTools':
          result = await this.recommendTools(request.payload)
          break
        default:
          result = Result.error(new Error(`Unknown action: ${request.action}`))
      }

      const duration = Date.now() - startTime

      if (result.isSuccess()) {
        this.logger.info(`✅ [ToolIPC] 请求成功: ${request.action} (${duration}ms)`, 'ToolIPCHandler', {
          correlationId: request.correlationId,
          duration
        })

        return {
          success: true,
          data: result.getValue(),
          correlationId: request.correlationId
        }
      } else {
        this.logger.error(`❌ [ToolIPC] 请求失败: ${request.action} (${duration}ms)`, result.getError(), 'ToolIPCHandler', {
          correlationId: request.correlationId,
          duration
        })

        return {
          success: false,
          error: result.getError().message,
          correlationId: request.correlationId
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`💥 [ToolIPC] 请求异常: ${request.action} (${duration}ms)`, error, 'ToolIPCHandler', {
        correlationId: request.correlationId,
        duration
      })

      return {
        success: false,
        error: error.message || 'Unknown error',
        correlationId: request.correlationId
      }
    }
  }

  // IToolHandler 接口实现

  async executeTool(request: IExecuteToolRequest): Promise<Result<IExecuteToolResponse, Error>> {
    try {
      // 数据验证和清理
      const cleanedRequest = this.validateAndCleanExecuteToolRequest(request)
      if (cleanedRequest.isError()) {
        return cleanedRequest
      }

      // 调用应用服务
      const result = await this.toolService.executeTool(cleanedRequest.getValue())
      
      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('tool:toolExecuted', {
          execution: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Execute tool failed: ${error.message}`))
    }
  }

  async registerTool(request: {
    toolId: string
    name: string
    description?: string
    serverName: string
    schema: any
    capabilities?: string[]
  }): Promise<Result<void, Error>> {
    try {
      // 数据验证
      const missing = this.validateRequired(request, ['toolId', 'name', 'serverName', 'schema'])
      if (missing.length > 0) {
        return Result.error(new Error(`Missing required fields: ${missing.join(', ')}`))
      }

      const result = await this.toolService.registerTool({
        toolId: request.toolId.trim(),
        name: request.name.trim(),
        description: this.cleanStringField(request.description),
        serverName: request.serverName.trim(),
        schema: request.schema,
        capabilities: Array.isArray(request.capabilities) ? request.capabilities : []
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('tool:toolRegistered', {
          toolId: request.toolId,
          name: request.name,
          serverName: request.serverName
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Register tool failed: ${error.message}`))
    }
  }

  async listTools(request: {
    serverName?: string
    enabled?: boolean
    capabilities?: string[]
    page?: number
    limit?: number
  }): Promise<Result<any, Error>> {
    try {
      const { page, limit } = this.cleanPaginationParams(request.page, request.limit)

      const result = await this.toolService.listTools({
        serverName: this.cleanStringField(request.serverName),
        enabled: request.enabled,
        capabilities: Array.isArray(request.capabilities) ? request.capabilities : undefined,
        page,
        limit
      })

      return result
    } catch (error) {
      return Result.error(new Error(`List tools failed: ${error.message}`))
    }
  }

  async getTool(request: { toolId: string }): Promise<Result<any, Error>> {
    try {
      if (!request.toolId) {
        return Result.error(new Error('Tool ID is required'))
      }

      const result = await this.toolService.getTool({
        toolId: request.toolId.trim()
      })

      return result
    } catch (error) {
      return Result.error(new Error(`Get tool failed: ${error.message}`))
    }
  }

  async toggleToolStatus(request: { 
    toolId: string
    enabled: boolean 
  }): Promise<Result<void, Error>> {
    try {
      if (!request.toolId) {
        return Result.error(new Error('Tool ID is required'))
      }

      if (typeof request.enabled !== 'boolean') {
        return Result.error(new Error('Enabled status must be boolean'))
      }

      const result = await this.toolService.toggleToolStatus({
        toolId: request.toolId.trim(),
        enabled: request.enabled
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('tool:toolStatusToggled', {
          toolId: request.toolId,
          enabled: request.enabled
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Toggle tool status failed: ${error.message}`))
    }
  }

  async discoverAndRegisterTools(request: { 
    serverName?: string 
  }): Promise<Result<any, Error>> {
    try {
      const result = await this.toolService.discoverAndRegisterTools({
        serverName: this.cleanStringField(request.serverName)
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('tool:toolsDiscovered', {
          serverName: request.serverName,
          discoveredTools: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Discover and register tools failed: ${error.message}`))
    }
  }

  async performHealthCheck(request: { 
    toolId?: string 
    serverName?: string 
  }): Promise<Result<any, Error>> {
    try {
      const result = await this.toolService.performHealthCheck({
        toolId: this.cleanStringField(request.toolId),
        serverName: this.cleanStringField(request.serverName)
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('tool:healthCheckCompleted', {
          toolId: request.toolId,
          serverName: request.serverName,
          results: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Perform health check failed: ${error.message}`))
    }
  }

  async recommendTools(request: {
    context?: string
    requiredCapabilities?: string[]
    limit?: number
  }): Promise<Result<any, Error>> {
    try {
      const result = await this.toolService.recommendTools({
        context: this.cleanStringField(request.context),
        requiredCapabilities: Array.isArray(request.requiredCapabilities) ? request.requiredCapabilities : [],
        limit: Math.min(20, Math.max(1, request.limit || 10)) // 限制在1-20之间
      })

      return result
    } catch (error) {
      return Result.error(new Error(`Recommend tools failed: ${error.message}`))
    }
  }

  /**
   * 验证和清理执行工具请求
   */
  private validateAndCleanExecuteToolRequest(request: IExecuteToolRequest): Result<IExecuteToolRequest, Error> {
    try {
      if (!request.toolId || request.toolId.trim().length === 0) {
        return Result.error(new Error('Tool ID is required'))
      }

      if (!request.parameters || typeof request.parameters !== 'object') {
        return Result.error(new Error('Tool parameters must be an object'))
      }

      // 验证选项
      const options = request.options || {}
      
      if (options.timeout && (options.timeout < 1000 || options.timeout > 300000)) {
        return Result.error(new Error('Timeout must be between 1 second and 5 minutes'))
      }

      if (options.priority && !['low', 'normal', 'high'].includes(options.priority)) {
        return Result.error(new Error('Priority must be low, normal, or high'))
      }

      const cleaned: IExecuteToolRequest = {
        toolId: request.toolId.trim(),
        parameters: this.cleanParameters(request.parameters),
        context: {
          userId: this.cleanStringField(request.context?.userId),
          sessionId: this.cleanStringField(request.context?.sessionId),
          workspaceId: this.cleanStringField(request.context?.workspaceId)
        },
        options: {
          timeout: options.timeout || 30000,
          retryOnFailure: options.retryOnFailure !== false, // 默认为true
          useCache: options.useCache !== false, // 默认为true
          priority: options.priority || 'normal'
        }
      }

      return Result.success(cleaned)
    } catch (error) {
      return Result.error(new Error(`Invalid execute tool request: ${error.message}`))
    }
  }

  /**
   * 清理工具参数
   */
  private cleanParameters(parameters: Record<string, any>): Record<string, any> {
    const cleaned: Record<string, any> = {}

    for (const [key, value] of Object.entries(parameters)) {
      // 移除undefined值
      if (value === undefined) {
        continue
      }

      // 清理字符串值
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.length > 0) {
          cleaned[key] = trimmed
        }
      } else {
        cleaned[key] = value
      }
    }

    return cleaned
  }
}