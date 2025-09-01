import React, { useRef, useEffect, useState } from 'react'
import { Layout, Empty, Typography, Button } from 'antd'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { createNewSession, saveCurrentSession, updateSessionModel } from '../store/slices/chatSlice'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ModelManagement from '../pages/ModelManagement'
import ChatSessionDropdown from './ChatSessionDropdown'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
// import { parseModelId } from '../../../shared/utils/modelIdHelper'
import { ApiResponse } from '../../../shared/types'
import { UserPreferenceEntity, UserPreferenceData } from '../../../shared/entities/UserPreferenceEntity'
import { useStreamProcessor } from '../streaming/useStreamProcessor'
import { useRoleStateManager } from '../hooks/useRoleStateManager'

// 内置默认配置
const DEFAULT_CONFIG = {
  id: 'default-config',
  name: 'ChatAnywhere (内置)',
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto',
  baseURL: 'https://api.chatanywhere.tech/v1',
  isEnabled: true,
  priority: 10,
  enabledModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  status: 'untested' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const { Content } = Layout
const { Title, Text } = Typography

interface ChatAreaProps {
  onGoToSettings?: () => void
  onToggleWorkspace?: (expand: boolean) => void
  workspaceExpanded?: boolean
  workspaceTransitioning?: boolean
}

const ChatArea: React.FC<ChatAreaProps> = ({ 
  onGoToSettings, 
  onToggleWorkspace, 
  workspaceExpanded = false,
  workspaceTransitioning = false 
}) => {
  const { currentSession, isLoading, sessions, sessionLoadingStates } = useSelector((state: RootState) => state.chat)
  const dispatch = useDispatch<AppDispatch>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const previousSessionIdRef = useRef<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<{ id: string; config: ModelConfigEntity } | null>(null)
  const [modelManagementVisible, setModelManagementVisible] = useState(false)
  
  // 🔥 使用流式消息hook
  const streamProcessor = useStreamProcessor()
  
  // 🎭 使用角色状态管理器 - 解决"角色选择 ≠ 角色激活"问题
  const { roleStateInfo, resetRoleState } = useRoleStateManager({
    enableAutoSync: true,        // 启用自动同步
    enableNewSessionReset: true, // 启用新会话时重置角色
    enableConsistencyCheck: true // 启用一致性检查
  })

  // 处理模型选择
  const handleModelChange = async (modelId: string, modelConfig: ModelConfigEntity) => {
//     console.log('🔄 [ChatArea] handleModelChange 被调用:', {
//       modelId,
//       configId: modelConfig.id,
//       modelName,
//       当前selectedModel: selectedModel?.id,
//       当前会话: currentSession?.id
//     })

    // 🔥 处理ModelSelector传来的清空信号（配置不可用时）
    if (!modelId || modelId === '') {
      // 🔥 只在开发模式下输出日志，减少生产环境控制台噪音
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ [ChatArea] 接收到清空信号，清空模型选择')
      }
      setSelectedModel(null)
      dispatch(updateSessionModel(''))

      // 保存清空状态
      try {
        await dispatch(saveCurrentSession()).unwrap()
      } catch (error) {
        console.error('❌ [ChatArea] 保存清空状态失败:', error)
      }
      return
    }

    const newSelectedModel = { id: modelId, config: modelConfig }
//     console.log('🔄 [ChatArea] 设置新的 selectedModel:', newSelectedModel)
    setSelectedModel(newSelectedModel)

    // 立即更新当前会话的模型选择
//     console.log('🔄 [ChatArea] 更新会话模型:', modelId)
    dispatch(updateSessionModel(modelId))

    // 立即保存到后端
    try {
//       console.log('🔄 [ChatArea] 开始保存会话...')
      await dispatch(saveCurrentSession()).unwrap()
//       console.log('✅ [ChatArea] 模型选择已保存:', modelId, '配置ID:', modelConfig.id)
      
      // 更新用户偏好设置 - 记住最后选择的模型
      if (window.electronAPI?.preference?.get && window.electronAPI?.preference?.save) {
        try {
          console.log('🔄 [ChatArea] 开始保存用户模型偏好:', modelId)
          const prefResponse: ApiResponse<UserPreferenceData> = await window.electronAPI.preference.get()
          if (prefResponse?.success && prefResponse.data) {
            // 更新最后选择的模型ID
            const updatedPreferences = new UserPreferenceEntity(prefResponse.data)
            updatedPreferences.updateLastSelected(modelId)
            const saveResult = await window.electronAPI.preference.save(updatedPreferences.toData())
            console.log('✅ [ChatArea] 用户模型偏好已更新:', modelId, saveResult)
          } else {
            console.warn('⚠️ [ChatArea] 获取用户偏好失败:', prefResponse)
          }
        } catch (prefError) {
          console.error('❌ [ChatArea] 更新用户偏好失败:', prefError)
        }
      } else {
        console.warn('⚠️ [ChatArea] preference API 不可用')
      }
    } catch (error) {
      console.error('❌ [ChatArea] 保存模型选择失败:', error)
    }
  }

  // 🔥 简化：直接从持久化的会话数据中恢复模型选择，无需额外的 SessionService 调用

  // 简化模型配置加载 - 直接使用默认配置
  /*
  const loadModelConfig = async (configId: string, modelName: string) => {
    try {
      // 如果是默认配置的模型，或者配置ID以 'default-config' 开头，都使用默认配置
      if (configId === DEFAULT_CONFIG.id || configId.startsWith('default-config')) {
        const defaultConfig = new ModelConfigEntity(DEFAULT_CONFIG)
        setSelectedModel({
          id: modelName,
          config: defaultConfig
        })
        return
      }
      
      // 兼容其他可能的配置ID，也使用默认配置
      // 只在开发模式下输出警告，避免生产环境噪音
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [ChatArea] 使用默认配置替代未知配置:', configId)
      }
      const defaultConfig = new ModelConfigEntity(DEFAULT_CONFIG)
      setSelectedModel({
        id: modelName,
        config: defaultConfig
      })
    } catch (error) {
      console.error('❌ [ChatArea] 加载模型配置出错:', error)
      setSelectedModel(null)
    }
  }
  */

  // 🔥 重构：直接从持久化会话数据恢复模型选择
  useEffect(() => {
    const currentSessionId = currentSession?.id || null

    // 只有在会话ID真正改变时才执行逻辑
    if (previousSessionIdRef.current !== currentSessionId) {
      previousSessionIdRef.current = currentSessionId

      // console.log('🔄 [ChatArea] 会话切换检测:', { previousId: previousSessionIdRef.current, currentId: currentSessionId, hasSession: !!currentSession, hasModelConfig: !!(currentSession as any)?.selectedModelConfig })

      if (!currentSession) {
        // 没有当前会话时，清空模型选择
//         console.log('🚫 [ChatArea] 无当前会话，清空模型选择')
        setSelectedModel(null)
        return
      }

      // 🔥 新架构：直接从持久化的会话数据中恢复模型选择
      if (currentSession.selectedModelId) {
//         console.log('🔍 [ChatArea] 开始从持久化数据恢复模型选择:', currentSession.selectedModelId)

        // 新方案：直接使用模型ID，不需要解析
        const modelId = currentSession.selectedModelId
        
        // 使用ChatAnywhere内置配置 - 支持多种模型包括kimi
        const config = new ModelConfigEntity({
          ...DEFAULT_CONFIG,
          model: modelId  // 使用用户选择的模型ID
        })
        
        setSelectedModel({
          id: modelId,
          config: config
        })
      } else {
        // 新会话或未设置模型的会话 - 加载用户的默认模型配置
//         console.log('🆕 [ChatArea] 会话无模型选择，尝试加载用户默认模型')
        
        // 异步加载用户默认模型配置
        const loadDefaultModel = async () => {
          try {
            console.log('🔍 [ChatArea] 开始加载用户默认模型配置...')
            // 获取用户偏好设置
            if (window.electronAPI?.preference?.get) {
              const prefResponse: ApiResponse<UserPreferenceData> = await window.electronAPI.preference.get()
              console.log('🔍 [ChatArea] 用户偏好响应:', prefResponse)
              if (prefResponse?.success && prefResponse.data) {
                const preferences = new UserPreferenceEntity(prefResponse.data)
                const defaultModelId = preferences.getDefaultModelId()
                console.log('🔍 [ChatArea] 用户默认模型ID:', defaultModelId)
                
                if (defaultModelId) {
                  // 使用ChatAnywhere内置配置
                  const config = new ModelConfigEntity({
                    ...DEFAULT_CONFIG,
                    model: defaultModelId
                  })
                  
                  setSelectedModel({
                    id: defaultModelId,
                    config: config
                  })
                  return
                }
              }
            }
            
            // 如果没有用户偏好，使用内置默认配置的第一个模型
            const defaultModelName = DEFAULT_CONFIG.enabledModels?.[0] || DEFAULT_CONFIG.model
            if (defaultModelName) {
              const defaultConfig = new ModelConfigEntity({
                ...DEFAULT_CONFIG,
                model: defaultModelName
              })
              
              setSelectedModel({
                id: defaultModelName,
                config: defaultConfig
              })
            } else {
              setSelectedModel(null)
            }
          } catch (error) {
            console.error('❌ [ChatArea] 加载默认模型失败:', error)
            setSelectedModel(null)
          }
        }
        
        loadDefaultModel()
      }
    }
  }, [currentSession]) // 🔥 关键修复：只监听 currentSession，移除 selectedModel 依赖

  // 🔥 新增：实时调试当前状态
  useEffect(() => {
    // console.log('🎯 ChatArea状态更新:', { currentSessionId: currentSession?.id, selectedModelId: currentSession?.selectedModelId, selectedModelState: selectedModel?.id, hasSelectedModel: !!selectedModel })
  }, [currentSession, selectedModel])

  // 🎯 DeeChat专属提示词上下文设置
  useEffect(() => {
    // 设置聊天模式上下文
    const setupChatContext = async () => {
      try {
        // 通过IPC通知主进程设置聊天上下文
        // Legacy API call - may not be available in current implementation
        // if (window.electronAPI?.llm?.setupChatContext) {
        //   await window.electronAPI.llm.setupChatContext()
        // }
        console.log('💬 [ChatArea] 聊天上下文已设置')
      } catch (error) {
        console.error('❌ [ChatArea] 设置聊天上下文失败:', error)
      }
    }

    setupChatContext()
  }, []) // 只在组件挂载时执行一次




  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentSession?.messages])

  // 创建新会话的处理函数
  const handleCreateNewSession = () => {
    dispatch(createNewSession())
  }

  // 处理跳转到模型管理
  const handleGoToModelManagement = () => {
    if (onGoToSettings) {
      onGoToSettings()
    } else {
      // 兜底方案：显示弹窗
      setModelManagementVisible(true)
    }
  }



  const activeSession = currentSession

  // 没有会话时显示完整欢迎页面
  if (!activeSession) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: '40px'
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div style={{ textAlign: 'center' }}>
              <Title level={4} type="secondary">
                欢迎使用 DeeChat
              </Title>
              <Text type="secondary">
                选择一个AI模型开始对话
              </Text>
            </div>
          }
        />

        {/* 始终显示创建新会话按钮 */}
        <Button
          type="primary"
          size="large"
          onClick={handleCreateNewSession}
          style={{ marginTop: '20px' }}
        >
          开始新对话
        </Button>
      </div>
    )
  }

  // 判断是否显示消息区域的欢迎内容
  const shouldShowMessageWelcome = activeSession.messages.length === 0

  return (
    <Layout style={{ height: '100%' }}>
      <Content
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden'
        }}
      >
        {/* 聊天头部 */}
        <div
          style={{
            height: workspaceExpanded ? '48px' : '56px',  // 工作区展开时减少高度
            borderBottom: '1px solid #f0f0f0',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: workspaceExpanded ? '0 12px' : '0 20px'  // 工作区展开时减少内边距
          }}
        >
          {/* 左侧区域：会话管理 */}
          <ChatSessionDropdown compact={workspaceExpanded} />
          
          {/* 右侧区域：工作区按钮 */}
          <Button
            type={workspaceExpanded ? 'default' : 'text'}
            loading={workspaceTransitioning}
            onClick={() => onToggleWorkspace?.(!workspaceExpanded)}
            style={{
              borderRadius: '4px',
              fontWeight: '400',
              height: '32px',
              padding: '0 12px',
              border: '1px solid #d9d9d9',
              color: workspaceExpanded ? '#666' : '#1890ff',
              backgroundColor: workspaceExpanded ? '#f5f5f5' : '#ffffff'
            }}
          >
            {workspaceExpanded ? '收起工作区' : '工作区'}
          </Button>
        </div>



        {/* 消息列表区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: shouldShowMessageWelcome ? '0' : '16px 24px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {shouldShowMessageWelcome ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                padding: '40px'
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ textAlign: 'center' }}>
                    <Title level={4} type="secondary">
                      准备开始新对话
                    </Title>
                    <Text type="secondary">
                      选择模型后即可开始聊天
                    </Text>
                  </div>
                }
              />
            </div>
          ) : (
            <>
              <MessageList 
                messages={activeSession.messages} 
                isLoading={sessionLoadingStates[activeSession.id] || isLoading}  // 🎯 优先使用会话级状态，降级到全局状态
              />
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 输入区域 */}
        <div
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: workspaceExpanded ? '12px 16px' : '16px 24px',  // 工作区展开时减少内边距
            backgroundColor: '#fff'
          }}
        >
          <MessageInput
            disabled={sessionLoadingStates[activeSession.id] || isLoading}  // 🎯 优先使用会话级状态，降级到全局状态
            selectedModel={selectedModel}
            onModelSelect={handleModelChange}
            onGoToModelManagement={handleGoToModelManagement}
            compact={workspaceExpanded}  // 传递紧凑模式状态
          />
        </div>
      </Content>

      {/* 模型管理弹窗 */}
      <ModelManagement
        visible={modelManagementVisible}
        onClose={() => setModelManagementVisible(false)}
      />
    </Layout>
  )
}

export default ChatArea
