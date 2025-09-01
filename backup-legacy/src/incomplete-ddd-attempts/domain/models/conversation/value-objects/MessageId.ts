/**
 * 消息ID值对象
 */

import { Id } from '../../../shared/primitives/Id'

export class MessageId extends Id {
  private constructor(value: string) {
    super(value)
  }

  /**
   * 从字符串创建MessageId
   */
  static fromString(value: string): MessageId {
    return new MessageId(value)
  }

  /**
   * 生成新的MessageId
   */
  static generate(): MessageId {
    return new MessageId(Id.generateTimestamp() + '-' + Math.random().toString(36).substr(2, 9))
  }

  /**
   * 验证MessageId格式
   */
  protected validate(): void {
    super.validate()
    
    // MessageId可以是各种格式：UUID、时间戳、组合格式等
    // 这里主要验证基本规则，不限制具体格式
  }
}