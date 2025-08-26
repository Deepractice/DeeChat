/**
 * Conversation Domain 导出
 * 🏗️ DDD重构: Conversation领域的公共API
 */

// 实体
export * from './entities/Message';
export * from './entities/ChatSession';

// 值对象
export * from './value-objects/SessionId';
export * from './value-objects/MessageId';
export * from './value-objects/MessageContent';

// 仓储接口
export * from './repositories/ISessionRepository';
export * from './repositories/IMessageRepository';

// 领域服务
export * from './services/ConversationService';

// 领域事件
export * from './events/ConversationStarted';
export * from './events/MessageSent';
export * from './events/MessageReceived';
export * from './events/SessionArchived';