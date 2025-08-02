/**
 * MCP服务器配置实体 V2
 * 支持完整的MCP协议和DeeChat特性
 */

import { 
  MCPTransportType, 
  MCPExecutionMode, 
  MCPServerCollection, 
  MCPAuthType,
  MCPServerStatus 
} from '../types/mcp-protocol';

/**
 * OAuth2配置
 */
export interface MCPOAuth2Config {
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope?: string;
  redirectUri?: string;
}

/**
 * 认证配置
 */
export interface MCPAuthConfig {
  type: MCPAuthType;
  credentials?: any;
  // Bearer Token
  token?: string;
  // OAuth2
  oauth2?: MCPOAuth2Config;
  // Custom
  customHeaders?: Record<string, string>;
}

/**
 * 沙箱配置
 */
export interface MCPSandboxConfig {
  enabled: boolean;
  permissions?: string[];  // 沙箱权限列表
  resourceLimits?: {
    maxMemory?: number;    // 最大内存（MB）
    maxCpu?: number;       // CPU限制（百分比）
    timeout?: number;      // 执行超时（毫秒）
  };
  isolationLevel?: 'low' | 'medium' | 'high';  // 隔离级别
}

/**
 * 重试策略配置
 */
export interface MCPRetryConfig {
  maxRetries: number;      // 最大重试次数
  initialDelay: number;    // 初始延迟（毫秒）
  maxDelay: number;        // 最大延迟（毫秒）
  backoffFactor: number;   // 退避因子
}

/**
 * MCP服务器配置
 */
export interface MCPServerConfig {
  // === 基础标识 ===
  id: string;
  name: string;
  description?: string;
  icon?: string;           // 服务器图标URL或图标名称
  version?: string;        // 服务器版本
  
  // === 协议配置 ===
  type: MCPTransportType;
  
  // === 执行策略 ===
  execution?: MCPExecutionMode;  // 未指定时自动推断
  
  // === 分组管理 ===
  collection?: MCPServerCollection;
  tags?: string[];         // 用于搜索和过滤
  priority?: number;       // 显示优先级
  
  // === Stdio协议配置 ===
  command?: string;
  args?: string[];
  workingDirectory?: string;
  
  // === 网络协议配置 ===
  url?: string;
  headers?: Record<string, string>;
  
  // === 认证配置 ===
  auth?: MCPAuthConfig;
  
  // === 通用配置 ===
  env?: Record<string, string>;
  timeout?: number;        // 默认30秒
  retryConfig?: MCPRetryConfig;
  maxConcurrent?: number;  // 最大并发请求数
  
  // === 状态管理 ===
  isEnabled: boolean;
  autoStart?: boolean;     // 是否自动启动
  autoReconnect?: boolean; // 是否自动重连
  reconnectDelay?: number; // 重连延迟（毫秒）
  
  // === 安全配置 ===
  sandbox?: MCPSandboxConfig;
  
  // === 会话配置 ===
  sessionConfig?: {
    maintainSession: boolean;  // 是否保持会话
    sessionTimeout?: number;   // 会话超时（毫秒）
  };
  
  // === 代理配置 ===
  proxy?: {
    enabled: boolean;
    url: string;
    auth?: {
      username: string;
      password: string;
    };
  };
  
  // === 元数据 ===
  source?: 'user' | 'project' | 'system' | 'imported';  // 配置来源
  createdAt: Date;
  updatedAt: Date;
  lastConnected?: Date;
  
  // === 运行时信息 ===
  runtime?: {
    status: MCPServerStatus;
    pid?: number;           // 进程ID
    startTime?: Date;       // 启动时间
    toolCount?: number;     // 工具数量
    resourceCount?: number; // 资源数量
    errorCount?: number;    // 错误计数
    lastError?: {
      message: string;
      timestamp: Date;
      code?: string;
    };
  };
  
