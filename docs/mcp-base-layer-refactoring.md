# DeeChat MCP基础层改造文档

## 📋 概述

本文档描述了DeeChat MCP（Model Context Protocol）基础层的改造方案，旨在建立一个通用、可扩展、配置驱动的MCP实现框架。

## 🎯 改造目标

1. **完整协议支持** - 支持MCP规范中的所有传输协议
2. **配置驱动** - 通过配置而非硬编码决定行为
3. **可扩展架构** - 便于添加新协议和功能
4. **保持简洁** - 避免过度设计，保持代码可维护性
5. **独特优势** - 保留DeeChat的创新功能（智能执行模式、沙箱等）

## 🏗️ 架构设计

### 1. 协议层定义

```typescript
// src/shared/types/mcp-protocol.ts

/**
 * MCP传输协议类型
 * 基于官方规范，支持5种传输方式
 */
export type MCPTransportType = 
  | 'stdio'           // 标准输入输出（本地进程）
  | 'sse'            // Server-Sent Events（已弃用，仅向后兼容）
  | 'streamable-http' // Streamable HTTP（新标准）
  | 'websocket'      // WebSocket连接
  | 'inmemory';      // 内存传输（测试用）

/**
 * 执行模式（DeeChat独有）
 * 决定MCP服务器的运行方式
 */
export type MCPExecutionMode = 
  | 'inprocess'  // 进程内执行（零开销）
  | 'sandbox'    // 沙箱隔离执行（安全）
  | 'standard';  // 标准子进程执行

/**
 * 服务器分组
 * 用于UI组织和权限管理
 */
export type MCPServerCollection = 
  | 'system'   // 系统级服务器
  | 'project'  // 项目级服务器
  | 'user';    // 用户级服务器
```

### 2. 配置模型

```typescript
// src/shared/entities/MCPServerConfig.ts

export interface MCPServerConfig {
  // === 基础标识 ===
  id: string;
  name: string;
  description?: string;
  icon?: string;  // 服务器图标
  
  // === 协议配置 ===
  type: MCPTransportType;
  
  // === 执行策略 ===
  execution?: MCPExecutionMode;  // 未指定时自动推断
  
  // === 分组管理 ===
  collection?: MCPServerCollection;
  tags?: string[];  // 用于搜索和过滤
  
  // === Stdio协议配置 ===
  command?: string;
  args?: string[];
  workingDirectory?: string;
  
  // === 网络协议配置 ===
  url?: string;
  headers?: Record<string, string>;
  
  // === 认证配置 ===
  auth?: {
    type: 'none' | 'bearer' | 'oauth2' | 'custom';
    credentials?: any;
    // OAuth2特定
    clientId?: string;
    clientSecret?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scope?: string;
  };
  
  // === 通用配置 ===
  env?: Record<string, string>;
  timeout?: number;        // 默认30秒
  retryCount?: number;     // 默认3次
  retryDelay?: number;     // 重试延迟（毫秒）
  maxConcurrent?: number;  // 最大并发请求数
  
  // === 状态管理 ===
  isEnabled: boolean;
  autoStart?: boolean;     // 是否自动启动
  
  // === 安全配置 ===
  sandbox?: {
    enabled: boolean;
    permissions?: string[];  // 沙箱权限列表
    resourceLimits?: {
      maxMemory?: number;    // 最大内存（MB）
      maxCpu?: number;       // CPU限制（百分比）
    };
  };
  
  // === 元数据 ===
  version?: string;        // 服务器版本
  source?: string;         // 配置来源
  createdAt: Date;
  updatedAt: Date;
  lastConnected?: Date;
  
  // === 扩展配置 ===
  extra?: Record<string, any>;  // 预留扩展字段
}
```

### 3. 传输层架构

