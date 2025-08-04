import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { ChatMessage, ChatSession, EnhancedChatSession } from '../../../../shared/types'
import { SessionService } from '../../services/SessionService'
import { ParsedRole, PromptXWelcomeResponse, parsePromptXWelcome, RoleCache } from '../../utils/promptxParser'

interface ChatState {
  currentSession: EnhancedChatSession | null  // 🔥 使用增强的会话类型
  sessions: ChatSession[]
  isLoading: boolean
  error: string | null
  // 🎭 角色管理状态
  roles: {
    availableRoles: ParsedRole[]
    currentRole: ParsedRole | null
    loading: boolean
    lastUpdated: string | null
    error: string | null
    initialized: boolean  // 新增：标记是否已初始化
  }
}

const initialState: ChatState = {
  currentSession: null,
  sessions: [],
  isLoading: false,
  error: null,
  // 🎭 角色管理初始状态
  roles: {
    availableRoles: [],
    currentRole: null,
    loading: false,
    lastUpdated: null,
    error: null,
    initialized: false  // 初始值为false
  },
}

// 异步 thunk：发送消息
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ message, config }: { message: string; config: any }) => {
    const response = await window.electronAPI.sendMessage(message, config)
    return response
  }
)

// 异步 thunk：加载聊天历史
export const loadChatHistory = createAsyncThunk(
  'chat/loadHistory',
  async () => {
    // console.log('🔍 [FINAL DEBUG] 检查API可用性:', {
    //   electronAPI: !!window.electronAPI,
    //   langchain: !!window.electronAPI?.langchain,
    //   getAllSessions: !!window.electronAPI?.langchain?.getAllSessions,
    //   langchainKeys: Object.keys(window.electronAPI?.langchain || {})
    // });

    if (window.electronAPI?.langchain?.getAllSessions) {
      // console.log('✅ 使用新版会话API');
      const response = await window.electronAPI.langchain.getAllSessions()
      return response
    } else {
      // console.log('⚠️ 降级到旧版API');
      // 降级到旧版API
      const history = await window.electronAPI.getChatHistory()
      return history
    }
  }
)

// 异步 thunk：保存当前会话
export const saveCurrentSession = createAsyncThunk(
  'chat/saveSession',
  async (_, { getState }) => {
    const state = getState() as { chat: ChatState }
    if (!state.chat.currentSession) {
      throw new Error('没有当前会话需要保存')
    }

    // console.log('🔍 [FINAL DEBUG] 保存会话 - API检查:', {
    //   saveSession: !!window.electronAPI?.langchain?.saveSession,
    //   sessionData: state.chat.currentSession
    // });

    if (window.electronAPI?.langchain?.saveSession) {
      // console.log('✅ 调用保存会话API');
      const response = await window.electronAPI.langchain.saveSession(state.chat.currentSession)
      return response
    }
    console.error('❌ 保存会话功能不可用');
    throw new Error('保存会话功能不可用')
  }
)

// 异步 thunk：删除会话
export const deleteSession = createAsyncThunk(
  'chat/deleteSession',
  async (sessionId: string) => {
    if (window.electronAPI?.langchain?.deleteSession) {
      const response = await window.electronAPI.langchain.deleteSession(sessionId)
      return { sessionId, response }
    }
    throw new Error('删除会话功能不可用')
  }
)

// 🔥 新增：加载完整会话数据（包含模型配置）
export const loadSessionWithConfig = createAsyncThunk(
  'chat/loadSessionWithConfig',
  async (sessionId: string) => {
    // console.log('🔄 [Redux] 开始加载完整会话数据:', sessionId)
    const enhancedSession = await SessionService.loadSessionWithConfig(sessionId)

    if (!enhancedSession) {
      throw new Error(`无法加载会话: ${sessionId}`)
    }

    // console.log('✅ [Redux] 完整会话数据加载成功:', enhancedSession.title)
    return enhancedSession
  }
)

