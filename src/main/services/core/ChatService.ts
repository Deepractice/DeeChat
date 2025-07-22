import { app } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { ChatSession, ChatMessage } from '../../../shared/types/index'

export class ChatService {
  private dataPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dataPath = join(userDataPath, 'chat-data.json')
    console.log('📁 ChatService数据文件路径:', this.dataPath)
  }

  async getChatHistory(): Promise<ChatSession[]> {
    try {
      const data = await fs.readFile(this.dataPath, 'utf-8')
      const sessions = JSON.parse(data)
      return Array.isArray(sessions) ? sessions : []
    } catch (error: any) {
      // 如果文件不存在，返回空数组
      if (error.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }

  async saveChatHistory(sessions: ChatSession[]): Promise<void> {
    try {
      // 确保目录存在
      const userDataPath = app.getPath('userData')
      await fs.mkdir(userDataPath, { recursive: true })
      
      // 保存聊天历史
      await fs.writeFile(this.dataPath, JSON.stringify(sessions, null, 2), 'utf-8')
    } catch (error) {
      console.error('保存聊天历史失败:', error)
      throw error
    }
  }

  async saveMessage(_message: ChatMessage): Promise<void> {
    try {
      const sessions = await this.getChatHistory()
      // 这里可以实现更复杂的消息保存逻辑
      // 目前简单地保存整个会话列表
      await this.saveChatHistory(sessions)
    } catch (error) {
      console.error('保存消息失败:', error)
      throw error
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getChatHistory()
      const filteredSessions = sessions.filter(session => session.id !== sessionId)
      await this.saveChatHistory(filteredSessions)
    } catch (error) {
      console.error('删除会话失败:', error)
      throw error
    }
  }

  async clearAllHistory(): Promise<void> {
    try {
      await fs.unlink(this.dataPath)
    } catch (error: any) {
      // 如果文件不存在，忽略错误
      if (error.code !== 'ENOENT') {
        throw error
      }
    }
  }
}
