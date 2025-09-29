import React, { useState, useEffect, useRef } from 'react'
import { Layout, Button, Drawer, Select, message, Spin, Space, Tag, Avatar, Slider, InputNumber, Tooltip } from 'antd'
import { MenuOutlined, PlusOutlined, SettingOutlined, RobotOutlined, DownOutlined, UserSwitchOutlined, LeftOutlined, DeleteOutlined, ClearOutlined } from '@ant-design/icons'
import MessageList from './MessageList'
import { VirtualToolMessage } from './ToolMessage'

// 扩展的工具执行信息接口，用于在AI消息中嵌入工具执行状态
interface EmbeddedToolExecution {
  id: string
  toolName: string
  serverId: string
  arguments?: any
  result?: any
  status: 'pending' | 'executing' | 'completed' | 'error'
  error?: string
  startTime?: number
  endTime?: number
}

// 时间线内容项接口 - 支持文本和工具的混合显示
interface TimelineItem {
  id: string
  type: 'text' | 'tool'
  timestamp: number
  // 文本内容
  content?: string
  // 工具执行信息
  toolExecution?: EmbeddedToolExecution
}
import MessageInput from './MessageInput'
import SessionList from './SessionList'
import ModelSelectorModal from './ModelSelectorModal'
import type {
  ConversationSession,
  ConversationMessage,
  AIConfig
} from '../../../main/preload'
import { Role, RoleActivationResponse } from '../types/role'
import { useMcp } from '../contexts/McpContext'

// 移除了Layout组件的解构，现在使用统一布局

interface ChatPageProps {
  onBackToConfig: () => void
  onBackToRoleSelector?: () => void
  selectedRole?: Role | null
  roleActivationResult?: RoleActivationResponse | null
  sidebarVisible?: boolean
  onSidebarVisibleChange?: (visible: boolean) => void
  onCurrentSessionChange?: (session: ConversationSession | null) => void
  onUpdateSessionTitle?: (sessionId: string, newTitle: string) => void
  sessionListRefreshTrigger?: number
}

