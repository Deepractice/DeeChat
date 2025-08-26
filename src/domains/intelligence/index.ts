/**
 * Intelligence Domain 导出
 * 🏗️ DDD重构: Intelligence领域的公共API
 */

// 实体
export * from './entities/PromptXRole';
export * from './entities/LayeredPrompt';

// 值对象
export * from './value-objects/RoleId';
export * from './value-objects/PromptContent';
export * from './value-objects/TokenUsage';

// 仓储接口
export * from './repositories/IRoleRepository';

// 领域服务
export * from './services/RoleActivationService';
export * from './services/SmartLayeredPromptService';

// 领域事件
export * from './events/RoleActivated';
export * from './events/RoleDeactivated';
export * from './events/RoleActivationFailed';