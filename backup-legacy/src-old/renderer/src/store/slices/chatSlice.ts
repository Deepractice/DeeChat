import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { ChatMessage, ChatSession, EnhancedChatSession } from '../../../../shared/types'
import { SessionService } from '../../services/SessionService'
import { ParsedRole, parsePromptXWelcome, RoleCache } from '../../utils/promptxParser'
import { generateMessageId, generateSessionId } from '../../../../shared/utils/idGenerator'

interface ChatState {
  currentSession: EnhancedChatSession | null  // 🔥 使用增强的会话类型
  sessions: ChatSession[]
  isLoading: boolean  // 保留全局加载状态用于向后兼容
  sessionLoadingStates: Record<string, boolean>  // 🎯 新增：会话级加载状态隔离
  error: string | null
  // 🔥 新增：流式消息状态
  streamingMessage: {
    isActive: boolean
    sessionId: string | null
    updates: any[]
    currentStage: any | null
  }
  // 🎭 角色管理状态
  roles: {
    availableRoles: ParsedRole[]
    currentRole: ParsedRole | null
    loading: boolean
    lastUpdated: string | null
    error: string | null
    initialized: boolean  // 标记是否已初始化
  }
  // 🎯 新增：角色激活状态（来自后端SmartLayeredPromptSystem）
  roleActivation: {
    activeRole: string | null           // 当前激活的角色
    isActivated: boolean                // 角色是否成功激活
    activationSuccess: boolean          // 角色激活是否成功
    roleContent?: string                // 角色内容（调试用）
    roleMetadata?: {                    // 角色元数据
      name: string
      description?: string
      lastActivated: Date
    }
    error?: string                      // 角色激活错误信息
    lastUpdated?: Date                  // 最后更新时间
  }
}

const initialState: ChatState = {
  currentSession: null,
  sessions: [],
  isLoading: false,  // 保留全局状态用于向后兼容
  sessionLoadingStates: {},  // 🎯 新增：会话级加载状态映射
  error: null,
  // 🔥 流式消息初始状态
  streamingMessage: {
    isActive: false,
    sessionId: null,
    updates: [],
    currentStage: null
  },
  // 🎭 角色管理初始状态
  roles: {
    availableRoles: [],
    currentRole: null,
    loading: false,
    lastUpdated: null,
    error: null,
    initialized: false  // 初始值为false
  },
  // 🎯 角色激活初始状态
  roleActivation: {
    activeRole: null,
    isActivated: false,
    activationSuccess: false,
    roleContent: undefined,
    roleMetadata: undefined,
    error: undefined,
    lastUpdated: undefined
  },
}

// 🗑️ [已删除] sendMessage thunk - 统一使用useUnifiedMessage hook中的流式方法

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
      const response = await window.electronAPI.chat.getHistory()
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

    if (window.electronAPI?.chat?.saveMessage) {
      // console.log('✅ 调用保存会话API');
      const response = await window.electronAPI.chat.saveMessage(state.chat.currentSession)
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
    // 调用SessionService删除会话
    await SessionService.deleteSession(sessionId);
    return { sessionId };
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
    try {
      console.log('[Redux] 开始加载可用角色列表...');
      
      // 如果需要强制刷新，先执行PromptX init重新扫描资源
      if (forceRefresh) {
        console.log('[Redux] 执行强制刷新，重新初始化PromptX资源...');
        try {
          // ✅ PromptX 支持自动初始化，不需要显式调用 init
          // 直接刷新资源发现即可
          console.log('[Redux] 跳过init调用，PromptX将自动初始化');
          // 这里可以添加其他资源刷新逻辑
        } catch (initError) {
          console.warn('[Redux] PromptX init警告，继续执行welcome:', initError);
        }
      }
      
      // 直接调用PromptX welcome工具获取角色列表
      const welcomeResponse = await window.electronAPI.promptx.execute('welcome', []);
      
      if (!welcomeResponse.success) {
        throw new Error(`角色加载失败: ${welcomeResponse.error || '未知错误'}`);
      }
      
      // 解析PromptX welcome返回的内容
      console.log('[Redux] welcomeResponse.data类型:', typeof welcomeResponse.data);
      console.log('[Redux] welcomeResponse.data预览:', welcomeResponse.data?.substring ? welcomeResponse.data.substring(0, 200) : welcomeResponse.data);
      
      const parsedResult = parsePromptXWelcome(welcomeResponse.data);
      console.log('[Redux] parsePromptXWelcome返回结果:', parsedResult);
      console.log('[Redux] parsedResult.roles类型:', typeof parsedResult?.roles);
      console.log('[Redux] parsedResult.roles长度:', parsedResult?.roles?.length);
      
      const result = {
        roles: parsedResult?.roles || [],
        tools: parsedResult?.tools || [],
        metadata: {
          totalRoles: parsedResult?.roles?.length || 0,
          totalTools: parsedResult?.tools?.length || 0,
          timestamp: new Date().toISOString()
        }
      };
      
      console.log(`[Redux] 成功加载 ${result.roles.length} 个角色`);
      return result;
      
    } catch (error) {
      console.error('[Redux] loadAvailableRoles 错误:', error);
      
      // 降级方案：使用原有的PromptX API直接调用
      try {
        // 降级方案中也需要强制刷新逻辑
        if (forceRefresh) {
          console.log('[Redux] 降级方案中执行强制刷新...');
          try {
            // 🔥 降级方案中也使用系统用户数据目录
            const userDataPath = await window.electronAPI.file.getAppDataPath();
            console.log('[Redux] 降级方案使用系统用户数据目录:', userDataPath);
            
            await window.electronAPI.promptx.execute('init', [userDataPath]);
            console.log('[Redux] 降级方案PromptX资源重新扫描完成');
          } catch (initError) {
            console.warn('[Redux] 降级方案PromptX init警告，继续执行:', initError);
          }
        }
        
        // 检查缓存
        if (!forceRefresh) {
          const cached = RoleCache.load()
          if (cached) {
            return cached
          }
        }
        
        // 调用welcome命令获取角色列表
        const result = await window.electronAPI.promptx.execute('welcome', [])
        
        if (!result.success) {
          throw new Error(result.error || '获取角色列表失败')
        }
        
        // 解析响应数据
        const parsed = parsePromptXWelcome(result.data)
        
        // 缓存结果
        RoleCache.save(parsed)
        
        console.log(`[Redux] 降级方案加载成功，共 ${parsed.roles.length} 个角色`)
        return parsed
      } catch (fallbackError) {
        console.error('[Redux] 降级方案也失败:', fallbackError)
        throw fallbackError
      }
    }
  }
)


