import React, { useState, useEffect, useRef } from 'react'
import { Layout, Button, Drawer, Select, message, Spin } from 'antd'
import { MenuOutlined, PlusOutlined, SettingOutlined, RobotOutlined, DownOutlined } from '@ant-design/icons'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import SessionList from './SessionList'
import ModelSelectorModal from './ModelSelectorModal'
import type {
  ConversationSession,
  ConversationMessage,
  AIConfig
} from '../../../main/preload'

const { Header, Content, Sider } = Layout

interface ChatPageProps {
  onBackToConfig: () => void
}

const ChatPage: React.FC<ChatPageProps> = ({ onBackToConfig }) => {
  // 状态管理
  const [sessions, setSessions] = useState<ConversationSession[]>([])
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [aiConfigs, setAiConfigs] = useState<AIConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<string>('')
  const [sidebarVisible, setSidebarVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false)

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

  // 流式响应状态
  const [currentAiMessage, setCurrentAiMessage] = useState<ConversationMessage | null>(null)
  const [streamingContent, setStreamingContent] = useState<string>('')

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

    // 如果没有当前会话，但事件中有sessionId，可以继续处理
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

          setStreamingContent(prev => {
            const newContent = prev + chunkContent
            const currentAiFromRef = currentAiMessageRef.current

            if (!currentAiFromRef) {
              // 创建新的AI消息
              const newAiMessage: ConversationMessage = {
                id: `ai_${Date.now()}`,
                session_id: sessionFromRef?.id || event.sessionId || '',
                role: 'assistant',
                content: newContent,
                timestamp: new Date().toISOString()
              }
              setCurrentAiMessage(newAiMessage)
              setMessages(prev => [...prev, newAiMessage])
            } else {
              // 更新现有AI消息内容
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === currentAiFromRef.id
                    ? { ...msg, content: newContent }
                    : msg
                )
              )
            }

            return newContent
          })
        }
        break

      case 'ai_complete':
        // AI响应完成，用最终消息替换
        const finalAiMessage = event.data
        const currentAiFromRefComplete = currentAiMessageRef.current
        if (currentAiFromRefComplete) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === currentAiFromRefComplete.id ? finalAiMessage : msg
            )
          )
        }
        // 重置流式状态
        setCurrentAiMessage(null)
        setStreamingContent('')
        break

      case 'error':
        console.error('AI响应错误:', event.data.error)
        message.error(event.data.error || 'AI响应失败')
        // 重置流式状态
        setCurrentAiMessage(null)
        setStreamingContent('')
        break
    }
  }

  // 设置流式事件监听器
  const setupStreamListeners = () => {
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
      message.error(data.error || '流式处理失败')
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
        // 自动选择第一个配置
        if (result.data.length > 0) {
          setSelectedConfig(result.data[0].name)
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

  // 加载可用模型
  const loadModels = async () => {
    if (!selectedConfig) return
    setLoadingModels(true)
    try {
      const modelsResult = await window.electronAPI.aiConfig.getModels(selectedConfig)
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
        const prefResult = await window.electronAPI.aiConfig.getModelPreference(selectedConfig)
        if (prefResult.success && prefResult.data) {
          setSelectedModel(prefResult.data)
        } else if (models.length > 0) {
          const firstModelId = models[0].id
          setSelectedModel(firstModelId)
          // 保存默认偏好
          await window.electronAPI.aiConfig.setModelPreference(selectedConfig, firstModelId)
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
      
      // 构建会话创建参数
      const sessionInput = {
        title: `新对话 ${new Date().toLocaleString()}`,
        ai_config: {
          baseUrl: config.base_url,
          model: selectedModel || 'gpt-3.5-turbo',
          apiKey: config.api_key,
          temperature: 0.7,
          maxTokens: 4000
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
        setSidebarVisible(false)
        message.success('创建会话成功')
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
    setSidebarVisible(false)
    
    try {
      const result = await window.electronAPI.conversation.getMessageHistory(session.id)
      if (result.success && result.data) {
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

      // 重置流式状态
      setCurrentAiMessage(null)
      setStreamingContent('')

      // 发送流式请求（触发实时流式响应）
      const result = await window.electronAPI.conversation.sendMessageStream({
        session_id: currentSession.id,
        content: content.trim(),
        ai_config: {
          baseUrl: config.base_url,
          model: selectedModel || 'gpt-3.5-turbo',
          apiKey: config.api_key,
          temperature: 0.7,
          maxTokens: 4000
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
          setMessages([])
        }
        message.success('删除会话成功')
      } else {
        message.error(result.error || '删除会话失败')
      }
    } catch (error) {
      message.error('删除会话失败')
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
    <Layout style={{ height: '100vh' }}>
      {/* 侧边栏抽屉 */}
      <Drawer
        title="会话列表"
        placement="left"
        onClose={() => setSidebarVisible(false)}
        open={sidebarVisible}
        width={320}
      >
        <div style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={createNewSession}
            loading={loading}
            block
          >
            新建会话
          </Button>
        </div>
        <SessionList
          sessions={sessions}
          currentSession={currentSession}
          onSelectSession={selectSession}
          onDeleteSession={deleteSession}
        />
      </Drawer>

      {/* 主布局 */}
      <Layout>
        {/* 顶部导航 */}
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setSidebarVisible(true)}
            />
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
              {currentSession ? currentSession.title : 'DeeChat'}
            </h1>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Select
              value={selectedConfig}
              onChange={setSelectedConfig}
              placeholder="选择AI配置"
              style={{ width: 200 }}
              options={aiConfigs.map(config => ({
                label: config.name,
                value: config.name
              }))}
            />
            <Button
              icon={<RobotOutlined />}
              onClick={openModelSelector}
              disabled={!selectedConfig || loadingModels}
              loading={loadingModels}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                minWidth: '150px',
                maxWidth: '200px'
              }}
            >
              <span style={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginRight: '4px'
              }}>
                {selectedModel || '选择模型'}
              </span>
              <DownOutlined style={{ fontSize: '10px' }} />
            </Button>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={onBackToConfig}
            />
          </div>
        </Header>

        {/* 聊天内容区域 */}
        <Content style={{ 
          display: 'flex', 
          flexDirection: 'column',
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
              
              {/* 消息输入 */}
              <div style={{ 
                borderTop: '1px solid #f0f0f0',
                padding: '16px'
              }}>
                <MessageInput
                  onSendMessage={sendMessage}
                  disabled={sendingMessage}
                  placeholder={sendingMessage ? 'AI正在思考中...' : '输入消息...'}
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
        </Content>
      </Layout>

      {/* 模型选择弹窗 */}
      <ModelSelectorModal
        visible={modelSelectorVisible}
        onCancel={() => setModelSelectorVisible(false)}
        onSelect={handleModelSelect}
        models={availableModels}
        selectedModel={selectedModel}
        loading={loadingModels}
      />
    </Layout>
  )
}

export default ChatPage