import { ValueObject } from '../../../domain/core/ValueObject'

interface MessageRoleProps {
  value: 'user' | 'assistant' | 'system'
}

/**
 * 消息角色值对象
 * 确保消息角色的类型安全和业务规则
 */
export class MessageRole extends ValueObject<MessageRoleProps> {
  private constructor(props: MessageRoleProps) {
    super(props)
  }

  static user(): MessageRole {
    return new MessageRole({ value: 'user' })
  }

  static assistant(): MessageRole {
    return new MessageRole({ value: 'assistant' })
  }

  static system(): MessageRole {
    return new MessageRole({ value: 'system' })
  }

  static of(role: string): MessageRole {
    switch (role) {
      case 'user':
        return MessageRole.user()
      case 'assistant':
        return MessageRole.assistant()
      case 'system':
        return MessageRole.system()
      default:
        throw new Error(`Invalid message role: ${role}`)
    }
  }

  get value(): 'user' | 'assistant' | 'system' {
    return this.props.value
  }

  isUser(): boolean {
    return this.props.value === 'user'
  }

  isAssistant(): boolean {
    return this.props.value === 'assistant'
  }

  isSystem(): boolean {
    return this.props.value === 'system'
  }

  canBeEditedByUser(): boolean {
    return this.props.value === 'user'
  }
}