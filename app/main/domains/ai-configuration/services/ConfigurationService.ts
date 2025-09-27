/**
 * 配置管理服务
 *
 * 职责：
 * - 管理AI配置的生命周期（创建、查询、更新、删除）
 * - 提供AI配置的业务规则验证
 * - 处理配置相关的业务逻辑
 */

import {
  AIConfigManager,
  CreateAIConfigInput,
  UpdateAIConfigInput,
  AIConfig
} from '@deepracticex/ai-config'

export class ConfigurationService {
  constructor(private aiConfigManager: AIConfigManager) {}

  /**
   * 创建新的用户AI配置
   *
   * 业务流程：
   * 1. 验证用户输入的合法性
   * 2. 检查配置名称是否重复
   * 3. 调用底层API创建配置
   * 4. 记录操作日志
   *
   * @param input 创建AI配置的输入参数
   * @returns 创建成功的AI配置对象
   * @throws {Error} 验证失败、重复配置或创建过程出错
   */
  async createConfiguration(input: CreateAIConfigInput): Promise<AIConfig> {
    try {
      // 1. 业务规则验证：确保输入参数符合业务要求
      this.validateConfigurationInput(input)

      // 2. 业务规则验证：检查配置名称唯一性
      await this.checkDuplicateConfiguration(input.name)

      // 3. 委托给AI配置管理器创建配置
      const result = await this.aiConfigManager.configs.create(input)

      console.log(`✅ 用户AI配置创建成功: ${input.name}`)
      return result
    } catch (error: any) {
      console.error('❌ 创建AI配置失败:', error)
      throw error
    }
  }

  /**
   * 获取所有用户AI配置列表
   *
   * @returns AI配置对象数组
   */
  async getAllConfigurations(): Promise<AIConfig[]> {
    return await this.aiConfigManager.configs.findAll()
  }

  /**
   * 更新用户AI配置
   *
   * 业务流程：
   * 1. 验证配置ID是否存在
   * 2. 如果更新配置名称，检查新名称是否重复
   * 3. 调用底层API更新配置
   * 4. 记录操作日志
   *
   * @param id 配置ID
   * @param input 更新AI配置的输入参数
   * @returns 更新后的AI配置对象
   * @throws {Error} 配置不存在、验证失败或更新过程出错
   */
  async updateConfiguration(id: number, input: UpdateAIConfigInput): Promise<AIConfig> {
    try {
      // 1. 业务规则验证：检查配置是否存在
      const existingConfig = await this.aiConfigManager.configs.findById(id)
      if (!existingConfig) {
        throw new Error(`配置ID ${id} 不存在`)
      }

      // 2. 业务规则验证：如果要更新名称，检查新名称是否重复
      if (input.name && input.name !== existingConfig.name) {
        const duplicateConfig = await this.aiConfigManager.configs.findByName(input.name)
        if (duplicateConfig && duplicateConfig.id !== id) {
          throw new Error(`配置名称 "${input.name}" 已存在`)
        }
      }

      // 3. 委托给AI配置管理器更新配置
      const result = await this.aiConfigManager.configs.update(id, input)

      console.log(`✅ 用户AI配置更新成功: ID ${id} (${input.name || existingConfig.name})`)
      return result
    } catch (error: any) {
      console.error('❌ 更新AI配置失败:', error)
      throw error
    }
  }

