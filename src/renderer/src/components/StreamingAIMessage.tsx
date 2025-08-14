/**
 * StreamingAIMessage 流式AI消息组件
 * 实时显示AI的思考过程、工具调用、工具结果和最终回复生成
 */

import React, { useState, useEffect } from 'react'
import { Avatar, Card, Typography, Space, Progress, Tag, Timeline, Spin } from 'antd'
import { RobotOutlined, ToolOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import styled, { keyframes } from 'styled-components'
import TypewriterRenderer from './TypewriterRenderer'
import ConversationalToolCall from './ConversationalToolCall'

const { Text, Paragraph } = Typography

// 流式更新接口（与后端保持一致）
export interface StreamUpdate {
  type: 'thinking' | 'tool_calling' | 'tool_result' | 'generating' | 'complete'
  stage: string
  currentTool?: {
    name: string
    description: string
    progress: number
  }
  toolResults?: any[]
  partialContent?: string
  metadata?: any
}

interface StreamingAIMessageProps {
  isActive: boolean
  currentStage?: StreamUpdate | null
  updates?: StreamUpdate[]
  finalContent?: string
  finalToolExecutions?: any[]
  onComplete?: () => void
}

// 动画定义
const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`

const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`

// 样式组件
const MessageContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-bottom: 16px;
  animation: ${fadeInUp} 0.3s ease-out;
`

const MessageContent = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  max-width: 70%;
`

const StageContainer = styled.div<{ $isActive?: boolean }>`
  margin-bottom: 12px;
  opacity: ${props => props.$isActive ? 1 : 0.7};
  transition: all 0.3s ease;
`

const ThinkingStage = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
  border-radius: 12px;
  border-left: 4px solid #1890ff;
  animation: ${props => props.theme?.isActive ? pulse : 'none'} 2s infinite;
`

const ToolCallStage = styled.div`
  padding: 12px 16px;
  background: linear-gradient(135deg, #fff7e6 0%, #fff1d6 100%);
  border-radius: 12px;
  border-left: 4px solid #fa8c16;
`

const ToolResultStage = styled.div`
  padding: 12px 16px;
  background: linear-gradient(135deg, #f6ffed 0%, #eef9e3 100%);
  border-radius: 12px;
  border-left: 4px solid #52c41a;
`

const GeneratingStage = styled.div`
  padding: 12px 16px;
  background: linear-gradient(135deg, #f9f0ff 0%, #efdbff 100%);
  border-radius: 12px;
  border-left: 4px solid #722ed1;
  
  .typing-indicator {
    display: inline-block;
    animation: ${shimmer} 2s infinite;
    background: linear-gradient(90deg, transparent, rgba(114, 46, 209, 0.3), transparent);
    background-size: 200px 100%;
  }
`

const StageTitle = styled(Text)`
  font-weight: 500;
  font-size: 14px;
  color: #333;
  margin-right: 8px;
`

const StageDescription = styled(Text)`
  font-size: 13px;
  color: #666;
  line-height: 1.4;
`

const ToolProgress = styled.div`
  margin-top: 8px;
  
  .ant-progress {
    margin: 0;
  }
`

const TimelineContainer = styled.div`
  margin: 16px 0;
  
  .ant-timeline {
    margin-left: 8px;
  }
  
  .ant-timeline-item-content {
    min-height: 32px;
    line-height: 1.4;
  }
`

const StreamingAIMessage: React.FC<StreamingAIMessageProps> = ({
  isActive,
  currentStage,
  updates = [],
  finalContent,
  finalToolExecutions = [],
  onComplete
}) => {
  const [isCompleted, setIsCompleted] = useState(false)

  // 监听完成状态
  useEffect(() => {
    if (currentStage?.type === 'complete') {
      setIsCompleted(true)
      setTimeout(() => {
        onComplete?.()
      }, 1000) // 延迟1秒让用户看到完成状态
    }
  }, [currentStage, onComplete])

  // 如果已完成，显示最终内容
  if (isCompleted && finalContent) {
    return (
      <MessageContainer>
        <MessageContent>
          <Avatar
            size={32}
            icon={<RobotOutlined />}
            style={{
              backgroundColor: '#52c41a',
              flexShrink: 0,
            }}
          />
          
          <Card
            size="small"
            style={{
              backgroundColor: '#f6f6f6',
              border: 'none',
              borderRadius: '12px',
              maxWidth: '100%',
            }}
            styles={{
              body: {
                padding: '12px 16px',
              }
            }}
          >
            <TypewriterRenderer
              text={finalContent}
              speed={20}
              style={{
                margin: 0,
                color: '#000',
              }}
            />

            {finalToolExecutions.length > 0 && (
              <ConversationalToolCall 
                toolExecutions={finalToolExecutions}
                isExecuting={false}
              />
            )}

            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)' }}>
                {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Tag style={{ fontSize: '10px', margin: 0, backgroundColor: '#f0f0f0', color: '#666', border: 'none' }}>
                AI Assistant
              </Tag>
            </div>
          </Card>
        </MessageContent>
      </MessageContainer>
    )
  }

  // 流式显示过程
  return (
    <MessageContainer>
      <MessageContent>
        <Avatar
          size={32}
          icon={<RobotOutlined />}
          style={{
            backgroundColor: '#52c41a',
            flexShrink: 0,
          }}
        />
        
        <Card
          size="small"
          style={{
            backgroundColor: '#f6f6f6',
            border: 'none',
            borderRadius: '12px',
            maxWidth: '100%',
          }}
          styles={{
            body: {
              padding: '16px 20px',
            }
          }}
        >
          {/* 当前活动阶段 */}
          {currentStage && (
            <StageContainer $isActive={true}>
              {currentStage.type === 'thinking' && (
                <ThinkingStage>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 16, color: '#1890ff' }} spin />} />
                  <div>
                    <StageTitle>思考中</StageTitle>
                    <br />
                    <StageDescription>{currentStage.stage}</StageDescription>
                  </div>
                </ThinkingStage>
              )}

              {currentStage.type === 'tool_calling' && currentStage.currentTool && (
                <ToolCallStage>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <ToolOutlined style={{ color: '#fa8c16', fontSize: '16px' }} />
                    <div>
                      <StageTitle>工具调用</StageTitle>
                      <br />
                      <StageDescription>{currentStage.stage}</StageDescription>
                    </div>
                  </div>
                  <ToolProgress>
                    <Text style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'block' }}>
                      {currentStage.currentTool.description}
                    </Text>
                    <Progress 
                      percent={currentStage.currentTool.progress} 
                      size="small" 
                      strokeColor="#fa8c16"
                      showInfo={false}
                    />
                  </ToolProgress>
                </ToolCallStage>
              )}

              {currentStage.type === 'tool_result' && (
                <ToolResultStage>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                    <div>
                      <StageTitle>工具执行完成</StageTitle>
                      <br />
                      <StageDescription>{currentStage.stage}</StageDescription>
                    </div>
                  </div>
                  {currentStage.toolResults && currentStage.toolResults.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <ConversationalToolCall 
                        toolExecutions={currentStage.toolResults}
                        isExecuting={false}
                      />
                    </div>
                  )}
                </ToolResultStage>
              )}

              {currentStage.type === 'generating' && (
                <GeneratingStage>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <RobotOutlined style={{ color: '#722ed1', fontSize: '16px' }} />
                    <div>
                      <StageTitle>正在生成回复</StageTitle>
                      <br />
                      <StageDescription>
                        <span className="typing-indicator">{currentStage.stage}</span>
                      </StageDescription>
                    </div>
                  </div>
                  {currentStage.partialContent && (
                    <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px' }}>
                      <Text style={{ fontSize: '13px', color: '#333' }}>
                        {currentStage.partialContent.substring(0, 100)}
                        {currentStage.partialContent.length > 100 && '...'}
                      </Text>
                    </div>
                  )}
                </GeneratingStage>
              )}
            </StageContainer>
          )}

          {/* 进度时间线（显示已完成的阶段） */}
          {updates.length > 1 && (
            <TimelineContainer>
              <Timeline
                size="small"
                items={updates.slice(0, -1).map((stage, index) => ({
                  color: stage.type === 'thinking' ? '#1890ff' : 
                         stage.type === 'tool_calling' ? '#fa8c16' : 
                         stage.type === 'tool_result' ? '#52c41a' : '#722ed1',
                  children: (
                    <Text style={{ fontSize: '12px', color: '#666' }}>
                      {stage.stage}
                    </Text>
                  )
                }))}
              />
            </TimelineContainer>
          )}

          {/* 打字机光标效果 */}
          <div
            style={{
              marginTop: '8px',
              height: '2px',
              width: '12px',
              backgroundColor: '#1890ff',
              animation: 'blink 1s infinite',
            }}
          />

          <style>
            {`
              @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
              }
            `}
          </style>
        </Card>
      </MessageContent>
    </MessageContainer>
  )
}

export default StreamingAIMessage
export type { StreamUpdate }