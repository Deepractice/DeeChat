/**
 * MCP工具聚合根
 * 管理工具的生命周期、状态和执行
 */

import { AggregateRoot } from '../../../core/AggregateRoot'
import { ToolId } from '../value-objects/ToolId'
import { ToolName } from '../value-objects/ToolName'
import { ToolSchema } from '../value-objects/ToolSchema'
import { ToolStatus } from '../value-objects/ToolStatus'
import { ToolCapabilities } from '../value-objects/ToolCapabilities'
import { ToolExecutionContext } from '../value-objects/ToolExecutionContext'
import { ToolExecutionResult } from '../value-objects/ToolExecutionResult'
import { Timestamp } from '../../../shared/primitives/Timestamp'
import { ToolRegistered } from '../events/ToolRegistered'
import { ToolUnregistered } from '../events/ToolUnregistered'
import { ToolExecutionStarted } from '../events/ToolExecutionStarted'
import { ToolExecutionCompleted } from '../events/ToolExecutionCompleted'
import { ToolExecutionFailed } from '../events/ToolExecutionFailed'
import { ToolStatusChanged } from '../events/ToolStatusChanged'

export interface IToolMetadata {
  description?: string
  version?: string
  author?: string
  documentation?: string
  tags?: string[]
  category?: string
  priority?: number
  isSystemTool?: boolean
}

export class MCPTool extends AggregateRoot<ToolId> {
  private constructor(
    id: ToolId,
    private name: ToolName,
    private schema: ToolSchema,
    private status: ToolStatus,
    private capabilities: ToolCapabilities,
    private metadata: IToolMetadata,
    private readonly registeredAt: Timestamp,
    private lastUsedAt?: Timestamp,
    private usageCount: number = 0,
    private successCount: number = 0,
    private errorCount: number = 0
  ) {
    super(id)
    this.validate()
  }

  /**
   * 创建新的MCP工具
   */
  static create(
    id: ToolId,
    name: ToolName,
    schema: ToolSchema,
    capabilities: ToolCapabilities,
    metadata: IToolMetadata = {}
  ): MCPTool {
    const tool = new MCPTool(
      id,
      name,
      schema,
      ToolStatus.available(),
      capabilities,
      metadata,
      Timestamp.now(),
      undefined,
      0,
      0,
      0
    )

    tool.addDomainEvent(new ToolRegistered(
      id,
      name,
      capabilities,
      Timestamp.now()
    ))

    return tool
  }

  /**
   * 重新构造已存在的工具
   */
  static reconstruct(
    id: ToolId,
    name: ToolName,
    schema: ToolSchema,
    status: ToolStatus,
    capabilities: ToolCapabilities,
    metadata: IToolMetadata,
    registeredAt: Timestamp,
    lastUsedAt?: Timestamp,
    usageCount: number = 0,
    successCount: number = 0,
    errorCount: number = 0
  ): MCPTool {
    return new MCPTool(
      id,
      name,
      schema,
      status,
      capabilities,
      metadata,
      registeredAt,
      lastUsedAt,
      usageCount,
      successCount,
      errorCount
    )
  }

  /**
   * 执行工具
   */
  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    if (!this.status.isAvailable()) {
      const error = new Error(`Tool ${this.name.getValue()} is not available: ${this.status.toString()}`)
      this.recordExecutionError(error, context)
      throw error
    }

    // 验证执行权限
    this.validateExecutionPermissions(context)

    // 验证输入参数
    this.validateExecutionInput(context)

    // 记录执行开始
    this.addDomainEvent(new ToolExecutionStarted(
      this.id,
      this.name,
      context,
      Timestamp.now()
    ))

