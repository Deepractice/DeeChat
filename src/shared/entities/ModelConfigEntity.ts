export type ModelStatus = 'available' | 'error' | 'untested' | 'testing'

export interface ModelConfigData {
  id: string
  name: string
  provider: string
  model: string
  apiKey: string
  baseURL: string
  isEnabled: boolean
  status: ModelStatus
  priority: number
  createdAt: string
  updatedAt: string
  lastTested?: string
  responseTime?: number
  errorMessage?: string
  availableModels?: string[]  // 可用模型列表
  enabledModels?: string[]    // 启用的模型列表
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface TestResult {
  success: boolean
  responseTime?: number
  model?: string
  error?: string
}

export class ModelConfigEntity {
  public readonly id: string
  public name: string
  public provider: string
  public model: string
  public apiKey: string
  public baseURL: string
  public isEnabled: boolean
  public status: ModelStatus
  public priority: number
  public readonly createdAt: Date
  public updatedAt: Date
  public lastTested?: Date
  public responseTime?: number
  public errorMessage?: string
  public availableModels: string[]
  public enabledModels: string[]

  constructor(data: ModelConfigData) {
    this.id = data.id
    this.name = data.name
    this.provider = data.provider
    this.model = data.model
    this.apiKey = data.apiKey
    this.baseURL = data.baseURL
    this.isEnabled = data.isEnabled
    this.status = data.status
    this.priority = data.priority
    this.createdAt = new Date(data.createdAt)
    this.updatedAt = new Date(data.updatedAt)
    this.lastTested = data.lastTested ? new Date(data.lastTested) : undefined
    this.responseTime = data.responseTime
    this.errorMessage = data.errorMessage
    this.availableModels = data.availableModels || []
    this.enabledModels = data.enabledModels || []
  }

  // 验证配置
  validate(): ValidationResult {
    const errors: string[] = []

    if (!this.name.trim()) {
      errors.push('配置名称不能为空')
    }

    if (!this.provider.trim()) {
      errors.push('提供商不能为空')
    }

    if (!this.model.trim()) {
      errors.push('模型不能为空')
    }

    if (!this.apiKey.trim()) {
      errors.push('API密钥不能为空')
    }

    if (!this.baseURL.trim()) {
      errors.push('API地址不能为空')
    }

    // 提供商特定验证
    if (this.provider === 'openai' && !this.apiKey.startsWith('sk-')) {
      errors.push('OpenAI API密钥格式不正确')
    }

    if (this.provider === 'claude' && !this.apiKey.startsWith('sk-ant-')) {
      errors.push('Claude API密钥格式不正确')
    }

    try {
      new URL(this.baseURL)
    } catch {
      errors.push('API地址格式不正确')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 更新状态
  updateStatus(status: ModelStatus, errorMessage?: string): void {
    this.status = status
    this.errorMessage = errorMessage
    this.updatedAt = new Date()
    
    if (status === 'available') {
      this.errorMessage = undefined
    }
  }

  // 更新测试结果
  updateTestResult(result: TestResult): void {
    if (result.success) {
      this.status = 'available'
      this.responseTime = result.responseTime
      this.errorMessage = undefined
    } else {
      this.status = 'error'
      this.errorMessage = result.error
    }
    
    this.lastTested = new Date()
    this.updatedAt = new Date()
  }

  // 转换为数据对象
  toData(): ModelConfigData {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      model: this.model,
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      isEnabled: this.isEnabled,
      status: this.status,
      priority: this.priority,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      lastTested: this.lastTested?.toISOString(),
      responseTime: this.responseTime,
      errorMessage: this.errorMessage,
      availableModels: this.availableModels,
      enabledModels: this.enabledModels
    }
  }

  // 创建新的配置实体
  static create(data: Omit<ModelConfigData, 'id' | 'createdAt' | 'updatedAt' | 'status'>): ModelConfigEntity {
    const now = new Date().toISOString()

    // 生成UUID - 兼容主进程和渲染进程
    const generateId = (): string => {
      // 主进程环境：直接使用Node.js crypto模块
      if (typeof window === 'undefined') {
        try {
          const crypto = require('crypto')
          return crypto.randomUUID()
        } catch (error) {
          console.warn('crypto.randomUUID() 不可用，使用fallback')
        }
      }

      // 渲染进程环境：使用preload暴露的API
      if (typeof window !== 'undefined' && (window as any).electronAPI?.generateUUID) {
        return (window as any).electronAPI.generateUUID()
      }

      // Fallback: 简单但有效的ID生成
      return 'config-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)
    }

    const id = generateId()

    return new ModelConfigEntity({
      ...data,
      id,
      status: 'untested',
      createdAt: now,
      updatedAt: now
    })
  }

  // 克隆实体
  clone(): ModelConfigEntity {
    return new ModelConfigEntity(this.toData())
  }
}
