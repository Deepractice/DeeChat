import React, { useState } from 'react'
import { Button, Input, Card, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface StreamingTestProps {
  selectedModel?: { id: string; config: any } | null
}

const StreamingTest: React.FC<StreamingTestProps> = ({ selectedModel }) => {
  const [testMessage, setTestMessage] = useState('')
  const [streamingResult, setStreamingResult] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const handleTestStream = async () => {
    if (!testMessage.trim()) {
      message.error('请输入测试消息')
      return
    }

    if (!selectedModel) {
      message.error('请先选择一个模型')
      return
    }

    setIsStreaming(true)
    setStreamingResult('')

    try {
      // 设置流式事件监听器
      const removeStreamListener = window.electronAPI?.ai?.onStreamChunk((data: any) => {
        if (data.chunk) {
          setStreamingResult(data.chunk)
        }
      })

      // 发送流式请求
      const response = await window.electronAPI?.ai?.streamMessage({
        llmRequest: {
          message: testMessage,
          temperature: 0.7,
          maxTokens: 1000,
          sessionId: `test_${Date.now()}`
        },
        configId: selectedModel.id,
        requestId: `stream_test_${Date.now()}`
      })

      console.log('🌊 [流式测试] 流式请求完成:', response)

      // 清理监听器
      if (removeStreamListener) {
        removeStreamListener()
      }

    } catch (error) {
      console.error('🌊 [流式测试] 流式测试失败:', error)
      message.error('流式测试失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <Card title="🌊 流式输出测试" style={{ margin: '20px 0' }}>
      <div style={{ marginBottom: '16px' }}>
        <TextArea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="输入测试消息..."
          rows={3}
          style={{ marginBottom: '8px' }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleTestStream}
          loading={isStreaming}
          disabled={!selectedModel}
        >
          {isStreaming ? '流式输出中...' : '测试流式输出'}
        </Button>
      </div>
      
      <div>
        <strong>当前模型:</strong> {selectedModel ? selectedModel.config.name : '未选择'}
      </div>
      
      <div style={{ marginTop: '16px' }}>
        <strong>流式输出结果:</strong>
        <div 
          style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: '4px', 
            padding: '8px', 
            minHeight: '100px',
            backgroundColor: '#fafafa',
            marginTop: '8px',
            whiteSpace: 'pre-wrap'
          }}
        >
          {streamingResult || '等待流式输出...'}
        </div>
      </div>
    </Card>
  )
}

export default StreamingTest