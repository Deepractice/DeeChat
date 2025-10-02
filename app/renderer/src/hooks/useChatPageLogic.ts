import { useState, useEffect, useCallback, useRef } from 'react'
import { message } from 'antd'
import type { ConversationSession, ConversationMessage, AIConfig } from '../../../main/preload'
import type { Role, RoleActivationResponse } from '../types/role'
import { useSession } from '../contexts/SessionContext'
import { useMcp } from '../contexts/McpContext'

/**
 * ChatPage核心业务逻辑Hook
 * 从ChatPage中抽取所有业务逻辑，保持组件简洁
 */
export const useChatPageLogic = (props: {
  selectedRole?: Role | null
  roleActivationResult?: RoleActivationResponse | null
  onCurrentSessionChange?: (session: ConversationSession | null) => void
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
}) => {
  // ==================== Context层 ====================
  const {
    currentSessionId,
    loading: sessionLoading,
    createSession: createSessionContext,
    selectSession: selectSessionContext,
    updateSessionTitle,
    deleteSession: deleteSessionContext,
    getSessions,
    getCurrentSession,
    getMessages
  } = useSession()

  const { tools, loading: loadingMcpTools } = useMcp()

  // ==================== 本地状态管理 ====================
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [isCallingTool, setIsCallingTool] = useState(false)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [currentDisplayModel, setCurrentDisplayModel] = useState<string>('')
  const [loadingCurrentModel, setLoadingCurrentModel] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false)

  // AI参数配置
  const [temperature, setTemperature] = useState<number>(0.7)
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined)

  // 内部角色状态管理
  const [internalSelectedRole, setInternalSelectedRole] = useState<Role | null>(props.selectedRole || null)
  const [internalRoleActivationResult, setInternalRoleActivationResult] = useState<any>(props.roleActivationResult || null)

  // 流式响应状态
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamingTimeline, setStreamingTimeline] = useState<any[]>([])

  // Refs
  const currentSessionRef = useRef<ConversationSession | null>(null)
  const processedEvents = useRef<Set<string>>(new Set())

  // ==================== 工具函数 ====================

  /**
   * 获取指定配置的当前模型
   * 三层回退策略：1. 用户偏好 2. 第一个可用模型 3. 系统默认
   */
  const getCurrentModel = async (configName: string): Promise<string> => {
    if (!configName) {
      console.warn('⚠️ getCurrentModel: 配置名为空')
      return 'gpt-3.5-turbo'
    }

    try {
      console.log(`🎯 [getCurrentModel] 开始获取模型: ${configName}`)

      // 1. 首先尝试获取用户偏好
      const prefResult = await window.electronAPI.aiConfig.getModelPreference(configName)
      if (prefResult.success && prefResult.data) {
        console.log(`✅ [getCurrentModel] 找到用户偏好: ${prefResult.data}`)
        return prefResult.data
      }

      // 2. 获取可用模型列表，选择第一个
      const modelsResult = await window.electronAPI.aiConfig.getModels(configName)
      if (modelsResult.success && modelsResult.data?.models?.length > 0) {
        const firstModel = modelsResult.data.models[0].id
        console.log(`🔄 [getCurrentModel] 使用第一个可用模型: ${firstModel}`)

        // 自动保存为偏好
        await window.electronAPI.aiConfig.setModelPreference(configName, firstModel)
        console.log(`💾 [getCurrentModel] 已保存为偏好: ${configName} -> ${firstModel}`)

        return firstModel
      }

      // 3. 最后的系统默认
      console.warn(`⚠️ [getCurrentModel] 未找到可用模型，使用系统默认`)
      return 'gpt-3.5-turbo'
    } catch (error) {
      console.error(`❌ [getCurrentModel] 获取模型失败:`, error)
      return 'gpt-3.5-turbo'
    }
  }

  /**
   * 异步加载并显示当前模型
   */
  const loadAndDisplayCurrentModel = async (configName: string): Promise<void> => {
    if (!configName) {
      setCurrentDisplayModel('')
      return
    }

    try {
      setLoadingCurrentModel(true)
      const currentModel = await getCurrentModel(configName)
      setCurrentDisplayModel(currentModel)
      console.log(`🖥️ 显示当前模型: ${configName} -> ${currentModel}`)
    } catch (error) {
      console.error('❌ 加载显示模型失败:', error)
      setCurrentDisplayModel('gpt-3.5-turbo')
    } finally {
      setLoadingCurrentModel(false)
    }
  }

  // ==================== 数据加载方法 ====================

  /**
   * 加载AI配置列表
   */
  const loadAIConfigs = async () => {
    try {
      const result = await window.electronAPI.aiConfig.getAll()
      if (result.success && result.data) {
        setAiConfigs(result.data)
        if (result.data.length > 0) {
          const firstConfigName = result.data[0].name
          setSelectedConfig(firstConfigName)
          await loadModelsForConfig(firstConfigName)
        }
      }
    } catch (error) {
      message.error('加载AI配置失败')
    }
  }

  /**
   * 加载会话列表
   */
  const loadSessions = async () => {
    try {
      const result = await window.electronAPI.conversation.getSessions()
      if (result.success && result.data) {
        setSessions(result.data)
      }
    } catch (error) {
      message.error('加载会话列表失败')
    }
  }

  /**
   * 加载消息列表
   */
  const loadMessages = async () => {
    if (!currentSession) return

    try {
      const result = await window.electronAPI.conversation.getMessageHistory(currentSession.id)
      if (result.success && result.data) {
        setMessages(result.data)
      }
    } catch (error) {
      console.error('加载消息失败:', error)
    }
  }

  /**
   * 加载可用模型
   */
  const loadModelsForConfig = async (configName?: string) => {
    const targetConfig = configName || selectedConfig
    if (!targetConfig) return

    setLoadingModels(true)
    try {
      console.log(`🔄 加载模型: ${targetConfig}`)
      const modelsResult = await window.electronAPI.aiConfig.getModels(targetConfig)

      if (modelsResult.success && modelsResult.data) {
        const models = modelsResult.data.models || []
        setAvailableModels(models)

        // 加载偏好
        const prefResult = await window.electronAPI.aiConfig.getModelPreference(targetConfig)
        if (prefResult.success && prefResult.data) {
          setCurrentDisplayModel(prefResult.data)
        } else if (models.length > 0) {
          const firstModelId = models[0].id
          setCurrentDisplayModel(firstModelId)
          await window.electronAPI.aiConfig.setModelPreference(targetConfig, firstModelId)
        } else {
          setCurrentDisplayModel('gpt-3.5-turbo')
        }
      } else {
        setCurrentDisplayModel('gpt-3.5-turbo')
      }
    } catch (error) {
      console.error('加载模型失败:', error)
      message.error('加载模型列表失败，使用默认模型')
      setCurrentDisplayModel('gpt-3.5-turbo')
    } finally {
      setLoadingModels(false)
    }
  }

  // ==================== 会话操作方法 ====================

  /**
   * 创建新会话
   */
  const createNewSession = async () => {
    if (!selectedConfig) {
      message.error('请先选择AI配置')
      return
    }

    try {
      setLoading(true)
      console.log('🔄 开始创建会话，配置名称:', selectedConfig)

      const configResult = await window.electronAPI.aiConfig.get(selectedConfig)
      if (!configResult.success || !configResult.data) {
        message.error('无法获取AI配置详情')
        return
      }

      const config = configResult.data
      const currentModel = await getCurrentModel(selectedConfig)

      const sessionInput = {
        title: `新对话 ${new Date().toLocaleString()}`,
        ai_config: {
          baseUrl: config.base_url,
          model: currentModel,
          apiKey: config.api_key,
          temperature: temperature,
          maxTokens: maxTokens
        }
      }

      const result = await window.electronAPI.conversation.createSession(sessionInput)

      if (result.success && result.data) {
        const newSession = result.data
        setSessions(prev => [newSession, ...prev])
        setCurrentSession(newSession)
        props.onCurrentSessionChange?.(newSession)
        setMessages([])
        console.log('✅ 会话创建成功:', newSession)
      } else {
        console.error('❌ 创建会话失败:', result.error)
        message.error(`创建会话失败: ${result.error || '未知错误'}`)
      }
    } catch (error: any) {
      console.error('💥 创建会话异常:', error)
      message.error(`创建会话异常: ${error?.message || error}`)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 选择会话
   */
  const selectSession = async (session: ConversationSession) => {
    console.log('📂 选择会话:', session.id, session.title)
    setCurrentSession(session)
    props.onCurrentSessionChange?.(session)

    try {
      const result = await window.electronAPI.conversation.getMessageHistory(session.id)
      if (result.success && result.data) {
        setMessages(result.data)
      } else {
        setMessages([])
      }
    } catch (error) {
      console.error('💥 加载消息历史异常:', error)
      message.error('加载消息历史失败')
      setMessages([])
    }
  }

  /**
   * 删除会话
   */
  const deleteSession = async (sessionId: string) => {
    try {
      const result = await window.electronAPI.conversation.deleteSession(sessionId)
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSession?.id === sessionId) {
          setCurrentSession(null)
          props.onCurrentSessionChange?.(null)
          setMessages([])
        }
      } else {
        message.error(result.error || '删除会话失败')
      }
    } catch (error) {
      message.error('删除会话失败')
    }
  }

  /**
   * 删除所有会话
   */
  const deleteAllSessions = async () => {
    try {
      const deletePromises = sessions.map(session =>
        window.electronAPI.conversation.deleteSession(session.id)
      )

      const results = await Promise.all(deletePromises)
      const failedCount = results.filter(r => !r.success).length

      if (failedCount === 0) {
        setSessions([])
        setCurrentSession(null)
        setMessages([])
      } else {
        message.warning(`删除了 ${sessions.length - failedCount} 个会话，${failedCount} 个删除失败`)
        loadSessions()
      }
    } catch (error) {
      message.error('批量删除会话失败')
    }
  }

  // ==================== 消息发送方法 ====================

  /**
   * 发送消息（流式版本）
   */
  const sendMessage = async (content: string) => {
    if (!currentSession) {
      message.error('请先选择会话')
      return
    }

    if (!content.trim()) {
      message.error('请输入消息内容')
      return
    }

    try {
      setSendingMessage(true)

      // 立即显示用户消息
      const userMessage: ConversationMessage = {
        id: `temp_${Date.now()}`,
        session_id: currentSession.id,
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString()
      }

      setMessages(prev => [...prev, userMessage])

      // 获取AI配置
      if (!selectedConfig) {
        message.error('无法确定AI配置，请重新选择')
        return
      }

      const configResult = await window.electronAPI.aiConfig.get(selectedConfig)
      if (!configResult.success || !configResult.data) {
        message.error('无法获取AI配置详情')
        return
      }

      const config = configResult.data
      const currentModel = await getCurrentModel(selectedConfig)

      // 重置流式状态
      setStreamingMessageId(null)

      // 准备系统提示词
      const currentRole = internalSelectedRole || props.selectedRole
      const currentActivationResult = internalRoleActivationResult || props.roleActivationResult

      let systemPrompt = undefined
      if (currentRole && currentActivationResult?.system_prompt) {
        systemPrompt = currentActivationResult.system_prompt
        console.log(`🎭 使用角色 "${currentRole.name}" 的系统提示词`)
      }

      // 发送流式请求
      const result = await window.electronAPI.conversation.sendMessageStream({
        session_id: currentSession.id,
        content: content.trim(),
        ai_config: {
          baseUrl: config.base_url,
          model: currentModel,
          apiKey: config.api_key,
          temperature: temperature,
          maxTokens: maxTokens
        },
        options: {
          ...(systemPrompt && { system_prompt: systemPrompt })
        }
      })

      if (!result.success) {
        throw new Error(result.error || '发送流式消息失败')
      }

      console.log('✅ 流式请求已发送，开始等待实时事件...')

    } catch (error: any) {
      console.error('发送消息失败:', error)
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp_')))
      message.error(error.message || '发送消息失败')
    } finally {
      setSendingMessage(false)
    }
  }

  // ==================== 配置管理方法 ====================

  /**
   * 处理模型选择
   */
  const handleModelSelect = async (model: string) => {
    if (!selectedConfig) {
      message.error('请先选择AI配置')
      return
    }

    try {
      setCurrentDisplayModel(model)
      await window.electronAPI.aiConfig.setModelPreference(selectedConfig, model)
      message.success('模型偏好已保存')
      console.log(`💾 模型偏好已保存: ${selectedConfig} -> ${model}`)
    } catch (error) {
      console.error('❌ 保存模型偏好失败:', error)
      message.error('保存模型偏好失败')
      loadAndDisplayCurrentModel(selectedConfig)
    }
  }

  /**
   * 处理角色选择
   */
  const handleRoleSelect = (role: Role | null, activationResult?: any) => {
    console.log('🎭 角色选择变化:', role?.name || '无角色', activationResult)
    setInternalSelectedRole(role)
    setInternalRoleActivationResult(activationResult)
  }

  // ==================== 副作用管理 ====================

  // 初始化数据
  useEffect(() => {
    loadAIConfigs()
    loadSessions()
  }, [])

  // 配置变化时加载模型
  useEffect(() => {
    if (selectedConfig) {
      loadModelsForConfig()
      loadAndDisplayCurrentModel(selectedConfig)
    }
  }, [selectedConfig])

  // 同步外部传入的角色状态
  useEffect(() => {
    if (props.selectedRole !== internalSelectedRole) {
      setInternalSelectedRole(props.selectedRole || null)
    }
    if (props.roleActivationResult !== internalRoleActivationResult) {
      setInternalRoleActivationResult(props.roleActivationResult || null)
    }
  }, [props.selectedRole, props.roleActivationResult])

  // 更新 currentSessionRef
  useEffect(() => {
    currentSessionRef.current = currentSession
  }, [currentSession])

  // ==================== 返回接口 ====================
  return {
    // 状态
    sessions,
    currentSession,
    messages,
    aiConfigs,
    selectedConfig,
    loading,
    sendingMessage,
    isCallingTool,
    availableModels,
    currentDisplayModel,
    loadingCurrentModel,
    loadingModels,
    modelSelectorVisible,
    temperature,
    maxTokens,
    internalSelectedRole,
    internalRoleActivationResult,
    streamingMessageId,
    streamingTimeline,
    tools,
    loadingMcpTools,

    // 方法
    setSelectedConfig,
    setTemperature,
    setMaxTokens,
    setModelSelectorVisible,
    setStreamingMessageId,
    setStreamingTimeline,
    setIsCallingTool,
    setSendingMessage,
    loadMessages,
    createNewSession,
    selectSession,
    deleteSession,
    deleteAllSessions,
    sendMessage,
    handleModelSelect,
    handleRoleSelect,
    loadSessions,

    // Refs
    currentSessionRef,
    processedEvents
  }
}