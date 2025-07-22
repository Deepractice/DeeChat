/**
 * 服务层统一导出
 * 提供所有服务的统一访问入口
 */

// 核心服务
export * from './core/index';

// LLM服务
export * from './llm/index';

// MCP服务
export * from './mcp/index';

// 模型管理服务
export * from './model/index';

// 服务分组说明
export const ServiceGroups = {
  CORE: 'core',        // 核心基础服务
  LLM: 'llm',          // 大语言模型服务
  MCP: 'mcp',          // MCP协议服务
  MODEL: 'model'       // 模型管理服务
} as const;

// 服务描述
export const ServiceDescriptions = {
  // 核心服务
  ConfigService: '应用配置管理服务',
  ChatService: '聊天会话管理服务',
  LocalStorageService: '本地存储服务',
  
  // LLM服务
  LLMService: '统一LLM服务接口，基于LangChain框架',

  // MCP服务
  MCPIntegrationService: 'MCP核心集成服务',
  MCPClientManager: 'MCP客户端管理器',
  MCPConfigService: 'MCP配置管理服务',
  MCPCacheService: 'MCP缓存服务',
  MCPToolService: 'MCP工具管理服务',

  // 模型管理服务
  ModelService: '模型配置管理服务'
} as const;
