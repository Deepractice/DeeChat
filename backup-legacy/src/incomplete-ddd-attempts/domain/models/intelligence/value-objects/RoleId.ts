/**
 * 角色ID值对象
 */

import { Id } from '../../../shared/primitives/Id'

export class RoleId extends Id {
  private constructor(value: string) {
    super(value)
  }

  /**
   * 从字符串创建RoleId
   */
  static fromString(value: string): RoleId {
    return new RoleId(value)
  }

  /**
   * 生成新的RoleId
   */
  static generate(): RoleId {
    return new RoleId(Id.generateUUID())
  }

  /**
   * 从角色名称创建RoleId（用于预定义角色）
   */
  static fromRoleName(roleName: string): RoleId {
    // 将角色名称转换为kebab-case格式作为ID
    const id = roleName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // 移除特殊字符
      .replace(/\s+/g, '-') // 空格替换为连字符
      .replace(/-+/g, '-') // 多个连字符合并为一个
      .replace(/^-|-$/g, '') // 移除开头和结尾的连字符
    
    return new RoleId(id)
  }

  /**
   * 验证RoleId格式
   */
  protected validate(): void {
    super.validate()
    
    // RoleId可以是UUID格式或kebab-case格式
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.value)
    const isKebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(this.value)
    
    if (!isUUID && !isKebabCase) {
      throw new Error('RoleId must be a valid UUID or kebab-case format')
    }

    if (this.value.length > 50) {
      throw new Error('RoleId cannot be longer than 50 characters')
    }
  }
}