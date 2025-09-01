/**
 * 对话开始事件
 * 🏗️ DDD重构: 当新的对话会话开始时发布的领域事件
 */

import { SessionId } from '../value-objects/SessionId';

export class ConversationStarted {
  public readonly eventType = 'ConversationStarted';
  public readonly occurredAt: Date;

  constructor(
    public readonly sessionId: SessionId,
    public readonly title: string,
    public readonly modelConfig: string,
    public readonly activeRole?: string
  ) {
    this.occurredAt = new Date();
  }
}