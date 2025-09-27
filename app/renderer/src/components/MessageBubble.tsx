import React from 'react'
import { Avatar, Typography, Tag, Space, Button } from 'antd'
import { UserOutlined, RobotOutlined, SettingOutlined, DatabaseOutlined, CheckCircleOutlined, ExclamationCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import type { ConversationMessage } from '../../preload'
import ToolMessage from './ToolMessage'

const { Text, Paragraph } = Typography

// 工具执行信息类型（与ChatPage.tsx中的EmbeddedToolExecution相同）
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

interface MessageBubbleProps {
  message: ConversationMessage
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'
  const toolExecutions = message.metadata?.toolExecutions as EmbeddedToolExecution[] || []
  const toolExecution = message.metadata?.toolExecution
  const toolExecutionSteps = message.metadata?.toolExecutionSteps || []
  const timeline = message.metadata?.timeline || []

  // 渲染基于时间线的混合内容（新方法）
  const renderTimelineContent = () => {
    if (timeline.length === 0) {
      // 如果没有时间线数据，回退到原有方式
      return message.content ? renderMixedContent(message.content) : null
    }

    return timeline.map((item, index) => {
      if (item.type === 'text') {
        return (
          <div key={item.id} style={{ marginBottom: index < timeline.length - 1 ? '8px' : '0' }}>
            <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {item.content}
            </span>
          </div>
        )
      } else if (item.type === 'tool' && item.toolExecution) {
        // 转换为 ToolMessage 需要的步骤格式
        const toolStep = {
          id: item.toolExecution.id,
          toolName: item.toolExecution.toolName,
          serverId: item.toolExecution.serverId,
          status: item.toolExecution.status,
          parameters: item.toolExecution.arguments,
          result: item.toolExecution.result,
          error: item.toolExecution.error,
          startTime: item.toolExecution.startTime,
          endTime: item.toolExecution.endTime
        }

        return (
          <div key={item.id} style={{ marginBottom: index < timeline.length - 1 ? '8px' : '0' }}>
            <ToolMessage
              steps={[toolStep]}
              onCopyResult={(result) => {
                console.log('复制结果:', result)
              }}
            />
          </div>
        )
      }
      return null
    })
  }

  // 解析混合内容：包含文本和工具执行标记（旧方法，作为回退）
  const renderMixedContent = (content: string) => {
    if (!content) return null

    // 检测工具执行标记的正则表达式
    const toolPattern = /(✅ \*\*工具执行完成\*\*\n结果: (.+))|(❌ \*\*工具执行失败\*\*\n错误: (.+))/g

    // 如果没有工具标记，直接返回文本
    if (!toolPattern.test(content)) {
      return content
    }

    // 重置正则表达式
    toolPattern.lastIndex = 0

    const parts = []
    let lastIndex = 0
    let match

    while ((match = toolPattern.exec(content)) !== null) {
      // 添加工具标记前的文本
      if (match.index > lastIndex) {
        const textPart = content.substring(lastIndex, match.index)
        if (textPart.trim()) {
          parts.push(
            <span key={`text-${parts.length}`}>
              {textPart}
            </span>
          )
        }
      }

      // 解析工具执行信息
      const isSuccess = match[1] !== undefined
      const result = isSuccess ? match[2] : match[4]
      const toolName = '未知工具' // 暂时硬编码，后续可以从内容中提取

      // 创建简化的工具步骤对象
      const toolStep = {
        id: `tool-${parts.length}`,
        toolName,
        status: isSuccess ? 'completed' as const : 'error' as const,
        result: isSuccess ? result : undefined,
        error: isSuccess ? undefined : result,
        parameters: undefined
      }

      // 添加工具执行块
      parts.push(
        <div key={`tool-${parts.length}`} className="tool-inline-block">
          <ToolMessage
            steps={[toolStep]}
            onCopyResult={(result) => {
              // 复制结果的处理
              console.log('复制结果:', result)
            }}
          />
        </div>
      )

      lastIndex = match.index + match[0].length
    }

    // 添加最后剩余的文本
    if (lastIndex < content.length) {
      const remainingText = content.substring(lastIndex)
      if (remainingText.trim()) {
        parts.push(
          <span key={`text-${parts.length}`}>
            {remainingText}
          </span>
        )
      }
    }

    return parts.length > 0 ? <>{parts}</> : content
  }

  // 格式化时间
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取工具执行状态图标
  const getToolStatusIcon = (status: EmbeddedToolExecution['status']) => {
    switch (status) {
      case 'executing':
        return <LoadingOutlined style={{ color: '#1890ff' }} spin />
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <DatabaseOutlined style={{ color: '#1890ff' }} />
    }
  }

  // 获取工具执行状态标签
  const getToolStatusTag = (status: EmbeddedToolExecution['status']) => {
    switch (status) {
      case 'executing':
        return <Tag color="processing">执行中</Tag>
      case 'completed':
        return <Tag color="success">成功</Tag>
      case 'error':
        return <Tag color="error">失败</Tag>
      default:
        return <Tag color="blue">{status}</Tag>
    }
  }

  if (isSystem) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '16px 0'
      }}>
        <Tag
          icon={<SettingOutlined />}
          color="blue"
          style={{
            padding: '4px 12px',
            borderRadius: '16px'
          }}
        >
          系统消息: {message.content}
        </Tag>
      </div>
    )
  }

  // 处理工具执行消息
  if (isTool && toolExecution) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '12px 0'
      }}>
        <div style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getToolStatusIcon(toolExecution.status)}
            <Text strong style={{ fontSize: '14px' }}>
              {message.content}
            </Text>
            <Tag size="small" color="blue">{toolExecution.serverId}</Tag>
            {getToolStatusTag(toolExecution.status)}
          </div>

          {/* 显示工具参数 */}
          {toolExecution.arguments && Object.keys(toolExecution.arguments).length > 0 && (
            <div style={{
              background: '#f1f3f4',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}>
              <Text type="secondary">参数:</Text>
              <div style={{ marginTop: '4px' }}>
                {JSON.stringify(toolExecution.arguments, null, 2)}
              </div>
            </div>
          )}

          {/* 显示错误信息 */}
          {toolExecution.error && (
            <div style={{
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '12px',
              color: '#ff4d4f'
            }}>
              <Text type="danger" strong>错误: </Text>
              {toolExecution.error}
            </div>
          )}

          {/* 显示结果 */}
          {toolExecution.result && toolExecution.status === 'completed' && (
            <div style={{
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '12px',
              color: '#52c41a',
              maxHeight: '150px',
              overflow: 'auto'
            }}>
              <Text style={{ fontSize: '12px', color: '#52c41a' }} strong>结果: </Text>
              <div style={{ marginTop: '4px', fontFamily: 'monospace' }}>
                {typeof toolExecution.result === 'string'
                  ? (toolExecution.result.length > 300 ? toolExecution.result.substring(0, 300) + '...' : toolExecution.result)
                  : JSON.stringify(toolExecution.result, null, 2).substring(0, 300) + '...'
                }
              </div>
            </div>
          )}

          {/* 执行时间 */}
          <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center' }}>
            {formatTime(message.timestamp)}
            {toolExecution.endTime && toolExecution.startTime && (
              <span> • 耗时: {Math.round((toolExecution.endTime - toolExecution.startTime) / 1000 * 100) / 100}s</span>
            )}
          </Text>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      marginBottom: '16px',
      alignItems: 'flex-start'
    }}>
      {/* 头像 */}
      <Avatar 
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{ 
          backgroundColor: isUser ? '#1890ff' : '#52c41a',
          flexShrink: 0,
          margin: isUser ? '0 0 0 12px' : '0 12px 0 0'
        }} 
      />
      
      {/* 消息内容 */}
      <div style={{
        maxWidth: '70%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start'
      }}>
        {/* 消息气泡 */}
        <div style={{
          background: isUser ? '#1890ff' : '#fff',
          color: isUser ? '#fff' : '#333',
          padding: '12px 16px',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          wordBreak: 'break-word',
          position: 'relative'
        }}>
          {/* 消息内容 - 支持时间线混合内容显示 */}
          <div>
            {renderTimelineContent()}
          </div>


          {/* Token使用信息 */}
          {message.token_usage && (
            <div style={{
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : '#f0f0f0'}`,
              fontSize: '12px',
              opacity: 0.8
            }}>
              Token: {message.token_usage.total_tokens}
              (输入: {message.token_usage.prompt_tokens},
              输出: {message.token_usage.completion_tokens})
            </div>
          )}
        </div>
        
        {/* 时间戳 */}
        <Text 
          type="secondary" 
          style={{ 
            fontSize: '12px', 
            marginTop: '4px',
            marginLeft: isUser ? 0 : '16px',
            marginRight: isUser ? '16px' : 0
          }}
        >
          {formatTime(message.timestamp)}
        </Text>
      </div>
    </div>
  )
}

export default MessageBubble