/**
 * Conversation Domain 统一导出
 */

// 实体
export { ChatSession } from './entities/ChatSession'
export { Message } from './entities/Message'

// 值对象
export { SessionId } from './value-objects/SessionId'
export { SessionTitle } from './value-objects/SessionTitle'
export { MessageId } from './value-objects/MessageId'
export { MessageContent } from './value-objects/MessageContent'
export { MessageRole } from './value-objects/MessageRole'

// 事件
export { MessageAdded } from './events/MessageAdded'
export { SessionTitleUpdated } from './events/SessionTitleUpdated'
export { ModelSwitched } from './events/ModelSwitched'

// 仓储接口
export { ISessionRepository, SessionSearchCriteria, SessionListOptions } from './repositories/ISessionRepository'

// 领域服务
export { ConversationDomainService } from './services/ConversationDomainService'

// 类型定义
export type { SessionMetadata, SessionPreferences } from './entities/ChatSession'
export type { MessageMetadata } from './entities/Message'