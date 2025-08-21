import React, { useState, useRef, useEffect } from 'react'
import { Input, Button, message, Tag } from 'antd'
import { SendOutlined, PaperClipOutlined, RobotOutlined, FileTextOutlined, SelectOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { saveCurrentSession, setSessionLoading } from '../store/slices/chatSlice'
import { ModelConfigEntity } from '../../../shared/entities/ModelConfigEntity'
import FileUploadWithProgress, { FileUploadItem, FileUploadWithProgressRef } from './FileUploadWithProgress'
import DragDropOverlay from './DragDropOverlay'
import ModelSelectionModal from './ModelSelectionModal'
import RoleSelector from './RoleSelector'
import { FileReferenceService, FileReference } from '../../../shared/services/FileReferenceService'
import { useUnifiedMessage } from '../hooks/useUnifiedMessage'

const { TextArea } = Input

interface MessageInputProps {
  disabled?: boolean
  selectedModel?: { id: string; config: ModelConfigEntity } | null
  onSendMessage?: (message: string) => void
  onModelSelect?: (modelId: string, config: ModelConfigEntity, modelName?: string) => void
  onGoToModelManagement?: () => void
  compact?: boolean  // 紧凑模式，用于工作区展开时
}

const MessageInput: React.FC<MessageInputProps> = ({ disabled = false, selectedModel, onSendMessage, onModelSelect, onGoToModelManagement, compact = false }) => {
  const dispatch = useDispatch<AppDispatch>()
  const { currentSession, roles } = useSelector((state: RootState) => state.chat)

  // 🔥 使用统一消息Hook
  const { sendMessage: sendUnifiedMessage } = useUnifiedMessage()
  const [inputValue, setInputValue] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<FileUploadItem[]>([])
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([])
  const [showFileUpload, setShowFileUpload] = useState(false)
  const fileUploadRef = useRef<FileUploadWithProgressRef>(null)
  const [showModelSelection, setShowModelSelection] = useState(false)
  const textAreaRef = useRef<any>(null)
  
  // 工作区文件引用状态
  const [referencedFiles, setReferencedFiles] = useState<FileReference[]>([])
  const fileReferenceService = FileReferenceService.getInstance()

  // 监听工作区文件引用事件
  useEffect(() => {
    const handleFileReference = (event: CustomEvent) => {
      const { referenceMessage, reference } = event.detail
      
      // 将引用消息插入到输入框中
      setInputValue(prev => {
        const currentValue = prev.trim()
        return currentValue ? `${referenceMessage}\n${currentValue}` : referenceMessage
      })
      
      // 添加到引用文件列表
      setReferencedFiles(prev => {
        // 避免重复添加同一文件
        if (!prev.find(f => f.fileId === reference.fileId)) {
          return [...prev, reference]
        }
        return prev
      })
      
      // 聚焦到输入框
      setTimeout(() => {
        textAreaRef.current?.focus()
      }, 100)
    }

    window.addEventListener('insertChatReference', handleFileReference as EventListener)
    
    return () => {
      window.removeEventListener('insertChatReference', handleFileReference as EventListener)
    }
  }, [])

  // 移除引用文件
  const handleRemoveReference = (fileId: string) => {
    setReferencedFiles(prev => prev.filter(f => f.fileId !== fileId))
    
    // 同时从输入框中移除对应的引用内容
    const removedReference = referencedFiles.find(f => f.fileId === fileId)
    if (removedReference) {
      const referenceMessage = fileReferenceService.generateChatMessage(removedReference)
      setInputValue(prev => prev.replace(referenceMessage, '').trim())
    }
  }

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

    // 检查文件是否都已上传成功
    const successfulFiles = attachedFiles.filter(f => f.uploadStatus === 'success' && f.uploadedId)
    if (attachedFiles.length > 0 && successfulFiles.length !== attachedFiles.length) {
      message.error('请等待所有文件上传完成后再发送')
      return
    }

    // 使用已上传的文件ID
    const attachmentIds = uploadedFileIds

    // 如果有父组件回调，使用父组件处理
    if (onSendMessage) {
      onSendMessage(trimmedValue)
      // 清空输入框和文件
      setInputValue('')
      setAttachedFiles([])
      setUploadedFileIds([])
      setReferencedFiles([])
      setShowFileUpload(false)
      return
    }

    // 🔥 使用统一消息API - 大幅简化逻辑
    try {
      // 构建消息内容（包含文件信息）
      let messageContent = trimmedValue
      if (attachedFiles.length > 0) {
        const fileList = attachedFiles.map(file => `📎 ${file.name} (${(file.size / 1024).toFixed(1)}KB)`).join('\n')
        messageContent = trimmedValue ? `${trimmedValue}\n\n附件:\n${fileList}` : `附件:\n${fileList}`
      }

      // 🔥 立即清空输入框，提供即时反馈
      setInputValue('')
      setAttachedFiles([])
      setUploadedFileIds([])
      setReferencedFiles([])
      setShowFileUpload(false)

      // 🎯 设置会话级加载状态
      if (currentSession?.id) {
        dispatch(setSessionLoading({ sessionId: currentSession.id, loading: true }))
      }

      // 🔥 使用统一消息Hook - 超级简化！
      const response = await sendUnifiedMessage(messageContent, {
        sessionId: currentSession?.id || `session_${Date.now()}`,
        configId: selectedModel.id,
        enableMCPTools: true,
        chatHistory: currentSession?.messages || [],
        activeRole: roles.currentRole?.id,
        attachmentIds
      })

      console.log('✅ [统一消息] 消息发送成功:', response?.success)

      // 🔥 统一消息Hook已经处理了所有复杂逻辑：
      // - 添加用户消息到状态
      // - 启动流式状态管理
      // - 流式显示AI回复
      // - 自动保存会话

      // 🎯 清除会话级加载状态
      if (currentSession?.id) {
        dispatch(setSessionLoading({ sessionId: currentSession.id, loading: false }))
      }

      // 自动保存会话
      dispatch(saveCurrentSession())

    } catch (error) {
      console.error('❌ [统一消息] 发送失败:', error)

      // 🎯 发生错误时清除会话级加载状态
      if (currentSession?.id) {
        dispatch(setSessionLoading({ sessionId: currentSession.id, loading: false }))
      }

      // 🔧 统一消息Hook已经处理了流式状态重置
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

  // 处理已上传文件ID变化
  const handleUploadedIdsChange = (ids: string[]) => {
    setUploadedFileIds(ids)
  }

  // 处理拖拽文件
  const handleFileDrop = async (droppedFiles: File[]) => {
    if (disabled) return
    
    // 确保文件上传区域可见
    setShowFileUpload(true)
    
    // 现在组件始终渲染，ref应该立即可用
    if (fileUploadRef.current) {
      fileUploadRef.current.handleAddFiles(droppedFiles)
    } else {
      // 如果ref仍然不可用，使用setTimeout确保组件已渲染
      setTimeout(() => {
        if (fileUploadRef.current) {
          fileUploadRef.current.handleAddFiles(droppedFiles)
        } else {
          console.error('FileUploadWithProgress ref 仍然不可用')
        }
      }, 50)
    }
  }

  return (
    <DragDropOverlay
      onFileDrop={handleFileDrop}
      disabled={disabled}
    >
      <div style={{ width: '100%' }}>
        {/* 文件上传区域 - 始终渲染以确保ref可用 */}
        <div style={{ 
          marginBottom: showFileUpload ? 12 : 0, // 动态控制间距
          padding: showFileUpload ? 12 : 0,     // 动态控制内边距
          backgroundColor: showFileUpload ? '#fafafa' : 'transparent', 
          borderRadius: showFileUpload ? 6 : 0,
          border: showFileUpload ? '1px solid #f0f0f0' : 'none',
          height: showFileUpload ? 'auto' : 0,  // 隐藏时高度为0
          overflow: 'hidden',                   // 隐藏时不显示内容
          transition: 'all 0.2s ease'          // 平滑过渡动画
        }}>
          <FileUploadWithProgress
            ref={fileUploadRef}
            files={attachedFiles}
            onFilesChange={handleFilesChange}
            onUploadedIdsChange={handleUploadedIdsChange}
            maxFiles={5}
            maxSize={10}
            disabled={disabled}
          />
        </div>

        {/* 消息输入区域 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 工作区文件引用显示 */}
          {referencedFiles.length > 0 && (
            <div style={{
              padding: 8,
              backgroundColor: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}>
              <div style={{ fontSize: '12px', color: '#52c41a', fontWeight: 'bold' }}>
                📎 引用的工作区文件：
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {referencedFiles.map(ref => (
                  <Tag
                    key={ref.fileId}
                    icon={ref.selectedText ? <SelectOutlined /> : <FileTextOutlined />}
                    closable
                    onClose={() => handleRemoveReference(ref.fileId)}
                    color={ref.selectedText ? "blue" : "green"}
                    title={ref.selectedText ? `选中文字：${ref.selectedText.substring(0, 100)}...` : `完整文件：${ref.fileName}`}
                  >
                    {ref.selectedText ? `${ref.fileName} (选中文字)` : ref.fileName}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          
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
                title={compact ? "添加附件" : "添加文件附件 (支持拖拽和Ctrl+V粘贴)"}
                style={{ 
                  minWidth: compact ? '28px' : 'auto',
                  padding: compact ? '4px' : undefined
                }}
              >
                {!compact && '附件'}
              </Button>
              
              {/* 角色选择器 */}
              <RoleSelector
                disabled={disabled}
                size="small"
              />
              
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
              disabled={disabled || (!inputValue.trim() && attachedFiles.length === 0) || (attachedFiles.length > 0 && attachedFiles.some(f => f.uploadStatus !== 'success'))}
              style={{
                borderRadius: 6,
                minWidth: compact ? '32px' : 'auto',
                padding: compact ? '4px 8px' : undefined
              }}
              title={compact ? '发送消息' : undefined}  // 紧凑模式显示tooltip
            >
              {compact ? null : (
                attachedFiles.length > 0 && attachedFiles.some(f => f.uploadStatus === 'uploading') ? '上传中...' : 
                attachedFiles.length > 0 && attachedFiles.some(f => f.uploadStatus === 'error') ? '上传失败' : '发送'
              )}
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
