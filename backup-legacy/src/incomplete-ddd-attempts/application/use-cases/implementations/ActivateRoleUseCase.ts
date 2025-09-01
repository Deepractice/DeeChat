/**
 * 激活角色用例
 * 实现AI角色激活的完整业务流程
 */

import { CommandUseCase, IUseCaseRequest, IUseCaseResponse } from '../base/UseCase'
import { Result } from '../../../domain/shared/primitives/Result'
import { IntelligenceApplicationService } from '../../services/IntelligenceApplicationService'

export interface IActivateRoleUseCaseRequest extends IUseCaseRequest {
  roleId: string
  context?: {
    userId?: string
    sessionId?: string
    previousRoleId?: string
    requiredCapabilities?: string[]
  }
}

export interface IActivateRoleUseCaseResponse extends IUseCaseResponse {
  roleId: string
  roleName: string
  activated: boolean
  previousRoleId?: string
  capabilities: string[]
  switchReason?: string
  success: boolean
}

export class ActivateRoleUseCase extends CommandUseCase<IActivateRoleUseCaseRequest, IActivateRoleUseCaseResponse> {
  constructor(
    private readonly intelligenceService: IntelligenceApplicationService
  ) {
    super()
  }

  protected async executeCommand(
    request: IActivateRoleUseCaseRequest
  ): Promise<Result<IActivateRoleUseCaseResponse, Error>> {
    // 使用应用服务激活角色
    const result = await this.intelligenceService.activateRole({
      roleId: request.roleId,
      context: request.context
    })

    if (result.isError()) {
      return Result.error(result.getError())
    }

    const response = result.getValue()

    // 生成切换原因说明
    const switchReason = this.generateSwitchReason(
      response.role,
      response.previousRole,
      request.context
    )

    return Result.success({
      roleId: response.role.getId().getValue(),
      roleName: response.role.getName().getValue(),
      activated: response.activated,
      previousRoleId: response.previousRole?.getId().getValue(),
      capabilities: response.role.getCapabilities().getCapabilities(),
      switchReason,
      success: true
    })
  }

  protected validate(request: IActivateRoleUseCaseRequest): Result<void, Error> {
    const baseValidation = super.validate(request)
    if (baseValidation.isError()) {
      return baseValidation
    }

    // 验证角色ID
    if (!request.roleId || request.roleId.trim().length === 0) {
      return Result.error(new Error('Role ID is required'))
    }

    // 验证能力要求
    if (request.context?.requiredCapabilities) {
      for (const capability of request.context.requiredCapabilities) {
        if (!capability || capability.trim().length === 0) {
          return Result.error(new Error('Invalid capability requirement'))
        }
      }
    }

    return Result.success()
  }

  protected async preProcess(request: IActivateRoleUseCaseRequest): Promise<void> {
    // 记录角色切换请求
    console.log(`🔄 Activating role: ${request.roleId}`, {
      context: request.context,
      timestamp: new Date().toISOString()
    })
  }

  protected async postProcess(
    response: IActivateRoleUseCaseResponse, 
    request: IActivateRoleUseCaseRequest
  ): Promise<void> {
    // 记录角色激活成功
    console.log(`✅ Role activated successfully: ${response.roleName}`, {
      roleId: response.roleId,
      activated: response.activated,
      capabilities: response.capabilities.length,
      previousRole: response.previousRoleId
    })
  }

  /**
   * 生成角色切换原因说明
   */
  private generateSwitchReason(
    newRole: any,
    previousRole: any,
    context?: any
  ): string {
    if (!previousRole) {
      return `已激活 ${newRole.getName().getValue()}`
    }

    if (context?.requiredCapabilities && context.requiredCapabilities.length > 0) {
      return `因需要 ${context.requiredCapabilities.join(', ')} 能力，从 ${previousRole.getName().getValue()} 切换到 ${newRole.getName().getValue()}`
    }

    return `从 ${previousRole.getName().getValue()} 切换到 ${newRole.getName().getValue()}`
  }

  protected getSuccessMessage(): string {
    return 'AI role activated successfully'
  }
}