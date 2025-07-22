import React, { useState, useRef } from 'react'
import { Input, Button, Space, message } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { addUserMessage, addAIMessage, sendMessage, saveCurrentSession, setLoading } from '../store/slices/chatSlice'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'

const { TextArea } = Input

interface MessageInputProps {
  disabled?: boolean
  selectedModel?: { id: string; config: ModelConfigEntity } | null
  onSendMessage?: (message: string) => void
}

const MessageInput: React.FC<MessageInputProps> = ({ disabled = false, selectedModel, onSendMessage }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { config } = useSelector((state: RootState) => state.config)
  const [inputValue, setInputValue] = useState('')
  const textAreaRef = useRef<any>(null)

  const handleSend = async () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue) {
      message.warning('请输入消息内容')
      return
    }

    // 检查是否选择了模型
    if (!selectedModel) {
      message.error('请先选择一个AI模型')
      return
    }

    // 检查模型是否启用
    if (!selectedModel.config.isEnabled) {
      message.error(`模型 ${selectedModel.config.name} 已被禁用，请选择其他模型`)
      return
    }

    // 检查模型状态 - 只有明确错误时才警告
    if (selectedModel.config.status === 'error') {
      message.warning(`模型 ${selectedModel.config.name} 状态异常 (${selectedModel.config.status})，可能无法正常使用`)
    }

    // 清空输入框
    setInputValue('')

    // 如果有父组件回调，使用父组件处理
    if (onSendMessage) {
      onSendMessage(trimmedValue)
      return
    }

    // 否则使用原有逻辑
    try {
      // 添加用户消息到状态（包含模型信息）
      dispatch(addUserMessage({
        message: trimmedValue,
        modelId: selectedModel.id
      }))

      // 保存用户消息后立即保存会话
      dispatch(saveCurrentSession())

      // 🔥 设置加载状态为true
      dispatch(setLoading(true))

      // 默认总是启用MCP工具，让AI自己决定是否使用
      // 使用新的AI服务API发送消息
      if (window.electronAPI?.ai?.sendMessage) {
        let response;

        // 优先使用MCP增强模式，如果不可用则降级到普通模式
        if (window.electronAPI?.ai?.sendMessageWithMCPTools) {
          console.log('🔧 [前端] 使用MCP增强模式发送消息');
          response = await window.electronAPI.ai.sendMessageWithMCPTools({
            llmRequest: {
              message: trimmedValue,
              temperature: 0.7,
              maxTokens: 2000
            },
            configId: selectedModel.id,
            enableMCPTools: true
          });
        } else {
          console.log('🔧 [前端] MCP增强模式不可用，使用普通模式');
          response = await window.electronAPI.ai.sendMessage({
            llmRequest: {
              message: trimmedValue,
              temperature: 0.7,
              maxTokens: 2000
            },
            configId: selectedModel.id
          });
        }

        if (response.success) {
          // 🔥 解析实际使用的模型名称
          const parseModelName = (modelId: string) => {
            const parts = modelId.split('-')
            if (parts.length >= 6) {
              // 前5段是UUID配置ID，后面的部分是模型名称
              return parts.slice(5).join('-')
            }
            return modelId
          }

          const actualModelName = parseModelName(selectedModel.id)

          // 添加AI响应到状态，包含工具执行记录
          dispatch(addAIMessage({
            content: response.data.content,
            modelId: actualModelName || selectedModel.config.model,
            toolExecutions: response.data.toolExecutions
          }))

          // 🔥 清除加载状态
          dispatch(setLoading(false))

          // 自动保存会话
          dispatch(saveCurrentSession())
        } else {
          throw new Error(response.error || '发送消息失败')
        }
      } else {
        // 降级到旧版API
        await dispatch(sendMessage({
          message: trimmedValue,
          config: {
            provider: selectedModel.config.provider,
            model: selectedModel.config.model,
            apiKey: selectedModel.config.apiKey,
            baseURL: selectedModel.config.baseURL,
            temperature: 0.7,
            maxTokens: 2000
          }
        })).unwrap()
      }

    } catch (error) {
      console.error('发送消息失败:', error)
      // 🔥 发生错误时也要清除加载状态
      dispatch(setLoading(false))
      message.error(`发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }



  return (
    <div style={{ width: '100%' }}>
      <Space.Compact style={{ width: '100%', display: 'flex' }}>
        <TextArea
          ref={textAreaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={
            !selectedModel
              ? "请先选择AI模型..."
              : selectedModel.config.isEnabled
                ? "输入消息... (Enter发送，Shift+Enter换行，MCP工具已自动启用)"
                : "当前模型已禁用，请选择其他模型..."
          }
          autoSize={{ minRows: 1, maxRows: 6 }}
          disabled={disabled}
          style={{
            flex: 1,
            resize: 'none',
            borderRadius: '8px 0 0 8px'
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          disabled={disabled || !inputValue.trim()}
          style={{
            height: 'auto',
            borderRadius: '0 8px 8px 0',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '16px',
            paddingRight: '16px'
          }}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  )
}

export default MessageInput
