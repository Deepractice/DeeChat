/**
 * 工具ID值对象
 * 🏗️ DDD重构: 强类型化的工具标识符
 */

export class ToolId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === '') {
      throw new Error('ToolId不能为空');
    }
    
    if (!value.includes(':')) {
      throw new Error('ToolId必须包含serverId和toolName，格式为 serverId:toolName');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  get serverId(): string {
    return this._value.split(':')[0];
  }

  get toolName(): string {
    return this._value.split(':')[1];
  }

  equals(other: ToolId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  static create(serverId: string, toolName: string): ToolId {
    return new ToolId(`${serverId}:${toolName}`);
  }
}