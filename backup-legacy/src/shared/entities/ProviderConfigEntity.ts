/**
 * 提供商配置实体
 * 管理AI提供商的配置信息（API密钥、地址等），一个配置可对应多个模型
 */

// 生成UUID的简单实现（兼容浏览器环境）
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface ProviderConfigData {
  id?: string
  name: string           // 用户自定义名称，如"我的OpenAI账户"
  provider: string       // 提供商类型：openai/claude/gemini/custom
  apiKey: string         // API密钥
  baseURL: string        // API地址
  isEnabled: boolean     // 是否启用
  priority: number       // 优先级（1-10，数字越大优先级越高）
  availableModels?: string[]  // 可用模型列表
  enabledModels?: string[]    // 启用的模型列表
  createdAt?: Date
  updatedAt?: Date
}

export class ProviderConfigEntity {
  public readonly id: string
  public readonly name: string
  public readonly provider: string
  public readonly apiKey: string
  public readonly baseURL: string
  public readonly isEnabled: boolean
  public readonly priority: number
  public readonly availableModels: string[]
  public readonly enabledModels: string[]
  public readonly createdAt: Date
  public readonly updatedAt: Date

  constructor(data: ProviderConfigData) {
    this.id = data.id || generateUUID()
    this.name = data.name
    this.provider = data.provider
    this.apiKey = data.apiKey
    this.baseURL = data.baseURL
    this.isEnabled = data.isEnabled
    this.priority = data.priority
    this.availableModels = data.availableModels || []
    this.enabledModels = data.enabledModels || []
    this.createdAt = data.createdAt || new Date()
    this.updatedAt = data.updatedAt || new Date()

    this.validate()
  }

  /**
   * 创建新的提供商配置
   */
  static create(data: Omit<ProviderConfigData, 'id' | 'createdAt' | 'updatedAt'>): ProviderConfigEntity {
    return new ProviderConfigEntity({
      ...data,
      id: generateUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  /**
   * 验证配置数据
   */
  private validate(): void {
    if (!this.name?.trim()) {
      throw new Error('配置名称不能为空')
    }

    if (!this.provider?.trim()) {
      throw new Error('提供商类型不能为空')
    }

    // API密钥可以为空，用户后续填写
    // if (!this.apiKey?.trim()) {
    //   throw new Error('API密钥不能为空')
    // }

    if (!this.baseURL?.trim()) {
      throw new Error('API地址不能为空')
    }

    if (typeof this.isEnabled !== 'boolean') {
      throw new Error('启用状态必须是布尔值')
    }

    if (!Number.isInteger(this.priority) || this.priority < 1 || this.priority > 10) {
      throw new Error('优先级必须是1-10之间的整数')
    }

    // 验证URL格式
    try {
      new URL(this.baseURL)
    } catch {
      throw new Error('API地址格式无效')
    }

    // 验证提供商类型
    const validProviders = ['openai', 'claude', 'gemini', 'custom']
    if (!validProviders.includes(this.provider)) {
      throw new Error(`不支持的提供商类型: ${this.provider}`)
    }
  }

  /**
   * 更新配置
   */
  update(data: Partial<Omit<ProviderConfigData, 'id' | 'createdAt'>>): ProviderConfigEntity {
    return new ProviderConfigEntity({
      id: this.id,
      name: data.name ?? this.name,
      provider: data.provider ?? this.provider,
      apiKey: data.apiKey ?? this.apiKey,
      baseURL: data.baseURL ?? this.baseURL,
      isEnabled: data.isEnabled ?? this.isEnabled,
      priority: data.priority ?? this.priority,
      availableModels: data.availableModels ?? this.availableModels,
      enabledModels: data.enabledModels ?? this.enabledModels,
      createdAt: this.createdAt,
      updatedAt: new Date()
    })
  }

  /**
   * 转换为普通对象
   */
  toData(): ProviderConfigData {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      isEnabled: this.isEnabled,
      priority: this.priority,
      availableModels: this.availableModels,
      enabledModels: this.enabledModels,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   * 转换为JSON字符串
   */
  toJSON(): string {
    return JSON.stringify(this.toData())
  }

  /**
   * 从JSON字符串创建实例
   */
  static fromJSON(json: string): ProviderConfigEntity {
    const data = JSON.parse(json)
    return new ProviderConfigEntity({
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    })
  }

  /**
   * 克隆配置
   */
  clone(): ProviderConfigEntity {
    return new ProviderConfigEntity(this.toData())
  }

  /**
   * 检查是否相等
   */
  equals(other: ProviderConfigEntity): boolean {
    return this.id === other.id
  }

  /**
   * 获取显示名称
   */
  getDisplayName(): string {
    return `${this.name} (${this.provider})`
  }

  /**
   * 检查是否可用
   */
  isAvailable(): boolean {
    return this.isEnabled && this.apiKey.trim() !== '' && this.baseURL.trim() !== ''
  }

  /**
   * 获取提供商的默认模型列表
   */
  getDefaultModels(): string[] {
    switch (this.provider) {
      case 'openai':
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo']
      case 'claude':
        return ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-sonnet-20240229']
      case 'gemini':
        return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
      case 'custom':
        // 对于自定义提供商，返回通用的默认模型列表
        // 包含常见的第三方API模型名
        return [
          'kimi-k2-0711-preview',  // Moonshot AI
          'moonshot-v1-8k',
          'moonshot-v1-32k',
          'gpt-3.5-turbo',         // 通用OpenAI兼容
          'gpt-4',
          'deepseek-chat',         // DeepSeek
          'qwen-turbo',            // 通义千问
          'chatglm-6b'             // ChatGLM
        ]
      default:
        return ['gpt-3.5-turbo'] // 至少提供一个默认模型
    }
  }

  /**
   * 创建用于API调用的临时模型配置
   */
  createModelConfig(modelName: string): any {
    return {
      id: `${this.id}-${modelName}`,
      name: `${this.name} - ${modelName}`,
      provider: this.provider,
      model: modelName,
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      isEnabled: this.isEnabled,
      priority: this.priority
    }
  }
}
