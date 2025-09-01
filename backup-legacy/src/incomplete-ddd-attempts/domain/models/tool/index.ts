/**
 * Tool Domain - MCP工具管理领域
 * 统一导出所有领域模型和服务
 */

// 实体
export { MCPTool, IToolMetadata } from './entities/MCPTool'

// 值对象
export { ToolId } from './value-objects/ToolId'
export { ToolName } from './value-objects/ToolName'
export { ToolStatus } from './value-objects/ToolStatus'
export { ToolCapabilities } from './value-objects/ToolCapabilities'
export { 
  ToolSchema, 
  IParameterSchema, 
  IToolSchemaDefinition, 
  IValidationResult 
} from './value-objects/ToolSchema'
export { 
  ToolExecutionContext,
  IExecutionEnvironment,
  IExecutionPermissions,
  IExecutionOptions
} from './value-objects/ToolExecutionContext'
export { 
  ToolExecutionResult,
  ExecutionStatus,
  IExecutionMetadata,
  IExecutionOutput
} from './value-objects/ToolExecutionResult'

// 领域事件
export { ToolRegistered } from './events/ToolRegistered'
export { ToolUnregistered } from './events/ToolUnregistered'
export { ToolExecutionStarted } from './events/ToolExecutionStarted'
export { ToolExecutionCompleted } from './events/ToolExecutionCompleted'
export { ToolExecutionFailed } from './events/ToolExecutionFailed'
export { ToolStatusChanged } from './events/ToolStatusChanged'

// 仓储接口
export { 
  IToolRepository,
  ToolSearchCriteria,
  ToolListOptions
} from './repositories/IToolRepository'

// 领域服务
export { 
  ToolDomainService,
  IToolDiscoveryResult,
  IToolExecutionRequest,
  IToolRecommendationCriteria,
  IToolHealthCheck
} from './services/ToolDomainService'

// 导出类型定义
export type {
  ToolSearchCriteria as ToolSearchCriteria,
  ToolListOptions as ToolListOptions,
  IToolExecutionRequest as ToolExecutionRequest,
  IToolRecommendationCriteria as ToolRecommendationCriteria,
  IToolHealthCheck as ToolHealthCheck,
  IToolDiscoveryResult as ToolDiscoveryResult
}