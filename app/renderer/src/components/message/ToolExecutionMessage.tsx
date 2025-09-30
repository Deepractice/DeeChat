/**
 * ToolExecutionMessage - 工具执行消息组件
 *
 * 职责:
 * 1. 渲染工具执行状态
 * 2. 显示工具参数、结果、错误
 * 3. 展示执行时间信息
 */

import React from 'react'
import { Typography, Tag } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  DatabaseOutlined
} from '@ant-design/icons'
import { formatTime } from '../../utils/messageParser'

const { Text } = Typography

interface ToolExecution {
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

interface ToolExecutionMessageProps {
  content: string
  toolExecution: ToolExecution
  timestamp: string
}

const ToolExecutionMessage: React.FC<ToolExecutionMessageProps> = ({
  content,
  toolExecution,
  timestamp
}) => {
  // 获取工具执行状态图标
  const getToolStatusIcon = (status: ToolExecution['status']) => {
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
  const getToolStatusTag = (status: ToolExecution['status']) => {
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

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '12px 0'
      }}
    >
      <div
        style={{
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '12px',
          padding: '12px 16px',
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* 工具名称和状态 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getToolStatusIcon(toolExecution.status)}
          <Text strong style={{ fontSize: '14px' }}>
            {content}
          </Text>
          <Tag size="small" color="blue">
            {toolExecution.serverId}
          </Tag>
          {getToolStatusTag(toolExecution.status)}
        </div>

        {/* 显示工具参数 */}
        {toolExecution.arguments && Object.keys(toolExecution.arguments).length > 0 && (
          <div
            style={{
              background: '#f1f3f4',
              padding: '8px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'monospace'
            }}
          >
            <Text type="secondary">参数:</Text>
            <div style={{ marginTop: '4px' }}>
              {JSON.stringify(toolExecution.arguments, null, 2)}
            </div>
          </div>
        )}

        {/* 显示错误信息 */}
        {toolExecution.error && (
          <div
            style={{
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '12px',
              color: '#ff4d4f'
            }}
          >
            <Text type="danger" strong>
              错误:{' '}
            </Text>
            {toolExecution.error}
          </div>
        )}

        {/* 显示结果 */}
        {toolExecution.result && toolExecution.status === 'completed' && (
          <div
            style={{
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '6px',
              padding: '8px',
              fontSize: '12px',
              color: '#52c41a',
              maxHeight: '150px',
              overflow: 'auto'
            }}
          >
            <Text style={{ fontSize: '12px', color: '#52c41a' }} strong>
              结果:{' '}
            </Text>
            <div style={{ marginTop: '4px', fontFamily: 'monospace' }}>
              {typeof toolExecution.result === 'string'
                ? toolExecution.result.length > 300
                  ? toolExecution.result.substring(0, 300) + '...'
                  : toolExecution.result
                : JSON.stringify(toolExecution.result, null, 2).substring(0, 300) + '...'}
            </div>
          </div>
        )}

        {/* 执行时间 */}
        <Text type="secondary" style={{ fontSize: '11px', textAlign: 'center' }}>
          {formatTime(timestamp)}
          {toolExecution.endTime && toolExecution.startTime && (
            <span>
              {' '}
              • 耗时:{' '}
              {Math.round(((toolExecution.endTime - toolExecution.startTime) / 1000) * 100) / 100}s
            </span>
          )}
        </Text>
      </div>
    </div>
  )
}

export default ToolExecutionMessage