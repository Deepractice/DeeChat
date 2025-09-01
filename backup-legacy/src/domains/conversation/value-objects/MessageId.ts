import { Id } from '../../../domain/shared/primitives/Id'

/**
 * 消息ID值对象
 * 确保消息ID的唯一性和类型安全
 */
export class MessageId extends Id {
  private constructor(value: string) {
    super(value)
  }

  static create(): MessageId {
    return new MessageId(this.generateUuid())
  }

  static of(value: string): MessageId {
    if (!value || value.trim().length === 0) {
      throw new Error('MessageId cannot be empty')
    }
    return new MessageId(value)
  }

  private static generateUuid(): string {
    return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  }
}