import React, { useState } from 'react'
import { 
  Progress, 
  Tag, 
  Collapse, 
  Space, 
  Typography, 
  Button
} from 'antd'
import { 
  RobotOutlined, 
  CheckCircleOutlined,
  EyeOutlined,
  CopyOutlined,
  DownOutlined,
  RightOutlined
} from '@ant-design/icons'
import { ToolExecution } from '../../../shared/types'
import styled, { keyframes } from 'styled-components'

const { Text } = Typography

interface ConversationalToolCallProps {
  toolExecutions: ToolExecution[]
  isExecuting?: boolean
}

// 工具名称到用户友好描述的映射
const getToolActionDescription = (toolName: string): { action: string, icon: string } => {
  const toolMap: Record<string, { action: string, icon: string }> = {
    'context7_resolve-library-id': { action: '查找相关资源库', icon: '🔍' },
    'context7_get-library-docs': { action: '获取技术文档', icon: '📚' },
    'promptx_welcome': { action: '获取可用角色列表', icon: '👥' },
    'promptx_action': { action: '激活专业角色', icon: '🎭' },
    'promptx_remember': { action: '记忆重要信息', icon: '🧠' },
    'promptx_recall': { action: '检索相关记忆', icon: '💭' },
    'web-search': { action: '搜索网络信息', icon: '🌐' },
    'file-read': { action: '读取文件内容', icon: '📄' },
    'code-execution': { action: '执行代码', icon: '⚡' }
  }
  
  return toolMap[toolName] || { action: `使用 ${toolName} 工具`, icon: '🔧' }
}

// 智能结果摘要生成
const generateResultSummary = (execution: ToolExecution): string => {
  const { toolName, result, error } = execution
  
  if (error) {
    return `执行失败: ${error}`
  }
  
  if (!result) {
    return '执行完成'
  }
  
  // 根据工具类型生成智能摘要
  switch (toolName) {
    case 'context7_resolve-library-id':
      try {
        const data = typeof result === 'string' ? JSON.parse(result) : result
        const count = data?.libraries?.length || 0
        return `找到 ${count} 个相关库，已为您筛选最匹配的选项`
      } catch {
        return '已找到相关资源库'
      }
    
    case 'context7_get-library-docs':
      return '已获取最新技术文档和代码示例'
    
    case 'promptx_welcome':
      try {
        // PromptX返回的是纯文本格式，需要解析文本
        const text = typeof result === 'string' ? result : String(result)
        // 统计角色数量：查找 "#### 数字." 模式
        const roleMatches = text.match(/#### \d+\./g) || []
        const roleCount = roleMatches.length
        return roleCount > 0 ? `发现 ${roleCount} 个可用专业角色` : '已获取可用角色列表'
      } catch {
        return '已获取可用角色列表'
      }
    
    case 'promptx_action':
      return '专业角色已成功激活，现在具备相关领域专业能力'
    
    case 'web-search':
      return '网络搜索完成，已找到相关信息'
    
    case 'file-read':
      return '文件内容已读取并分析'
    
    default:
      return '操作执行完成'
  }
}

// 判断结果是否需要预览
const shouldShowPreview = (toolName: string): boolean => {
  const previewTools = ['context7_resolve-library-id', 'web-search', 'code-execution', 'promptx_welcome']
  return previewTools.includes(toolName)
}

// 生成智能预览内容
const generateSmartPreview = (execution: ToolExecution): React.ReactNode => {
  const { toolName, result, error } = execution
  
  if (error || !result) {
    return null
  }

  try {
    const data = typeof result === 'string' ? JSON.parse(result) : result

    switch (toolName) {
      case 'context7_resolve-library-id':
        if (data?.libraries && Array.isArray(data.libraries)) {
          return (
            <div>
              <Text strong style={{ color: '#1890ff', marginBottom: 8, display: 'block' }}>
                📚 找到的资源库：
              </Text>
              {data.libraries.slice(0, 3).map((lib: any, index: number) => (
                <div key={index} style={{ 
                  padding: '8px 12px', 
                  background: '#f8f9ff', 
                  borderRadius: '6px',
                  marginBottom: '6px',
                  borderLeft: '3px solid #1890ff'
                }}>
                  <Text strong>{lib.name || lib.title}</Text>
                  {lib.description && (
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                      {lib.description.length > 80 ? lib.description.substring(0, 80) + '...' : lib.description}
                    </div>
                  )}
                  {lib.trustScore && (
                    <Tag color="blue" style={{ marginTop: '4px', fontSize: '11px' }}>
                      信任度: {lib.trustScore}/10
                    </Tag>
                  )}
                </div>
              ))}
              {data.libraries.length > 3 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  ...还有 {data.libraries.length - 3} 个资源库
                </Text>
              )}
            </div>
          )
        }
        break

      case 'promptx_welcome':
        if (data?.roles && Array.isArray(data.roles)) {
          return (
            <div>
              <Text strong style={{ color: '#52c41a', marginBottom: 8, display: 'block' }}>
                🎭 可用专业角色：
              </Text>
              {data.roles.slice(0, 4).map((role: any, index: number) => (
                <div key={index} style={{ 
                  padding: '8px 12px', 
                  background: '#f6ffed',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  borderLeft: '3px solid #52c41a'
                }}>
                  <Space>
                    <Text strong>{role.name}</Text>
                    <Tag color={role.source === 'system' ? 'blue' : 'green'} style={{ fontSize: '10px' }}>
                      {role.source === 'system' ? '系统' : '项目'}
                    </Tag>
                  </Space>
                  {role.description && (
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                      {role.description.length > 60 ? role.description.substring(0, 60) + '...' : role.description}
                    </div>
                  )}
                </div>
              ))}
              {data.roles.length > 4 && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  ...还有 {data.roles.length - 4} 个角色
                </Text>
              )}
            </div>
          )
        }
        break

      case 'context7_get-library-docs':
        if (data?.content || data?.codeSnippets) {
          return (
            <div>
              <Text strong style={{ color: '#722ed1', marginBottom: 8, display: 'block' }}>
                📖 获取的文档内容：
              </Text>
              {data.codeSnippets && (
                <div style={{ marginBottom: '8px' }}>
                  <Tag color="purple">代码示例: {data.codeSnippets.length}</Tag>
                </div>
              )}
              {data.content && (
                <div style={{ 
                  background: '#f9f0ff',
                  padding: '12px',
                  borderRadius: '6px',
                  maxHeight: '150px',
                  overflow: 'auto',
                  fontSize: '12px',
                  lineHeight: '1.4'
                }}>
                  {typeof data.content === 'string' 
                    ? data.content.substring(0, 300) + (data.content.length > 300 ? '...' : '')
                    : JSON.stringify(data.content, null, 2).substring(0, 300) + '...'
                  }
                </div>
              )}
            </div>
          )
        }
        break

      default:
        // 通用预览格式
        const preview = JSON.stringify(data, null, 2)
        if (preview.length > 200) {
          return (
            <div>
              <Text strong style={{ color: '#1890ff', marginBottom: 8, display: 'block' }}>
                🔧 执行结果预览：
              </Text>
              <div style={{ 
                background: '#f5f5f5',
                padding: '12px',
                borderRadius: '6px',
                maxHeight: '120px',
                overflow: 'auto',
                fontSize: '12px',
                fontFamily: 'Monaco, Consolas, monospace'
              }}>
                {preview.substring(0, 200)}...
              </div>
            </div>
          )
        }
    }
  } catch (e) {
    // JSON解析失败，显示原始内容
    const preview = typeof result === 'string' ? result : String(result)
    if (preview.length > 100) {
      return (
        <div style={{ 
          background: '#f5f5f5',
          padding: '12px',
          borderRadius: '6px',
          maxHeight: '120px',
          overflow: 'auto',
          fontSize: '12px'
        }}>
          {preview.substring(0, 100)}...
        </div>
      )
    }
  }

  return null
}

