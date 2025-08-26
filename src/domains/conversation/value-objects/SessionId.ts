/**
 * 会话ID值对象
 * 🏗️ DDD重构: 强类型化的会话标识符
 */

export class SessionId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === '') {
      throw new Error('SessionId不能为空');
    }
    
    if (value.length < 8) {
      throw new Error('SessionId长度不能少于8位');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  /**
   * 获取短格式ID（用于显示）
   */
  get shortId(): string {
    return this._value.substring(0, 8);
  }

  /**
   * 检查是否为有效的会话ID格式
   */
  isValid(): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(this._value) && this._value.length >= 8;
  }

  equals(other: SessionId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * 静态工厂方法：生成新的会话ID
   */
  static generate(): SessionId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return new SessionId(`session_${timestamp}_${random}`);
  }

  /**
   * 静态工厂方法：从字符串创建
   */
  static fromString(value: string): SessionId {
    return new SessionId(value);
  }
}