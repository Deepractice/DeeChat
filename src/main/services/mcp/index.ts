/**
 * MCP服务模块导出
 * 基于官方MCP SDK的标准化服务实现
 * 
 * 结构说明：
 * - client/ - MCP客户端相关组件（连接和管理外部MCP服务器）
 * - servers/ - 内置MCP服务器（DeeChat提供的MCP服务）
 */

// MCP客户端组件
export { MCPIntegrationService } from './client/MCPIntegrationService';
export { SimpleMCPClientManager } from './client/SimpleMCPClientManager';
export { MCPConfigService } from './client/MCPConfigService';
export { MCPCacheService } from './client/MCPCacheService';

// 内置MCP服务器
export { InProcessMCPServer } from './servers/InProcessMCPServer';
export { FileOperationsMCPServer } from './servers/FileOperationsMCPServer';
