/**
 * 工具执行上下文值对象
 * 包含执行工具所需的环境信息和参数
 */

import { ValueObject } from '../../../core/ValueObject'
import { Timestamp } from '../../../shared/primitives/Timestamp'

export interface IExecutionEnvironment {
  userId?: string
  sessionId?: string
  workspaceId?: string
  platform?: string
  version?: string
  locale?: string
  timezone?: string
}

export interface IExecutionPermissions {
  canReadFiles?: boolean
  canWriteFiles?: boolean
  canExecuteCommands?: boolean
  canAccessNetwork?: boolean
  canAccessDatabase?: boolean
  hasSystemPermission?: boolean
  allowedPaths?: string[]
  deniedPaths?: string[]
}

export interface IExecutionOptions {
  timeout?: number
  maxRetries?: number
  priority?: 'low' | 'normal' | 'high'
  async?: boolean
  validateInput?: boolean
  validateOutput?: boolean
  enableCache?: boolean
  cacheExpiry?: number
}

export class ToolExecutionContext extends ValueObject {
  private constructor(
    private readonly parameters: Record<string, any>,
    private readonly environment: IExecutionEnvironment,
    private readonly permissions: IExecutionPermissions,
    private readonly options: IExecutionOptions,
    private readonly timestamp: Timestamp,
    private readonly requiredCapabilities: string[] = []
  ) {
    super()
    this.validate()
  }

  /**
   * 创建执行上下文
   */
  static create(
    parameters: Record<string, any>,
    environment: IExecutionEnvironment = {},
    permissions: IExecutionPermissions = {},
    options: IExecutionOptions = {}
  ): ToolExecutionContext {
    return new ToolExecutionContext(
      parameters,
      environment,
      permissions,
      options,
      Timestamp.now()
    )
  }

  /**
   * 创建系统执行上下文（具有最高权限）
   */
  static createSystem(
    parameters: Record<string, any>,
    environment: IExecutionEnvironment = {},
    options: IExecutionOptions = {}
  ): ToolExecutionContext {
    const systemPermissions: IExecutionPermissions = {
      canReadFiles: true,
      canWriteFiles: true,
      canExecuteCommands: true,
      canAccessNetwork: true,
      canAccessDatabase: true,
      hasSystemPermission: true
    }

    return new ToolExecutionContext(
      parameters,
      environment,
      systemPermissions,
      options,
      Timestamp.now()
    )
  }

  /**
   * 创建只读执行上下文
   */
  static createReadOnly(
    parameters: Record<string, any>,
    environment: IExecutionEnvironment = {},
    options: IExecutionOptions = {}
  ): ToolExecutionContext {
    const readOnlyPermissions: IExecutionPermissions = {
      canReadFiles: true,
      canWriteFiles: false,
      canExecuteCommands: false,
      canAccessNetwork: false,
      canAccessDatabase: false,
      hasSystemPermission: false
    }

    return new ToolExecutionContext(
      parameters,
      environment,
      readOnlyPermissions,
      options,
      Timestamp.now()
    )
  }

  /**
   * 创建网络执行上下文
   */
  static createNetworkEnabled(
    parameters: Record<string, any>,
    environment: IExecutionEnvironment = {},
    options: IExecutionOptions = {}
  ): ToolExecutionContext {
    const networkPermissions: IExecutionPermissions = {
      canReadFiles: false,
      canWriteFiles: false,
      canExecuteCommands: false,
      canAccessNetwork: true,
      canAccessDatabase: false,
      hasSystemPermission: false
    }

    return new ToolExecutionContext(
      parameters,
      environment,
      networkPermissions,
      options,
      Timestamp.now()
    )
  }

  /**
   * 获取参数
   */
  getParameters(): Record<string, any> {
    return { ...this.parameters }
  }

  /**
   * 获取特定参数
   */
  getParameter<T = any>(name: string, defaultValue?: T): T {
    return this.parameters[name] ?? defaultValue
  }

  /**
   * 检查是否有特定参数
   */
  hasParameter(name: string): boolean {
    return name in this.parameters && this.parameters[name] !== undefined
  }

  /**
   * 获取环境信息
   */
  getEnvironment(): IExecutionEnvironment {
    return { ...this.environment }
  }

  /**
   * 获取用户ID
   */
  getUserId(): string | undefined {
    return this.environment.userId
  }