  // === 扩展配置 ===
  extra?: Record<string, any>;  // 预留扩展字段
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(partial: Partial<MCPServerConfig>): MCPServerConfig {
  const now = new Date();
  return {
    id: partial.id || `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: partial.name || 'Unnamed Server',
    type: partial.type || 'stdio',
    isEnabled: partial.isEnabled ?? true,
    collection: partial.collection || 'user',
    tags: partial.tags || [],
    source: partial.source || 'user',
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    ...partial
  };
}

/**
 * 配置验证错误
 */
export interface MCPConfigValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * 验证配置
 */
export function validateConfig(config: Partial<MCPServerConfig>): MCPConfigValidationError[] {
  const errors: MCPConfigValidationError[] = [];
  
  // 基础字段验证
  if (!config.name?.trim()) {
    errors.push({ field: 'name', message: '服务器名称不能为空' });
  }
  
  if (!config.type) {
    errors.push({ field: 'type', message: '必须指定传输协议类型' });
  }
  
  // 协议特定验证
  if (config.type === 'stdio') {
    if (!config.command?.trim()) {
      errors.push({ field: 'command', message: 'Stdio协议必须指定命令' });
    }
  } else if (['sse', 'streamable-http', 'websocket'].includes(config.type!)) {
    if (!config.url?.trim()) {
      errors.push({ field: 'url', message: '网络协议必须指定URL' });
    } else {
      try {
        new URL(config.url);
      } catch {
        errors.push({ field: 'url', message: 'URL格式无效' });
      }
    }
  }
  
  // 超时验证
  if (config.timeout !== undefined && config.timeout < 1000) {
    errors.push({ field: 'timeout', message: '超时时间不能少于1秒' });
  }
  
  // 认证验证
  if (config.auth) {
    if (config.auth.type === 'bearer' && !config.auth.token) {
      errors.push({ field: 'auth.token', message: 'Bearer认证必须提供token' });
    }
    if (config.auth.type === 'oauth2') {
      if (!config.auth.oauth2?.clientId) {
        errors.push({ field: 'auth.oauth2.clientId', message: 'OAuth2必须提供clientId' });
      }
      if (!config.auth.oauth2?.authorizationUrl) {
        errors.push({ field: 'auth.oauth2.authorizationUrl', message: 'OAuth2必须提供authorizationUrl' });
      }
    }
  }
  
  return errors;
}

/**
 * 推断执行模式
 */
export function inferExecutionMode(config: MCPServerConfig): MCPExecutionMode {
  // 1. 内存协议总是进程内
  if (config.type === 'inmemory') {
    return 'inprocess';
  }
  
  // 2. 网络协议总是标准模式
  if (['sse', 'streamable-http', 'websocket'].includes(config.type)) {
    return 'standard';
  }
  
  // 3. Stdio协议根据特征推断
  if (config.type === 'stdio') {
    // 需要包管理的使用沙箱
    if (config.command === 'npx' || config.command === 'npm') {
      return 'sandbox';
    }
    
    // 特定标记的使用进程内
    if (config.tags?.includes('inprocess')) {
      return 'inprocess';
    }
    
    // 有沙箱配置且启用的使用沙箱
    if (config.sandbox?.enabled) {
      return 'sandbox';
    }
  }
  
  return 'standard';
}

/**
 * 合并配置（用于更新）
 */
export function mergeConfig(
  existing: MCPServerConfig, 
  updates: Partial<MCPServerConfig>
): MCPServerConfig {
  return {
    ...existing,
    ...updates,
    updatedAt: new Date(),
    // 保留运行时信息
    runtime: existing.runtime
  };
}

/**
 * 配置迁移（从旧版本到新版本）
 */
export function migrateConfig(oldConfig: any): MCPServerConfig {
  // 从V1迁移到V2
  const config: Partial<MCPServerConfig> = {
    ...oldConfig,
    // 添加新字段的默认值
    collection: oldConfig.collection || 'user',
    tags: oldConfig.tags || [],
    source: oldConfig.source || 'user'
  };
  
  // 迁移认证配置
  if (oldConfig.headers?.Authorization) {
    const authHeader = oldConfig.headers.Authorization;
    if (authHeader.startsWith('Bearer ')) {
      config.auth = {
        type: 'bearer',
        token: authHeader.substring(7)
      };
    }
  }
  
  return createDefaultConfig(config);
}