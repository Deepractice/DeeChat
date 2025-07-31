import React, { useState, useRef } from 'react'
import { Input, Button, Space, message, Divider } from 'antd'
import { SendOutlined, PaperClipOutlined, RobotOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { addUserMessage, addAIMessage, sendMessage, saveCurrentSession, setLoading } from '../store/slices/chatSlice'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import FileUpload, { FileUploadItem } from './FileUpload'
import DragDropOverlay from './DragDropOverlay'
import ModelSelectionModal from './ModelSelectionModal'

const { TextArea } = Input

interface MessageInputProps {
  disabled?: boolean
  selectedModel?: { id: string; config: ModelConfigEntity } | null
  onSendMessage?: (message: string) => void
  onModelSelect?: (modelId: string, config: ModelConfigEntity, modelName?: string) => void
  onGoToModelManagement?: () => void
}

const MessageInput: React.FC<MessageInputProps> = ({ disabled = false, selectedModel, onSendMessage, onModelSelect, onGoToModelManagement }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { config } = useSelector((state: RootState) => state.config)
  const [inputValue, setInputValue] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<FileUploadItem[]>([])
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [showModelSelection, setShowModelSelection] = useState(false)
  const textAreaRef = useRef<any>(null)

  const handleSend = async () => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue && attachedFiles.length === 0) {
      message.warning('请输入消息内容或添加文件')
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

    // 清空输入框和文件
    setInputValue('')
    setAttachedFiles([])
    setShowFileUpload(false)

    // 如果有父组件回调，使用父组件处理
    if (onSendMessage) {
      onSendMessage(trimmedValue)
      return
    }

    // 否则使用原有逻辑
    try {
      // 构建消息内容（包含文件信息）
      let messageContent = trimmedValue
      if (attachedFiles.length > 0) {
        const fileList = attachedFiles.map(file => `📎 ${file.name} (${(file.size / 1024).toFixed(1)}KB)`).join('\n')
        messageContent = trimmedValue ? `${trimmedValue}\n\n附件:\n${fileList}` : `附件:\n${fileList}`
      }

      // 添加用户消息到状态（包含模型信息和文件）
      dispatch(addUserMessage({
        message: messageContent,
        modelId: selectedModel.id,
        files: attachedFiles.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }))
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

  // 处理文件附件按钮点击
  const handleAttachmentClick = () => {
    setShowFileUpload(!showFileUpload)
  }

  // 处理文件变化
  const handleFilesChange = (files: FileUploadItem[]) => {
    setAttachedFiles(files)
    // 如果没有文件了，自动隐藏文件上传区域
    if (files.length === 0) {
      setShowFileUpload(false)
    }
  }

  // 处理拖拽文件
  const handleFileDrop = async (droppedFiles: File[]) => {
    if (disabled) return

    // 检查文件数量限制
    const maxFiles = 5
    if (attachedFiles.length + droppedFiles.length > maxFiles) {
      message.error(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    const fileItems: FileUploadItem[] = []
    const maxSize = 10 // MB

    for (const file of droppedFiles) {
      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        message.error(`文件 "${file.name}" 超过大小限制 (${maxSize}MB)`)
        continue
      }

      // 创建文件项
      const fileItem: FileUploadItem = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file: file
      }

      // 如果是图片，生成预览
      if (file.type.startsWith('image/')) {
        try {
          fileItem.preview = URL.createObjectURL(file)
        } catch (error) {
          console.warn('Failed to create preview for:', file.name)
        }
      }

      fileItems.push(fileItem)
    }

    if (fileItems.length > 0) {
      setAttachedFiles([...attachedFiles, ...fileItems])
      setShowFileUpload(true) // 自动显示文件上传区域
      message.success(`成功添加 ${fileItems.length} 个文件`)
    }
  }

  return (
    <DragDropOverlay
      onFileDrop={handleFileDrop}
      disabled={disabled}
    >
      <div style={{ width: '100%' }}>
        {/* 文件上传区域 */}
        {showFileUpload && (
          <div style={{ 
            marginBottom: 12, 
            padding: 12, 
            backgroundColor: '#fafafa', 
            borderRadius: 6,
            border: '1px solid #f0f0f0'
          }}>
            <FileUpload
              files={attachedFiles}
              onFilesChange={handleFilesChange}
              maxFiles={5}
              maxSize={10}
              disabled={disabled}
            />
          </div>
        )}

        {/* 消息输入区域 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 输入框 */}
          <div style={{ 
            border: '1px solid #d9d9d9', 
            borderRadius: 8, 
            padding: 8,
            backgroundColor: '#fff',
            minHeight: 80
          }}>
            <TextArea
              ref={textAreaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={
                !selectedModel
                  ? "请先选择AI模型..."
                  : selectedModel.config.isEnabled
                    ? `输入消息... (Enter发送，Shift+Enter换行${attachedFiles.length > 0 ? `，已添加${attachedFiles.length}个文件` : '，支持Ctrl+V粘贴文件'})`
                    : "当前模型已禁用，请选择其他模型..."
              }
              autoSize={{ minRows: 2, maxRows: 8 }}
              disabled={disabled}
              style={{
                resize: 'none',
                border: 'none',
                boxShadow: 'none',
                padding: 0,
                fontSize: 14,
                lineHeight: 1.6
              }}
            />
          </div>
          
          {/* 底部工具栏 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* 左侧工具按钮 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                icon={<PaperClipOutlined />}
                onClick={handleAttachmentClick}
                disabled={disabled}
                type={showFileUpload || attachedFiles.length > 0 ? 'primary' : 'default'}
                size="small"
                title="添加文件附件 (支持拖拽和Ctrl+V粘贴)"
              >
                附件
              </Button>
              
              {/* 模型选择/显示 */}
              <Button
                icon={<RobotOutlined />}
                size="small"
                type="text"
                onClick={() => setShowModelSelection(true)}
                disabled={disabled}
                style={{ fontSize: 12, color: '#666' }}
              >
                {selectedModel ? (
                  // 从selectedModel.id中提取模型名称
                  (() => {
                    const parts = selectedModel.id.split('-')
                    return parts.length >= 6 ? parts.slice(5).join('-') : selectedModel.config.model
                  })()
                ) : '选择模型'}
              </Button>
            </div>
            
            {/* 右侧发送按钮 */}
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              disabled={disabled || (!inputValue.trim() && attachedFiles.length === 0)}
              style={{
                borderRadius: 6
              }}
            >
              发送
            </Button>
          </div>
        </div>

      {/* 文件预览指示器 */}
      {attachedFiles.length > 0 && !showFileUpload && (
        <div style={{ 
          marginTop: 8, 
          padding: '6px 12px',
          fontSize: 12, 
          color: '#666',
          backgroundColor: '#f0f8ff',
          borderRadius: 4,
          border: '1px solid #e6f7ff'
        }}>
          📎 已添加 {attachedFiles.length} 个文件 - 
          <Button 
            type="link" 
            size="small" 
            onClick={() => setShowFileUpload(true)}
            style={{ padding: 0, height: 'auto', fontSize: 12, marginLeft: 4 }}
          >
            查看详情
          </Button>
        </div>
      )}
      </div>

      {/* 模型选择弹窗 */}
      <ModelSelectionModal
        visible={showModelSelection}
        onClose={() => setShowModelSelection(false)}
        selectedModelId={selectedModel?.id}
        onSelectModel={(modelId, config, modelName) => {
          onModelSelect?.(modelId, config, modelName)
          setShowModelSelection(false)
        }}
        onGoToModelManagement={onGoToModelManagement}
      />
    </DragDropOverlay>
  )
}

export default MessageInput
