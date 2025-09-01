/**
 * 消息发送事件
 * 🏗️ DDD重构: 当用户发送消息时发布的领域事件
 */

import { MessageId } from '../value-objects/MessageId';
import { SessionId } from '../value-objects/SessionId';
import { MessageRole } from '../entities/Message';

export class MessageSent {
  public readonly eventType = 'MessageSent';
  public readonly occurredAt: Date;

  constructor(
    public readonly messageId: MessageId,
    public readonly sessionId: SessionId,
    public readonly role: MessageRole,
    public readonly contentPreview: string,
    public readonly hasAttachments: boolean = false
  ) {
    this.occurredAt = new Date();
  }
}