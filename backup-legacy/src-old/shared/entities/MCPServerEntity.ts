/**
 * MCP服务器实体
 * 表示一个MCP服务器的配置信息
 */

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'sse' | 'websocket' | 'streamable-http' | 'builtin' | 'inprocess';
  isEnabled: boolean;

  // Stdio配置
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  workingDirectory?: string; // 🔥 添加工作目录支持

  // SSE配置
  url?: string;
  headers?: Record<string, string>;

  // 通用配置
  timeout?: number;
  retryCount?: number;
  
  // 🔥 新增：执行策略配置
  execution?: 'inprocess' | 'sandbox' | 'standard';
  
  // 🔥 新增：OAuth认证配置
  auth?: {
    clientId: string;
    clientSecret: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
  };

  // 元数据
  createdAt: Date;
  updatedAt: Date;
}

export class MCPServerEntity {
  public readonly id: string;
  public name: string;
  public description?: string;
  public type: 'stdio' | 'sse' | 'websocket' | 'streamable-http' | 'builtin' | 'inprocess';
  public isEnabled: boolean;

  // Stdio配置
  public command?: string;
  public args?: string[];
  public env?: Record<string, string>;
  public workingDirectory?: string; // 🔥 添加工作目录支持

  // SSE配置
  public url?: string;
  public headers?: Record<string, string>;

  // 通用配置
  public timeout: number;
  public retryCount: number;
  
  // 🔥 新增：执行策略配置
  public execution?: 'inprocess' | 'sandbox' | 'standard';
  
  // 🔥 新增：OAuth认证配置
  public auth?: {
    clientId: string;
    clientSecret: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
  };

  // 元数据
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(config: MCPServerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.type = config.type;
    this.isEnabled = config.isEnabled;

    // Stdio配置
    this.command = config.command;
    this.args = config.args || [];
    this.env = config.env || {};
    this.workingDirectory = config.workingDirectory; // 🔥 添加工作目录支持

    // SSE配置
    this.url = config.url;
    this.headers = config.headers || {};

    // 通用配置
    this.timeout = config.timeout || 30000; // 默认30秒
    this.retryCount = config.retryCount || 3; // 默认重试3次
    
    // 🔥 新增字段
    this.execution = config.execution;
    this.auth = config.auth;

    // 元数据
    this.createdAt = config.createdAt;
    this.updatedAt = config.updatedAt;
  }

  /**
   * 更新服务器配置
   */
  update(updates: Partial<MCPServerConfig>): void {
    if (updates.name !== undefined) this.name = updates.name;
    if (updates.description !== undefined) this.description = updates.description;
    if (updates.type !== undefined) this.type = updates.type;
    if (updates.isEnabled !== undefined) this.isEnabled = updates.isEnabled;

    // Stdio配置
    if (updates.command !== undefined) this.command = updates.command;
    if (updates.args !== undefined) this.args = updates.args;
    if (updates.env !== undefined) this.env = updates.env;
    if (updates.workingDirectory !== undefined) this.workingDirectory = updates.workingDirectory; // 🔥 添加工作目录支持

    // SSE配置
    if (updates.url !== undefined) this.url = updates.url;
    if (updates.headers !== undefined) this.headers = updates.headers;
    
    // 通用配置
    if (updates.timeout !== undefined) this.timeout = updates.timeout;
    if (updates.retryCount !== undefined) this.retryCount = updates.retryCount;
    
    // 🔥 新增字段更新
    if (updates.execution !== undefined) this.execution = updates.execution;
    if (updates.auth !== undefined) this.auth = updates.auth;
    
    this.updatedAt = new Date();
  }

  /**
   * 验证配置是否有效
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name.trim()) {
      errors.push('服务器名称不能为空');
    }

    if (this.type === 'stdio') {
      if (!this.command?.trim()) {
        errors.push('Stdio类型服务器必须指定命令');
      }
    } else if (['sse', 'websocket', 'streamable-http'].includes(this.type)) {
      if (!this.url?.trim()) {
        errors.push(`${this.type}类型服务器必须指定URL`);
      } else {
        try {
          new URL(this.url);
        } catch {
          errors.push(`${this.type} URL格式无效`);
        }
      }
    } else {
      errors.push('服务器类型必须是stdio、sse、websocket或streamable-http');
    }

    if (this.timeout < 1000) {
      errors.push('超时时间不能少于1秒');
    }

    if (this.retryCount < 0) {
      errors.push('重试次数不能为负数');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 转换为数据对象
   */
  toData(): MCPServerConfig {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      type: this.type,
      isEnabled: this.isEnabled,
      command: this.command,
      args: this.args,
      env: this.env,
      workingDirectory: this.workingDirectory, // 🔥 添加工作目录支持
      url: this.url,
      headers: this.headers,
      timeout: this.timeout,
      retryCount: this.retryCount,
      execution: this.execution, // 🔥 新增字段
      auth: this.auth, // 🔥 新增字段
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * 从数据对象创建实体
   */
  static fromData(data: MCPServerConfig): MCPServerEntity {
    return new MCPServerEntity(data);
  }

  /**
   * 创建新的MCP服务器实体
   */
  static create(config: Omit<MCPServerConfig, 'id' | 'createdAt' | 'updatedAt'>): MCPServerEntity {
    const now = new Date();

    // 生成UUID - 兼容主进程和渲染进程
    const generateId = (): string => {
      // 主进程环境：直接使用Node.js crypto模块
      if (typeof window === 'undefined') {
        try {
          const crypto = require('crypto');
          return crypto.randomUUID();
        } catch (error) {
          console.warn('crypto.randomUUID() 不可用，使用fallback');
        }
      }

      // 渲染进程环境：使用preload暴露的API
      if (typeof window !== 'undefined' && (window as any).electronAPI?.generateUUID) {
        return (window as any).electronAPI.generateUUID();
      }

      // Fallback: 简单但有效的ID生成
      return 'mcp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    };

    const id = generateId();

    return new MCPServerEntity({
      ...config,
      id,
      createdAt: now,
      updatedAt: now
    });
  }
}
