/**
 * AI角色聚合根
 * 管理AI角色的激活、状态和能力
 */

import { AggregateRoot } from '../../../core/AggregateRoot'
import { RoleId } from '../value-objects/RoleId'
import { RoleName } from '../value-objects/RoleName'
import { RoleCapabilities } from '../value-objects/RoleCapabilities'
import { RoleStatus } from '../value-objects/RoleStatus'
import { Timestamp } from '../../../shared/primitives/Timestamp'
import { RoleActivated } from '../events/RoleActivated'
import { RoleDeactivated } from '../events/RoleDeactivated'
import { RoleCapabilitiesUpdated } from '../events/RoleCapabilitiesUpdated'

export interface RoleMetadata {
  description?: string
  category?: string
  tags?: string[]
  version?: string
  author?: string
  dependencies?: string[]
  requiredTools?: string[]
}

export interface RoleConfiguration {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  customInstructions?: string[]
}

export class AIRole extends AggregateRoot<RoleId> {
  private name: RoleName
  private capabilities: RoleCapabilities
  private status: RoleStatus
  private readonly createdAt: Timestamp
  private updatedAt: Timestamp
  private activatedAt?: Timestamp
  private deactivatedAt?: Timestamp
  private metadata?: RoleMetadata
  private configuration?: RoleConfiguration
  private usageCount: number = 0
  private lastUsedAt?: Timestamp

  constructor(
    id: RoleId,
    name: RoleName,
    capabilities: RoleCapabilities,
    createdAt: Timestamp,
    updatedAt: Timestamp,
    status: RoleStatus = RoleStatus.inactive(),
    metadata?: RoleMetadata,
    configuration?: RoleConfiguration,
    usageCount: number = 0,
    activatedAt?: Timestamp,
    deactivatedAt?: Timestamp,
    lastUsedAt?: Timestamp
  ) {
    super(id)
    this.name = name
    this.capabilities = capabilities
    this.status = status
    this.createdAt = createdAt
    this.updatedAt = updatedAt
    this.activatedAt = activatedAt
    this.deactivatedAt = deactivatedAt
    this.metadata = metadata
    this.configuration = configuration
    this.usageCount = usageCount
    this.lastUsedAt = lastUsedAt
  }

  /**
   * 创建新的AI角色
   */
  static create(
    name: string,
    capabilities: string[],
    metadata?: RoleMetadata,
    configuration?: RoleConfiguration
  ): AIRole {
    const id = RoleId.generate()
    const roleName = RoleName.create(name)
    const roleCapabilities = RoleCapabilities.create(capabilities)
    const now = Timestamp.now()
    
    return new AIRole(
      id,
      roleName,
      roleCapabilities,
      now,
      now,
      RoleStatus.inactive(),
      metadata,
      configuration
    )
  }

  /**
   * 激活角色
   */
  activate(): void {
    if (this.status.isActive()) {
      return // 已经是激活状态
    }

    // 业务规则：检查角色是否有必要的能力
    if (!this.capabilities.hasAnyCapabilities()) {
      throw new Error('Cannot activate role without capabilities')
    }

    this.status = RoleStatus.active()
    this.activatedAt = Timestamp.now()
    this.updatedAt = Timestamp.now()
    this.usageCount += 1
    this.lastUsedAt = Timestamp.now()

    // 发布领域事件
    this.addDomainEvent(new RoleActivated(
      this.id,
      this.name,
      this.capabilities,
      this.activatedAt
    ))
  }

  /**
   * 停用角色
   */
  deactivate(): void {
    if (!this.status.isActive()) {
      return // 已经是停用状态
    }

    this.status = RoleStatus.inactive()
    this.deactivatedAt = Timestamp.now()
    this.updatedAt = Timestamp.now()

    // 发布领域事件
    this.addDomainEvent(new RoleDeactivated(
      this.id,
      this.name,
      this.deactivatedAt
    ))
  }

  /**
   * 暂停角色
   */
  suspend(): void {
    if (!this.status.isActive()) {
      throw new Error('Cannot suspend inactive role')
    }

    this.status = RoleStatus.suspended()
    this.updatedAt = Timestamp.now()
  }

