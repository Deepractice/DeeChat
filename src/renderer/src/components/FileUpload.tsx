import React, { useState, useRef, useCallback } from 'react'
import { Upload, Button, Card, Space, Typography, Tag, message } from 'antd'
import { 
  PlusOutlined, 
  FileOutlined, 
  DeleteOutlined,
  PictureOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileZipOutlined
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'

const { Text } = Typography

// 支持的文件类型配置
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
  preview?: string // 图片预览URL
}

interface FileUploadProps {
  files: FileUploadItem[]
  onFilesChange: (files: FileUploadItem[]) => void
  maxFiles?: number
  maxSize?: number // MB
  disabled?: boolean
}

export const FileUpload: React.FC<FileUploadProps> = ({
  files = [],
  onFilesChange,
  maxFiles = 10,
  maxSize = 50,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      onFilesChange([...files, ...fileItems])
      message.success(`成功添加 ${fileItems.length} 个文件`)
    }
  }, [files, onFilesChange, maxFiles, maxSize, disabled])

  // 处理文件删除
  const handleRemoveFile = useCallback((fileId: string) => {
    const updatedFiles = files.filter(f => {
      if (f.id === fileId) {
        // 清理预览URL
        if (f.preview) {
          URL.revokeObjectURL(f.preview)
        }
        return false
      }
      return true
    })
    onFilesChange(updatedFiles)
  }, [files, onFilesChange])

  // 移除了拖拽和粘贴事件处理，这些现在由DragDropOverlay处理

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

  // 渲染文件卡片
  const renderFileCard = (fileItem: FileUploadItem) => {
    const fileTypeInfo = getFileType(fileItem.name)

    return (
      <Card
        key={fileItem.id}
        size="small"
        style={{
          width: 200,
          marginBottom: 6
        }}
        styles={{ body: { padding: '6px 8px' } }}
        actions={[
          <Button
            key="delete"
            type="text"
            size="small"
            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
            onClick={() => handleRemoveFile(fileItem.id)}
            danger
            style={{ 
              padding: '2px 4px',
              height: 20,
              width: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          />
        ]}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* 文件图标或预览 */}
          <div style={{ flexShrink: 0 }}>
            {fileItem.preview ? (
              <img
                src={fileItem.preview}
                alt={fileItem.name}
                style={{
                  width: 28,
                  height: 28,
                  objectFit: 'cover',
                  borderRadius: 3
                }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  borderRadius: 3,
                  color: fileTypeInfo.color,
                  fontSize: 14
                }}
              >
                {fileTypeInfo.icon}
              </div>
            )}
          </div>

          {/* 文件信息 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Text
                ellipsis={{ tooltip: fileItem.name }}
                style={{ fontSize: 11, fontWeight: 500, maxWidth: 100 }}
              >
                {fileItem.name}
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
              <Tag size="small" color={fileTypeInfo.color} style={{ fontSize: 10, lineHeight: 1.2, padding: '0 4px' }}>
                {fileTypeInfo.type.toUpperCase()}
              </Tag>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {formatFileSize(fileItem.size)}
              </Text>
            </div>
          </div>
        </div>
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
}

export default FileUpload