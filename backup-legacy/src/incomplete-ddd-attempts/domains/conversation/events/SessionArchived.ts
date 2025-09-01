/**
 * 会话归档事件
 * 🏗️ DDD重构: 当会话被归档时发布的领域事件
 */

import { SessionId } from '../value-objects/SessionId';

export class SessionArchived {
  public readonly eventType = 'SessionArchived';
  public readonly occurredAt: Date;

  constructor(
    public readonly sessionId: SessionId,
    public readonly title: string,
    public readonly reason?: string
  ) {
    this.occurredAt = new Date();
  }
}