// 动画定义
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const slideInLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.8;
    transform: scale(1.02);
  }
`

const shimmer = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`

const successPop = keyframes`
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`

// 样式组件
const ConversationContainer = styled.div`
  margin: 16px 0;
  animation: ${fadeInUp} 0.4s cubic-bezier(0.4, 0, 0.2, 1);
`

const ThinkingProcess = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f6f8ff 0%, #e8f4ff 100%);
  background-size: 200px 100%;
  background-image: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.4) 50%,
    rgba(255, 255, 255, 0) 100%
  ),
  linear-gradient(135deg, #f6f8ff 0%, #e8f4ff 100%);
  animation: ${shimmer} 2s infinite linear, ${pulse} 3s infinite ease-in-out;
  border-radius: 12px;
  border-left: 4px solid #1890ff;
  margin-bottom: 8px;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
  }
`

const ThinkingText = styled(Text)`
  color: #1890ff;
  font-weight: 500;
`

const ResultSummary = styled.div<{ $hasError?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: ${props => props.$hasError ? '#fff2f0' : '#f6ffed'};
  border-radius: 12px;
  border-left: 4px solid ${props => props.$hasError ? '#ff4d4f' : '#52c41a'};
  margin-bottom: 8px;
  animation: ${props => props.$hasError ? slideInLeft : successPop} 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      ${props => props.$hasError 
        ? 'rgba(255, 77, 79, 0.1)' 
        : 'rgba(82, 196, 26, 0.1)'
      },
      transparent
    );
    animation: ${shimmer} 1.5s ease-in-out;
  }
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px ${props => props.$hasError 
      ? 'rgba(255, 77, 79, 0.15)' 
      : 'rgba(82, 196, 26, 0.15)'
    };
  }
`

const ResultIcon = styled.div`
  font-size: 20px;
  margin-top: 2px;
`