// 🔥 新增：切换到指定会话（数据驱动方式）
export const switchToSessionWithConfig = createAsyncThunk(
  'chat/switchToSessionWithConfig',
  async (sessionId: string) => {
    // console.log('🔄 [Redux] 开始切换会话:', sessionId)
    const enhancedSession = await SessionService.switchToSession(sessionId)

    if (!enhancedSession) {
      throw new Error(`无法切换到会话: ${sessionId}`)
    }

    // console.log('✅ [Redux] 会话切换成功:', enhancedSession.title)
    return enhancedSession
  }
)

// 🎭 异步thunk：加载角色列表
export const loadAvailableRoles = createAsyncThunk(
  'chat/loadAvailableRoles',
  async (forceRefresh: boolean = false) => {
    // 检查缓存
    if (!forceRefresh) {
      const cached = RoleCache.load()
      if (cached) {
        return cached
      }
    }
    
    try {
      // 调用welcome命令获取角色列表
      const result = await window.electronAPI.promptx.execute('welcome', [])
      
      if (!result.success) {
        throw new Error(result.error || '获取角色列表失败')
      }
      
      // 解析响应数据
      const parsed = parsePromptXWelcome(result.data)
      
      // 缓存结果
      RoleCache.save(parsed)
      
      console.log(`[Redux] 角色列表加载成功，共 ${parsed.roles.length} 个角色`)
      console.log('[Redux] 即将返回的数据:', parsed)
      return parsed
    } catch (error) {
      console.error('[Redux] loadAvailableRoles 错误:', error)
      throw error
    }
  }
)

