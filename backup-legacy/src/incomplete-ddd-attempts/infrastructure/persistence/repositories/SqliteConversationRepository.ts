/**
 * SQLite 对话仓储实现
 * 实现对话领域的持久化操作
 */

import { Database } from 'sqlite3'
import { ChatSession, SessionId } from '../../../domain/conversation/entities/ChatSession'
import { Message, MessageId } from '../../../domain/conversation/entities/Message'
import { ISessionRepository } from '../../../domain/conversation/repositories/ISessionRepository'
import { IMessageRepository } from '../../../domain/conversation/repositories/IMessageRepository'
import { MessageContent } from '../../../domain/conversation/value-objects/MessageContent'
import { Result } from '../../../domain/shared/primitives/Result'

export class SqliteConversationRepository implements ISessionRepository, IMessageRepository {
  constructor(
    private readonly database: Database
  ) {}

  // Session Repository 实现
  async save(session: ChatSession): Promise<Result<void, Error>> {
    try {
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO chat_sessions (
          id, title, created_at, updated_at, archived, user_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)

      await new Promise<void>((resolve, reject) => {
        stmt.run([
          session.getId().getValue(),
          session.getTitle(),
          session.getCreatedAt().toISOString(),
          session.getUpdatedAt().toISOString(),
          session.isArchived() ? 1 : 0,
          session.getUserId() || null
        ], (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      stmt.finalize()
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to save session: ${error.message}`))
    }
  }

  async findById(sessionId: SessionId): Promise<Result<ChatSession | null, Error>> {
    try {
      const row = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT * FROM chat_sessions WHERE id = ?',
          [sessionId.getValue()],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      if (!row) {
        return Result.success(null)
      }

      const session = this.mapRowToSession(row)
      return Result.success(session)
    } catch (error) {
      return Result.error(new Error(`Failed to find session: ${error.message}`))
    }
  }

  async findByUserId(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<Result<ChatSession[], Error>> {
    try {
      const offset = (page - 1) * limit
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM chat_sessions 
           WHERE user_id = ? AND archived = 0 
           ORDER BY updated_at DESC 
           LIMIT ? OFFSET ?`,
          [userId, limit, offset],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const sessions = rows.map(row => this.mapRowToSession(row))
      return Result.success(sessions)
    } catch (error) {
      return Result.error(new Error(`Failed to find sessions by user: ${error.message}`))
    }
  }

  async delete(sessionId: SessionId): Promise<Result<void, Error>> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM chat_sessions WHERE id = ?',
          [sessionId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      // 同时删除相关消息
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM chat_messages WHERE session_id = ?',
          [sessionId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to delete session: ${error.message}`))
    }
  }

  // Message Repository 实现
  async saveMessage(message: Message): Promise<Result<void, Error>> {
    try {
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO chat_messages (
          id, session_id, content, role, timestamp, token_count, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      await new Promise<void>((resolve, reject) => {
        stmt.run([
          message.getId().getValue(),
          message.getSessionId().getValue(),
          message.getContent().getValue(),
          message.getRole(),
          message.getTimestamp().toISOString(),
          message.getTokenCount() || 0,
          message.getUserId() || null
        ], (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      stmt.finalize()
      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to save message: ${error.message}`))
    }
  }

  async findMessageById(messageId: MessageId): Promise<Result<Message | null, Error>> {
    try {
      const row = await new Promise<any>((resolve, reject) => {
        this.database.get(
          'SELECT * FROM chat_messages WHERE id = ?',
          [messageId.getValue()],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      if (!row) {
        return Result.success(null)
      }

      const message = this.mapRowToMessage(row)
      return Result.success(message)
    } catch (error) {
      return Result.error(new Error(`Failed to find message: ${error.message}`))
    }
  }

  async findMessagesBySessionId(
    sessionId: SessionId,
    page: number = 1,
    limit: number = 50
  ): Promise<Result<Message[], Error>> {
    try {
      const offset = (page - 1) * limit
      const rows = await new Promise<any[]>((resolve, reject) => {
        this.database.all(
          `SELECT * FROM chat_messages 
           WHERE session_id = ? 
           ORDER BY timestamp ASC 
           LIMIT ? OFFSET ?`,
          [sessionId.getValue(), limit, offset],
          (error, rows) => {
            if (error) reject(error)
            else resolve(rows || [])
          }
        )
      })

      const messages = rows.map(row => this.mapRowToMessage(row))
      return Result.success(messages)
    } catch (error) {
      return Result.error(new Error(`Failed to find messages: ${error.message}`))
    }
  }

  async deleteMessage(messageId: MessageId): Promise<Result<void, Error>> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.database.run(
          'DELETE FROM chat_messages WHERE id = ?',
          [messageId.getValue()],
          (error) => {
            if (error) reject(error)
            else resolve()
          }
        )
      })

      return Result.success()
    } catch (error) {
      return Result.error(new Error(`Failed to delete message: ${error.message}`))
    }
  }

  async getSessionStatistics(sessionId: SessionId): Promise<Result<{
    messageCount: number
    totalTokens: number
    lastMessageTime: Date | null
  }, Error>> {
    try {
      const stats = await new Promise<any>((resolve, reject) => {
        this.database.get(
          `SELECT 
             COUNT(*) as message_count,
             SUM(token_count) as total_tokens,
             MAX(timestamp) as last_message_time
           FROM chat_messages 
           WHERE session_id = ?`,
          [sessionId.getValue()],
          (error, row) => {
            if (error) reject(error)
            else resolve(row)
          }
        )
      })

      return Result.success({
        messageCount: stats.message_count || 0,
        totalTokens: stats.total_tokens || 0,
        lastMessageTime: stats.last_message_time ? new Date(stats.last_message_time) : null
      })
    } catch (error) {
      return Result.error(new Error(`Failed to get statistics: ${error.message}`))
    }
  }

  /**
   * 将数据库行映射为会话实体
   */
  private mapRowToSession(row: any): ChatSession {
    return ChatSession.create({
      id: SessionId.create(row.id).getValue(),
      title: row.title,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      archived: Boolean(row.archived)
    }).getValue()
  }

  /**
   * 将数据库行映射为消息实体
   */
  private mapRowToMessage(row: any): Message {
    return Message.create({
      id: MessageId.create(row.id).getValue(),
      sessionId: SessionId.create(row.session_id).getValue(),
      content: MessageContent.create(row.content).getValue(),
      role: row.role as 'user' | 'assistant' | 'system',
      timestamp: new Date(row.timestamp),
      tokenCount: row.token_count,
      userId: row.user_id
    }).getValue()
  }
}