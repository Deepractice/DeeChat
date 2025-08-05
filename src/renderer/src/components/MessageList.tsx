import React, { useState, useEffect } from 'react'
import { Avatar, Card, Typography, Space, Tag, Spin } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import { ChatMessage } from '../../../shared/types'
import TypewriterText from './TypewriterText'
import ConversationalToolCall from './ConversationalToolCall'

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

  // 动态加载文本效果
  useEffect(() => {
    if (!isLoading) return

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

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.role === 'user'
    const isLatestAIMessage = !isUser && index === messages.length - 1 && message.id !== lastMessageId

    // 更新最后一条消息ID
    if (isLatestAIMessage) {
      setLastMessageId(message.id)
    }

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
              <Paragraph
                style={{
                  margin: 0,
                  color: isUser ? '#fff' : '#000',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {isLatestAIMessage ? (
                  <TypewriterText
                    text={message.content}
                    speed={30}
                  />
                ) : (
                  message.content
                )}
              </Paragraph>

              {/* 对话式工具调用显示 - 只在AI消息中显示 */}
              {!isUser && message.toolExecutions && message.toolExecutions.length > 0 && (
                <ConversationalToolCall 
                  toolExecutions={message.toolExecutions}
                  isExecuting={false}
                />
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
      
      {/* 加载状态 */}
      {isLoading && (
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