const ResultContent = styled.div`
  flex: 1;
`

const ResultTitle = styled(Text)`
  color: #52c41a;
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
`

const ResultDescription = styled(Text)`
  color: #666;
  line-height: 1.5;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
  animation: ${fadeInUp} 0.3s ease-out 0.2s both;
  
  .ant-btn {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    &:active {
      transform: translateY(0);
    }
  }
`

const DetailPanel = styled.div`
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  margin-top: 8px;
  animation: ${fadeInUp} 0.3s ease-out;
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
  
  &:hover {
    border-color: #d9d9d9;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }
`

const JsonDisplay = styled.pre`
  background: #f5f5f5;
  border-radius: 6px;
  padding: 12px;
  margin: 0;
  font-size: 12px;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  overflow-x: auto;
  max-height: 300px;
  transition: all 0.2s ease;
  border: 1px solid #e8e8e8;
  
  &:hover {
    background: #f0f0f0;
    border-color: #d9d9d9;
  }
`

const ConversationalToolCall: React.FC<ConversationalToolCallProps> = ({ 
  toolExecutions, 
  isExecuting = false 
}) => {
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set())
  
  if (!toolExecutions || toolExecutions.length === 0) {
    return null
  }

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopiedIds(prev => new Set([...prev, id]))
    setTimeout(() => {
      setCopiedIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }, 2000)
  }

  // 如果正在执行，显示思考过程
  if (isExecuting && toolExecutions.length > 0) {
    const currentTool = toolExecutions[toolExecutions.length - 1]
    const { action } = getToolActionDescription(currentTool.toolName)
    
    return (
      <ConversationContainer>
        <ThinkingProcess>
          <RobotOutlined spin />
          <ThinkingText>AI正在{action}...</ThinkingText>
          <div style={{ marginLeft: 'auto' }}>
            <Progress 
              percent={75} 
              showInfo={false} 
              size="small" 
              strokeColor="#1890ff"
              trailColor="rgba(24, 144, 255, 0.1)"
            />
          </div>
        </ThinkingProcess>
      </ConversationContainer>
    )
  }

  // 按工具分组显示结果
  return (
    <ConversationContainer>
      {toolExecutions.map((execution) => {
        const { action } = getToolActionDescription(execution.toolName)
        const summary = generateResultSummary(execution)
        const hasError = !!execution.error
        const showPreview = shouldShowPreview(execution.toolName)

        return (
          <div key={execution.id}>
            <ResultSummary $hasError={hasError}>
              <ResultIcon>
                {hasError ? '❌' : '✅'}
              </ResultIcon>
              
              <ResultContent>
                <ResultTitle style={{ color: hasError ? '#ff4d4f' : '#52c41a' }}>
                  {hasError ? '操作失败' : `已为您${action}`}
                </ResultTitle>
                <ResultDescription>
                  {summary}
                </ResultDescription>
                
                {execution.duration && (
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue" style={{ fontSize: '11px' }}>
                      耗时 {execution.duration < 1000 ? `${execution.duration}ms` : `${(execution.duration/1000).toFixed(1)}s`}
                    </Tag>
                    {execution.serverName && (
                      <Tag color="geekblue" style={{ fontSize: '11px' }}>
                        {execution.serverName}
                      </Tag>
                    )}
                  </div>
                )}

                {/* 智能预览内容 */}
                {showPreview && !hasError && (() => {
                  const smartPreview = generateSmartPreview(execution)
                  return smartPreview ? (
                    <div style={{ marginTop: '12px' }}>
                      {smartPreview}
                    </div>
                  ) : null
                })()}

                <ActionButtons>
                  {showPreview && !hasError && (
                    <Collapse 
                      ghost 
                      size="small"
                      expandIcon={({ isActive }) => 
                        isActive ? <DownOutlined /> : <RightOutlined />
                      }
                      items={[
                        {
                          key: 'preview',
                          label: (
                            <Space>
                              <EyeOutlined />
                              <span>查看技术详情</span>
                            </Space>
                          ),
                          children: (
                            <DetailPanel>
                              <JsonDisplay>
                                {JSON.stringify(execution.result, null, 2)}
                              </JsonDisplay>
                            </DetailPanel>
                          )
                        }
                      ]}
                    />
                  )}
                  
                  <Button
                    type="text"
                    size="small"
                    icon={copiedIds.has(execution.id) ? <CheckCircleOutlined /> : <CopyOutlined />}
                    onClick={() => handleCopy(
                      JSON.stringify({
                        tool: execution.toolName,
                        params: execution.params,
                        result: execution.result
                      }, null, 2),
                      execution.id
                    )}
                  >
                    {copiedIds.has(execution.id) ? '已复制' : '复制详情'}
                  </Button>
                </ActionButtons>
              </ResultContent>
            </ResultSummary>
          </div>
        )
      })}
    </ConversationContainer>
  )
}

export default ConversationalToolCall