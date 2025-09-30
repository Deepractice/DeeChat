/**
 * UserMessage - 用户消息组件
 *
 * 职责:
 * 1. 渲染用户消息气泡（右对齐）
 * 2. 显示用户头像
 * 3. 显示时间戳
 */

import React from 'react'
import { Avatar, Typography } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { formatTime } from '../../utils/messageParser'

const { Text } = Typography

interface UserMessageProps {
  content: string
  timestamp: string
}

const UserMessage: React.FC<UserMessageProps> = ({ content, timestamp }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row-reverse',
        marginBottom: '16px',
        alignItems: 'flex-start'
      }}
    >
      {/* 头像 */}
      <Avatar
        icon={<UserOutlined />}
        style={{
          backgroundColor: '#1890ff',
          flexShrink: 0,
          margin: '0 0 0 12px'
        }}
      />

      {/* 消息内容 */}
      <div
        style={{
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}
      >
        {/* 消息气泡 */}
        <div
          style={{
            background: '#1890ff',
            color: '#fff',
            padding: '12px 16px',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            wordBreak: 'break-word',
            position: 'relative'
          }}
        >
          <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{content}</span>
        </div>

        {/* 时间戳 */}
        <Text
          type="secondary"
          style={{
            fontSize: '12px',
            marginTop: '4px',
            marginRight: '16px'
          }}
        >
          {formatTime(timestamp)}
        </Text>
      </div>
    </div>
  )
}

export default UserMessage