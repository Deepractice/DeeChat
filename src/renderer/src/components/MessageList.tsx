import React, { useState, useEffect } from 'react'
import { Avatar, Card, Typography, Space, Tag, Spin } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { ChatMessage } from '../../../shared/types'
import TypewriterText from './TypewriterText'
import ToolCallDisplay from './ToolCallDisplay'
import MessageRenderer from './MessageRenderer'
import StreamingDisplay from '../streaming/StreamingDisplay'
import { useStreamProcessor } from '../streaming/useStreamProcessor'

const { Text, Paragraph } = Typography

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
  currentToolExecution?: string // 当前正在执行的工具名称
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, currentToolExecution }) => {
  const [loadingText, setLoadingText] = useState('AI正在思考中')
  const [dotCount, setDotCount] = useState(0)
  const [lastMessageId, setLastMessageId] = useState<string | null>(null)
  
  // 🔥 从Redux获取流式状态
  const streamingMessage = useSelector((state: RootState) => state.chat.streamingMessage)
  
  // 🔥 使用新的流式处理器
  const streamProcessor = useStreamProcessor({
    onComplete: () => {
      console.log('🎉 流式消息处理完成')
    },
    onError: (chunk) => {
      console.error('❌ 流式消息处理失败:', chunk.error)
    }
  })

  // 动态加载文本效果 - 修复无限重渲染问题
  useEffect(() => {
    if (!isLoading) {
      setLoadingText('')
      setDotCount(0)
      return
    }

    // 获取加载文本，避免在useEffect中重复创建
    const getLoadingTexts = () => {
      if (currentToolExecution) {
        const toolActionMap: Record<string, string> = {
          'context7_resolve-library-id': '正在查找相关资源库',
          'context7_get-library-docs': '正在获取技术文档', 
          'promptx_welcome': '正在获取可用角色',
          'promptx_action': '正在激活专业角色',
          'promptx_remember': '正在记忆重要信息',
          'promptx_recall': '正在检索相关记忆',
          'web-search': '正在搜索网络信息',
          'file-read': '正在读取文件内容',
          'code-execution': '正在执行代码'
        }
        const toolAction = toolActionMap[currentToolExecution] || `正在使用 ${currentToolExecution} 工具`
        return [
          toolAction,
          '正在处理工具响应',
          '即将完成操作',
          '正在整理结果'
        ]
      }
      
      return [
        'AI正在思考中',
        '正在分析您的问题', 
        '正在生成回复',
        '即将完成回复'
      ]
    }

    const loadingTexts = getLoadingTexts()
    
    // 设置初始文本
    setLoadingText(loadingTexts[0])
    setDotCount(0)

    const textInterval = setInterval(() => {
      setLoadingText(prev => {
        const currentIndex = loadingTexts.indexOf(prev)
        return loadingTexts[(currentIndex + 1) % loadingTexts.length]
      })
    }, 2000)

    const dotInterval = setInterval(() => {
      setDotCount(prev => (prev + 1) % 4)
    }, 500)

    return () => {
      clearInterval(textInterval)
      clearInterval(dotInterval)
    }
  }, [isLoading, currentToolExecution])

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 🔥 在useEffect中更新lastMessageId，避免在render中setState
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage.role === 'assistant' && lastMessage.id !== lastMessageId) {
        setLastMessageId(lastMessage.id)
      }
    }
  }, [messages, lastMessageId])

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user'
    const isLatestAIMessage = !isUser && index === messages.length - 1 && message.id !== lastMessageId
    
    // 处理空内容消息：有工具执行的消息不显示占位文本
    const hasToolExecutions = message.toolExecutions && message.toolExecutions.length > 0
    const displayContent = (!message.content || message.content.trim() === '') 
      ? (isUser ? '[空消息]' : (hasToolExecutions ? '' : '[AI回复为空]')) 
      : message.content

    return (
      <div
        key={message.id}
        style={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          {/* 头像 */}
          <Avatar
            size={32}
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? '#1890ff' : '#52c41a',
              flexShrink: 0,
            }}
          />

          {/* 消息内容 */}
          <Card
            size="small"
            style={{
              backgroundColor: isUser ? '#1890ff' : '#f6f6f6',
              border: 'none',
              borderRadius: '12px',
              maxWidth: '100%',
            }}
            styles={{
              body: {
                padding: '12px 16px',
              }
            }}
          >
            <div>
              {/* 智能内容渲染 - 只在有显示内容时渲染 */}
              {displayContent && (
                <MessageRenderer 
                  content={displayContent}
                  style={{
                    margin: 0,
                    color: isUser ? '#fff' : '#000',
                  }}
                />
              )}

              {/* 工具调用显示 - 只在AI消息中显示 */}
              {!isUser && message.toolExecutions && message.toolExecutions.length > 0 && (
                <div style={{ marginTop: displayContent ? '12px' : '0' }}>
                  {message.toolExecutions.map((execution) => (
                    <ToolCallDisplay
                      key={execution.id}
                      toolId={execution.id}
                      toolName={execution.toolName}
                      toolArgs={execution.params}
                      status={execution.success === false ? 'error' : 'success'}
                      result={execution.result}
                      error={execution.error}
                      duration={execution.duration}
                      timestamp={execution.timestamp}
                      defaultExpanded={false}
                    />
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: '11px',
                    color: isUser ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)',
                  }}
                >
                  {formatTime(message.timestamp)}
                </Text>
                
                {message.modelId && (
                  <Tag
                    style={{
                      fontSize: '10px',
                      margin: 0,
                      backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
                      color: isUser ? '#fff' : '#666',
                      border: 'none',
                    }}
                  >
                    {message.modelId}
                  </Tag>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div>
      {messages.map((message, index) => renderMessage(message, index))}
      
      {/* 🔥 新的流式消息显示 - 使用Redux状态 */}
      {streamingMessage.isActive && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              maxWidth: '70%'
            }}
          >
            <Avatar
              size={32}
              icon={<RobotOutlined />}
              style={{
                backgroundColor: '#52c41a',
                flexShrink: 0,
              }}
            />
            
            <Card
              size="small"
              style={{
                backgroundColor: '#f6f6f6',
                border: 'none',
                borderRadius: '12px',
                maxWidth: '100%',
              }}
              styles={{
                body: {
                  padding: '12px 16px',
                }
              }}
            >
              {/* 显示流式文本内容 */}
              <div style={{ minHeight: '20px' }}>
                {streamingMessage.updates
                  .filter(update => update.type === 'text')
                  .map((update, index) => (
                    <span key={`streaming-text-${streamingMessage.sessionId}-${index}-${Date.now()}`} style={{ color: '#000' }}>
                      {update.content}
                    </span>
                  ))}
                {/* 显示光标 */}
                <span
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '16px',
                    backgroundColor: '#1890ff',
                    marginLeft: '2px',
                    animation: 'blink 1s infinite',
                  }}
                />
              </div>
              
              {/* 显示工具执行状态 */}
              {streamingMessage.updates
                .filter(update => update.type === 'tool_start')
                .map((update, index) => (
                  <div key={`streaming-tool-${streamingMessage.sessionId}-${index}-${update.toolName || 'unknown'}`} style={{ 
                    marginTop: '8px', 
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #f6f8ff 0%, #e8f4ff 100%)',
                    borderRadius: '6px',
                    borderLeft: '3px solid #1890ff'
                  }}>
                    <Space>
                      <RobotOutlined spin style={{ color: '#1890ff' }} />
                      <Text style={{ color: '#1890ff', fontSize: '12px' }}>
                        正在使用 {update.toolName} 工具...
                      </Text>
                    </Space>
                  </div>
                ))}
                
              <style>
                {`
                  @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                  }
                `}
              </style>
            </Card>
          </div>
        </div>
      )}
      
      {/* 加载状态（传统模式） */}
      {isLoading && !streamingMessage.isActive && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
            }}
          >
            <Avatar
              size={32}
              icon={<RobotOutlined />}
              style={{
                backgroundColor: '#52c41a',
                flexShrink: 0,
              }}
            />
            
            <Card
              size="small"
              style={{
                backgroundColor: '#f6f6f6',
                border: 'none',
                borderRadius: '12px',
                minWidth: '200px',
              }}
              styles={{
                body: {
                  padding: '12px 16px',
                }
              }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Spin size="small" />
                  <Text type="secondary">
                    {loadingText}{'·'.repeat(dotCount)}
                  </Text>
                </Space>
                {currentToolExecution && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px',
                    background: 'linear-gradient(135deg, #f6f8ff 0%, #e8f4ff 100%)',
                    borderRadius: '8px',
                    borderLeft: '3px solid #1890ff'
                  }}>
                    <Space>
                      <RobotOutlined spin style={{ color: '#1890ff' }} />
                      <Text style={{ color: '#1890ff', fontSize: '12px' }}>
                        使用 {currentToolExecution} 工具中...
                      </Text>
                    </Space>
                  </div>
                )}
              </Space>

              {/* 打字机效果的光标 */}
              <div
                style={{
                  marginTop: '8px',
                  height: '2px',
                  width: '12px',
                  backgroundColor: '#1890ff',
                  animation: 'blink 1s infinite',
                }}
              />

              <style>
                {`
                  @keyframes blink {
                    0%, 50% { opacity: 1; }
                    51%, 100% { opacity: 0; }
                  }
                `}
              </style>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

export default MessageList
