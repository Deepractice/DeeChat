/**
 * 消息接收事件
 * 🏗️ DDD重构: 当接收到AI助手消息时发布的领域事件
 */

import { MessageId } from '../value-objects/MessageId';
import { SessionId } from '../value-objects/SessionId';
import { MessageRole } from '../entities/Message';

export class MessageReceived {
  public readonly eventType = 'MessageReceived';
  public readonly occurredAt: Date;

  constructor(
    public readonly messageId: MessageId,
    public readonly sessionId: SessionId,
    public readonly role: MessageRole,
    public readonly contentPreview: string,
    public readonly toolExecutionsCount: number = 0
  ) {
    this.occurredAt = new Date();
  }
}