```typescript
// src/main/services/mcp/transports/MCPTransportFactory.ts

import { MCPServerConfig } from '@/shared/entities/MCPServerConfig';
import { IMCPTransport } from './IMCPTransport';

export class MCPTransportFactory {
  private static validators = new Map<MCPTransportType, ConfigValidator>();
  private static factories = new Map<MCPTransportType, TransportFactory>();
  
  /**
   * 注册新的传输协议支持
   */
  static register(
    type: MCPTransportType,
    validator: ConfigValidator,
    factory: TransportFactory
  ): void {
    this.validators.set(type, validator);
    this.factories.set(type, factory);
  }
  
  /**
   * 创建传输实例
   */
  static async create(config: MCPServerConfig): Promise<IMCPTransport> {
    // 1. 验证配置
    const errors = this.validateConfig(config);
    if (errors.length > 0) {
      throw new MCPConfigError(errors);
    }
    
    // 2. 获取工厂
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`Unsupported transport type: ${config.type}`);
    }
    
    // 3. 创建传输
    const transport = await factory(config);
    
    // 4. 应用通用配置
    this.applyCommonConfig(transport, config);
    
    return transport;
  }
  
  /**
   * 验证配置
   */
  private static validateConfig(config: MCPServerConfig): string[] {
    const errors: string[] = [];
    
    // 基础验证
    if (!config.id) errors.push('id is required');
    if (!config.name?.trim()) errors.push('name is required');
    if (!config.type) errors.push('type is required');
    
    // 协议特定验证
    const validator = this.validators.get(config.type);
    if (validator) {
      errors.push(...validator(config));
    }
    
    return errors;
  }
  
  /**
   * 应用通用配置
   */
  private static applyCommonConfig(
    transport: IMCPTransport,
    config: MCPServerConfig
  ): void {
    transport.setTimeout(config.timeout || 30000);
    transport.setRetryPolicy({
      count: config.retryCount || 3,
      delay: config.retryDelay || 1000
    });
  }
}

// 初始化内置协议
MCPTransportFactory.register('stdio', validateStdioConfig, createStdioTransport);
MCPTransportFactory.register('streamable-http', validateHttpConfig, createStreamableHTTPTransport);
MCPTransportFactory.register('websocket', validateWebSocketConfig, createWebSocketTransport);
MCPTransportFactory.register('sse', validateSSEConfig, createSSETransport);
MCPTransportFactory.register('inmemory', validateInMemoryConfig, createInMemoryTransport);
```

### 4. 配置管理层

```typescript
// src/main/services/mcp/MCPConfigManager.ts

export class MCPConfigManager {
  private configs = new Map<string, MCPServerConfig>();
  private configPath: string;
  
  /**
   * 加载配置
   */
  async loadConfigs(): Promise<void> {
    // 1. 加载系统级配置
    const systemConfigs = await this.loadSystemConfigs();
    
    // 2. 加载项目级配置
    const projectConfigs = await this.loadProjectConfigs();
    
    // 3. 加载用户级配置
    const userConfigs = await this.loadUserConfigs();
    
    // 4. 合并配置（用户 > 项目 > 系统）
    this.mergeConfigs([systemConfigs, projectConfigs, userConfigs]);
  }
  
  /**
   * 添加服务器配置
   */
  async addServer(config: Partial<MCPServerConfig>): Promise<MCPServerConfig> {
    // 1. 生成完整配置
    const fullConfig = this.createFullConfig(config);
    
    // 2. 验证唯一性
    this.validateUniqueness(fullConfig);
    
    // 3. 推断执行模式
    if (!fullConfig.execution) {
      fullConfig.execution = this.inferExecutionMode(fullConfig);
    }
    
    // 4. 设置默认collection
    if (!fullConfig.collection) {
      fullConfig.collection = 'user';
    }
    
    // 5. 保存配置
    this.configs.set(fullConfig.id, fullConfig);
    await this.persistConfig(fullConfig);
    
    return fullConfig;
  }
  
  /**
   * 推断执行模式
   */
  private inferExecutionMode(config: MCPServerConfig): MCPExecutionMode {
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
    }
    
    return 'standard';
  }
  
  /**
   * 验证配置唯一性
   */
  private validateUniqueness(config: MCPServerConfig): void {
    // 检查名称唯一性
    for (const existing of this.configs.values()) {
      if (existing.id !== config.id && existing.name === config.name) {
        throw new Error(`Server with name "${config.name}" already exists`);
      }
    }
  }
}
```

