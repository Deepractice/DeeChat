/**
 * AssistantMessage - AI助手消息组件
 *
 * 职责:
 * 1. 渲染AI助手消息气泡（左对齐）
 * 2. 显示AI头像
 * 3. 显示时间线内容（文本 + 工具执行）
 * 4. 显示Token使用信息
 */

import React from 'react'
import { Avatar, Typography } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { formatTime } from '../../utils/messageParser'
import type { ConversationMessage } from '../../types/preload'

const { Text } = Typography

interface AssistantMessageProps {
  message: ConversationMessage
  renderTimelineContent: () => React.ReactNode
}

const AssistantMessage: React.FC<AssistantMessageProps> = ({ message, renderTimelineContent }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        marginBottom: '16px',
        alignItems: 'flex-start'
      }}
    >
      {/* 头像 */}
      <Avatar
        icon={<RobotOutlined />}
        style={{
          backgroundColor: '#52c41a',
          flexShrink: 0,
          margin: '0 12px 0 0'
        }}
      />

      {/* 消息内容 */}
      <div
        style={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}
      >
        {/* 消息气泡 */}
        <div
          style={{
            background: '#fff',
            color: '#333',
            padding: '12px 16px',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            wordBreak: 'break-word',
            position: 'relative'
          }}
        >
          {/* 消息内容 - 支持时间线混合内容显示 */}
          <div>{renderTimelineContent()}</div>

          {/* Token使用信息 */}
          {message.token_usage && (
            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #f0f0f0',
                fontSize: '12px',
                opacity: 0.8
              }}
            >
              Token: {message.token_usage.total_tokens}
              (输入: {message.token_usage.prompt_tokens}, 输出: {message.token_usage.completion_tokens})
            </div>
          )}
        </div>

        {/* 时间戳 */}
        <Text
          type="secondary"
          style={{
            fontSize: '12px',
            marginTop: '4px',
            marginLeft: '16px'
          }}
        >
          {formatTime(message.timestamp)}
        </Text>
      </div>
    </div>
  )
}

export default AssistantMessage