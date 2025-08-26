/**
 * 统一流式显示组件
 * 
 * 设计原则：
 * - 单一组件，处理所有流式显示需求
 * - 高性能渲染，支持大型内容
 * - 清晰的UI状态反馈
 */

import React from 'react'
import { Card, Typography, Tag, Timeline, Space, Progress } from 'antd'
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined, ToolOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { StreamState } from './useStreamProcessor'
import MarkdownBlock from '../components/content/MarkdownBlock'

const { Text } = Typography

interface StreamingDisplayProps {
  state: StreamState
  className?: string
}

const StreamingContainer = styled(Card)`
  .ant-card-body {
    padding: 16px;
  }
  
  .streaming-content {
    min-height: 20px;
    line-height: 1.6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .tool-execution {
    margin: 8px 0;
    padding: 8px;
    background: #f5f5f5;
    border-radius: 6px;
    border-left: 3px solid #1890ff;
  }
  
  .tool-execution.success {
    border-left-color: #52c41a;
  }
  
  .tool-execution.error {
    border-left-color: #ff4d4f;
  }
  
  .streaming-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #e6f7ff;
    border: 1px solid #91d5ff;
    border-radius: 6px;
  }
`

const StreamingIndicator: React.FC<{ isStreaming: boolean }> = ({ isStreaming }) => {
  if (!isStreaming) return null

  return (
    <div className="streaming-indicator">
      <LoadingOutlined spin />
      <Text type="secondary">AI正在思考和处理中...</Text>
    </div>
  )
}

const ToolExecutionDisplay: React.FC<{ executions: any[] }> = ({ executions }) => {
  if (executions.length === 0) return null

  return (
    <div style={{ margin: '16px 0' }}>
      <Text strong>🔧 工具调用记录：</Text>
      <Timeline style={{ marginTop: 12 }}>
        {executions.map((execution, index) => {
          const isSuccess = execution.success
          const icon = isSuccess ? 
            <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />

          return (
            <Timeline.Item key={execution.toolId || index} dot={icon}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <ToolOutlined />
                  <Text strong>{execution.toolName}</Text>
                  <Tag color={isSuccess ? 'success' : 'error'}>
                    {isSuccess ? '成功' : '失败'}
                  </Tag>
                  {execution.duration && (
                    <Text type="secondary">{execution.duration}ms</Text>
                  )}
                </Space>
                
                {execution.error && (
                  <Text type="danger" style={{ fontSize: '12px' }}>
                    错误: {execution.error}
                  </Text>
                )}
                
                {execution.result && execution.success && (
                  <div className={`tool-execution ${isSuccess ? 'success' : 'error'}`}>
                    {typeof execution.result === 'string' ? (
                      <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                        {execution.result.length > 200 
                          ? `${execution.result.slice(0, 200)}...` 
                          : execution.result
                        }
                      </Text>
                    ) : execution.result?.content ? (
                      // 处理分片内容
                      <div>
                        {execution.result.isPartial && (
                          <div style={{ marginBottom: 8 }}>
                            <Progress 
                              percent={((execution.result.chunkIndex + 1) / execution.result.totalChunks) * 100} 
                              size="small"
                              status="active"
                            />
                            <Text type="secondary" style={{ fontSize: '11px' }}>
                              接收中: {execution.result.chunkIndex + 1}/{execution.result.totalChunks}
                            </Text>
                          </div>
                        )}
                        <Text style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {execution.result.content.length > 200 
                            ? `${execution.result.content.slice(0, 200)}...` 
                            : execution.result.content
                          }
                        </Text>
                      </div>
                    ) : (
                      <Text style={{ fontSize: '12px', color: '#666' }}>
                        {JSON.stringify(execution.result).slice(0, 200)}
                      </Text>
                    )}
                  </div>
                )}
              </Space>
            </Timeline.Item>
          )
        })}
      </Timeline>
    </div>
  )
}

const StreamingDisplay: React.FC<StreamingDisplayProps> = ({ state, className }) => {
  const { isStreaming, currentContent, toolExecutions, error } = state

  return (
    <StreamingContainer className={className} bordered={false}>
      <StreamingIndicator isStreaming={isStreaming} />
      
      {error && (
        <div style={{ 
          marginBottom: 16, 
          padding: 12, 
          background: '#fff2f0', 
          border: '1px solid #ffccc7', 
          borderRadius: 6 
        }}>
          <Text type="danger">
            <CloseCircleOutlined /> 处理出错: {error}
          </Text>
        </div>
      )}
      
      <ToolExecutionDisplay executions={toolExecutions} />
      
      {currentContent && (
        <div className="streaming-content">
          <MarkdownBlock content={currentContent} />
        </div>
      )}
      
      {!isStreaming && !currentContent && toolExecutions.length === 0 && !error && (
        <div style={{ 
          padding: 24, 
          textAlign: 'center', 
          color: '#999' 
        }}>
          <Text type="secondary">等待AI响应...</Text>
        </div>
      )}
    </StreamingContainer>
  )
}

export default StreamingDisplay