// 🎭 异步thunk：激活角色（仅更新前端状态，实际激活由LangChain的MCP工具处理）
export const activateRole = createAsyncThunk(
  'chat/activateRole',
  async (roleId: string, { getState }) => {
    console.log('[Redux] 🎯 选择角色（仅更新UI状态）:', roleId)
    
    const state = getState() as { chat: ChatState }
    const role = state.chat.roles.availableRoles.find(r => r.id === roleId)
    
    if (!role) {
      throw new Error(`角色不存在: ${roleId}`)
    }
    
    // ✅ 只更新前端状态，不直接调用PromptX
    // 真正的角色激活将在下次对话时由LangChain通过MCP工具自动处理
    console.log('[Redux] ✅ 角色已选择，下次对话时LangChain将通过MCP工具自动激活:', role.name)
    console.log('[Redux] 💡 避免重复调用：不再直接调用PromptXLocalService')
    
    return role
  }
)

// 🎭 异步thunk：清除角色（仅更新前端状态，下次对话时恢复默认模式）
export const clearRole = createAsyncThunk(
  'chat/clearRole',
  async () => {
    console.log('[Redux] 🎯 清除角色选择（仅更新UI状态）')
    
    // ✅ 只更新前端状态，不直接调用PromptX
    // 下次对话时将自动使用默认的assistant模式
    console.log('[Redux] ✅ 角色选择已清除，下次对话将恢复默认AI模式')
    console.log('[Redux] 💡 避免重复调用：不再直接调用PromptXLocalService')
    
    return null
  }
)

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // 创建新会话
    createNewSession: (state) => {
      const newSession: ChatSession = {
        id: generateSessionId(),
        title: '新对话',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      state.sessions.unshift(newSession)
      state.currentSession = newSession
      
      // 注意：角色状态重置现在由 useRoleStateManager Hook 处理
      // 这样可以提供更好的用户体验和状态管理
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
      attachmentIds?: string[]
    }>) => {
      const { message, modelId, attachmentIds } = action.payload

      if (!state.currentSession) {
        // 如果没有当前会话，创建一个新的
        const newSession: ChatSession = {
          id: generateSessionId(),
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
        id: generateMessageId(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        attachments: attachmentIds, // 添加附件ID列表
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
        id: generateMessageId(),
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

      // 🎯 清理该会话的加载状态
      delete state.sessionLoadingStates[sessionId]

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

    // 🎯 新增：设置会话级加载状态
    setSessionLoading: (state, action: PayloadAction<{sessionId: string, loading: boolean}>) => {
      const { sessionId, loading } = action.payload
      if (loading) {
        state.sessionLoadingStates[sessionId] = true
      } else {
        // 删除false状态以保持对象干净
        delete state.sessionLoadingStates[sessionId]
      }
    },

    // 🎯 新增：清除会话加载状态（会话删除时调用）
    clearSessionLoading: (state, action: PayloadAction<string>) => {
      const sessionId = action.payload
      delete state.sessionLoadingStates[sessionId]
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

    // 🎯 角色激活状态管理（后端返回的状态信息）
    updateRoleActivationStatus: (state, action: PayloadAction<{
      activeRole: string | null
      isActivated: boolean
      activationSuccess: boolean
      roleContent?: string
      roleMetadata?: {
        name: string
        description?: string
        lastActivated: Date
      }
      error?: string
    }>) => {
      state.roleActivation = {
        ...action.payload,
        lastUpdated: new Date()
      }
    },

    // 清除角色激活状态
    clearRoleActivationStatus: (state) => {
      state.roleActivation = {
        activeRole: null,
        isActivated: false,
        activationSuccess: false,
        roleContent: undefined,
        roleMetadata: undefined,
        error: undefined,
        lastUpdated: new Date()
      }
    },

    // 🔥 流式消息相关reducers
    // 开始流式消息
    startStreamingMessage: (state, action: PayloadAction<{ sessionId: string }>) => {
      state.streamingMessage.isActive = true
      state.streamingMessage.sessionId = action.payload.sessionId
      state.streamingMessage.updates = []
      state.streamingMessage.currentStage = null
      state.isLoading = true
    },

    // 添加流式更新
    addStreamUpdate: (state, action: PayloadAction<any>) => {
      state.streamingMessage.updates.push(action.payload)
      state.streamingMessage.currentStage = action.payload
    },

    // 完成流式消息
    completeStreamingMessage: (state, action: PayloadAction<{ content: string; model?: string; toolExecutions?: any[] }>) => {
      state.streamingMessage.isActive = false
      state.streamingMessage.sessionId = null
      state.streamingMessage.updates = []
      state.streamingMessage.currentStage = null
      state.isLoading = false

      // 只有当有实际内容或工具执行时才添加AI消息到当前会话
      if (state.currentSession) {
        const hasContent = action.payload.content && action.payload.content.trim().length > 0
        const hasToolExecutions = action.payload.toolExecutions && action.payload.toolExecutions.length > 0
        
        if (hasContent || hasToolExecutions) {
          const aiMessage: ChatMessage = {
            id: generateMessageId(),
            role: 'assistant',
            content: action.payload.content || '',
            timestamp: Date.now(),
            modelId: action.payload.model,
            toolExecutions: action.payload.toolExecutions,
          }
          state.currentSession.messages.push(aiMessage)
          state.currentSession.updatedAt = Date.now()
        }
      }
    },

    // 重置流式消息状态
    resetStreamingMessage: (state) => {
      state.streamingMessage.isActive = false
      state.streamingMessage.sessionId = null
      state.streamingMessage.updates = []
      state.streamingMessage.currentStage = null
      state.isLoading = false
    },
  },
  extraReducers: (builder) => {
    builder
      // 🗑️ [已删除] sendMessage处理 - 统一使用useUnifiedMessage hook中的流式方法
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
        
        if (action.payload && action.payload.roles && Array.isArray(action.payload.roles)) {
          state.roles.availableRoles = action.payload.roles
          state.roles.lastUpdated = action.payload.metadata?.timestamp || new Date().toISOString()
        } else {
          // 确保availableRoles总是一个数组
          state.roles.availableRoles = []
        }
        
        // 如果当前有角色选中，更新其激活状态
        if (state.roles.currentRole && Array.isArray(state.roles.availableRoles)) {
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
      // 🎭 角色清除
      .addCase(clearRole.pending, (state) => {
        state.roles.loading = true
        state.roles.error = null
      })
      .addCase(clearRole.fulfilled, (state) => {
        state.roles.loading = false
        state.roles.currentRole = null
        // 清除所有角色的激活状态
        state.roles.availableRoles.forEach(role => {
          role.isActive = false
        })
      })
      .addCase(clearRole.rejected, (state, action) => {
        state.roles.loading = false
        state.roles.error = action.error.message || '清除角色失败'
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
  // 🎯 新增：会话级加载状态管理
  setSessionLoading,
  clearSessionLoading,
  // 🎭 角色管理actions
  setCurrentRole,
  clearCurrentRole,
  clearRoleError,
  refreshRoleCache,
  // 🎯 角色激活状态actions
  updateRoleActivationStatus,
  clearRoleActivationStatus,
  // 🔥 流式消息actions
  startStreamingMessage,
  addStreamUpdate,
  completeStreamingMessage,
  resetStreamingMessage
} = chatSlice.actions

// 🔥 注意：loadSessionWithConfig 和 switchToSessionWithConfig
// 已经通过 createAsyncThunk 自动导出，无需重复导出

export default chatSlice.reducer
