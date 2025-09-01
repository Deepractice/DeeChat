import { Id } from '../../../domain/shared/primitives/Id'

/**
 * 会话ID值对象
 * 确保会话ID的唯一性和类型安全
 */
export class SessionId extends Id {
  private constructor(value: string) {
    super(value)
  }

  static create(value?: string): SessionId {
    return new SessionId(value || this.generateUuid())
  }

  static of(value: string): SessionId {
    if (!value || value.trim().length === 0) {
      throw new Error('SessionId cannot be empty')
    }
    return new SessionId(value)
  }

  private static generateUuid(): string {
    return 'session_' + Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}