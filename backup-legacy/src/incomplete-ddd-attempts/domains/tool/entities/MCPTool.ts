/**
 * MCP工具实体 (Domain Entity)
 * 表示一个MCP服务器提供的工具
 * 🏗️ DDD重构: 从MCPToolEntity重构为纯领域实体
 */

import { ToolId } from '../value-objects/ToolId';
import { ToolExecutionResult } from '../value-objects/ToolExecutionResult';

export interface MCPToolConfig {
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  
  // 工具参数定义
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  
  // 完整工具定义 - 用于存储完整的工具提示词和使用指南
  fullDefinition?: any;
  
  // 工具元数据
  category?: string;
  tags?: string[];
  version?: string;
  
  // 状态信息
  isAvailable: boolean;
  lastUsed?: Date;
  usageCount: number;
  
  // 缓存信息
  cachedAt: Date;
}

/**
 * MCP工具实体 - DDD风格的领域实体
 */
export class MCPTool {
  private readonly _id: ToolId;
  private _name: string;
  private _description?: string;
  private _serverId: string;
  private _serverName: string;
  private _inputSchema?: any;
  private _fullDefinition?: any;
  private _category?: string;
  private _tags: string[];
  private _version?: string;
  private _isAvailable: boolean;
  private _lastUsed?: Date;
  private _usageCount: number;
  private _cachedAt: Date;

  constructor(config: MCPToolConfig) {
    this._id = new ToolId(`${config.serverId}:${config.name}`);
    this._name = config.name;
    this._description = config.description;
    this._serverId = config.serverId;
    this._serverName = config.serverName;
    this._inputSchema = config.inputSchema;
    this._fullDefinition = config.fullDefinition;
    this._category = config.category;
    this._tags = config.tags || [];
    this._version = config.version;
    this._isAvailable = config.isAvailable;
    this._lastUsed = config.lastUsed;
    this._usageCount = config.usageCount;
    this._cachedAt = config.cachedAt;
  }

  // Getters - 暴露只读属性
  get id(): ToolId { return this._id; }
  get name(): string { return this._name; }
  get description(): string | undefined { return this._description; }
  get serverId(): string { return this._serverId; }
  get serverName(): string { return this._serverName; }
  get inputSchema(): any { return this._inputSchema; }
  get fullDefinition(): any { return this._fullDefinition; }
  get category(): string | undefined { return this._category; }
  get tags(): readonly string[] { return this._tags; }
  get version(): string | undefined { return this._version; }
  get isAvailable(): boolean { return this._isAvailable; }
  get lastUsed(): Date | undefined { return this._lastUsed; }
  get usageCount(): number { return this._usageCount; }
  get cachedAt(): Date { return this._cachedAt; }

  /**
   * 业务方法：记录工具使用
   */
  recordUsage(): void {
    this._lastUsed = new Date();
    this._usageCount += 1;
  }

  /**
   * 业务方法：更新可用性状态
   */
  updateAvailability(isAvailable: boolean): void {
    this._isAvailable = isAvailable;
    this._cachedAt = new Date();
  }

  /**
   * 业务方法：验证工具参数
   */
  validateArgs(args: any): ToolExecutionResult {
    const errors: string[] = [];

    if (!this._inputSchema) {
      return ToolExecutionResult.success();
    }

    const { required = [], properties = {} } = this._inputSchema;

    // 检查必需参数
    for (const requiredField of required) {
      if (!(requiredField in args) || args[requiredField] === undefined || args[requiredField] === null) {
        errors.push(`缺少必需参数: ${requiredField}`);
      }
    }

    // 检查参数类型（简单验证）
    for (const [key, value] of Object.entries(args)) {
      const propSchema = properties[key];
      if (propSchema && propSchema.type) {
        const actualType = typeof value;
        const expectedType = propSchema.type;
        
        if (expectedType === 'string' && actualType !== 'string') {
          errors.push(`参数 ${key} 应为字符串类型`);
        } else if (expectedType === 'number' && actualType !== 'number') {
          errors.push(`参数 ${key} 应为数字类型`);
        } else if (expectedType === 'boolean' && actualType !== 'boolean') {
          errors.push(`参数 ${key} 应为布尔类型`);
        } else if (expectedType === 'object' && (actualType !== 'object' || value === null)) {
          errors.push(`参数 ${key} 应为对象类型`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`参数 ${key} 应为数组类型`);
        }
      }
    }

    return errors.length === 0 
      ? ToolExecutionResult.success()
      : ToolExecutionResult.failure(errors.join(', '));
  }

  /**
   * 业务方法：检查是否匹配搜索条件
   */
  matches(searchTerm: string): boolean {
    const term = searchTerm.toLowerCase();
    
    return this._name.toLowerCase().includes(term) ||
           this._description?.toLowerCase().includes(term) ||
           this._tags.some(tag => tag.toLowerCase().includes(term)) ||
           this._category?.toLowerCase().includes(term) ||
           this._serverName.toLowerCase().includes(term);
  }

  /**
   * 获取工具的显示名称
   */
  get displayName(): string {
    return `${this._serverName} - ${this._name}`;
  }

  /**
   * 获取工具的参数提示信息
   */
  getParameterHints(): string[] {
    if (!this._inputSchema?.properties) {
      return [];
    }

    const hints: string[] = [];
    const { properties, required = [] } = this._inputSchema;

    for (const [key, schema] of Object.entries(properties)) {
      const isRequired = required.includes(key);
      const type = (schema as any).type || 'any';
      const description = (schema as any).description || '';
      
      let hint = `${key} (${type})`;
      if (isRequired) {
        hint += ' *必需';
      }
      if (description) {
        hint += ` - ${description}`;
      }
      
      hints.push(hint);
    }

    return hints;
  }

  /**
   * 工厂方法：创建新的MCP工具
   */
  static create(config: Omit<MCPToolConfig, 'isAvailable' | 'usageCount' | 'cachedAt'>): MCPTool {
    return new MCPTool({
      ...config,
      isAvailable: true,
      usageCount: 0,
      cachedAt: new Date()
    });
  }

  /**
   * 转换为数据传输对象
   */
  toData(): MCPToolConfig {
    return {
      name: this._name,
      description: this._description,
      serverId: this._serverId,
      serverName: this._serverName,
      inputSchema: this._inputSchema,
      fullDefinition: this._fullDefinition,
      category: this._category,
      tags: [...this._tags],
      version: this._version,
      isAvailable: this._isAvailable,
      lastUsed: this._lastUsed,
      usageCount: this._usageCount,
      cachedAt: this._cachedAt
    };
  }
}