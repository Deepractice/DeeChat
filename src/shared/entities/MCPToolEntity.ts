/**
 * MCP工具实体
 * 表示一个MCP服务器提供的工具
 */

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

export class MCPToolEntity {
  public readonly name: string;
  public description?: string;
  public readonly serverId: string;
  public readonly serverName: string;
  
  // 工具参数定义
  public inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  
  // 工具元数据
  public category?: string;
  public tags: string[];
  public version?: string;
  
  // 状态信息
  public isAvailable: boolean;
  public lastUsed?: Date;
  public usageCount: number;
  
  // 缓存信息
  public cachedAt: Date;

  constructor(config: MCPToolConfig) {
    this.name = config.name;
    this.description = config.description;
    this.serverId = config.serverId;
    this.serverName = config.serverName;
    this.inputSchema = config.inputSchema;
    this.category = config.category;
    this.tags = config.tags || [];
    this.version = config.version;
    this.isAvailable = config.isAvailable;
    this.lastUsed = config.lastUsed;
    this.usageCount = config.usageCount;
    this.cachedAt = config.cachedAt;
  }

  /**
   * 获取工具的唯一标识符
   */
  get id(): string {
    return `${this.serverId}:${this.name}`;
  }

  /**
   * 获取工具的显示名称
   */
  get displayName(): string {
    return `${this.serverName} - ${this.name}`;
  }

  /**
   * 更新工具使用统计
   */
  recordUsage(): void {
    this.lastUsed = new Date();
    this.usageCount += 1;
  }

  /**
   * 更新工具可用性状态
   */
  updateAvailability(isAvailable: boolean): void {
    this.isAvailable = isAvailable;
    this.cachedAt = new Date();
  }

  /**
   * 检查工具是否匹配搜索条件
   */
  matches(searchTerm: string): boolean {
    const term = searchTerm.toLowerCase();
    
    // 检查名称
    if (this.name.toLowerCase().includes(term)) {
      return true;
    }
    
    // 检查描述
    if (this.description?.toLowerCase().includes(term)) {
      return true;
    }
    
    // 检查标签
    if (this.tags.some(tag => tag.toLowerCase().includes(term))) {
      return true;
    }
    
    // 检查分类
    if (this.category?.toLowerCase().includes(term)) {
      return true;
    }
    
    // 检查服务器名称
    if (this.serverName.toLowerCase().includes(term)) {
      return true;
    }
    
    return false;
  }

  /**
   * 验证工具参数
   */
  validateArgs(args: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.inputSchema) {
      return { isValid: true, errors: [] };
    }

    const { required = [], properties = {} } = this.inputSchema;

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

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取工具的参数提示信息
   */
  getParameterHints(): string[] {
    if (!this.inputSchema?.properties) {
      return [];
    }

    const hints: string[] = [];
    const { properties, required = [] } = this.inputSchema;

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
   * 转换为数据对象
   */
  toData(): MCPToolConfig {
    return {
      name: this.name,
      description: this.description,
      serverId: this.serverId,
      serverName: this.serverName,
      inputSchema: this.inputSchema,
      category: this.category,
      tags: this.tags,
      version: this.version,
      isAvailable: this.isAvailable,
      lastUsed: this.lastUsed,
      usageCount: this.usageCount,
      cachedAt: this.cachedAt
    };
  }

  /**
   * 从数据对象创建实体
   */
  static fromData(data: MCPToolConfig): MCPToolEntity {
    return new MCPToolEntity(data);
  }

  /**
   * 创建新的MCP工具实体
   */
  static create(config: Omit<MCPToolConfig, 'isAvailable' | 'usageCount' | 'cachedAt'>): MCPToolEntity {
    return new MCPToolEntity({
      ...config,
      isAvailable: true,
      usageCount: 0,
      cachedAt: new Date()
    });
  }
}
