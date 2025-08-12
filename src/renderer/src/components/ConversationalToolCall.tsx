import React, { useState } from 'react'
import { 
  Progress, 
  Collapse, 
  Typography, 
  Button
} from 'antd'
import { 
  RobotOutlined, 
  CheckCircleOutlined,
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

// 判断结果是否需要预览 - 扩展到更多工具类型
const shouldShowPreview = (toolName: string): boolean => {
  const previewTools = [
    'context7_resolve-library-id', 
    'web-search', 
    'code-execution', 
    'promptx_welcome',
    'promptx_action',  // 添加角色激活工具
    'promptx_recall',  // 添加记忆检索工具
    'file-read',       // 添加文件读取工具
    'context7_get-library-docs' // 添加文档获取工具
  ]
  return previewTools.includes(toolName)
}

// 删除未使用的函数

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

// 删除未使用的动画

// 样式组件 - 简约风格
const ConversationContainer = styled.div`
  margin: 12px 0;
  animation: ${fadeInUp} 0.3s ease-out;
`

const ThinkingProcess = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  margin-bottom: 6px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #d9d9d9;
  }
`

const ThinkingText = styled(Text)`
  color: #666;
  font-size: 13px;
  font-weight: 400;
`

const ResultSummary = styled.div<{ $hasError?: boolean }>`
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #fafafa;
  margin-bottom: 8px;
  transition: border-color 0.2s ease;
  overflow: hidden;
  
  &:hover {
    border-color: #d9d9d9;
  }
  
  ${props => props.$hasError && `
    border-color: #ffccc7;
    background: #fff2f0;
    &:hover {
      border-color: #ff7875;
    }
  `}
`

const ResultIcon = styled.div`
  font-size: 14px;
  margin-top: 1px;
  margin-right: 2px;
`

// 删除未使用的样式

const ResultTitle = styled(Text)`
  color: #333;
  font-weight: 500;
  display: block;
  margin-bottom: 2px;
  font-size: 13px;
`

const ResultDescription = styled(Text)`
  color: #666;
  line-height: 1.4;
  font-size: 12px;
`

const ActionButtons = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 8px;
  
  .ant-btn {
    transition: all 0.2s ease;
    font-size: 12px;
    height: 24px;
    padding: 0 8px;
    
    &:hover {
      transform: none;
      box-shadow: none;
    }
  }
`

