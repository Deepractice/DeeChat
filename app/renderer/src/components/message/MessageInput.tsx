import React, { useState, useRef } from 'react'
import { Input, Button, Space, Badge } from 'antd'
import { SendOutlined, ToolOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface MessageInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
  placeholder?: string
  toolCount?: number
  isCallingTool?: boolean
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = '输入消息...',
  toolCount = 0,
  isCallingTool = false
}) => {
  const [content, setContent] = useState('')
  const textAreaRef = useRef<any>(null)

  const handleSend = () => {
    if (!content.trim() || disabled) return
    
    onSendMessage(content.trim())
    setContent('')
    
    // 重置输入框高度
    if (textAreaRef.current) {
      textAreaRef.current.resizableTextArea.textArea.style.height = 'auto'
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Shift + Enter 换行，Enter 发送
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: '12px',
      alignItems: 'flex-end',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <div style={{ flex: 1 }}>
        <TextArea
          ref={textAreaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled}
          autoSize={{ 
            minRows: 1, 
            maxRows: 6 
          }}
          style={{
            borderRadius: '12px',
            resize: 'none'
          }}
        />
      </div>
      
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        disabled={!content.trim() || disabled}
        loading={disabled}
        size="large"
        style={{
          borderRadius: '12px',
          height: 'auto',
          padding: '8px 16px',
          minHeight: '40px'
        }}
      >
        发送
      </Button>
    </div>
  )
}

export default MessageInput