import { Middleware } from '@reduxjs/toolkit'
import { RootState } from '../index'
import { 
  addUserMessage, 
  addAIMessage, 
  createNewSession,
  switchSession,
  updateSessionTitle
} from '../slices/chatSlice'

/**
 * 持久化中间件 - 自动处理状态变更的持久化
 */
export const persistenceMiddleware: Middleware<{}, RootState> = 
  (store) => (next) => (action) => {
    
    // 执行action
    const result = next(action)
    
    // 获取更新后的状态
    const state = store.getState()
    
    // 根据action类型决定持久化策略
    switch (action.type) {
      // 立即持久化的操作
      case addUserMessage.type:
      case addAIMessage.type:
        // 用户消息或AI回复 - 立即保存
        immediatelyPersistSession(state.chat.currentSession)
        break
        
      case createNewSession.type:
        // 新建会话 - 立即保存
        immediatelyPersistSession(state.chat.currentSession)
        break
        
      case switchSession.type:
        // 切换会话 - 保存之前的会话状态
        if (state.chat.currentSession) {
          immediatelyPersistSession(state.chat.currentSession)
        }
        break
        
      // 延迟持久化的操作
      case updateSessionTitle.type:
        // 会话标题更新 - 延迟保存（防抖）
        debouncedPersistSession(state.chat.currentSession)
        break
        
      // 批量持久化的操作
      case 'chat/loadChatHistory/fulfilled':
        // 历史加载完成 - 批量同步
        batchPersistSessions(state.chat.sessions)
        break
        
      default:
        // 其他操作不需要持久化
        break
    }
    
    return result
  }

/**
 * 立即持久化会话
 */
async function immediatelyPersistSession(session: any) {
  if (!session) return
  
  try {
    await window.electronAPI?.langchain?.saveSession(session)
    console.log('✅ 会话立即持久化成功:', session.id)
  } catch (error) {
    console.error('❌ 会话立即持久化失败:', error)
  }
}

/**
 * 延迟持久化会话（防抖）
 */
const debouncedPersistSession = (() => {
  const timers = new Map<string, NodeJS.Timeout>()
  
  return (session: any) => {
    if (!session) return
    
    // 清除之前的定时器
    const existingTimer = timers.get(session.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    
    // 设置新的定时器
    const timer = setTimeout(async () => {
      try {
        await window.electronAPI?.langchain?.saveSession(session)
        console.log('✅ 会话延迟持久化成功:', session.id)
        timers.delete(session.id)
      } catch (error) {
        console.error('❌ 会话延迟持久化失败:', error)
      }
    }, 1000) // 1秒防抖
    
    timers.set(session.id, timer)
  }
})()

/**
 * 批量持久化会话
 */
async function batchPersistSessions(sessions: any[]) {
  if (!sessions || sessions.length === 0) return
  
  try {
    // 批量保存所有会话
    const promises = sessions.map(session => 
      window.electronAPI?.langchain?.saveSession(session)
    )
    
    await Promise.allSettled(promises)
    console.log('✅ 会话批量持久化完成:', sessions.length)
  } catch (error) {
    console.error('❌ 会话批量持久化失败:', error)
  }
}

/**
 * 模型选择持久化中间件
 */
export const modelPersistenceMiddleware: Middleware<{}, RootState> = 
  (store) => (next) => (action) => {
    
    const result = next(action)
    const state = store.getState()
    
    // 监听模型选择变更
    if (action.type.includes('model') || action.type.includes('config')) {
      // 保存模型配置到会话偏好
      persistModelSelection(state)
    }
    
    return result
  }

/**
 * 持久化模型选择
 */
async function persistModelSelection(state: RootState) {
  const { currentSession } = state.chat
  
  if (!currentSession) return
  
  try {
    // 保存会话的模型选择偏好
    const sessionPreferences = {
      sessionId: currentSession.id,
      modelConfigId: currentSession.modelConfigId,
      selectedModel: currentSession.selectedModel,
      updatedAt: new Date().toISOString()
    }
    
    await window.electronAPI?.langchain?.saveSessionPreferences?.(sessionPreferences)
    console.log('✅ 模型选择持久化成功:', currentSession.id)
  } catch (error) {
    console.error('❌ 模型选择持久化失败:', error)
  }
}

/**
 * 持久化配置
 */
export interface PersistenceConfig {
  // 立即持久化的action类型
  immediateActions: string[]
  
  // 延迟持久化的action类型和延迟时间
  debouncedActions: { [actionType: string]: number }
  
  // 批量持久化的action类型
  batchedActions: string[]
  
  // 是否启用持久化
  enabled: boolean
  
  // 错误重试次数
  retryCount: number
}

export const defaultPersistenceConfig: PersistenceConfig = {
  immediateActions: [
    addUserMessage.type,
    addAIMessage.type,
    createNewSession.type,
    switchSession.type
  ],
  
  debouncedActions: {
    [updateSessionTitle.type]: 1000,
    'ui/updateSettings': 2000
  },
  
  batchedActions: [
    'chat/loadChatHistory/fulfilled',
    'chat/bulkUpdate'
  ],
  
  enabled: true,
  retryCount: 3
}
