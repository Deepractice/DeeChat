import { AppConfig } from '../types/index'

export interface ConfigData {
  id: string
  key: string
  value: string // JSON 字符串存储
  createdAt: string
  updatedAt: string
}

/**
 * 配置实体 - 用于SQLite存储
 * 支持应用程序配置的存储和检索
 */
export class ConfigEntity {
  public readonly id: string
  public readonly key: string
  public value: string
  public readonly createdAt: Date
  public updatedAt: Date

  constructor(data: ConfigData) {
    this.id = data.id
    this.key = data.key
    this.value = data.value
    this.createdAt = new Date(data.createdAt)
    this.updatedAt = new Date(data.updatedAt)
  }

  /**
   * 创建新的配置实体
   */
  static create(key: string, value: any): ConfigEntity {
    const now = new Date()
    return new ConfigEntity({
      id: ConfigEntity.generateId(),
      key,
      value: JSON.stringify(value),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    })
  }

  /**
   * 从AppConfig创建配置实体
   */
  static fromAppConfig(config: AppConfig): ConfigEntity {
    return ConfigEntity.create('app_config', config)
  }

  /**
   * 转换为数据对象
   */
  toData(): ConfigData {
    return {
      id: this.id,
      key: this.key,
      value: this.value,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    }
  }

  /**
   * 获取解析后的值
   */
  getParsedValue<T = any>(): T {
    try {
      return JSON.parse(this.value)
    } catch (error) {
      console.error(`解析配置值失败 key=${this.key}:`, error)
      return this.value as any
    }
  }

  /**
   * 设置新值
   */
  setValue(value: any): void {
    this.value = JSON.stringify(value)
    this.updatedAt = new Date()
  }

  /**
   * 转换为AppConfig（仅当key为app_config时有效）
   */
  toAppConfig(): AppConfig | null {
    if (this.key !== 'app_config') {
      return null
    }
    return this.getParsedValue<AppConfig>()
  }

  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 创建默认的应用配置
   */
  static createDefaultAppConfig(): ConfigEntity {
    const defaultConfig: AppConfig = {
      llm: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000
      },
      ui: {
        theme: 'auto',
        language: 'zh'
      },
      chat: {
        maxHistoryLength: 100,
        autoSave: true
      }
    }

    return ConfigEntity.fromAppConfig(defaultConfig)
  }

  /**
   * 验证配置数据
   */
  static validate(data: Partial<ConfigData>): ValidationResult {
    const errors: string[] = []

    if (!data.key || typeof data.key !== 'string') {
      errors.push('配置键不能为空')
    }

    if (!data.value || typeof data.value !== 'string') {
      errors.push('配置值不能为空')
    }

    // 验证JSON格式
    if (data.value) {
      try {
        JSON.parse(data.value)
      } catch (error) {
        errors.push('配置值必须是有效的JSON格式')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * 更新时间戳
   */
  touch(): void {
    this.updatedAt = new Date()
  }

  /**
   * 克隆配置实体
   */
  clone(): ConfigEntity {
    return new ConfigEntity(this.toData())
  }

  /**
   * 比较两个配置是否相等
   */
  equals(other: ConfigEntity): boolean {
    return this.id === other.id && 
           this.key === other.key && 
           this.value === other.value
  }
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}