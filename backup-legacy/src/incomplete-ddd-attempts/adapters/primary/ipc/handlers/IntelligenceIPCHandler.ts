/**
 * 智能IPC处理器
 * 实现IIntelligenceHandler入站端口，处理来自渲染进程的AI智能相关请求
 */

import { IIntelligenceHandler } from '../../../../application/ports/inbound/handlers/IIntelligenceHandler'
import { 
  IActivateRoleRequest,
  IActivateRoleResponse,
  ICreateRoleRequest,
  ICreateRoleResponse
} from '../../../../application/services/IntelligenceApplicationService'
import { Result } from '../../../../domain/shared/primitives/Result'
import { BaseIPCHandler } from '../base/BaseIPCHandler'

export interface IIPCIntelligenceRequest {
  action: 'activateRole' | 'createRole' | 'listRoles' | 'getRole' | 'recommendRoles' | 'intelligentRoleSwitch' | 'updateRoleCapabilities'
  payload: any
  correlationId?: string
}

export interface IIPCIntelligenceResponse {
  success: boolean
  data?: any
  error?: string
  correlationId?: string
}

export class IntelligenceIPCHandler extends BaseIPCHandler implements IIntelligenceHandler {
  
  /**
   * 处理IPC消息
   */
  async handleIPCMessage(request: IIPCIntelligenceRequest): Promise<IIPCIntelligenceResponse> {
    const startTime = Date.now()
    
    try {
      this.logger.info(`🔄 [IntelligenceIPC] 处理请求: ${request.action}`, 'IntelligenceIPCHandler', {
        correlationId: request.correlationId,
        action: request.action
      })

      let result: Result<any, Error>

      switch (request.action) {
        case 'activateRole':
          result = await this.activateRole(request.payload)
          break
        case 'createRole':
          result = await this.createRole(request.payload)
          break
        case 'listRoles':
          result = await this.listRoles(request.payload)
          break
        case 'getRole':
          result = await this.getRole(request.payload)
          break
        case 'recommendRoles':
          result = await this.recommendRoles(request.payload)
          break
        case 'intelligentRoleSwitch':
          result = await this.intelligentRoleSwitch(request.payload)
          break
        case 'updateRoleCapabilities':
          result = await this.updateRoleCapabilities(request.payload)
          break
        default:
          result = Result.error(new Error(`Unknown action: ${request.action}`))
      }

      const duration = Date.now() - startTime

      if (result.isSuccess()) {
        this.logger.info(`✅ [IntelligenceIPC] 请求成功: ${request.action} (${duration}ms)`, 'IntelligenceIPCHandler', {
          correlationId: request.correlationId,
          duration
        })

        return {
          success: true,
          data: result.getValue(),
          correlationId: request.correlationId
        }
      } else {
        this.logger.error(`❌ [IntelligenceIPC] 请求失败: ${request.action} (${duration}ms)`, result.getError(), 'IntelligenceIPCHandler', {
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
      this.logger.error(`💥 [IntelligenceIPC] 请求异常: ${request.action} (${duration}ms)`, error, 'IntelligenceIPCHandler', {
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

  // IIntelligenceHandler 接口实现

  async activateRole(request: IActivateRoleRequest): Promise<Result<IActivateRoleResponse, Error>> {
    try {
      // 数据验证和清理
      const cleanedRequest = this.validateAndCleanActivateRoleRequest(request)
      if (cleanedRequest.isError()) {
        return cleanedRequest
      }

      // 调用应用服务
      const result = await this.intelligenceService.activateRole(cleanedRequest.getValue())
      
      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('intelligence:roleActivated', {
          role: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Activate role failed: ${error.message}`))
    }
  }

  async createRole(request: ICreateRoleRequest): Promise<Result<ICreateRoleResponse, Error>> {
    try {
      // 数据验证和清理
      const cleanedRequest = this.validateAndCleanCreateRoleRequest(request)
      if (cleanedRequest.isError()) {
        return cleanedRequest
      }

      // 调用应用服务
      const result = await this.intelligenceService.createRole(cleanedRequest.getValue())
      
      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('intelligence:roleCreated', {
          role: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Create role failed: ${error.message}`))
    }
  }

  async listRoles(request: { 
    active?: boolean 
    page?: number 
    limit?: number 
  }): Promise<Result<any, Error>> {
    try {
      const { page, limit } = this.cleanPaginationParams(request.page, request.limit)

      const result = await this.intelligenceService.listRoles({
        active: request.active,
        page,
        limit
      })

      return result
    } catch (error) {
      return Result.error(new Error(`List roles failed: ${error.message}`))
    }
  }

  async getRole(request: { roleId: string }): Promise<Result<any, Error>> {
    try {
      if (!request.roleId) {
        return Result.error(new Error('Role ID is required'))
      }

      const result = await this.intelligenceService.getRole({
        roleId: request.roleId
      })

      return result
    } catch (error) {
      return Result.error(new Error(`Get role failed: ${error.message}`))
    }
  }

  async recommendRoles(request: { 
    context?: string 
    requiredCapabilities?: string[] 
    limit?: number 
  }): Promise<Result<any, Error>> {
    try {
      const result = await this.intelligenceService.recommendRoles({
        context: this.cleanStringField(request.context),
        requiredCapabilities: request.requiredCapabilities || [],
        limit: Math.min(10, Math.max(1, request.limit || 5)) // 限制在1-10之间
      })

      return result
    } catch (error) {
      return Result.error(new Error(`Recommend roles failed: ${error.message}`))
    }
  }

  async intelligentRoleSwitch(request: {
    currentContext: string
    userInput: string
    currentRoleId?: string
  }): Promise<Result<any, Error>> {
    try {
      if (!request.currentContext || !request.userInput) {
        return Result.error(new Error('Current context and user input are required'))
      }

      const result = await this.intelligenceService.intelligentRoleSwitch({
        currentContext: request.currentContext.trim(),
        userInput: request.userInput.trim(),
        currentRoleId: this.cleanStringField(request.currentRoleId)
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('intelligence:roleSwitched', {
          switch: result.getValue()
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Intelligent role switch failed: ${error.message}`))
    }
  }

  async updateRoleCapabilities(request: {
    roleId: string
    capabilities: string[]
  }): Promise<Result<void, Error>> {
    try {
      if (!request.roleId) {
        return Result.error(new Error('Role ID is required'))
      }

      if (!Array.isArray(request.capabilities)) {
        return Result.error(new Error('Capabilities must be an array'))
      }

      // 清理能力列表
      const cleanCapabilities = request.capabilities
        .map(cap => typeof cap === 'string' ? cap.trim() : '')
        .filter(cap => cap.length > 0)

      if (cleanCapabilities.length === 0) {
        return Result.error(new Error('At least one capability is required'))
      }

      const result = await this.intelligenceService.updateRoleCapabilities({
        roleId: request.roleId,
        capabilities: cleanCapabilities
      })

      if (result.isSuccess()) {
        // 发布事件到前端
        await this.publishToRenderer('intelligence:roleCapabilitiesUpdated', {
          roleId: request.roleId,
          capabilities: cleanCapabilities
        })
      }

      return result
    } catch (error) {
      return Result.error(new Error(`Update role capabilities failed: ${error.message}`))
    }
  }

  /**
   * 验证和清理激活角色请求
   */
  private validateAndCleanActivateRoleRequest(request: IActivateRoleRequest): Result<IActivateRoleRequest, Error> {
    try {
      if (!request.roleId || request.roleId.trim().length === 0) {
        return Result.error(new Error('Role ID is required'))
      }

      const cleaned: IActivateRoleRequest = {
        roleId: request.roleId.trim(),
        context: {
          userId: this.cleanStringField(request.context?.userId),
          sessionId: this.cleanStringField(request.context?.sessionId),
          previousRoleId: this.cleanStringField(request.context?.previousRoleId),
          requiredCapabilities: Array.isArray(request.context?.requiredCapabilities) 
            ? request.context.requiredCapabilities.filter(cap => typeof cap === 'string' && cap.trim().length > 0)
            : undefined
        }
      }

      return Result.success(cleaned)
    } catch (error) {
      return Result.error(new Error(`Invalid activate role request: ${error.message}`))
    }
  }

  /**
   * 验证和清理创建角色请求
   */
  private validateAndCleanCreateRoleRequest(request: ICreateRoleRequest): Result<ICreateRoleRequest, Error> {
    try {
      if (!request.name || request.name.trim().length === 0) {
        return Result.error(new Error('Role name is required'))
      }

      if (!Array.isArray(request.capabilities) || request.capabilities.length === 0) {
        return Result.error(new Error('At least one capability is required'))
      }

      if (!request.layeredPrompt) {
        return Result.error(new Error('Layered prompt is required'))
      }

      // 清理能力列表
      const cleanCapabilities = request.capabilities
        .map(cap => typeof cap === 'string' ? cap.trim() : '')
        .filter(cap => cap.length > 0)

      if (cleanCapabilities.length === 0) {
        return Result.error(new Error('Valid capabilities are required'))
      }

      const cleaned: ICreateRoleRequest = {
        name: request.name.trim(),
        description: this.cleanStringField(request.description),
        capabilities: cleanCapabilities,
        layeredPrompt: {
          system: this.cleanStringField(request.layeredPrompt.system) || '',
          task: this.cleanStringField(request.layeredPrompt.task) || '',
          context: this.cleanStringField(request.layeredPrompt.context) || '',
          examples: this.cleanStringField(request.layeredPrompt.examples) || '',
          output: this.cleanStringField(request.layeredPrompt.output) || ''
        },
        isActive: request.isActive !== false, // 默认为true
        metadata: request.metadata || {}
      }

      return Result.success(cleaned)
    } catch (error) {
      return Result.error(new Error(`Invalid create role request: ${error.message}`))
    }
  }
}