import React, { useState } from 'react'
import { Upload, Button, message } from 'antd'
import { InboxOutlined, CloseOutlined } from '@ant-design/icons'
import DocumentViewer from './DocumentViewer'

const { Dragger } = Upload

interface DocumentUploadProps {
  onDocumentLoad: (filePath: string, fileName: string, content: React.ReactNode) => void
  onClose: () => void
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onDocumentLoad, onClose }) => {
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = (file: File) => {
    setUploading(true)
    
    try {
      const fileType = '.' + file.name.split('.').pop()?.toLowerCase()
      
      // 创建文档查看器组件
      const documentViewer = (
        <DocumentViewer
          filePath={file.path || URL.createObjectURL(file)}
          fileName={file.name}
          fileType={fileType}
          onError={(error) => {
            message.error(error)
          }}
        />
      )
      
      // 通知父组件加载文档
      onDocumentLoad(file.path || URL.createObjectURL(file), file.name, documentViewer)
      
      message.success(`文档 "${file.name}" 加载成功`)
    } catch (error) {
      message.error(`加载文档失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setUploading(false)
    }
    
    return false // 阻止默认上传行为
  }

  return (
    <div style={{ position: 'relative' }}>
      <Button 
        icon={<CloseOutlined />}
        onClick={onClose}
        style={{ position: 'absolute', right: 0, top: -8, zIndex: 1 }}
        type="text"
        size="small"
      />
      
      <Dragger
        multiple
        beforeUpload={handleFileSelect}
        accept=".pdf,.doc,.docx,.txt,.md,.html,.htm,.json"
        style={{ padding: '20px' }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文档到此区域</p>
        <p className="ant-upload-hint">
          支持 PDF, Word, TXT, Markdown, HTML, JSON 等格式
        </p>
      </Dragger>
    </div>
  )
}

export default DocumentUpload