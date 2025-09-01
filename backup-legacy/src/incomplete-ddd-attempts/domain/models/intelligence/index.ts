/**
 * Intelligence Domain - AI角色管理领域
 * 统一导出所有领域模型和服务
 */

// 实体
export { AIRole } from './entities/AIRole'

// 值对象
export { RoleId } from './value-objects/RoleId'
export { RoleName } from './value-objects/RoleName'
export { RoleCapabilities } from './value-objects/RoleCapabilities'
export { RoleStatus } from './value-objects/RoleStatus'

// 领域事件
export { RoleActivated } from './events/RoleActivated'
export { RoleDeactivated } from './events/RoleDeactivated'
export { RoleCapabilitiesUpdated } from './events/RoleCapabilitiesUpdated'

// 仓储接口
export { 
  IRoleRepository, 
  RoleSearchCriteria, 
  RoleListOptions 
} from './repositories/IRoleRepository'

// 领域服务
export { 
  IntelligenceDomainService,
  IRoleActivationRequest,
  IRoleRecommendationCriteria
} from './services/IntelligenceDomainService'

// 导出类型定义
export type {
  RoleSearchCriteria as IntelligenceRoleSearchCriteria,
  RoleListOptions as IntelligenceRoleListOptions,
  IRoleActivationRequest as RoleActivationRequest,
  IRoleRecommendationCriteria as RoleRecommendationCriteria
}