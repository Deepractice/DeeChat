/**
 * 聊天模块类型定义
 * 🎯 单一职责：只管聊天相关的类型，不掺杂其他模块
 */

// === 基础实体 ===
export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
  metadata?: {
    wordCount?: number
    toolExecutions?: any[]
    attachments?: string[]
  }
}

export interface ChatSession {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  messages: ChatMessage[]
  selectedModelId?: string
  isArchived?: boolean
}

// === 服务接口 ===
export interface ChatService {
  // 会话管理
  createSession(title?: string): Promise<{ success: boolean; sessionId?: string; error?: string }>
  listSessions(): Promise<{ success: boolean; sessions?: ChatSession[]; error?: string }>
  getSession(sessionId: string): Promise<{ success: boolean; session?: ChatSession; error?: string }>
  deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }>
  
  // 消息管理
  sendMessage(sessionId: string, content: string): Promise<{ success: boolean; message?: ChatMessage; error?: string }>
  getMessages(sessionId: string): Promise<{ success: boolean; messages?: ChatMessage[]; error?: string }>
}

// === 仓储接口 ===
export interface ChatRepository {
  // 简单的CRUD，不搞复杂的
  saveSessions(sessions: ChatSession[]): Promise<void>
  loadSessions(): Promise<ChatSession[]>
  saveSession(session: ChatSession): Promise<void>
  deleteSession(sessionId: string): Promise<void>
}

// === 请求/响应类型 ===
export interface SendMessageRequest {
  content: string
  sessionId: string
  attachments?: string[]
  metadata?: Record<string, any>
}

export interface SendMessageResponse {
  success: boolean
  message?: ChatMessage
  error?: string
}