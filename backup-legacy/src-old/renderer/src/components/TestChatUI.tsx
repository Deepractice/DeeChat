import React, { useState } from 'react'
import { Button, Space, Card, Typography } from 'antd'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { ChatMessage } from '../../../shared/types'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'

const { Title } = Typography

const TestChatUI: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // 模拟选中的模型
  const mockSelectedModel = {
    id: 'test-gemini-model',
    config: ModelConfigEntity.create({
      name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      model: 'gemini-2.5-flash-preview-05-20',
      apiKey: 'test-key',
      baseURL: 'https://generativelanguage.googleapis.com',
      isEnabled: true,
      priority: 5
    })
  }

  const addTestMessage = () => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: '你好，请介绍一下你自己。',
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // 模拟AI回复延迟
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '你好！我是一个AI助手，基于Google的Gemini模型。我可以帮助您回答问题、进行对话、提供信息和协助完成各种任务。我具备理解自然语言、生成文本、分析问题和提供解决方案的能力。有什么我可以帮助您的吗？',
        timestamp: Date.now() + 1,
        modelId: 'gemini-2.5-flash-preview-05-20'
      }

      setMessages(prev => [...prev, aiMessage])
      setIsLoading(false)
    }, 2000)
  }

  const clearMessages = () => {
    setMessages([])
    setIsLoading(false)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <Title level={3}>聊天界面测试</Title>
        
        <Space style={{ marginBottom: '16px' }}>
          <Button type="primary" onClick={addTestMessage} disabled={isLoading}>
            发送测试消息
          </Button>
          <Button onClick={clearMessages}>
            清空消息
          </Button>
        </Space>

        <div style={{ 
          height: '400px', 
          border: '1px solid #f0f0f0', 
          borderRadius: '8px',
          overflow: 'auto',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <MessageList messages={messages} isLoading={isLoading} />
        </div>

        <MessageInput 
          selectedModel={mockSelectedModel}
          disabled={isLoading}
        />
      </Card>
    </div>
  )
}

export default TestChatUI
