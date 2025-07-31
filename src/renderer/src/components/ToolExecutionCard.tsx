import React, { useState } from 'react'
import { Card, Collapse, Typography, Tag, Space, Button, Tooltip } from 'antd'
import { 
  ToolOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  RightOutlined,
  CopyOutlined
} from '@ant-design/icons'
import { ToolExecution } from '../../../shared/types'

const { Text, Paragraph } = Typography

interface ToolExecutionCardProps {
  toolExecutions: ToolExecution[]
}

const ToolExecutionCard: React.FC<ToolExecutionCardProps> = ({ toolExecutions }) => {
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  if (!toolExecutions || toolExecutions.length === 0) {
    return null
  }

  const handleCopyResult = (result: any) => {
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    navigator.clipboard.writeText(text)
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return '未知'
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(1)}s`
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const renderToolResult = (execution: ToolExecution) => {
    if (execution.error) {
      return (
        <div style={{ 
          background: '#fff2f0', 
          border: '1px solid #ffccc7',
          borderRadius: '6px',
          padding: '12px',
          marginTop: '8px'
        }}>
          <Text type="danger" style={{ fontSize: '12px' }}>
            <ExclamationCircleOutlined style={{ marginRight: '4px' }} />
            执行失败: {execution.error}
          </Text>
        </div>
      )
    }

    if (!execution.result) {
      return (
        <div style={{ 
          background: '#f6f6f6', 
          borderRadius: '6px',
          padding: '12px',
          marginTop: '8px'
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            无返回结果
          </Text>
        </div>
      )
    }

    // 处理结构化结果
    let displayResult = execution.result
    if (typeof execution.result === 'object') {
      // 如果是MCP标准格式
      if (execution.result.content && Array.isArray(execution.result.content)) {
        displayResult = execution.result.content
          .map((item: any) => item.text || JSON.stringify(item))
          .join('\n')
      } else {
        displayResult = JSON.stringify(execution.result, null, 2)
      }
    }

    return (
      <div style={{ 
        background: '#f6ffed', 
        border: '1px solid #b7eb8f',
        borderRadius: '6px',
        padding: '12px',
        marginTop: '8px',
        position: 'relative'
      }}>
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={() => handleCopyResult(execution.result)}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            fontSize: '12px'
          }}
        />
        <pre style={{ 
          margin: 0,
          fontSize: '12px',
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '200px',
          overflow: 'auto',
          paddingRight: '32px'
        }}>
          {displayResult}
        </pre>
      </div>
    )
  }

  return (
    <Card
      size="small"
      style={{
        marginTop: '12px',
        marginBottom: '12px',
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        backgroundColor: '#fafafa'
      }}
      styles={{
        body: { padding: '12px' }
      }}
    >
      <Collapse
        ghost
        size="small"
        expandIcon={({ isActive }) =>
          isActive ? <DownOutlined style={{ fontSize: '12px' }} /> : <RightOutlined style={{ fontSize: '12px' }} />
        }
        onChange={(keys) => setExpandedKeys(keys as string[])}
        items={[
          {
            key: 'tools',
            label: (
              <Space size="small" style={{ fontSize: '13px' }}>
                <ToolOutlined style={{ color: '#1890ff' }} />
                <Text strong style={{ fontSize: '13px' }}>
                  工具调用 ({toolExecutions.length}个)
                </Text>
                <Tag size="small" color="blue">
                  {toolExecutions.filter(t => !t.error).length} 成功
                </Tag>
                {toolExecutions.some(t => t.error) && (
                  <Tag size="small" color="red">
                    {toolExecutions.filter(t => t.error).length} 失败
                  </Tag>
                )}
              </Space>
            ),
            children: (
              <div style={{ marginTop: '8px' }}>
                {toolExecutions.map((execution, index) => (
                  <div
                    key={execution.id}
                    style={{
                      marginBottom: index < toolExecutions.length - 1 ? '16px' : '0',
                      paddingBottom: index < toolExecutions.length - 1 ? '16px' : '0',
                      borderBottom: index < toolExecutions.length - 1 ? '1px solid #f0f0f0' : 'none'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <Space size="small">
                        {execution.error ? (
                          <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: '14px' }} />
                        ) : (
                          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                        )}
                        <Text strong style={{ fontSize: '13px' }}>
                          {execution.toolName}
                        </Text>
                        {execution.serverName && (
                          <Tag size="small" color="geekblue" style={{ fontSize: '10px' }}>
                            {execution.serverName}
                          </Tag>
                        )}
                      </Space>

                      <Space size="small">
                        <Tooltip title={`执行时间: ${formatTimestamp(execution.timestamp)}`}>
                          <Tag
                            size="small"
                            icon={<ClockCircleOutlined />}
                            style={{ fontSize: '11px' }}
                          >
                            {formatDuration(execution.duration)}
                          </Tag>
                        </Tooltip>
                      </Space>
                    </div>

                    {/* 参数显示 */}
                    {execution.params && Object.keys(execution.params).length > 0 && (
                      <div style={{ marginBottom: '8px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          参数:
                        </Text>
                        <div style={{
                          background: '#f5f5f5',
                          borderRadius: '4px',
                          padding: '8px',
                          marginTop: '4px'
                        }}>
                          <pre style={{
                            margin: 0,
                            fontSize: '11px',
                            fontFamily: 'Monaco, Consolas, "Courier New", monospace'
                          }}>
                            {JSON.stringify(execution.params, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* 结果显示 */}
                    {renderToolResult(execution)}
                  </div>
                ))}
              </div>
            )
          }
        ]}
      />
    </Card>
  )
}

export default ToolExecutionCard