### 5. 服务器管理层

```typescript
// src/main/services/mcp/MCPServerManager.ts

export class MCPServerManager {
  private servers = new Map<string, MCPServerInstance>();
  private configManager: MCPConfigManager;
  private transportFactory = MCPTransportFactory;
  
  /**
   * 初始化服务器
   */
  async initializeServer(config: MCPServerConfig): Promise<MCPServerInstance> {
    // 1. 检查是否已存在
    if (this.servers.has(config.id)) {
      return this.servers.get(config.id)!;
    }
    
    // 2. 创建服务器实例
    const server = await this.createServerInstance(config);
    
    // 3. 存储实例
    this.servers.set(config.id, server);
    
    // 4. 自动启动（如果配置）
    if (config.autoStart && config.isEnabled) {
      await server.start();
    }
    
    return server;
  }
  
  /**
   * 创建服务器实例
   */
  private async createServerInstance(
    config: MCPServerConfig
  ): Promise<MCPServerInstance> {
    // 1. 确定执行模式
    const executionMode = config.execution || 
      this.configManager.inferExecutionMode(config);
    
    // 2. 根据执行模式创建实例
    switch (executionMode) {
      case 'inprocess':
        return this.createInProcessServer(config);
        
      case 'sandbox':
        return this.createSandboxServer(config);
        
      case 'standard':
        return this.createStandardServer(config);
        
      default:
        throw new Error(`Unknown execution mode: ${executionMode}`);
    }
  }
  
  /**
   * 获取服务器分组
   */
  getServersByCollection(collection: MCPServerCollection): MCPServerInstance[] {
    return Array.from(this.servers.values())
      .filter(server => server.config.collection === collection);
  }
  
  /**
   * 获取服务器状态统计
   */
  getStatistics(): MCPStatistics {
    const servers = Array.from(this.servers.values());
    
    return {
      total: servers.length,
      byCollection: {
        system: servers.filter(s => s.config.collection === 'system').length,
        project: servers.filter(s => s.config.collection === 'project').length,
        user: servers.filter(s => s.config.collection === 'user').length,
      },
      byType: {
        stdio: servers.filter(s => s.config.type === 'stdio').length,
        streamableHttp: servers.filter(s => s.config.type === 'streamable-http').length,
        websocket: servers.filter(s => s.config.type === 'websocket').length,
        sse: servers.filter(s => s.config.type === 'sse').length,
        inmemory: servers.filter(s => s.config.type === 'inmemory').length,
      },
      byStatus: {
        running: servers.filter(s => s.status === 'running').length,
        stopped: servers.filter(s => s.status === 'stopped').length,
        error: servers.filter(s => s.status === 'error').length,
      }
    };
  }
}
```

### 6. 配置验证Schema

