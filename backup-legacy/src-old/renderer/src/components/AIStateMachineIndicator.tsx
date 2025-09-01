/**
 * AI状态机指示器组件
 * 显示AI的当前状态、进度和下一步动作
 */

import React from 'react'
import { Card, Progress, Typography, Tag, Space, Tooltip } from 'antd'
import { 
  CheckCircleOutlined, 
  QuestionCircleOutlined, 
  ExclamationCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import styled, { keyframes } from 'styled-components'

const { Text, Paragraph } = Typography

// AI状态枚举（与后端保持一致）
export enum AIState {
  WORKING = 'working',
  COMPLETED = 'completed', 
  WAITING_INPUT = 'waiting_input',
  ERROR = 'error'
}

// AI状态输出接口（与后端保持一致）
export interface AIStateOutput {
  aiState: AIState
  taskProgress: number
  nextAction: string
  errorMessage?: string
  taskSummary?: string
}

interface AIStateMachineIndicatorProps {
  /** 当前AI状态 */
  aiState?: AIStateOutput | null
  /** 当前迭代次数 */
  currentIteration?: number
  /** 总迭代次数 */
  totalIterations?: number
  /** 是否处于活跃状态 */
  isActive?: boolean
  /** 是否启用状态机 */
  isEnabled?: boolean
  /** 样式类型 */
  variant?: 'compact' | 'full'
}

// 动画定义
const breatheAnimation = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`

const pulseAnimation = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`

// 样式组件
const StateMachineCard = styled(Card)<{ $isActive?: boolean; $variant?: string }>`
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
  
  ${props => props.$isActive && `
    border-color: #1890ff;
    box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
    animation: ${pulseAnimation} 2s ease-in-out infinite;
  `}
  
  ${props => props.$variant === 'compact' && `
    .ant-card-body {
      padding: 12px 16px;
    }
  `}
`

const StateIcon = styled.div<{ $state: AIState; $isActive?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  margin-right: 8px;
  
  ${props => props.$isActive && `
    animation: ${breatheAnimation} 1.5s ease-in-out infinite;
  `}
  
  .anticon {
    font-size: 14px;
    color: ${props => {
      switch (props.$state) {
        case AIState.WORKING: return '#1890ff'
        case AIState.COMPLETED: return '#52c41a'
        case AIState.WAITING_INPUT: return '#faad14'
        case AIState.ERROR: return '#ff4d4f'
        default: return '#8c8c8c'
      }
    }};
  }
`

const ProgressContainer = styled.div`
  margin: 8px 0;
`

const IterationInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
`

const NextActionText = styled(Text)`
  color: #666;
  font-size: 12px;
  line-height: 1.4;
`

/**
 * 获取状态相关信息
 */
function getStateInfo(state: AIState) {
  switch (state) {
    case AIState.WORKING:
      return {
        icon: <SyncOutlined spin />,
        color: '#1890ff',
        text: '工作中',
        bgColor: '#e6f7ff'
      }
    case AIState.COMPLETED:
      return {
        icon: <CheckCircleOutlined />,
        color: '#52c41a',
        text: '已完成',
        bgColor: '#f6ffed'
      }
    case AIState.WAITING_INPUT:
      return {
        icon: <QuestionCircleOutlined />,
        color: '#faad14',
        text: '等待输入',
        bgColor: '#fffbe6'
      }
    case AIState.ERROR:
      return {
        icon: <ExclamationCircleOutlined />,
        color: '#ff4d4f',
        text: '错误',
        bgColor: '#fff2f0'
      }
    default:
      return {
        icon: <ClockCircleOutlined />,
        color: '#8c8c8c',
        text: '未知',
        bgColor: '#f5f5f5'
      }
  }
}

const AIStateMachineIndicator: React.FC<AIStateMachineIndicatorProps> = ({
  aiState,
  currentIteration = 0,
  totalIterations = 15,
  isActive = false,
  isEnabled = true,
  variant = 'full'
}) => {
  // 如果未启用状态机，不显示组件
  if (!isEnabled) {
    return null
  }

  // 如果没有状态信息且不活跃，不显示
  if (!aiState && !isActive) {
    return null
  }

  const state = aiState?.aiState || AIState.WORKING
  const progress = aiState?.taskProgress || 0
  const nextAction = aiState?.nextAction || '处理中...'
  const stateInfo = getStateInfo(state)

  const renderCompactView = () => (
    <StateMachineCard 
      size="small" 
      $isActive={isActive} 
      $variant="compact"
      bodyStyle={{ padding: '8px 12px' }}
    >
      <Space size="small" align="center">
        <StateIcon $state={state} $isActive={isActive}>
          {stateInfo.icon}
        </StateIcon>
        <Tag color={stateInfo.color} style={{ margin: 0 }}>
          {stateInfo.text}
        </Tag>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {progress}%
        </Text>
        {currentIteration > 0 && (
          <Text type="secondary" style={{ fontSize: '11px' }}>
            第{currentIteration}轮
          </Text>
        )}
      </Space>
    </StateMachineCard>
  )

  const renderFullView = () => (
    <StateMachineCard $isActive={isActive} $variant="full">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <StateIcon $state={state} $isActive={isActive}>
          {stateInfo.icon}
        </StateIcon>
        <Space>
          <Tag color={stateInfo.color}>{stateInfo.text}</Tag>
          <Text strong style={{ color: stateInfo.color }}>
            AI状态机
          </Text>
        </Space>
      </div>

      <ProgressContainer>
        <Progress 
          percent={progress} 
          size="small"
          strokeColor={stateInfo.color}
          trailColor="#f0f0f0"
          showInfo={true}
          format={(percent) => (
            <Text style={{ fontSize: '11px', color: stateInfo.color }}>
              {percent}%
            </Text>
          )}
        />
      </ProgressContainer>

      <NextActionText>
        <strong>下一步：</strong> {nextAction}
      </NextActionText>

      {aiState?.errorMessage && (
        <Paragraph 
          type="danger" 
          style={{ 
            fontSize: '12px', 
            margin: '8px 0 0 0',
            padding: '8px',
            backgroundColor: '#fff2f0',
            borderRadius: '4px',
            border: '1px solid #ffccc7'
          }}
        >
          {aiState.errorMessage}
        </Paragraph>
      )}

      {aiState?.taskSummary && state === AIState.COMPLETED && (
        <Paragraph 
          type="success" 
          style={{ 
            fontSize: '12px', 
            margin: '8px 0 0 0',
            padding: '8px',
            backgroundColor: '#f6ffed',
            borderRadius: '4px',
            border: '1px solid #b7eb8f'
          }}
        >
          {aiState.taskSummary}
        </Paragraph>
      )}

      {(currentIteration > 0 || totalIterations > 1) && (
        <IterationInfo>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            迭代进度
          </Text>
          <Tooltip title={`当前第${currentIteration}轮，最多${totalIterations}轮`}>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              {currentIteration} / {totalIterations}
            </Text>
          </Tooltip>
        </IterationInfo>
      )}
    </StateMachineCard>
  )

  return variant === 'compact' ? renderCompactView() : renderFullView()
}

export default AIStateMachineIndicator