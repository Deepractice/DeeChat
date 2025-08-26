/**
 * 角色ID值对象
 * 🏗️ DDD重构: 强类型化的角色标识符
 */

export class RoleId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === '') {
      throw new Error('RoleId不能为空');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: RoleId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static fromString(value: string): RoleId {
    return new RoleId(value);
  }

  static default(): RoleId {
    return new RoleId('deechat-assistant');
  }
}