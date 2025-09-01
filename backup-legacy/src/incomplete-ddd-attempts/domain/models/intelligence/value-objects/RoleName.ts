/**
 * 角色名称值对象
 */

import { ValueObject } from '../../../core/ValueObject'

export class RoleName extends ValueObject {
  private constructor(private readonly value: string) {
    super()
    this.validate()
  }

  /**
   * 创建角色名称
   */
  static create(name: string): RoleName {
    return new RoleName(name)
  }

  /**
   * 获取名称值
   */
  getValue(): string {
    return this.value
  }

  /**
   * 获取显示名称（格式化后的名称）
   */
  getDisplayName(): string {
    return this.value.charAt(0).toUpperCase() + this.value.slice(1)
  }

  /**
   * 获取kebab-case格式
   */
  getKebabCase(): string {
    return this.value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  /**
   * 名称相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof RoleName)) return false
    return this.value === other.value
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return this.value
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.value
  }

  /**
   * 检查是否为系统预定义角色
   */
  isSystemRole(): boolean {
    const systemRoles = [
      'assistant',
      'java-developer',
      'python-developer',
      'frontend-developer',
      'product-manager',
      'architect',
      'ui-designer',
      'data-analyst',
      'devops-engineer',
      'copywriter'
    ]
    
    return systemRoles.includes(this.getKebabCase())
  }

  /**
   * 检查是否为用户自定义角色
   */
  isCustomRole(): boolean {
    return !this.isSystemRole()
  }

  /**
   * 验证角色名称
   */
  protected validate(): void {
    if (!this.value || this.value.trim().length === 0) {
      throw new Error('Role name cannot be empty')
    }

    if (this.value.length < 2) {
      throw new Error('Role name must be at least 2 characters long')
    }

    if (this.value.length > 50) {
      throw new Error('Role name cannot be longer than 50 characters')
    }

    // 检查是否包含特殊字符（允许字母、数字、空格、连字符、下划线）
    const validPattern = /^[a-zA-Z0-9\s\-_\u4e00-\u9fff]+$/
    if (!validPattern.test(this.value)) {
      throw new Error('Role name contains invalid characters')
    }

    // 不允许纯数字
    if (/^\d+$/.test(this.value.trim())) {
      throw new Error('Role name cannot be purely numeric')
    }

    // 不允许以空格开头或结尾
    if (this.value !== this.value.trim()) {
      throw new Error('Role name cannot start or end with whitespace')
    }
  }
}