  /**
   * 获取会话ID
   */
  getSessionId(): string | undefined {
    return this.environment.sessionId
  }

  /**
   * 获取工作空间ID
   */
  getWorkspaceId(): string | undefined {
    return this.environment.workspaceId
  }

  /**
   * 获取权限信息
   */
  getPermissions(): IExecutionPermissions {
    return { ...this.permissions }
  }

  /**
   * 检查文件读取权限
   */
  canReadFiles(): boolean {
    return this.permissions.canReadFiles === true
  }

  /**
   * 检查文件写入权限
   */
  canWriteFiles(): boolean {
    return this.permissions.canWriteFiles === true
  }

  /**
   * 检查命令执行权限
   */
  canExecuteCommands(): boolean {
    return this.permissions.canExecuteCommands === true
  }

  /**
   * 检查网络访问权限
   */
  canAccessNetwork(): boolean {
    return this.permissions.canAccessNetwork === true
  }

  /**
   * 检查数据库访问权限
   */
  canAccessDatabase(): boolean {
    return this.permissions.canAccessDatabase === true
  }

  /**
   * 检查系统权限
   */
  hasSystemPermission(): boolean {
    return this.permissions.hasSystemPermission === true
  }

  /**
   * 检查路径访问权限
   */
  canAccessPath(path: string): boolean {
    // 检查拒绝列表
    if (this.permissions.deniedPaths) {
      for (const deniedPath of this.permissions.deniedPaths) {
        if (path.startsWith(deniedPath)) {
          return false
        }
      }
    }

    // 检查允许列表
    if (this.permissions.allowedPaths) {
      for (const allowedPath of this.permissions.allowedPaths) {
        if (path.startsWith(allowedPath)) {
          return true
        }
      }
      return false // 有允许列表但路径不在其中
    }

    return true // 没有路径限制
  }

  /**
   * 获取执行选项
   */
  getOptions(): IExecutionOptions {
    return { ...this.options }
  }

  /**
   * 获取超时时间
   */
  getTimeout(): number {
    return this.options.timeout || 30000 // 默认30秒
  }

  /**
   * 获取最大重试次数
   */
  getMaxRetries(): number {
    return this.options.maxRetries || 0
  }

  /**
   * 获取执行优先级
   */
  getPriority(): 'low' | 'normal' | 'high' {
    return this.options.priority || 'normal'
  }

  /**
   * 检查是否异步执行
   */
  isAsync(): boolean {
    return this.options.async === true
  }

  /**
   * 检查是否验证输入
   */
  shouldValidateInput(): boolean {
    return this.options.validateInput !== false // 默认验证
  }

  /**
   * 检查是否验证输出
   */
  shouldValidateOutput(): boolean {
    return this.options.validateOutput === true
  }

  /**
   * 检查是否启用缓存
   */
  isCacheEnabled(): boolean {
    return this.options.enableCache === true
  }

  /**
   * 获取缓存过期时间
   */
  getCacheExpiry(): number {
    return this.options.cacheExpiry || 300000 // 默认5分钟
  }

  /**
   * 获取时间戳
   */
  getTimestamp(): Timestamp {
    return this.timestamp
  }

  /**
   * 获取必需能力
   */
  getRequiredCapabilities(): string[] {
    return [...this.requiredCapabilities]
  }

  /**
   * 添加必需能力
   */
  withRequiredCapabilities(capabilities: string[]): ToolExecutionContext {
    return new ToolExecutionContext(
      this.parameters,
      this.environment,
      this.permissions,
      this.options,
      this.timestamp,
      [...this.requiredCapabilities, ...capabilities]
    )
  }

  /**
   * 更新参数
   */
  withParameters(newParameters: Record<string, any>): ToolExecutionContext {
    return new ToolExecutionContext(
      { ...this.parameters, ...newParameters },
      this.environment,
      this.permissions,
      this.options,
      this.timestamp,
      this.requiredCapabilities
    )
  }

  /**
   * 更新权限
   */
  withPermissions(newPermissions: IExecutionPermissions): ToolExecutionContext {
    return new ToolExecutionContext(
      this.parameters,
      this.environment,
      { ...this.permissions, ...newPermissions },
      this.options,
      this.timestamp,
      this.requiredCapabilities
    )
  }

