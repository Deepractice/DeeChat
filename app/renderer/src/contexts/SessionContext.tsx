import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { message } from 'antd'
import type {
  ConversationSession,
  ConversationMessage,
  AIConfig
} from '../../../main/preload'

// SessionContext 接口定义
interface SessionContextType {
  // 最小前端状态 - 只保存必要信息
  currentSessionId: string | null
  loading: boolean

  // 会话操作方法 - 直接调用后端
  createSession: (params: {
    title?: string
    model?: string
    systemPrompt?: string
    maxTokens?: number
  }) => Promise<ConversationSession | null>

  selectSession: (sessionId: string | null) => void

  updateSessionTitle: (sessionId: string, newTitle: string) => Promise<boolean>

  deleteSession: (sessionId: string) => Promise<boolean>

  // 数据获取方法 - 实时从后端获取
  getSessions: () => Promise<ConversationSession[]>

  getCurrentSession: () => Promise<ConversationSession | null>

  getMessages: (sessionId: string) => Promise<ConversationMessage[]>

  // 刷新方法
  refreshCurrentSession: () => Promise<ConversationSession | null>
}

// 创建 Context
const SessionContext = createContext<SessionContextType | null>(null)

// Context Provider 组件
interface SessionProviderProps {
  children: ReactNode
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  // 最小状态管理
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // 创建会话
  const createSession = useCallback(async (params: {
    title?: string
    model?: string
    systemPrompt?: string
    maxTokens?: number
  }): Promise<ConversationSession | null> => {
    try {
      setLoading(true)
      console.log('🆕 创建新会话:', params)

      const sessionInput = {
        title: params.title || `新对话 ${new Date().toLocaleString()}`,
        model: params.model || '',
        systemPrompt: params.systemPrompt || '',
        maxTokens: params.maxTokens || 4000
      }

      const result = await window.electronAPI.conversation.createSession(sessionInput)

      if (result.success && result.data) {
        const newSession = result.data
        setCurrentSessionId(newSession.id)
        console.log('✅ 会话创建成功:', newSession)
        return newSession
      } else {
        console.error('❌ 创建会话失败:', result.error)
        message.error(`创建会话失败: ${result.error || '未知错误'}`)
        return null
      }
    } catch (error: any) {
      console.error('💥 创建会话异常:', error)
      message.error(`创建会话异常: ${error?.message || error}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // 选择会话
  const selectSession = useCallback((sessionId: string | null) => {
    console.log('🎯 选择会话:', sessionId)
    setCurrentSessionId(sessionId)
  }, [])

  // 更新会话标题
  const updateSessionTitle = useCallback(async (sessionId: string, newTitle: string): Promise<boolean> => {
    try {
      setLoading(true)
      console.log('📝 更新会话标题:', { sessionId, newTitle })

      const result = await window.electronAPI.conversation.updateSessionTitle(sessionId, newTitle)

      if (result.success) {
        console.log('✅ 会话标题更新成功')
        message.success('会话标题已更新')
        return true
      } else {
        console.error('❌ 更新会话标题失败:', result.error)
        message.error(`更新标题失败: ${result.error || '未知错误'}`)
        return false
      }
    } catch (error: any) {
      console.error('💥 更新会话标题异常:', error)
      message.error(`更新标题异常: ${error?.message || error}`)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  // 删除会话
  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setLoading(true)
      console.log('🗑️ 删除会话:', sessionId)

      const result = await window.electronAPI.conversation.deleteSession(sessionId)

      if (result.success) {
        console.log('✅ 会话删除成功')
        // 如果删除的是当前会话，清空选择
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null)
        }
        message.success('会话已删除')
        return true
      } else {
        console.error('❌ 删除会话失败:', result.error)
        message.error(`删除会话失败: ${result.error || '未知错误'}`)
        return false
      }
    } catch (error: any) {
      console.error('💥 删除会话异常:', error)
      message.error(`删除会话异常: ${error?.message || error}`)
      return false
    } finally {
      setLoading(false)
    }
  }, [currentSessionId])

  // 获取会话列表
  const getSessions = useCallback(async (): Promise<ConversationSession[]> => {
    try {
      console.log('📋 获取会话列表')
      const result = await window.electronAPI.conversation.getSessions()

      if (result.success && result.data) {
        console.log('✅ 会话列表获取成功:', result.data.length, '个会话')
        return result.data
      } else {
        console.error('❌ 获取会话列表失败:', result.error)
        return []
      }
    } catch (error: any) {
      console.error('💥 获取会话列表异常:', error)
      return []
    }
  }, [])

  // 获取当前会话信息
  const getCurrentSession = useCallback(async (): Promise<ConversationSession | null> => {
    if (!currentSessionId) {
      return null
    }

    try {
      console.log('📖 获取当前会话信息:', currentSessionId)
      const sessions = await getSessions()
      const currentSession = sessions.find(s => s.id === currentSessionId) || null

      if (currentSession) {
        console.log('✅ 当前会话信息:', currentSession)
      } else {
        console.log('⚠️ 未找到当前会话，可能已被删除')
        setCurrentSessionId(null)
      }

      return currentSession
    } catch (error: any) {
      console.error('💥 获取当前会话异常:', error)
      return null
    }
  }, [currentSessionId, getSessions])

  // 获取消息列表
  const getMessages = useCallback(async (sessionId: string): Promise<ConversationMessage[]> => {
    try {
      console.log('💬 获取消息列表:', sessionId)
      const result = await window.electronAPI.conversation.getMessageHistory(sessionId)

      if (result.success && result.data) {
        console.log('✅ 消息列表获取成功:', result.data.length, '条消息')
        return result.data
      } else {
        console.error('❌ 获取消息列表失败:', result.error)
        return []
      }
    } catch (error: any) {
      console.error('💥 获取消息列表异常:', error)
      return []
    }
  }, [])

  // 刷新当前会话
  const refreshCurrentSession = useCallback(async (): Promise<ConversationSession | null> => {
    return await getCurrentSession()
  }, [getCurrentSession])

  // Context 值
  const contextValue: SessionContextType = {
    currentSessionId,
    loading,
    createSession,
    selectSession,
    updateSessionTitle,
    deleteSession,
    getSessions,
    getCurrentSession,
    getMessages,
    refreshCurrentSession
  }

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  )
}

// 自定义 Hook
export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}

export default SessionContext