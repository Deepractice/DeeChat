/**
 * Tool Domain 导出
 * 🏗️ DDD重构: Tool领域的公共API
 */

// 实体
export * from './entities/MCPTool';
export * from './entities/ToolExecution';

// 值对象
export * from './value-objects/ToolId';
export * from './value-objects/ToolExecutionResult';

// 仓储接口
export * from './repositories/IToolRepository';
export * from './repositories/IToolExecutionRepository';

// 领域服务
export * from './services/ToolDiscoveryService';
export * from './services/ToolExecutionService';

// 领域事件
export * from './events/ToolDiscovered';
export * from './events/ToolUnavailable';
export * from './events/ToolExecutionStarted';
export * from './events/ToolExecutionCompleted';
export * from './events/ToolExecutionFailed';