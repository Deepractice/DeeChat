/**
 * SystemMessage - 系统消息组件
 *
 * 职责:
 * 1. 渲染居中的系统消息标签
 * 2. 显示系统图标
 */

import React from 'react'
import { Tag } from 'antd'
import { SettingOutlined } from '@ant-design/icons'

interface SystemMessageProps {
  content: string
}

const SystemMessage: React.FC<SystemMessageProps> = ({ content }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '16px 0'
      }}
    >
      <Tag
        icon={<SettingOutlined />}
        color="blue"
        style={{
          padding: '4px 12px',
          borderRadius: '16px'
        }}
      >
        系统消息: {content}
      </Tag>
    </div>
  )
}

export default SystemMessage