// 🎭 异步thunk：激活角色
export const activateRole = createAsyncThunk(
  'chat/activateRole',
  async (roleId: string, { getState }) => {
    console.log('[Redux] 开始激活角色:', roleId)
    
    const state = getState() as { chat: ChatState }
    const role = state.chat.roles.availableRoles.find(r => r.id === roleId)
    
    if (!role) {
      throw new Error(`角色不存在: ${roleId}`)
    }
    
    // 调用PromptX action命令激活角色
    const result = await window.electronAPI.promptx.execute('action', [roleId])
    
    if (!result.success) {
      throw new Error(result.error || '角色激活失败')
    }
    
    console.log('[Redux] 角色激活成功:', role.name)
    return role
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // 创建新会话
    createNewSession: (state) => {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      state.sessions.unshift(newSession)
      state.currentSession = newSession
    },

    // 切换会话
    switchSession: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find(s => s.id === action.payload)
      if (session) {
        state.currentSession = session
      }
    },

    // 添加用户消息
    addUserMessage: (state, action: PayloadAction<{
      message: string
      modelId?: string
    }>) => {
      const { message, modelId } = action.payload

      if (!state.currentSession) {
        // 如果没有当前会话，创建一个新的
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: message.slice(0, 20) + '...',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          selectedModelId: modelId, // 🔥 保存模型选择
        }
        state.sessions.unshift(newSession)
        state.currentSession = newSession
      } else {
        // 更新当前会话的模型选择
        if (modelId) {
          state.currentSession.selectedModelId = modelId
        }
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
      }

      state.currentSession.messages.push(userMessage)
      state.currentSession.updatedAt = Date.now()

      // 如果是第一条消息，更新会话标题
      if (state.currentSession.messages.length === 1) {
        state.currentSession.title = message.slice(0, 20) + (message.length > 20 ? '...' : '')
      }
    },

    // 添加AI消息
    addAIMessage: (state, action: PayloadAction<{ content: string; modelId?: string; toolExecutions?: any[] }>) => {
      if (!state.currentSession) {
        return
      }

      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: action.payload.content,
        timestamp: Date.now(),
        modelId: action.payload.modelId,
        toolExecutions: action.payload.toolExecutions,
      }

      state.currentSession.messages.push(aiMessage)
      state.currentSession.updatedAt = Date.now()
    },

    // 删除会话
    removeSession: (state, action: PayloadAction<string>) => {
      const sessionId = action.payload
      state.sessions = state.sessions.filter(s => s.id !== sessionId)

      // 如果删除的是当前会话，切换到第一个会话或创建新会话
      if (state.currentSession?.id === sessionId) {
        state.currentSession = state.sessions.length > 0 ? state.sessions[0] : null
      }
    },

    // 更新会话标题
    updateSessionTitle: (state, action: PayloadAction<{ sessionId: string; title: string }>) => {
      const { sessionId, title } = action.payload
      const session = state.sessions.find(s => s.id === sessionId)
      if (session) {
        session.title = title
        session.updatedAt = Date.now()
      }
      if (state.currentSession?.id === sessionId) {
        state.currentSession.title = title
        state.currentSession.updatedAt = Date.now()
      }
    },

    // 更新当前会话的模型选择（废弃，保留用于向后兼容）
    updateSessionModel: (state, action: PayloadAction<string>) => {
      if (state.currentSession) {
        state.currentSession.selectedModelId = action.payload
        state.currentSession.updatedAt = Date.now()
        // console.log('🔄 更新会话模型选择:', action.payload)
      }
    },

    // 新方法：更新模型配置（分开存储配置ID和模型名称）
    updateSessionModelConfig: (state, action: PayloadAction<{ configId: string; modelName: string }>) => {
      if (state.currentSession) {
        const { configId, modelName } = action.payload
        state.currentSession.modelConfigId = configId
        state.currentSession.modelName = modelName
        // 为了向后兼容，同时更新 selectedModelId
        state.currentSession.selectedModelId = `${configId}-${modelName}`
        state.currentSession.updatedAt = Date.now()
      }
    },

    // 清除错误
    clearError: (state) => {
      state.error = null
    },

    // 设置加载状态
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },

    // 🎭 角色管理相关reducers
    // 设置当前角色
    setCurrentRole: (state, action: PayloadAction<ParsedRole>) => {
      state.roles.currentRole = action.payload
      // 同时更新角色的激活状态
      state.roles.availableRoles.forEach(role => {
        role.isActive = role.id === action.payload.id
      })
    },

    // 清除当前角色
    clearCurrentRole: (state) => {
      state.roles.currentRole = null
      // 清除所有角色的激活状态
      state.roles.availableRoles.forEach(role => {
        role.isActive = false
      })
    },

    // 清除角色错误
    clearRoleError: (state) => {
      state.roles.error = null
    },

    // 刷新角色缓存
    refreshRoleCache: (state) => {
      RoleCache.clear()
      state.roles.lastUpdated = null
      state.roles.initialized = false  // 重置初始化标志，允许重新加载
    },
  },
  extraReducers: (builder) => {
    builder
      // 发送消息
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false
        if (state.currentSession && action.payload.success) {
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: action.payload.data.content,
            timestamp: Date.now(),
            modelId: action.payload.data.model,
          }
          state.currentSession.messages.push(assistantMessage)
          state.currentSession.updatedAt = Date.now()
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || '发送消息失败'
      })
      // 加载历史
      .addCase(loadChatHistory.fulfilled, (state, action) => {
        if (action.payload.success) {
          const loadedSessions = action.payload.data || []

          // 智能合并会话：保留本地未保存的会话，更新已保存的会话
          const mergedSessions = [...state.sessions]

          // 更新或添加从后端加载的会话
          loadedSessions.forEach(loadedSession => {
            const existingIndex = mergedSessions.findIndex(s => s.id === loadedSession.id)
            if (existingIndex >= 0) {
              // 更新现有会话（但保留当前会话的状态）
              if (state.currentSession?.id !== loadedSession.id) {
                mergedSessions[existingIndex] = loadedSession
              }
            } else {
              // 添加新会话
              mergedSessions.push(loadedSession)
            }
          })

          state.sessions = mergedSessions

          // 🔥 修复：如果没有当前会话且有历史会话，使用数据驱动架构加载第一个会话
          if (!state.currentSession && state.sessions.length > 0) {
            // 暂时设置第一个会话，但需要通过 switchToSessionWithConfig 来完整加载
            state.currentSession = state.sessions[0]
            // console.log('🔄 [Redux] 应用启动时设置默认会话:', state.sessions[0].id)
            // 注意：这里不能直接 dispatch，需要在组件中检测并触发完整加载
          }
        }
      })
      // 保存会话
      .addCase(saveCurrentSession.fulfilled, (state, action) => {
        // 保存成功，可以在这里添加成功提示逻辑
      })
      .addCase(saveCurrentSession.rejected, (state, action) => {
        state.error = action.error.message || '保存会话失败'
      })
      // 删除会话
      .addCase(deleteSession.fulfilled, (state, action) => {
        const sessionId = action.payload.sessionId
        state.sessions = state.sessions.filter(s => s.id !== sessionId)

        // 如果删除的是当前会话，切换到第一个会话
        if (state.currentSession?.id === sessionId) {
          state.currentSession = state.sessions.length > 0 ? state.sessions[0] : null
        }
      })
      .addCase(deleteSession.rejected, (state, action) => {
        state.error = action.error.message || '删除会话失败'
      })
      // 🔥 新增：加载完整会话数据
      .addCase(loadSessionWithConfig.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadSessionWithConfig.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentSession = action.payload
        // console.log('✅ [Redux] 完整会话数据已设置到状态:', action.payload.title)
      })
      .addCase(loadSessionWithConfig.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || '加载会话失败'
      })
      // 🔥 新增：切换到指定会话
      .addCase(switchToSessionWithConfig.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(switchToSessionWithConfig.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentSession = action.payload
        // console.log('✅ [Redux] 会话切换完成:', action.payload.title)
      })
      .addCase(switchToSessionWithConfig.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.error.message || '切换会话失败'
      })
      // 🎭 角色加载
      .addCase(loadAvailableRoles.pending, (state) => {
        state.roles.loading = true
        state.roles.error = null
      })
      .addCase(loadAvailableRoles.fulfilled, (state, action) => {
        state.roles.loading = false
        state.roles.initialized = true  // 设置初始化标志
        
        if (action.payload && action.payload.roles) {
          state.roles.availableRoles = action.payload.roles
          state.roles.lastUpdated = action.payload.metadata.timestamp
        }
        
        // 如果当前有角色选中，更新其激活状态
        if (state.roles.currentRole) {
          const currentRole = state.roles.availableRoles.find(
            r => r.id === state.roles.currentRole?.id
          )
          if (currentRole) {
            currentRole.isActive = true
          }
        }
      })
      .addCase(loadAvailableRoles.rejected, (state, action) => {
        state.roles.loading = false
        state.roles.error = action.error.message || '加载角色列表失败'
      })
      // 🎭 角色激活
      .addCase(activateRole.pending, (state) => {
        state.roles.loading = true
        state.roles.error = null
      })
      .addCase(activateRole.fulfilled, (state, action) => {
        state.roles.loading = false
        state.roles.currentRole = action.payload
        // 更新角色激活状态
        state.roles.availableRoles.forEach(role => {
          role.isActive = role.id === action.payload.id
        })
      })
      .addCase(activateRole.rejected, (state, action) => {
        state.roles.loading = false
        state.roles.error = action.error.message || '角色激活失败'
      })
  },
})

export const {
  createNewSession,
  switchSession,
  addUserMessage,
  addAIMessage,
  removeSession,
  updateSessionTitle,
  updateSessionModel,
  updateSessionModelConfig,
  clearError,
  setLoading,
  // 🎭 角色管理actions
  setCurrentRole,
  clearCurrentRole,
  clearRoleError,
  refreshRoleCache
} = chatSlice.actions

// 🔥 注意：loadSessionWithConfig 和 switchToSessionWithConfig
// 已经通过 createAsyncThunk 自动导出，无需重复导出

export default chatSlice.reducer