    try {
      this.usageCount++
      this.lastUsedAt = Timestamp.now()

      // 这里实际的工具执行逻辑将在基础设施层实现
      // 当前只是记录执行状态和事件
      
      // 模拟执行成功
      const result = ToolExecutionResult.success(
        this.id,
        context,
        { message: 'Tool executed successfully' },
        Timestamp.now()
      )

      this.recordExecutionSuccess(result, context)
      return result

    } catch (error) {
      this.recordExecutionError(error as Error, context)
      throw error
    }
  }

  /**
   * 停用工具
   */
  deactivate(reason?: string): void {
    const oldStatus = this.status
    this.status = ToolStatus.unavailable(reason)
    
    this.addDomainEvent(new ToolStatusChanged(
      this.id,
      this.name,
      oldStatus,
      this.status,
      Timestamp.now()
    ))
  }

  /**
   * 激活工具
   */
  activate(): void {
    const oldStatus = this.status
    this.status = ToolStatus.available()
    
    this.addDomainEvent(new ToolStatusChanged(
      this.id,
      this.name,
      oldStatus,
      this.status,
      Timestamp.now()
    ))
  }

  /**
   * 标记工具为维护状态
   */
  setMaintenance(reason?: string): void {
    const oldStatus = this.status
    this.status = ToolStatus.maintenance(reason)
    
    this.addDomainEvent(new ToolStatusChanged(
      this.id,
      this.name,
      oldStatus,
      this.status,
      Timestamp.now()
    ))
  }

  /**
   * 注销工具
   */
  unregister(reason?: string): void {
    this.addDomainEvent(new ToolUnregistered(
      this.id,
      this.name,
      reason,
      Timestamp.now()
    ))
  }

  /**
   * 更新工具能力
   */
  updateCapabilities(newCapabilities: ToolCapabilities): void {
    const oldCapabilities = this.capabilities
    this.capabilities = newCapabilities
    this.validate()
  }

  /**
   * 更新工具元数据
   */
  updateMetadata(newMetadata: Partial<IToolMetadata>): void {
    this.metadata = { ...this.metadata, ...newMetadata }
  }

  /**
   * 检查工具是否具有特定能力
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.hasCapability(capability)
  }

  /**
   * 检查工具是否具有所有指定能力
   */
  hasAllCapabilities(capabilities: string[]): boolean {
    return capabilities.every(cap => this.hasCapability(cap))
  }

  /**
   * 检查工具是否具有任一指定能力
   */
  hasAnyCapability(capabilities: string[]): boolean {
    return capabilities.some(cap => this.hasCapability(cap))
  }

  /**
   * 获取工具成功率
   */
  getSuccessRate(): number {
    if (this.usageCount === 0) return 0
    return this.successCount / this.usageCount
  }

  /**
   * 获取工具错误率
   */
  getErrorRate(): number {
    if (this.usageCount === 0) return 0
    return this.errorCount / this.usageCount
  }

  /**
   * 检查工具是否健康
   */
  isHealthy(): boolean {
    if (this.usageCount < 10) return true // 使用次数少时认为健康
    return this.getSuccessRate() >= 0.8 && this.getErrorRate() <= 0.2
  }

  /**
   * 记录执行成功
   */
  private recordExecutionSuccess(result: ToolExecutionResult, context: ToolExecutionContext): void {
    this.successCount++
    
    this.addDomainEvent(new ToolExecutionCompleted(
      this.id,
      this.name,
      context,
      result,
      Timestamp.now()
    ))
  }

  /**
   * 记录执行错误
   */
  private recordExecutionError(error: Error, context: ToolExecutionContext): void {
    this.errorCount++
    
    this.addDomainEvent(new ToolExecutionFailed(
      this.id,
      this.name,
      context,
      error.message,
      Timestamp.now()
    ))
  }

  /**
   * 验证执行权限
   */
  private validateExecutionPermissions(context: ToolExecutionContext): void {
    // 检查用户权限
    if (this.metadata.isSystemTool && !context.hasSystemPermission()) {
      throw new Error(`System tool ${this.name.getValue()} requires system permission`)
    }

    // 检查工具特定权限
    const requiredCapabilities = context.getRequiredCapabilities()
    if (requiredCapabilities.length > 0 && !this.hasAllCapabilities(requiredCapabilities)) {
      throw new Error(`Tool ${this.name.getValue()} lacks required capabilities: ${requiredCapabilities.join(', ')}`)
    }
  }

  /**
   * 验证执行输入
   */
  private validateExecutionInput(context: ToolExecutionContext): void {
    const validationResult = this.schema.validate(context.getParameters())
    if (!validationResult.isValid) {
      throw new Error(`Invalid parameters for tool ${this.name.getValue()}: ${validationResult.errors.join(', ')}`)
    }
  }

  /**
   * 验证工具状态
   */
  private validate(): void {
    if (!this.name || !this.schema || !this.capabilities) {
      throw new Error('Tool must have name, schema, and capabilities')
    }

    if (this.usageCount < 0 || this.successCount < 0 || this.errorCount < 0) {
      throw new Error('Usage counts cannot be negative')
    }

    if (this.successCount + this.errorCount > this.usageCount) {
      throw new Error('Success + error count cannot exceed total usage count')
    }
  }

  // Getters
  getName(): ToolName {
    return this.name
  }

  getSchema(): ToolSchema {
    return this.schema
  }

  getStatus(): ToolStatus {
    return this.status
  }

  getCapabilities(): ToolCapabilities {
    return this.capabilities
  }

  getMetadata(): IToolMetadata {
    return { ...this.metadata }
  }

  getRegisteredAt(): Timestamp {
    return this.registeredAt
  }

  getLastUsedAt(): Timestamp | undefined {
    return this.lastUsedAt
  }

  getUsageCount(): number {
    return this.usageCount
  }

  getSuccessCount(): number {
    return this.successCount
  }

  getErrorCount(): number {
    return this.errorCount
  }

  isSystemTool(): boolean {
    return this.metadata.isSystemTool === true
  }

  getDescription(): string {
    return this.metadata.description || ''
  }

  getVersion(): string {
    return this.metadata.version || '1.0.0'
  }

  getTags(): string[] {
    return this.metadata.tags || []
  }

  getCategory(): string {
    return this.metadata.category || 'general'
  }

  getPriority(): number {
    return this.metadata.priority || 0
  }
}