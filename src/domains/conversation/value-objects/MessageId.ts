/**
 * 消息ID值对象
 * 🏗️ DDD重构: 强类型化的消息标识符
 */

export class MessageId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === '') {
      throw new Error('MessageId不能为空');
    }
    
    this._value = value;
  }

  get value(): string {
    return this._value;
  }

  /**
   * 获取短格式ID（用于显示和调试）
   */
  get shortId(): string {
    return this._value.length > 12 ? this._value.substring(0, 12) + '...' : this._value;
  }

  equals(other: MessageId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * 静态工厂方法：生成新的消息ID
   */
  static generate(): MessageId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return new MessageId(`msg_${timestamp}_${random}`);
  }

  /**
   * 静态工厂方法：从字符串创建
   */
  static fromString(value: string): MessageId {
    return new MessageId(value);
  }
}