const DetailPanel = styled.div`
  background: #f8f8f8;
  border-radius: 6px;
  padding: 12px;
  margin-top: 6px;
  border: 1px solid #e8e8e8;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #d9d9d9;
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

  // 简洁的工具调用结果显示
  return (
    <ConversationContainer>
      {toolExecutions.map((execution) => {
        const { action, icon } = getToolActionDescription(execution.toolName)
        const summary = generateResultSummary(execution)
        const hasError = !!execution.error
        const showPreview = shouldShowPreview(execution.toolName)

        return (
          <div key={`tool-${execution.id || Date.now()}-${execution.toolName}-${Math.random().toString(36).substr(2, 9)}`}>
            <ResultSummary $hasError={hasError}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <ResultIcon>{icon}</ResultIcon>
                  <ResultTitle>
                    {hasError ? '操作失败' : action}
                  </ResultTitle>
                  {execution.duration && (
                    <Text style={{ color: '#999', fontSize: '11px', marginLeft: 'auto' }}>
                      {execution.duration < 1000 ? `${execution.duration}ms` : `${(execution.duration/1000).toFixed(1)}s`}
                    </Text>
                  )}
                </div>
                
                <ResultDescription>
                  {summary}
                </ResultDescription>

                {/* 增强的展开详情区域 */}
                {(showPreview && !hasError) && (
                  <ActionButtons>
                    <Collapse 
                      ghost 
                      size="small"
                      style={{ margin: 0, width: '100%' }}
                      expandIcon={({ isActive }) => 
                        <span style={{ fontSize: '12px' }}>
                          {isActive ? <DownOutlined /> : <RightOutlined />}
                        </span>
                      }
                      items={[
                        {
                          key: 'details',
                          label: (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <Text style={{ fontSize: '12px', color: '#666' }}>
                                查看执行详情
                              </Text>
                              <Text style={{ fontSize: '11px', color: '#999' }}>
                                {execution.toolName}
                              </Text>
                            </div>
                          ),
                          children: (
                            <DetailPanel>
                              {/* 工具调用信息摘要 */}
                              <div style={{ marginBottom: '12px', padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                                  <div>
                                    <Text strong style={{ fontSize: '11px', color: '#666' }}>工具名称:</Text>
                                    <br />
                                    <Text code style={{ fontSize: '11px' }}>{execution.toolName}</Text>
                                  </div>
                                  <div>
                                    <Text strong style={{ fontSize: '11px', color: '#666' }}>服务器:</Text>
                                    <br />
                                    <Text style={{ fontSize: '11px' }}>{execution.serverName || execution.serverId}</Text>
                                  </div>
                                  <div>
                                    <Text strong style={{ fontSize: '11px', color: '#666' }}>执行时间:</Text>
                                    <br />
                                    <Text style={{ fontSize: '11px' }}>
                                      {execution.duration ? 
                                        (execution.duration < 1000 ? `${execution.duration}ms` : `${(execution.duration/1000).toFixed(1)}s`) : 
                                        '未知'
                                      }
                                    </Text>
                                  </div>
                                  <div>
                                    <Text strong style={{ fontSize: '11px', color: '#666' }}>状态:</Text>
                                    <br />
                                    <Text style={{ 
                                      fontSize: '11px', 
                                      color: execution.success ? '#52c41a' : '#ff4d4f' 
                                    }}>
                                      {execution.success ? '✅ 成功' : '❌ 失败'}
                                    </Text>
                                  </div>
                                </div>
                              </div>

                              {/* 输入参数 */}
                              {execution.params && Object.keys(execution.params).length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                  <Text strong style={{ fontSize: '12px', color: '#333' }}>
                                    📥 输入参数:
                                  </Text>
                                  <JsonDisplay>
                                    {JSON.stringify(execution.params, null, 2)}
                                  </JsonDisplay>
                                </div>
                              )}

                              {/* 执行结果 */}
                              <div style={{ marginBottom: '8px' }}>
                                <Text strong style={{ fontSize: '12px', color: '#333' }}>
                                  📤 执行结果:
                                </Text>
                                <JsonDisplay>
                                  {JSON.stringify(execution.result, null, 2)}
                                </JsonDisplay>
                              </div>

                              {/* 操作按钮 */}
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={copiedIds.has(`${execution.id}-params`) ? <CheckCircleOutlined /> : <CopyOutlined />}
                                  onClick={() => handleCopy(
                                    JSON.stringify(execution.params, null, 2),
                                    `${execution.id}-params`
                                  )}
                                >
                                  {copiedIds.has(`${execution.id}-params`) ? '参数已复制' : '复制参数'}
                                </Button>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={copiedIds.has(`${execution.id}-result`) ? <CheckCircleOutlined /> : <CopyOutlined />}
                                  onClick={() => handleCopy(
                                    JSON.stringify(execution.result, null, 2),
                                    `${execution.id}-result`
                                  )}
                                >
                                  {copiedIds.has(`${execution.id}-result`) ? '结果已复制' : '复制结果'}
                                </Button>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={copiedIds.has(execution.id) ? <CheckCircleOutlined /> : <CopyOutlined />}
                                  onClick={() => handleCopy(
                                    JSON.stringify({
                                      tool: execution.toolName,
                                      server: execution.serverName || execution.serverId,
                                      params: execution.params,
                                      result: execution.result,
                                      duration: execution.duration,
                                      success: execution.success
                                    }, null, 2),
                                    execution.id
                                  )}
                                >
                                  {copiedIds.has(execution.id) ? '全部已复制' : '复制全部'}
                                </Button>
                              </div>
                            </DetailPanel>
                          )
                        }
                      ]}
                    />
                  </ActionButtons>
                )}
              </div>
            </ResultSummary>
          </div>
        )
      })}
    </ConversationContainer>
  )
}

export default ConversationalToolCall