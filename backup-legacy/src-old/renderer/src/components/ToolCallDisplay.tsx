/**
 * ToolCallDisplay - 工具调用显示组件
 * 
 * 用于在流式消息中显示工具调用的开始、执行和结果
 * 支持统一流式架构中的工具调用事件
 */

import React, { useState, useEffect } from 'react'
import { Card, Tag, Collapse, Typography, Space, Spin, Alert, Button } from 'antd'
import { 
  ToolOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  ClockCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined 
} from '@ant-design/icons'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

interface ToolCallDisplayProps {
  /** 工具调用ID */
  toolId: string
  /** 工具名称 */
  toolName: string
  /** 工具参数 */
  toolArgs?: Record<string, any>
  /** 工具调用状态 */
  status: 'calling' | 'success' | 'error'
  /** 工具执行结果 */
  result?: any
  /** 错误信息 */
  error?: string
  /** 执行耗时（毫秒） */
  duration?: number
  /** 阶段描述 */
  stage?: string
  /** 时间戳 */
  timestamp?: number
  /** 是否默认展开 */
  defaultExpanded?: boolean
}

const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolId,
  toolName,
  toolArgs,
  status,
  result,
  error,
  duration,
  stage,
  timestamp,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showFullResult, setShowFullResult] = useState(false)

  // 根据状态获取图标和颜色
  const getStatusInfo = () => {
    switch (status) {
      case 'calling':
        return {
          icon: <ClockCircleOutlined spin />,
          color: 'processing',
          text: stage || '正在执行...'
        }
      case 'success':
        return {
          icon: <CheckCircleOutlined />,
          color: 'success',
          text: stage || '执行成功'
        }
      case 'error':
        return {
          icon: <ExclamationCircleOutlined />,
          color: 'error', 
          text: stage || '执行失败'
        }
    }
  }

  const statusInfo = getStatusInfo()

  // 格式化工具参数显示
  const formatArgs = (args: Record<string, any>) => {
    if (!args || Object.keys(args).length === 0) return '无参数'
    
    return Object.entries(args)
      .map(([key, value]) => (
        <div key={key} style={{ marginBottom: '4px' }}>
          <Text strong>{key}:</Text> 
          <Text code style={{ marginLeft: '8px' }}>
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </Text>
        </div>
      ))
  }

  // 格式化结果显示
  const formatResult = (result: any) => {
    if (result === null || result === undefined) return '无结果'
    
    if (typeof result === 'string') {
      return showFullResult || result.length <= 200 
        ? result 
        : result.slice(0, 200) + '...'
    }
    
    if (typeof result === 'object') {
      const jsonStr = JSON.stringify(result, null, 2)
      return showFullResult || jsonStr.length <= 500
        ? jsonStr
        : jsonStr.slice(0, 500) + '...'
    }
    
    return String(result)
  }

  // 格式化时间显示
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  // 格式化耗时显示
  const formatDuration = (ms?: number) => {
    if (!ms) return ''
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <Card
      size="small"
      style={{ 
        margin: '8px 0',
        border: `1px solid ${
          status === 'success' ? '#52c41a' : 
          status === 'error' ? '#ff4d4f' : 
          '#1890ff'
        }`,
        borderRadius: '6px'
      }}
      bodyStyle={{ padding: '12px' }}
    >
      {/* 工具调用头部 */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Space>
          <ToolOutlined style={{ color: '#1890ff' }} />
          <Text strong>{toolName}</Text>
          <Tag 
            icon={statusInfo.icon} 
            color={statusInfo.color}
            style={{ margin: 0 }}
          >
            {statusInfo.text}
          </Tag>
          {duration && (
            <Tag color="blue" style={{ margin: 0 }}>
              {formatDuration(duration)}
            </Tag>
          )}
        </Space>
        
        <Space>
          {timestamp && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {formatTime(timestamp)}
            </Text>
          )}
          <Button 
            type="text" 
            size="small" 
            icon={isExpanded ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          />
        </Space>
      </div>

      {/* 工具调用详情 */}
      {isExpanded && (
        <div style={{ marginTop: '12px' }}>
          {/* 工具参数 */}
          {toolArgs && Object.keys(toolArgs).length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                参数:
              </Text>
              <div style={{ 
                background: '#f5f5f5', 
                padding: '8px', 
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {formatArgs(toolArgs)}
              </div>
            </div>
          )}

          {/* 执行结果 */}
          {status !== 'calling' && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                结果:
              </Text>
              
              {status === 'error' && error ? (
                <Alert
                  message="执行失败" 
                  description={error}
                  type="error"
                  size="small"
                  style={{ marginBottom: '8px' }}
                />
              ) : (
                <div style={{
                  background: status === 'success' ? '#f6ffed' : '#fff2f0',
                  border: `1px solid ${status === 'success' ? '#b7eb8f' : '#ffccc7'}`,
                  borderRadius: '4px',
                  padding: '8px'
                }}>
                  <Paragraph 
                    style={{ 
                      margin: 0, 
                      fontSize: '12px',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace'
                    }}
                  >
                    {formatResult(result)}
                  </Paragraph>
                  
                  {/* 显示更多按钮 */}
                  {result && (
                    (typeof result === 'string' && result.length > 200) ||
                    (typeof result === 'object' && JSON.stringify(result).length > 500)
                  ) && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setShowFullResult(!showFullResult)}
                      style={{ padding: '0', marginTop: '4px' }}
                    >
                      {showFullResult ? '收起' : '显示完整结果'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* 执行中状态 */}
          {status === 'calling' && (
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <Spin size="small" />
              <Text style={{ marginLeft: '8px', color: '#666' }}>
                {stage || '正在执行工具...'}
              </Text>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default ToolCallDisplay