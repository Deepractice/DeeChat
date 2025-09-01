/**
 * 消息实体 - 最核心的业务对象
 * 
 * 这就是一个简单的消息，包含：
 * - 消息ID、会话ID
 * - 角色（用户/AI助手）
 * - 消息内容
 * - 创建时间
 */

import { Entity } from '../../shared/primitives/Entity'
import { UniqueEntityID } from '../../../domain/shared/primitives/UniqueEntityID'
import { MessageContent } from '../value-objects/MessageContent'
import { SessionId } from '../value-objects/SessionId'

export interface IMessageProps {
  sessionId: SessionId
  role: 'user' | 'assistant' | 'system'
  content: MessageContent
  createdAt: Date
  metadata?: Record<string, any>
}

export class Message extends Entity<IMessageProps> {
  private constructor(props: IMessageProps, id?: UniqueEntityID) {
    super(props, id)
  }

  // 工厂方法 - 创建新消息
  public static create(props: IMessageProps, id?: UniqueEntityID): Message {
    // 简单的业务规则检查
    if (!props.content || props.content.getValue().trim().length === 0) {
      throw new Error('消息内容不能为空')
    }

    if (props.content.getValue().length > 10000) {
      throw new Error('消息内容不能超过10000字符')
    }

    return new Message(props, id)
  }

  // 获取器方法 - 暴露必要的属性
  get sessionId(): SessionId {
    return this.props.sessionId
  }

  get role(): string {
    return this.props.role
  }

  get content(): MessageContent {
    return this.props.content
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get metadata(): Record<string, any> | undefined {
    return this.props.metadata
  }

  // 业务方法 - 消息相关的业务逻辑
  public isFromUser(): boolean {
    return this.props.role === 'user'
  }

  public isFromAssistant(): boolean {
    return this.props.role === 'assistant'
  }

  public getWordCount(): number {
    return this.props.content.getValue().split(/\s+/).length
  }
}