  /**
   * 恢复角色
   */
  resume(): void {
    if (!this.status.isSuspended()) {
      throw new Error('Cannot resume non-suspended role')
    }

    this.status = RoleStatus.active()
    this.updatedAt = Timestamp.now()
    this.lastUsedAt = Timestamp.now()
  }

  /**
   * 更新能力
   */
  updateCapabilities(capabilities: string[]): void {
    const oldCapabilities = this.capabilities
    this.capabilities = RoleCapabilities.create(capabilities)
    this.updatedAt = Timestamp.now()

    // 发布领域事件
    this.addDomainEvent(new RoleCapabilitiesUpdated(
      this.id,
      oldCapabilities,
      this.capabilities
    ))
  }

  /**
   * 添加能力
   */
  addCapability(capability: string): void {
    if (this.capabilities.hasCapability(capability)) {
      return // 能力已存在
    }

    const currentCapabilities = this.capabilities.getCapabilities()
    this.updateCapabilities([...currentCapabilities, capability])
  }

  /**
   * 移除能力
   */
  removeCapability(capability: string): void {
    if (!this.capabilities.hasCapability(capability)) {
      return // 能力不存在
    }

    const currentCapabilities = this.capabilities.getCapabilities()
    const newCapabilities = currentCapabilities.filter(c => c !== capability)
    this.updateCapabilities(newCapabilities)
  }

  /**
   * 更新元数据
   */
  updateMetadata(metadata: Partial<RoleMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata }
    this.updatedAt = Timestamp.now()
  }

  /**
   * 更新配置
   */
  updateConfiguration(configuration: Partial<RoleConfiguration>): void {
    this.configuration = { ...this.configuration, ...configuration }
    this.updatedAt = Timestamp.now()
  }

  /**
   * 更新角色名称
   */
  updateName(newName: string): void {
    this.name = RoleName.create(newName)
    this.updatedAt = Timestamp.now()
  }

  /**
   * 记录使用
   */
  recordUsage(): void {
    this.usageCount += 1
    this.lastUsedAt = Timestamp.now()
    this.updatedAt = Timestamp.now()
  }

  /**
   * 检查是否可以执行特定任务
   */
  canPerformTask(requiredCapabilities: string[]): boolean {
    if (!this.status.isActive()) {
      return false
    }

    return requiredCapabilities.every(capability => 
      this.capabilities.hasCapability(capability)
    )
  }

  /**
   * 获取激活持续时间（毫秒）
   */
  getActiveDuration(): number | null {
    if (!this.activatedAt || !this.status.isActive()) {
      return null
    }

    const now = Timestamp.now()
    return now.differenceInMs(this.activatedAt)
  }

  /**
   * 检查是否长时间未使用
   */
  isIdleTooLong(maxIdleTimeMs: number): boolean {
    if (!this.lastUsedAt) {
      return false
    }

    const now = Timestamp.now()
    return now.differenceInMs(this.lastUsedAt) > maxIdleTimeMs
  }

  // Getter 方法
  getName(): RoleName { return this.name }
  getCapabilities(): RoleCapabilities { return this.capabilities }
  getStatus(): RoleStatus { return this.status }
  getCreatedAt(): Timestamp { return this.createdAt }
  getUpdatedAt(): Timestamp { return this.updatedAt }
  getActivatedAt(): Timestamp | undefined { return this.activatedAt }
  getDeactivatedAt(): Timestamp | undefined { return this.deactivatedAt }
  getMetadata(): RoleMetadata | undefined { return this.metadata ? { ...this.metadata } : undefined }
  getConfiguration(): RoleConfiguration | undefined { return this.configuration ? { ...this.configuration } : undefined }
  getUsageCount(): number { return this.usageCount }
  getLastUsedAt(): Timestamp | undefined { return this.lastUsedAt }

  /**
   * 检查角色状态
   */
  isActive(): boolean { return this.status.isActive() }
  isInactive(): boolean { return this.status.isInactive() }
  isSuspended(): boolean { return this.status.isSuspended() }
  isError(): boolean { return this.status.isError() }
}