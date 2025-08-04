import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Upload, Button, Card, Space, Typography, Tag, message, Progress } from 'antd'
import { 
  PlusOutlined, 
  FileOutlined, 
  DeleteOutlined,
  PictureOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileZipOutlined,
  CheckCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons'

const { Text } = Typography

// 文件类型配置
const FILE_TYPE_CONFIG = {
  image: {
    extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
    icon: <PictureOutlined />,
    color: '#52c41a'
  },
  document: {
    extensions: ['.pdf', '.doc', '.docx', '.txt', '.md'],
    icon: <FileTextOutlined />,
    color: '#1890ff'
  },
  archive: {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    icon: <FileZipOutlined />,
    color: '#fa8c16'
  },
  code: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.cpp', '.c', '.css', '.html'],
    icon: <FileOutlined />,
    color: '#722ed1'
  },
  other: {
    extensions: [],
    icon: <FileOutlined />,
    color: '#8c8c8c'
  }
}

// 获取文件类型
const getFileType = (fileName: string) => {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase()
  
  for (const [type, config] of Object.entries(FILE_TYPE_CONFIG)) {
    if (config.extensions.includes(ext)) {
      return { type, ...config }
    }
  }
  
  return { type: 'other', ...FILE_TYPE_CONFIG.other }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export interface FileUploadItem {
  id: string
  name: string
  size: number
  type: string
  file: File
  preview?: string
  // 新增上传相关字段
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error'
  uploadProgress?: number
  uploadedId?: string // 上传成功后的文件ID
  error?: string
}

interface FileUploadWithProgressProps {
  files: FileUploadItem[]
  onFilesChange: (files: FileUploadItem[]) => void
  onUploadedIdsChange?: (ids: string[]) => void // 回调已上传的文件ID
  maxFiles?: number
  maxSize?: number // MB
  disabled?: boolean
}

export interface FileUploadWithProgressRef {
  handleAddFiles: (files: File[]) => void
}

export const FileUploadWithProgress = forwardRef<FileUploadWithProgressRef, FileUploadWithProgressProps>(({
  files = [],
  onFilesChange,
  onUploadedIdsChange,
  maxFiles = 10,
  maxSize = 50,
  disabled = false
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<Set<string>>(new Set())

  // 上传单个文件
  const uploadFile = useCallback(async (fileItem: FileUploadItem) => {
    console.log(`开始上传文件: ${fileItem.name}`)
    // 更新状态为上传中
    onFilesChange(prevFiles => prevFiles.map(f => 
      f.id === fileItem.id ? { ...f, uploadStatus: 'uploading' as const, uploadProgress: 0 } : f
    ))
    setUploading(prev => new Set(prev).add(fileItem.id))

    try {
      // 读取文件为ArrayBuffer
      const arrayBuffer = await fileItem.file.arrayBuffer()
      
      // 模拟上传进度
      for (let i = 10; i <= 90; i += 20) {
        await new Promise(resolve => setTimeout(resolve, 200))
        console.log(`Upload progress for ${fileItem.name}: ${i}%`)
        onFilesChange(prevFiles => prevFiles.map(f => 
          f.id === fileItem.id ? { ...f, uploadProgress: i, uploadStatus: 'uploading' as const } : f
        ))
      }

      // 调用上传API
      const result = await window.electronAPI.file.upload(arrayBuffer, {
        name: fileItem.name,
        mimeType: fileItem.type
      })

      if (result.success) {
        // 上传成功
        onFilesChange(prevFiles => {
          const updatedFiles = prevFiles.map(f => 
            f.id === fileItem.id 
              ? { ...f, uploadStatus: 'success' as const, uploadProgress: 100, uploadedId: result.data.fileId }
              : f
          )
          
          // 通知父组件已上传的文件ID
          if (onUploadedIdsChange) {
            const uploadedIds = updatedFiles
              .filter(f => f.uploadedId)
              .map(f => f.uploadedId!)
            onUploadedIdsChange(uploadedIds)
          }
          
          return updatedFiles
        })
      } else {
        throw new Error(result.error || '上传失败')
      }
    } catch (error) {
      // 上传失败
      onFilesChange(prevFiles => prevFiles.map(f => 
        f.id === fileItem.id 
          ? { ...f, uploadStatus: 'error' as const, error: error instanceof Error ? error.message : '上传失败' }
          : f
      ))
      message.error(`文件 "${fileItem.name}" 上传失败`)
    } finally {
      setUploading(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileItem.id)
        return newSet
      })
    }
  }, [onFilesChange, onUploadedIdsChange])

  // 处理文件添加
  const handleAddFiles = useCallback(async (newFiles: File[]) => {
    if (disabled) return

    // 检查文件数量限制
    if (files.length + newFiles.length > maxFiles) {
      message.error(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    const fileItems: FileUploadItem[] = []

    for (const file of newFiles) {
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
        file: file,
        uploadStatus: 'pending'
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
      const newFilesList = [...files, ...fileItems]
      onFilesChange(newFilesList)
      
      // 立即开始上传新添加的文件
      setTimeout(() => {
        for (const fileItem of fileItems) {
          uploadFile(fileItem)
        }
      }, 100)
    }
  }, [files, onFilesChange, maxFiles, maxSize, disabled, uploadFile])

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    handleAddFiles
  }), [handleAddFiles])

  // 处理文件删除
  const handleRemoveFile = useCallback(async (fileId: string) => {
    const fileToRemove = files.find(f => f.id === fileId)
    if (!fileToRemove) return

    // 如果文件已上传，调用删除API
    if (fileToRemove.uploadedId) {
      try {
        await window.electronAPI.file.delete(fileToRemove.uploadedId)
      } catch (error) {
        console.error('Failed to delete uploaded file:', error)
      }
    }

    // 清理预览URL
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview)
    }

    // 更新文件列表
    const updatedFiles = files.filter(f => f.id !== fileId)
    onFilesChange(updatedFiles)

    // 更新已上传的文件ID列表
    if (onUploadedIdsChange) {
      const uploadedIds = updatedFiles
        .filter(f => f.uploadedId)
        .map(f => f.uploadedId!)
      onUploadedIdsChange(uploadedIds)
    }
  }, [files, onFilesChange, onUploadedIdsChange])

  // 点击上传
  const handleClickUpload = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      handleAddFiles(selectedFiles)
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = ''
  }

  // 获取上传状态图标
  const getStatusIcon = (status?: string, progress?: number) => {
    switch (status) {
      case 'uploading':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'error':
        return <DeleteOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  // 渲染文件卡片
  const renderFileCard = (fileItem: FileUploadItem) => {
    const fileTypeInfo = getFileType(fileItem.name)
    const isUploading = fileItem.uploadStatus === 'uploading'
    const isSuccess = fileItem.uploadStatus === 'success'
    const isError = fileItem.uploadStatus === 'error'

    return (
      <Card
        key={fileItem.id}
        size="small"
        style={{
          width: 240,
          marginBottom: 8,
          opacity: isUploading ? 0.9 : 1,
          border: isSuccess ? '1px solid #52c41a' : isError ? '1px solid #ff4d4f' : '1px solid #d9d9d9',
          backgroundColor: isSuccess ? '#f6ffed' : isError ? '#fff2f0' : '#fff'
        }}
        styles={{ body: { padding: '10px 12px' } }}
      >
        {/* 文件头部 - 图标、名称、删除按钮在同一行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {/* 文件图标或预览 */}
          <div style={{ flexShrink: 0, position: 'relative' }}>
            {fileItem.preview ? (
              <img
                src={fileItem.preview}
                alt={fileItem.name}
                style={{
                  width: 32,
                  height: 32,
                  objectFit: 'cover',
                  borderRadius: 4
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 4,
                  color: fileTypeInfo.color,
                  fontSize: 16
                }}
              >
                {fileTypeInfo.icon}
              </div>
            )}
            
            {/* 状态图标覆盖层 */}
            {fileItem.uploadStatus && fileItem.uploadStatus !== 'pending' && (
              <div
                style={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                {getStatusIcon(fileItem.uploadStatus, fileItem.uploadProgress)}
              </div>
            )}
          </div>

          {/* 文件名 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text
              ellipsis={{ tooltip: fileItem.name }}
              style={{ fontSize: 13, fontWeight: 500 }}
            >
              {fileItem.name}
            </Text>
          </div>

          {/* 删除按钮 */}
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined style={{ fontSize: 14 }} />}
            onClick={() => handleRemoveFile(fileItem.id)}
            disabled={isUploading}
            danger
            style={{ 
              padding: '4px',
              height: 24,
              width: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        </div>

        {/* 文件信息行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Tag size="small" color={fileTypeInfo.color} style={{ fontSize: 10, lineHeight: 1.2, padding: '2px 6px' }}>
            {fileTypeInfo.type.toUpperCase()}
          </Tag>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatFileSize(fileItem.size)}
          </Text>
        </div>
        
        {/* 上传进度 */}
        {fileItem.uploadStatus === 'uploading' && fileItem.uploadProgress !== undefined && (
          <div style={{ marginBottom: 4 }}>
            <Progress
              percent={fileItem.uploadProgress}
              size="small"
              strokeWidth={4}
              showInfo={true}
              format={(percent) => `${percent}%`}
            />
          </div>
        )}
        
        {/* 上传成功提示 */}
        {fileItem.uploadStatus === 'success' && (
          <div style={{ color: '#52c41a', fontSize: 11, fontWeight: 500 }}>
            ✅ 上传成功
          </div>
        )}
        
        {/* 错误信息 */}
        {fileItem.uploadStatus === 'error' && fileItem.error && (
          <Text type="danger" style={{ fontSize: 11 }}>
            ❌ {fileItem.error}
          </Text>
        )}
      </Card>
    )
  }

  return (
    <div>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* 点击上传区域 */}
      {files.length === 0 && (
        <div
          style={{
            border: '2px dashed #d9d9d9',
            borderRadius: 8,
            padding: '20px',
            textAlign: 'center',
            backgroundColor: '#fafafa',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease'
          }}
          onClick={handleClickUpload}
        >
          <PlusOutlined style={{ fontSize: 24, color: '#8c8c8c', marginBottom: 8 }} />
          <div>
            <Text type="secondary">
              点击选择文件
            </Text>
          </div>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              或直接拖拽到对话框任意位置
            </Text>
          </div>
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 && (
        <div>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              已添加 {files.length} 个文件
            </Text>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={handleClickUpload}
              disabled={disabled || files.length >= maxFiles}
            >
              添加更多
            </Button>
          </div>
          
          <div 
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: 6,
              maxHeight: 150,
              overflowY: 'auto',
              padding: 2
            }}
          >
            {files.map(renderFileCard)}
          </div>
        </div>
      )}
    </div>
  )
})

FileUploadWithProgress.displayName = 'FileUploadWithProgress'

export default FileUploadWithProgress