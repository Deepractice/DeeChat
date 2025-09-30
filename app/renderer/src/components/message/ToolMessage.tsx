import React, { useState, useMemo } from 'react'
import { ExclamationCircleOutlined, CheckCircleOutlined, LoadingOutlined, DownOutlined, ToolOutlined } from '@ant-design/icons'

// 工具执行步骤接口 - 支持多步骤工具执行
export interface ToolExecutionStep {
  id: string
  toolName: string
  serverId?: string
  status: 'pending' | 'running' | 'completed' | 'error'
  parameters?: Record<string, any>
  result?: string
  error?: string
  startTime?: number
  endTime?: number
}

// 兼容原有的VirtualToolMessage接口
export interface VirtualToolMessage {
  id: string
  role: 'tool'
  session_id: string
  timestamp: string
  content: string // 工具名称
  metadata?: {
    toolName: string
    serverId: string
    arguments?: any
    result?: any
    status: 'pending' | 'executing' | 'completed' | 'error'
    error?: string
    startTime?: number
    endTime?: number
  }
}

interface ToolMessageProps {
  // 支持新的多步骤模式
  steps?: ToolExecutionStep[]
  isStreaming?: boolean
  // 兼容原有的单消息模式
  message?: VirtualToolMessage
  // 回调函数
  onCopyResult?: (result: string) => void
}

const ToolMessage: React.FC<ToolMessageProps> = ({
  steps,
  message,
  isStreaming = false,
  onCopyResult
}) => {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  // 兼容旧的message模式，转换为steps格式
  const toolSteps = useMemo(() => {
    if (steps) {
      return steps
    }

    if (message && message.metadata) {
      const metadata = message.metadata
      return [{
        id: message.id,
        toolName: metadata.toolName,
        serverId: metadata.serverId,
        status: metadata.status === 'executing' ? 'running' :
                metadata.status === 'completed' ? 'completed' : metadata.status,
        parameters: metadata.arguments,
        result: metadata.result,
        error: metadata.error,
        startTime: metadata.startTime,
        endTime: metadata.endTime,
      } as ToolExecutionStep]
    }

    return []
  }, [steps, message])

  const toggleResultExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedResults)
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId)
    } else {
      newExpanded.add(stepId)
    }
    setExpandedResults(newExpanded)
  }

  if (toolSteps.length === 0) {
    return null
  }

  return (
    <div className="tool-execution-container">
      {toolSteps.map((step, stepIndex) => {
        const isResultExpanded = expandedResults.has(step.id)
        const hasResult = step.result && step.status === 'completed'
        const hasError = step.error

        console.log('🔍 ToolMessage渲染步骤:', {
          stepId: step.id,
          toolName: step.toolName,
          status: step.status,
          hasResult: hasResult,
          resultLength: step.result?.length || 0,
          result: step.result?.substring(0, 50) + '...'
        })

        return (
          <div key={step.id} style={{ marginBottom: stepIndex < toolSteps.length - 1 ? '8px' : '0' }}>
            {/* 头部栏 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <ToolOutlined style={{ color: '#8c8c8c', fontSize: '14px' }} />
                {step.serverId && (
                  <span style={{
                    color: '#262626',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {step.serverId}
                  </span>
                )}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {/* 状态指示器 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      step.status === 'running' ? '#1890ff' :
                      step.status === 'completed' ? '#52c41a' :
                      step.status === 'error' ? '#ff4d4f' : '#8c8c8c'
                  }} />
                  <span style={{
                    color:
                      step.status === 'running' ? '#1890ff' :
                      step.status === 'completed' ? '#52c41a' :
                      step.status === 'error' ? '#ff4d4f' : '#8c8c8c'
                  }}>
                    {step.status === 'running' ? '运行中' :
                     step.status === 'completed' ? '已完成' :
                     step.status === 'error' ? '错误' : '等待中'}
                  </span>
                </div>
                {/* 展开/收缩按钮 */}
                {(hasResult || hasError) && (
                  <button
                    onClick={() => toggleResultExpansion(step.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: '#8c8c8c',
                      fontSize: '12px'
                    }}
                  >
                    <DownOutlined
                      style={{
                        transform: isResultExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* 内容区域 */}
            <div style={{
              backgroundColor: '#f0f5ff',
              border: '1px solid #d6e4ff',
              borderRadius: '8px',
              padding: '12px'
            }}>
              {/* 工具信息行 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '8px',
                borderBottom: step.parameters ? '1px solid #e6f4ff' : 'none',
                marginBottom: step.parameters ? '8px' : '0'
              }}>
                <span style={{
                  color: '#1890ff',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {step.toolName}
                </span>
              </div>

              {/* 参数区（始终可见） */}
              {step.parameters && Object.keys(step.parameters).length > 0 && (
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e6f4ff',
                  borderRadius: '4px',
                  padding: '8px',
                  marginBottom: (hasResult || hasError) ? '8px' : '0'
                }}>
                  <pre style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    color: '#595959'
                  }}>
                    {JSON.stringify(step.parameters, null, 2)}
                  </pre>
                </div>
              )}

              {/* 结果区域（可折叠） */}
              {(hasResult || hasError) && (
                <div style={{
                  overflow: 'hidden',
                  maxHeight: isResultExpanded ? '400px' : '0px',
                  transition: 'max-height 0.3s ease',
                  borderTop: (hasResult || hasError) && isResultExpanded ? '1px solid #e6f4ff' : 'none',
                  paddingTop: isResultExpanded ? '8px' : '0'
                }}>
                  {hasError && (
                    <div style={{
                      backgroundColor: '#fff2f0',
                      border: '1px solid #ffccc7',
                      borderRadius: '4px',
                      padding: '8px',
                      marginBottom: hasResult ? '8px' : '0'
                    }}>
                      <div style={{
                        color: '#ff4d4f',
                        fontSize: '12px',
                        fontWeight: '600',
                        marginBottom: '4px'
                      }}>
                        错误:
                      </div>
                      <div style={{ color: '#ff4d4f', fontSize: '12px' }}>
                        {step.error}
                      </div>
                    </div>
                  )}
                  {hasResult && (
                    <div style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e6f4ff',
                      borderRadius: '4px',
                      padding: '8px',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                        fontSize: '12px',
                        lineHeight: '1.4',
                        color: '#595959'
                      }}>
                        {typeof step.result === 'string' ? step.result : JSON.stringify(step.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}


export default ToolMessage