  /**
   * 更新选项
   */
  withOptions(newOptions: IExecutionOptions): ToolExecutionContext {
    return new ToolExecutionContext(
      this.parameters,
      this.environment,
      this.permissions,
      { ...this.options, ...newOptions },
      this.timestamp,
      this.requiredCapabilities
    )
  }

  /**
   * 生成缓存键
   */
  getCacheKey(toolId: string): string {
    const paramsHash = this.hashObject(this.parameters)
    const envHash = this.hashObject(this.environment)
    return `tool_${toolId}_${paramsHash}_${envHash}`
  }

  /**
   * 检查上下文是否安全
   */
  isSafe(): boolean {
    const dangerousOperations = [
      this.permissions.canExecuteCommands,
      this.permissions.canWriteFiles && !this.permissions.allowedPaths,
      this.permissions.hasSystemPermission
    ]

    return !dangerousOperations.some(op => op === true)
  }

  /**
   * 获取风险等级
   */
  getRiskLevel(): 'low' | 'medium' | 'high' {
    if (this.permissions.hasSystemPermission || this.permissions.canExecuteCommands) {
      return 'high'
    }
    
    if (this.permissions.canWriteFiles || this.permissions.canAccessNetwork) {
      return 'medium'
    }
    
    return 'low'
  }

  /**
   * 生成对象哈希
   */
  private hashObject(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64').substring(0, 8)
  }

  /**
   * 相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof ToolExecutionContext)) return false
    
    return JSON.stringify(this.parameters) === JSON.stringify(other.parameters) &&
           JSON.stringify(this.environment) === JSON.stringify(other.environment) &&
           JSON.stringify(this.permissions) === JSON.stringify(other.permissions) &&
           JSON.stringify(this.options) === JSON.stringify(other.options) &&
           JSON.stringify(this.requiredCapabilities) === JSON.stringify(other.requiredCapabilities)
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return this.hashObject({
      parameters: this.parameters,
      environment: this.environment,
      permissions: this.permissions,
      options: this.options,
      requiredCapabilities: this.requiredCapabilities
    })
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return `ExecutionContext(user=${this.environment.userId}, session=${this.environment.sessionId}, params=${Object.keys(this.parameters).length})`
  }

  /**
   * 转换为JSON（用于日志和调试）
   */
  toJSON(): object {
    return {
      parameters: this.parameters,
      environment: this.environment,
      permissions: this.permissions,
      options: this.options,
      timestamp: this.timestamp.toISOString(),
      requiredCapabilities: this.requiredCapabilities,
      riskLevel: this.getRiskLevel(),
      isSafe: this.isSafe()
    }
  }

  /**
   * 验证上下文
   */
  protected validate(): void {
    if (!this.parameters || typeof this.parameters !== 'object') {
      throw new Error('Parameters must be an object')
    }

    if (!this.environment || typeof this.environment !== 'object') {
      throw new Error('Environment must be an object')
    }

    if (!this.permissions || typeof this.permissions !== 'object') {
      throw new Error('Permissions must be an object')
    }

    if (!this.options || typeof this.options !== 'object') {
      throw new Error('Options must be an object')
    }

    if (!this.timestamp) {
      throw new Error('Timestamp is required')
    }

    // 验证选项值
    if (this.options.timeout !== undefined && (typeof this.options.timeout !== 'number' || this.options.timeout <= 0)) {
      throw new Error('Timeout must be a positive number')
    }

    if (this.options.maxRetries !== undefined && (typeof this.options.maxRetries !== 'number' || this.options.maxRetries < 0)) {
      throw new Error('MaxRetries must be a non-negative number')
    }

    if (this.options.priority !== undefined && !['low', 'normal', 'high'].includes(this.options.priority)) {
      throw new Error('Priority must be low, normal, or high')
    }

    // 验证路径
    if (this.permissions.allowedPaths) {
      if (!Array.isArray(this.permissions.allowedPaths)) {
        throw new Error('AllowedPaths must be an array')
      }
    }

    if (this.permissions.deniedPaths) {
      if (!Array.isArray(this.permissions.deniedPaths)) {
        throw new Error('DeniedPaths must be an array')
      }
    }

    // 验证必需能力
    if (!Array.isArray(this.requiredCapabilities)) {
      throw new Error('RequiredCapabilities must be an array')
    }
  }
}