const ChatPage: React.FC<ChatPageProps> = ({
  onBackToConfig,
  onBackToRoleSelector,
  selectedRole,
  roleActivationResult,
  sidebarVisible = false,
  onSidebarVisibleChange,
  onCurrentSessionChange,
  onUpdateSessionTitle: onUpdateSessionTitleProp,
  sessionListRefreshTrigger
}) => {
  // 状态管理
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null)
  const [messages, setMessages] = useState<(ConversationMessage | VirtualToolMessage | ToolExecutionInfo)[]>([])
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  // 移除本地的 sidebarVisible 状态，使用从props传入的状态
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [isCallingTool, setIsCallingTool] = useState(false)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false)

  // AI 参数配置
  const [temperature, setTemperature] = useState<number>(0.7)
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined)

  // 使用MCP Context
  const { tools, loading: loadingMcpTools, refreshMcpData, isDataStale } = useMcp()

  // 初始化数据
  useEffect(() => {
    loadAIConfigs()
    loadSessions()
    setupStreamListeners()

    // 清理事件监听器
    return () => {
      window.electronAPI.removeStreamListeners()
    }
  }, [])

  // 监听会话列表刷新触发器
  useEffect(() => {
    if (sessionListRefreshTrigger && sessionListRefreshTrigger > 0) {
      console.log('🔄 收到会话列表刷新信号，重新加载会话列表')
      loadSessions()
    }
  }, [sessionListRefreshTrigger])

  // 流式响应状态
  const [currentAiMessage, setCurrentAiMessage] = useState<ConversationMessage | null>(null)
  const [streamingContent, setStreamingContent] = useState<string>('')
  // 当前消息的时间线内容（用于实现文本和工具的穿插显示）
  const [currentTimeline, setCurrentTimeline] = useState<TimelineItem[]>([])
  const currentTimelineRef = useRef<TimelineItem[]>([])

  // 更新时间线 ref
  useEffect(() => {
    currentTimelineRef.current = currentTimeline
  }, [currentTimeline])


  // 使用 useRef 来保持 currentSession 的最新值
  const currentSessionRef = useRef<ConversationSession | null>(null)
  // 使用 useRef 来保持 currentAiMessage 的最新值
  const currentAiMessageRef = useRef<ConversationMessage | null>(null)

  // 更新 ref 当 currentSession 改变时
  useEffect(() => {
    currentSessionRef.current = currentSession
  }, [currentSession])

  // 更新 ref 当 currentAiMessage 改变时
  useEffect(() => {
    currentAiMessageRef.current = currentAiMessage
  }, [currentAiMessage])

  // 处理实时流式事件
  const handleStreamEvent = (event: any) => {
    console.log('🎯 前端收到流式事件:', JSON.stringify(event, null, 2))
    const sessionFromRef = currentSessionRef.current
    console.log('🔍 当前会话状态 (ref):', sessionFromRef ? `ID: ${sessionFromRef.id}` : 'null')

    // 处理工具调用开始 - 集成到当前AI消息中
    if (event.data && (event.data.toolExecuting || (event.data.phase === 'calling_tools' && event.data.toolCalls))) {
      console.log('🔥 检测到工具调用事件:', event.data)
      setIsCallingTool(true)

      let toolCalls = []

      // 处理 toolExecuting 格式 - 将其转换为 toolCalls 格式
      if (event.data.toolExecuting) {
        const toolExecuting = event.data.toolExecuting
        toolCalls = [{
          id: toolExecuting.id,
          function: {
            name: toolExecuting.name,
            arguments: JSON.stringify(toolExecuting.arguments || {})
          },
          startTime: toolExecuting.startTime
        }]
      }
      // 处理 toolCalls 格式
      else if (event.data.toolCalls) {
        toolCalls = event.data.toolCalls
      }

      // 更新时间线：添加工具执行项
      toolCalls.forEach((toolCall: any, index: number) => {
        const toolId = toolCall.id || `tool-${Date.now()}-${index}`
        const toolName = toolCall.function?.name || toolCall.name || '未知工具'
        let parameters = null

        // 正确解析参数
        if (toolCall.function?.arguments) {
          try {
            parameters = JSON.parse(toolCall.function.arguments)
          } catch (e) {
            parameters = toolCall.function.arguments
          }
        } else if (toolCall.arguments) {
          parameters = toolCall.arguments
        } else if (toolCall.input) {
          parameters = toolCall.input
        }

        const toolExecution = {
          id: toolId,
          toolName: toolName,
          serverId: 'mcp-server',
          status: 'running' as const,
          arguments: parameters,
          startTime: toolCall.startTime || Date.now()
        }

        // 添加到时间线（避免重复添加）
        setCurrentTimeline(prevTimeline => {
          // 检查是否已存在相同的工具调用
          const exists = prevTimeline.some(item =>
            item.type === 'tool' && item.toolExecution?.id === toolId
          )
          if (exists) {
            console.log('🔄 工具调用已存在，跳过重复添加:', toolId)
            return prevTimeline
          }

          return [
            ...prevTimeline,
            {
              id: toolId,
              type: 'tool',
              timestamp: Date.now(),
              toolExecution
            }
          ]
        })
      })

      // 更新当前AI消息的工具执行状态（保持兼容性）
      const currentAiFromRef = currentAiMessageRef.current
      if (currentAiFromRef) {
        setMessages(prevMessages =>
          prevMessages.map(msg => {
            if (msg.id === currentAiFromRef.id) {
              // 创建或更新工具执行步骤
              const existingSteps = (msg.metadata?.toolExecutionSteps || []) as any[]
              const newSteps = toolCalls.map((toolCall: any, index: number) => {
                // 正确提取工具信息
                const toolId = toolCall.id || `tool-${Date.now()}-${index}`
                const toolName = toolCall.function?.name || toolCall.name || '未知工具'
                let parameters = null

                // 正确解析参数
                if (toolCall.function?.arguments) {
                  try {
                    parameters = JSON.parse(toolCall.function.arguments)
                  } catch (e) {
                    parameters = toolCall.function.arguments
                  }
                } else if (toolCall.arguments) {
                  parameters = toolCall.arguments
                } else if (toolCall.input) {
                  parameters = toolCall.input
                }

                return {
                  id: toolId,
                  toolName: toolName,
                  serverId: 'mcp-server', // 可以从事件中获取
                  status: 'running',
                  parameters: parameters,
                  startTime: toolCall.startTime || Date.now()
                }
              })

              return {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  toolExecutionSteps: [...existingSteps, ...newSteps],
                  timeline: currentTimelineRef.current
                }
              }
            }
            return msg
          })
        )
      }
    }


    // 处理工具执行结果：更新工具执行状态
    if (event.data && event.data.toolResults && event.data.toolResults.length > 0) {
      setIsCallingTool(false)
      console.log('✅ 工具执行完成，更新结果:', event.data.toolResults)

      // 更新时间线中的工具状态
      setCurrentTimeline(prevTimeline => {
        return prevTimeline.map(item => {
          if (item.type === 'tool' && item.toolExecution) {
            // 通过 tool_call_id 匹配结果
            const matchingResult = event.data.toolResults.find((result: any) =>
              result.tool_call_id === item.toolExecution?.id
            )

            if (matchingResult) {
              // 提取结果文本
              let resultText = ''
              console.log('🔍 处理工具结果:', {
                tool_call_id: matchingResult.tool_call_id,
                resultType: typeof matchingResult.result,
                resultIsArray: Array.isArray(matchingResult.result),
                result: matchingResult.result
              })
              if (matchingResult.result) {
                if (Array.isArray(matchingResult.result)) {
                  // 合并所有结果文本
                  resultText = matchingResult.result
                    .map((item: any) => item.text || item.content || JSON.stringify(item))
                    .join('\n')
                } else if (typeof matchingResult.result === 'string') {
                  resultText = matchingResult.result
                } else {
                  resultText = JSON.stringify(matchingResult.result, null, 2)
                }
              }
              console.log('✅ 提取的结果文本:', { resultTextLength: resultText.length, resultText: resultText.substring(0, 100) + '...' })

              return {
                ...item,
                toolExecution: {
                  ...item.toolExecution,
                  status: matchingResult.error ? 'error' as const : 'completed' as const,
                  result: matchingResult.error ? undefined : resultText,
                  error: matchingResult.error,
                  endTime: Date.now()
                }
              }
            }
          }
          return item
        })
      })

      // 更新当前AI消息的工具执行状态（保持兼容性）
      const currentAiFromRef = currentAiMessageRef.current
      if (currentAiFromRef) {
        setMessages(prevMessages =>
          prevMessages.map(msg => {
            if (msg.id === currentAiFromRef.id) {
              const existingSteps = (msg.metadata?.toolExecutionSteps || []) as any[]

              // 更新对应工具的执行状态
              const updatedSteps = existingSteps.map((step: any) => {
                // 通过 tool_call_id 匹配结果
                const matchingResult = event.data.toolResults.find((result: any) =>
                  result.tool_call_id === step.id
                )

                if (matchingResult) {
                  // 提取结果文本
                  let resultText = ''
                  if (matchingResult.result) {
                    if (Array.isArray(matchingResult.result)) {
                      // 合并所有结果文本
                      resultText = matchingResult.result
                        .map((item: any) => item.text || item.content || JSON.stringify(item))
                        .join('\n')
                    } else if (typeof matchingResult.result === 'string') {
                      resultText = matchingResult.result
                    } else {
                      resultText = JSON.stringify(matchingResult.result, null, 2)
                    }
                  }

                  return {
                    ...step,
                    status: matchingResult.error ? 'error' : 'completed',
                    result: matchingResult.error ? undefined : resultText,
                    error: matchingResult.error,
                    endTime: Date.now()
                  }
                }
                return step
              })

              return {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  toolExecutionSteps: updatedSteps,
                  timeline: currentTimelineRef.current
                }
              }
            }
            return msg
          })
        )
      }
    }

    // 处理工具执行错误：更新工具执行状态
    if (event.data && event.data.toolError) {
      setIsCallingTool(false)
      const error = event.data.toolError
      console.log('❌ 工具执行失败，更新错误状态')

      // 更新时间线中最近的工具状态为错误
      setCurrentTimeline(prevTimeline => {
        const updatedTimeline = [...prevTimeline]
        // 找到最后一个运行中的工具
        for (let i = updatedTimeline.length - 1; i >= 0; i--) {
          const item = updatedTimeline[i]
          if (item.type === 'tool' && item.toolExecution?.status === 'running') {
            updatedTimeline[i] = {
              ...item,
              toolExecution: {
                ...item.toolExecution,
                status: 'error' as const,
                error: error.error || '未知错误',
                endTime: Date.now()
              }
            }
            break
          }
        }
        return updatedTimeline
      })

      // 更新当前AI消息的工具执行状态（保持兼容性）
      const currentAiFromRef = currentAiMessageRef.current
      if (currentAiFromRef) {
        setMessages(prevMessages =>
          prevMessages.map(msg => {
            if (msg.id === currentAiFromRef.id) {
              const existingSteps = (msg.metadata?.toolExecutionSteps || []) as any[]

              // 更新最近的工具执行状态为错误
              const updatedSteps = [...existingSteps]
              if (updatedSteps.length > 0) {
                const lastStep = updatedSteps[updatedSteps.length - 1]
                if (lastStep.status === 'running') {
                  lastStep.status = 'error'
                  lastStep.error = error.error || '未知错误'
                  lastStep.endTime = Date.now()
                }
              }

              return {
                ...msg,
                metadata: {
                  ...msg.metadata,
                  toolExecutionSteps: updatedSteps,
                  timeline: currentTimelineRef.current
                }
              }
            }
            return msg
          })
        )
      }
    }

    // 如果没有当前会话，但事件中有sessionId，可以继续处理其他事件
    if (!sessionFromRef && !event.sessionId) {
      console.log('❌ 没有当前会话且事件无sessionId，忽略事件')
      return
    }

    switch (event.type) {
      case 'message_saved':
        // 用户消息已保存，替换临时消息
        const finalUserMessage = event.data
        setMessages(prev =>
          prev.map(msg =>
            msg.id.startsWith('temp_') ? finalUserMessage : msg
          )
        )
        break

      case 'ai_chunk':
        // 实时累积AI响应内容
        const chunkContent = event.data.content || ''

        // 只有当有实际内容时才处理消息创建/更新
        if (chunkContent) {
          // 第一次收到内容时，隐藏loading状态
          setSendingMessage(false)

          // 先计算新的内容和时间线，避免嵌套状态更新
          const newContent = streamingContent + chunkContent
          const currentAiFromRef = currentAiMessageRef.current

          // 计算新的时间线
          const currentTimeline = currentTimelineRef.current
          const updatedTimeline = [...currentTimeline]
          const lastItem = updatedTimeline[updatedTimeline.length - 1]

          if (lastItem && lastItem.type === 'text') {
            // 如果最后一项是文本，追加内容（避免重复）
            const currentContent = lastItem.content || ''
            if (!currentContent.endsWith(chunkContent)) {
              lastItem.content = currentContent + chunkContent
            }
          } else {
            // 创建新的文本时间线项
            updatedTimeline.push({
              id: `text_${Date.now()}`,
              type: 'text',
              timestamp: Date.now(),
              content: chunkContent
            })
          }

          // 批量更新状态 - 避免嵌套调用
          setStreamingContent(newContent)
          setCurrentTimeline(updatedTimeline)

          if (!currentAiFromRef) {
            // 创建新的AI消息（可能是因为工具调用后的继续回复）
            console.log('🆕 创建新的AI消息（工具调用后继续回复）')
            const newAiMessage: ConversationMessage = {
              id: `ai_${Date.now()}`,
              session_id: sessionFromRef?.id || event.sessionId || '',
              role: 'assistant',
              content: newContent,
              timestamp: new Date().toISOString(),
              metadata: {
                timeline: updatedTimeline
              }
            }
            setCurrentAiMessage(newAiMessage)
            setMessages(prev => [...prev, newAiMessage])
          } else {
            // 更新现有AI消息内容和时间线
            setMessages(prev =>
              prev.map(msg =>
                msg.id === currentAiFromRef.id
                  ? {
                      ...msg,
                      content: newContent,
                      metadata: {
                        ...msg.metadata,
                        timeline: updatedTimeline
                      }
                    }
                  : msg
              )
            )
          }
        }
        break

      case 'ai_complete':
        // AI响应完成，用最终消息替换
        const finalAiMessage = event.data
        const currentAiFromRefComplete = currentAiMessageRef.current
        if (currentAiFromRefComplete) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === currentAiFromRefComplete.id ?
                {
                  ...finalAiMessage,
                  metadata: {
                    ...finalAiMessage.metadata,
                    timeline: currentTimelineRef.current
                  }
                }
                : msg
            )
          )
        }
        // 重置流式状态和工具状态
        setCurrentAiMessage(null)
        setStreamingContent('')
        setIsCallingTool(false)
        setCurrentTimeline([])
        break

      case 'error':
        console.error('AI响应错误:', event.data.error)
        // 显示友好的错误提示，支持多行内容
        const errorMessage = event.data.error || 'AI响应失败'
        message.error({
          content: (
            <div style={{ whiteSpace: 'pre-line', maxWidth: '400px', lineHeight: '1.5' }}>
              {errorMessage}
            </div>
          ),
          duration: 8 // 延长显示时间，让用户有足够时间阅读
        })
        // 重置流式状态和工具状态
        setCurrentAiMessage(null)
        setStreamingContent('')
        setIsCallingTool(false)
        setCurrentTimeline([])
        break
    }
  }

  // 设置流式事件监听器（严格模式兼容）
  const setupStreamListeners = () => {
    console.log('🔧 设置事件监听器')

    // 先清理现有监听器，避免重复注册
    if (window.electronAPI.removeStreamListeners) {
      window.electronAPI.removeStreamListeners()
    }

    // 实时流式事件
    window.electronAPI.onStreamEvent((data: any) => {
      handleStreamEvent(data.event)
    })

    // 流式完成事件
    window.electronAPI.onStreamComplete((data: any) => {
      setSendingMessage(false)
    })

    // 流式错误事件
    window.electronAPI.onStreamError((data: any) => {
      console.error('流式处理错误:', data.error)
      setSendingMessage(false)
      // 显示友好的错误提示，支持多行内容
      const errorMessage = data.error || '流式处理失败'
      message.error({
        content: (
          <div style={{ whiteSpace: 'pre-line', maxWidth: '400px', lineHeight: '1.5' }}>
            {errorMessage}
          </div>
        ),
        duration: 8 // 延长显示时间，让用户有足够时间阅读
      })
    })
  }

  // 模型加载
  useEffect(() => {
    if (selectedConfig) {
      loadModels()
    }
  }, [selectedConfig])

  // 加载AI配置
  const loadAIConfigs = async () => {
    try {
      const result = await window.electronAPI.aiConfig.getAll()
      if (result.success && result.data) {
        setAiConfigs(result.data)
        // 自动选择第一个配置，并立即加载其模型
        if (result.data.length > 0) {
          const firstConfigName = result.data[0].name
          setSelectedConfig(firstConfigName)
          // 🔧 修复：主动触发第一个配置的模型加载
          await loadModelsForConfig(firstConfigName)
        }
      }
    } catch (error) {
      message.error('加载AI配置失败')
    }
  }

  // 加载会话列表
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

  // 加载可用模型 - 支持指定配置名
  const loadModelsForConfig = async (configName?: string) => {
    const targetConfig = configName || selectedConfig
    if (!targetConfig) return

    setLoadingModels(true)
    try {
      console.log(`🔄 加载模型: ${targetConfig}`)
      const modelsResult = await window.electronAPI.aiConfig.getModels(targetConfig)
      console.log('🔍 前端接收到的模型数据:', modelsResult)
      if (modelsResult.success && modelsResult.data) {
        console.log('📊 模型数据结构:', modelsResult.data)
        console.log('🔍 data是否有models属性:', 'models' in modelsResult.data)
        console.log('🔍 models数组长度:', modelsResult.data.models?.length)
        console.log('🔍 第一个模型示例:', modelsResult.data.models?.[0])
        const models = modelsResult.data.models || []
        console.log('🎯 完整模型数组长度:', models.length)
        console.log('🎯 第一个模型ID:', models[0]?.id)
        console.log('🔥 即将设置availableModels状态，长度:', models.length)
        setAvailableModels(models)
        console.log('✅ availableModels状态已更新，当前长度:', models.length)
        // 加载偏好
        const prefResult = await window.electronAPI.aiConfig.getModelPreference(targetConfig)
        if (prefResult.success && prefResult.data) {
          setSelectedModel(prefResult.data)
        } else if (models.length > 0) {
          const firstModelId = models[0].id
          setSelectedModel(firstModelId)
          // 保存默认偏好
          await window.electronAPI.aiConfig.setModelPreference(targetConfig, firstModelId)
        } else {
          setSelectedModel('gpt-3.5-turbo')
        }
      } else {
        setSelectedModel('gpt-3.5-turbo')
      }
    } catch (error) {
      console.error('加载模型失败:', error)
      message.error('加载模型列表失败，使用默认模型')
      setSelectedModel('gpt-3.5-turbo')
    } finally {
      setLoadingModels(false)
    }
  }

  // 兼容性函数 - 使用当前选中的配置加载模型
  const loadModels = () => loadModelsForConfig()

  // 创建新会话
  const createNewSession = async () => {
    if (!selectedConfig) {
      message.error('请先选择AI配置')
      return
    }

    try {
      setLoading(true)
      console.log('🔄 开始创建会话，配置名称:', selectedConfig)

      // 根据配置名称获取完整配置对象
      const configResult = await window.electronAPI.aiConfig.get(selectedConfig)
      console.log('🔍 AI配置获取结果:', configResult)
      if (!configResult.success || !configResult.data) {
        message.error('无法获取AI配置详情')
        return
      }

      const config = configResult.data
      console.log('📋 获取到配置详情:', config)

      // 实时获取模型偏好，确保使用最新的设置
      let currentModel = selectedModel
      if (!currentModel) {
        const preferenceResult = await window.electronAPI.aiConfig.getModelPreference(selectedConfig)
        if (preferenceResult.success && preferenceResult.data) {
          currentModel = preferenceResult.data
          console.log('🎯 实时获取到模型偏好:', currentModel)
        } else {
          console.warn('⚠️ 无法获取模型偏好，使用配置默认模型')
          currentModel = config.default_model || 'gpt-4o-mini'
        }
      }

      // 构建会话创建参数
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
      console.log('📝 会话创建参数:', JSON.stringify(sessionInput, null, 2))
      
      const result = await window.electronAPI.conversation.createSession(sessionInput)

      console.log('📥 创建会话响应:', result)

      if (result.success && result.data) {
        const newSession = result.data
        setSessions(prev => [newSession, ...prev])
        setCurrentSession(newSession)
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

  // 选择会话
  const selectSession = async (session: ConversationSession) => {
    setCurrentSession(session)
    onCurrentSessionChange?.(session)

    try {
      const result = await window.electronAPI.conversation.getMessageHistory(session.id)
      if (result.success && result.data) {
        // 只加载真实的聊天消息，工具消息会在下次工具调用时重新生成
        setMessages(result.data)
      }
    } catch (error) {
      message.error('加载消息历史失败')
    }
  }

  // 发送消息（流式版本）
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
      const userMessageId = userMessage.id
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

      // 实时获取模型偏好，确保使用最新的设置
      let currentModel = selectedModel
      if (!currentModel) {
        const preferenceResult = await window.electronAPI.aiConfig.getModelPreference(selectedConfig)
        if (preferenceResult.success && preferenceResult.data) {
          currentModel = preferenceResult.data
          console.log('🎯 实时获取到模型偏好:', currentModel)
        } else {
          console.warn('⚠️ 无法获取模型偏好，使用配置默认模型')
          currentModel = config.default_model || 'gpt-4o-mini'
        }
      }

      // 重置流式状态
      setCurrentAiMessage(null)
      setStreamingContent('')

      // 准备系统提示词（如果有选择的角色）
      let systemPrompt = undefined
      if (selectedRole && roleActivationResult?.system_prompt) {
        systemPrompt = roleActivationResult.system_prompt
        console.log(`🎭 使用角色 "${selectedRole.name}" 的系统提示词:`, systemPrompt)
      } else {
        console.log('⚠️ 没有角色系统提示词:', {
          hasRole: !!selectedRole,
          hasActivationResult: !!roleActivationResult,
          hasSystemPrompt: !!(roleActivationResult?.system_prompt)
        })
      }

      // 发送流式请求（触发实时流式响应）
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
        // 传递MCP工具信息
        tools: tools.length > 0 ? tools : undefined,
        enable_tool_calls: tools.length > 0,
        options: {
          system_prompt: systemPrompt
        }
      })

      if (!result.success) {
        throw new Error(result.error || '发送流式消息失败')
      }

      console.log('✅ 流式请求已发送，开始等待实时事件...')

    } catch (error: any) {
      console.error('发送消息失败:', error)

      // 移除临时消息
      setMessages(prev => prev.filter(msg => msg.id.startsWith('temp_')))
      message.error(error.message || '发送消息失败')
    } finally {
      setSendingMessage(false)
    }
  }

  // 删除会话
  const deleteSession = async (sessionId: string) => {
    try {
      const result = await window.electronAPI.conversation.deleteSession(sessionId)
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (currentSession?.id === sessionId) {
          setCurrentSession(null)
          onCurrentSessionChange?.(null)
          setMessages([])
        }
      } else {
        message.error(result.error || '删除会话失败')
      }
    } catch (error) {
      message.error('删除会话失败')
    }
  }


  // 删除所有会话
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
        // 重新加载会话列表以获取最新状态
        loadSessions()
      }
    } catch (error) {
      message.error('批量删除会话失败')
    }
  }

  // 处理模型选择
  const handleModelSelect = (model: string) => {
    setSelectedModel(model)
    if (selectedConfig) {
      window.electronAPI.aiConfig.setModelPreference(selectedConfig, model)
    }
  }

  // 打开模型选择弹窗
  const openModelSelector = () => {
    setModelSelectorVisible(true)
  }

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      {/* 左侧会话列表 */}
      <div style={{
        width: sidebarVisible ? '280px' : '0px',
        minWidth: sidebarVisible ? '280px' : '0px',
        backgroundColor: '#fafafa',
        borderRight: sidebarVisible ? '1px solid #e8e8e8' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.3s ease, min-width 0.3s ease'
      }}>
        {sidebarVisible && (
          <>
            {/* 会话列表头部 */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e8e8e8',
              backgroundColor: '#fff'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  onClick={createNewSession}
                  loading={loading}
                  size="large"
                  title="新建会话"
                  style={{
                    color: '#666',
                    fontSize: '16px'
                  }}
                />
                <Button
                  type="text"
                  icon={<ClearOutlined />}
                  onClick={async () => {
                    if (sessions.length === 0) return

                    try {
                      // 删除所有会话
                      for (const session of sessions) {
                        await deleteSession(session.id)
                      }
                    } catch (error) {
                      console.error('清空会话失败:', error)
                    }
                  }}
                  disabled={sessions.length === 0}
                  size="large"
                  title="清空所有会话"
                  style={{
                    color: sessions.length > 0 ? '#666' : '#d9d9d9',
                    fontSize: '16px'
                  }}
                />
              </div>
            </div>

            {/* 会话列表内容 */}
            <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#fff' }}>
              <SessionList
                sessions={sessions}
                currentSession={currentSession}
                onSelectSession={selectSession}
                onDeleteSession={deleteSession}
                onUpdateSessionTitle={onUpdateSessionTitleProp}
                onDeleteAllSessions={deleteAllSessions}
              />
            </div>
          </>
        )}
      </div>

      {/* 右侧聊天内容区域 */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
          {currentSession ? (
            <>
              {/* 消息列表 */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <MessageList 
                  messages={messages} 
                  loading={sendingMessage}
                />
              </div>
              
              {/* 消息输入区域 */}
              <div style={{
                borderTop: '1px solid #f0f0f0',
                padding: '16px'
              }}>
                {/* 配置和模型选择器 */}
                <div style={{
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  maxWidth: '800px',
                  margin: '0 auto 12px auto',
                  flexWrap: 'wrap'
                }}>
                  {/* AI配置选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '14px',
                      color: '#666',
                      minWidth: '40px'
                    }}>
                      配置:
                    </span>
                    <Select
                      value={selectedConfig}
                      onChange={(value) => {
                        setSelectedConfig(value)
                        setSelectedModel('') // 清空模型选择，等待新配置的模型加载
                      }}
                      style={{
                        minWidth: '120px'
                      }}
                      placeholder="选择配置"
                      disabled={sendingMessage}
                      size="middle"
                      options={aiConfigs.map(config => ({
                        value: config.name,
                        label: config.name,
                        title: `${config.name} - ${config.base_url}`
                      }))}
                    />
                  </div>

                  {/* AI模型选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '14px',
                      color: '#666',
                      minWidth: '40px'
                    }}>
                      模型:
                    </span>
                    <Select
                      value={selectedModel}
                      onChange={handleModelSelect}
                      style={{
                        minWidth: '200px',
                        flex: 1
                      }}
                      placeholder="选择AI模型"
                      loading={loadingModels}
                      disabled={sendingMessage || !selectedConfig}
                      size="middle"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={availableModels.map(model => ({
                        value: model.id,
                        label: model.name || model.id,
                        title: model.description
                      }))}
                    />
                  </div>

                  {/* AI角色选择 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '14px',
                      color: '#666',
                      minWidth: '40px'
                    }}>
                      角色:
                    </span>
                    <Button
                      onClick={onBackToRoleSelector}
                      style={{
                        minWidth: '200px',
                        flex: 1,
                        textAlign: 'left'
                      }}
                      size="middle"
                    >
                      {selectedRole ? selectedRole.name : '选择AI角色'}
                    </Button>
                  </div>
                </div>

                <MessageInput
                  onSendMessage={sendMessage}
                  disabled={sendingMessage}
                  placeholder={sendingMessage ? 'AI正在思考中...' : '输入消息...'}
                  toolCount={tools.length}
                  isCallingTool={isCallingTool}
                />
              </div>
            </>
          ) : (
            // 欢迎界面
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: '#666'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '24px' }}>💬</div>
              <h2 style={{ color: '#666', marginBottom: '16px' }}>
                欢迎使用 DeeChat
              </h2>
              <Button 
                type="primary" 
                size="large"
                icon={<PlusOutlined />}
                onClick={createNewSession}
                loading={loading}
                disabled={!selectedConfig}
              >
                创建新会话
              </Button>
            </div>
          )}
      </div>

      {/* 模型选择弹窗 */}
      <ModelSelectorModal
        visible={modelSelectorVisible}
        onCancel={() => setModelSelectorVisible(false)}
        onSelect={handleModelSelect}
        models={availableModels}
        selectedModel={selectedModel}
        loading={loadingModels}
      />
    </div>
  )
}

export default ChatPage