```typescript
// src/shared/schemas/mcp-config.schema.ts

export const MCPConfigSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    servers: {
      type: 'object',
      additionalProperties: {
        oneOf: [
          // Stdio服务器
          {
            type: 'object',
            properties: {
              type: { const: 'stdio' },
              command: { type: 'string' },
              args: { 
                type: 'array', 
                items: { type: 'string' } 
              },
              env: { 
                type: 'object',
                additionalProperties: { type: 'string' }
              },
              workingDirectory: { type: 'string' },
              execution: { 
                enum: ['inprocess', 'sandbox', 'standard'] 
              }
            },
            required: ['type', 'command'],
            additionalProperties: true
          },
          
          // Streamable HTTP服务器
          {
            type: 'object',
            properties: {
              type: { const: 'streamable-http' },
              url: { 
                type: 'string', 
                format: 'uri' 
              },
              headers: { 
                type: 'object',
                additionalProperties: { type: 'string' }
              },
              auth: {
                type: 'object',
                properties: {
                  type: { 
                    enum: ['none', 'bearer', 'oauth2', 'custom'] 
                  }
                }
              }
            },
            required: ['type', 'url'],
            additionalProperties: true
          },
          
          // WebSocket服务器
          {
            type: 'object',
            properties: {
              type: { const: 'websocket' },
              url: { 
                type: 'string', 
                pattern: '^wss?://' 
              },
              headers: { 
                type: 'object',
                additionalProperties: { type: 'string' }
              }
            },
            required: ['type', 'url'],
            additionalProperties: true
          },
          
          // SSE服务器（已弃用）
          {
            type: 'object',
            properties: {
              type: { const: 'sse' },
              url: { 
                type: 'string', 
                format: 'uri' 
              }
            },
            required: ['type', 'url'],
            additionalProperties: true
          },
          
          // InMemory服务器
          {
            type: 'object',
            properties: {
              type: { const: 'inmemory' },
              mockData: { type: 'object' }
            },
            required: ['type'],
            additionalProperties: true
          }
        ]
      }
    }
  }
};
```

## 📝 实施计划

### 第一阶段：协议层扩展（1-2周）

1. **添加StreamableHTTP传输实现**
   - 实现POST请求处理（JSON响应和SSE流）
   - 实现GET请求处理（服务器通知）
   - 支持会话管理（Session ID）
   - 实现协议版本协商

2. **完善InMemory传输**
   - 用于单元测试
   - 支持模拟各种场景
   - 零延迟通信

3. **改进现有传输实现**
   - 统一错误处理
   - 添加重试机制
   - 改进日志记录

### 第二阶段：配置层改造（1周）

1. **扩展MCPServerEntity**
   - 添加新字段（collection、auth、sandbox等）
   - 更新验证逻辑
   - 保持向后兼容

2. **实现配置管理器**
   - 分层配置加载
   - 配置合并策略
   - 配置持久化

3. **添加配置验证**
   - JSON Schema验证
   - 运行时类型检查
   - 友好的错误提示

### 第三阶段：管理层重构（1-2周）

1. **重构SimpleMCPClientManager**
   - 使用MCPTransportFactory
   - 移除硬编码逻辑
   - 改进错误处理

2. **实现MCPServerManager**
   - 服务器生命周期管理
   - 分组和标签支持
   - 统计和监控

3. **优化执行模式**
   - 改进推断逻辑
   - 支持运行时切换
   - 资源限制实施

### 第四阶段：UI层优化（1周）

1. **改进管理界面**
   - 按Collection分组显示
   - 添加筛选和搜索
   - 显示连接状态

2. **优化配置界面**
   - 根据协议类型显示字段
   - 添加配置向导
   - 实时验证反馈

3. **添加高级功能**
   - 批量操作
   - 配置导入/导出
   - 配置模板

## 🎯 预期成果

1. **完整的协议支持** - 支持所有5种MCP传输协议
2. **灵活的配置系统** - 通过配置驱动所有行为
3. **清晰的代码架构** - 模块化、可扩展、易维护
4. **更好的用户体验** - 直观的UI、智能的默认值
5. **保留独特优势** - 智能执行模式、沙箱安全等

## ⚠️ 风险和挑战

1. **向后兼容性** - 需要确保现有配置继续工作
2. **性能影响** - 新的抽象层可能带来性能开销
3. **复杂度增加** - 需要平衡功能和简洁性
4. **测试覆盖** - 需要完善的测试用例

## 📚 参考资料

- [MCP官方规范](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Void MCP实现](https://github.com/voideditor/void)
- [Cherry Studio实现](https://github.com/cherry-studio/cherry)

---

**文档版本**: 1.0.0  
**最后更新**: 2024-01-20  
**作者**: DeeChat开发团队