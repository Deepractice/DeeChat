/**
 * AI状态机测试组件
 * 用于测试和演示AI状态机功能
 */

import React, { useState } from 'react'
import { Card, Button, Space, Typography, Input, Divider, Alert } from 'antd'
import { PlayCircleOutlined, StopOutlined, BugOutlined } from '@ant-design/icons'
import AIStateMachineIndicator, { AIState, AIStateOutput } from './AIStateMachineIndicator'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const AIStateMachineTest: React.FC = () => {
  const [isActive, setIsActive] = useState(false)
  const [currentState, setCurrentState] = useState<AIStateOutput | null>(null)
  const [iteration, setIteration] = useState(0)
  const [testResponse, setTestResponse] = useState('')

  // 预设的测试状态
  const testStates: AIStateOutput[] = [
    {
      aiState: AIState.WORKING,
      taskProgress: 25,
      nextAction: '分析代码结构'
    },
    {
      aiState: AIState.WORKING,
      taskProgress: 50,
      nextAction: '执行代码搜索工具'
    },
    {
      aiState: AIState.WORKING,
      taskProgress: 75,
      nextAction: '生成分析报告'
    },
    {
      aiState: AIState.COMPLETED,
      taskProgress: 100,
      nextAction: '任务已完成',
      taskSummary: '成功分析了项目结构并生成了详细报告'
    }
  ]

  // 开始测试状态机
  const startTest = () => {
    setIsActive(true)
    setIteration(0)
    setCurrentState(testStates[0])
    
    // 模拟状态变化
    let currentIndex = 0
    const interval = setInterval(() => {
      currentIndex++
      if (currentIndex < testStates.length) {
        setCurrentState(testStates[currentIndex])
        setIteration(currentIndex + 1)
      } else {
        setIsActive(false)
        clearInterval(interval)
      }
    }, 3000) // 每3秒切换一次状态
  }

  // 停止测试
  const stopTest = () => {
    setIsActive(false)
    setCurrentState(null)
    setIteration(0)
  }

  // 测试状态提取功能
  const testStateExtraction = () => {
    if (!testResponse.trim()) {
      return
    }

    try {
      // 这里应该调用后端的状态提取API
      // 暂时模拟一个简单的JSON解析
      const jsonMatch = testResponse.match(/```json\s*\n?([\s\S]*?)\n?```|\{[\s\S]*?"aiState"[\s\S]*?\}/g)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0].replace(/```json\s*\n?|\n?```/g, ''))
        if (parsed.aiState) {
          setCurrentState({
            aiState: parsed.aiState as AIState,
            taskProgress: parsed.taskProgress || 0,
            nextAction: parsed.nextAction || '继续处理',
            errorMessage: parsed.errorMessage,
            taskSummary: parsed.taskSummary
          })
          setIsActive(true)
        }
      }
    } catch (error) {
      console.error('状态解析失败:', error)
    }
  }

  return (
    <Card title="🔄 AI状态机测试" style={{ margin: '20px 0' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        
        {/* 状态机指示器展示 */}
        <div>
          <Title level={4}>状态机指示器</Title>
          <AIStateMachineIndicator
            aiState={currentState}
            currentIteration={iteration}
            totalIterations={15}
            isActive={isActive}
            isEnabled={true}
            variant="full"
          />
        </div>

        {/* 控制按钮 */}
        <div>
          <Title level={4}>测试控制</Title>
          <Space>
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />}
              onClick={startTest}
              disabled={isActive}
            >
              开始状态机测试
            </Button>
            <Button 
              icon={<StopOutlined />}
              onClick={stopTest}
              disabled={!isActive}
            >
              停止测试
            </Button>
          </Space>
        </div>

        <Divider />

        {/* 状态提取测试 */}
        <div>
          <Title level={4}>状态提取测试</Title>
          <Paragraph type="secondary">
            在下面输入包含AI状态信息的响应文本，测试状态提取功能：
          </Paragraph>
          
          <TextArea
            rows={6}
            placeholder={`输入包含状态信息的AI响应，例如：

我正在分析您的代码结构...

\`\`\`json
{
  "aiState": "working",
  "taskProgress": 30,
  "nextAction": "继续分析依赖关系"
}
\`\`\`

接下来我将检查各个模块...`}
            value={testResponse}
            onChange={(e) => setTestResponse(e.target.value)}
          />
          
          <div style={{ marginTop: 12 }}>
            <Button 
              icon={<BugOutlined />}
              onClick={testStateExtraction}
              disabled={!testResponse.trim()}
            >
              测试状态提取
            </Button>
          </div>
        </div>

        {/* 使用说明 */}
        <Alert
          message="AI状态机功能说明"
          description={
            <div>
              <p><strong>自动对话续接：</strong> 当AI检测到任务未完成时，系统会自动发送"请继续"来让AI继续工作。</p>
              <p><strong>状态检测：</strong> AI会在响应中输出JSON格式的状态信息，系统据此判断是否需要继续对话。</p>
              <p><strong>进度显示：</strong> 实时显示AI的当前状态、任务进度和下一步动作。</p>
              <p><strong>防无限循环：</strong> 设置最大迭代次数（默认15轮）防止无限对话。</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Space>
    </Card>
  )
}

export default AIStateMachineTest