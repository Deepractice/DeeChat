/**
 * 会话ID值对象
 */

import { Id } from '../../../shared/primitives/Id'

export class SessionId extends Id {
  private constructor(value: string) {
    super(value)
  }

  /**
   * 从字符串创建SessionId
   */
  static fromString(value: string): SessionId {
    return new SessionId(value)
  }

  /**
   * 生成新的SessionId
   */
  static generate(): SessionId {
    return new SessionId(Id.generateUUID())
  }

  /**
   * 验证SessionId格式
   */
  protected validate(): void {
    super.validate()
    
    // SessionId应该是UUID格式或者时间戳格式
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.value)
    const isTimestamp = /^\d{13}$/.test(this.value)
    
    if (!isUUID && !isTimestamp) {
      throw new Error('SessionId must be a valid UUID or timestamp')
    }
  }
}