  /**
   * 删除用户AI配置
   *
   * 业务流程：
   * 1. 验证配置是否可以删除（如不能删除默认配置）
   * 2. 根据参数类型选择合适的删除方式
   * 3. 执行删除操作并记录日志
   *
   * @param nameOrId 配置名称或ID
   * @throws {Error} 配置不存在、不允许删除或删除过程出错
   */
  async removeConfiguration(nameOrId: string | number): Promise<void> {
    try {
      // 1. 业务规则验证：检查是否允许删除此配置
      await this.validateConfigurationDeletion(nameOrId)

      // 2. 根据参数类型执行不同的删除逻辑
      if (typeof nameOrId === 'number') {
        // 按ID删除
        await this.aiConfigManager.configs.delete(nameOrId)
      } else {
        // 按名称删除：先查找配置，再删除
        const config = await this.aiConfigManager.configs.findByName(nameOrId)
        if (config) {
          await this.aiConfigManager.configs.delete(config.id)
        } else {
          throw new Error(`配置 "${nameOrId}" 不存在`)
        }
      }

      console.log(`✅ AI配置删除成功: ${nameOrId}`)
    } catch (error: any) {
      console.error('❌ 删除AI配置失败:', error)
      throw error
    }
  }

  /**
   * 获取指定的用户AI配置
   *
   * 支持三种获取方式：
   * - 不传参数：返回默认配置
   * - 传入数字：按ID查找
   * - 传入字符串：按名称查找
   *
   * @param nameOrId 可选的配置名称或ID
   * @returns AI配置对象，不存在时返回null
   * @throws {Error} 查询过程出错
   */
  async getConfiguration(nameOrId?: string | number): Promise<AIConfig | null> {
    try {
      if (!nameOrId) {
        // 获取系统默认配置
        return await this.aiConfigManager.configs.findDefault()
      } else if (typeof nameOrId === 'number') {
        // 根据数字ID获取配置
        return await this.aiConfigManager.configs.findById(nameOrId)
      } else {
        // 根据字符串名称获取配置
        return await this.aiConfigManager.configs.findByName(nameOrId)
      }
    } catch (error: any) {
      console.error('❌ 获取AI配置失败:', error)
      throw error
    }
  }

  // ============ 私有辅助方法 ============

  /**
   * 验证配置输入参数
   *
   * 提供业务层面的验证规则，补充底层包的基础验证
   * （底层ai-config包已包含zod验证，此处主要关注业务规则）
   *
   * @param input 配置输入参数
   * @throws {Error} 验证失败时抛出错误
   * @private
   */
  private validateConfigurationInput(input: CreateAIConfigInput): void {
    // 业务规则：配置名称长度限制
    if (input.name.length > 100) {
      throw new Error('配置名称不能超过100个字符')
    }
    // 注意：底层ai-config包已经包含完整的zod验证
    // 这里只需要添加特定的业务层面验证规则
  }

  /**
   * 检查配置名称是否重复
   *
   * @param name 配置名称
   * @throws {Error} 配置名称已存在时抛出错误
   * @private
   */
  private async checkDuplicateConfiguration(name: string): Promise<void> {
    try {
      const existing = await this.aiConfigManager.configs.findByName(name)
      if (existing) {
        throw new Error(`配置 "${name}" 已存在`)
      }
    } catch (error: any) {
      // 如果是重复性错误，需要向上抛出给调用方
      if (error.message.includes('已存在')) {
        throw error
      }
      // 其他错误（如配置不存在）是正常情况，忽略处理
    }
  }

  /**
   * 验证配置是否可以删除
   *
   * 实施删除业务规则：
   * - 配置必须存在
   * - 不能删除默认配置
   *
   * @param nameOrId 配置名称或ID
   * @throws {Error} 配置不存在或不允许删除时抛出错误
   * @private
   */
  private async validateConfigurationDeletion(nameOrId: string | number): Promise<void> {
    let config: AIConfig | null = null

    // 根据参数类型选择查找方式
    if (typeof nameOrId === 'number') {
      config = await this.aiConfigManager.configs.findById(nameOrId)
    } else {
      config = await this.aiConfigManager.configs.findByName(nameOrId)
    }

    // 业务规则：配置必须存在
    if (!config) {
      throw new Error(`配置 "${nameOrId}" 不存在`)
    }

    // 业务规则：不允许删除默认配置
    if (config.is_default) {
      throw new Error('不能删除默认配置，请先设置其他配置为默认')
    }
  }
}