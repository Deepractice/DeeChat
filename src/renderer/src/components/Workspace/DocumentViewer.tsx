import React, { useState, useEffect } from 'react'
import { Spin, Alert, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'

const { Title, Paragraph } = Typography

interface DocumentViewerProps {
  filePath: string
  fileName: string
  fileType: string
  fileContent?: File  // 可选的File对象，用于拖拽上传的文件
  onError?: (error: string) => void
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  filePath, 
  fileName, 
  fileType, 
  fileContent,
  onError 
}) => {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDocument()
  }, [filePath, fileContent])

  const loadDocument = async () => {
    try {
      setLoading(true)
      setError(null)

      // 根据文件类型处理不同的加载逻辑
      switch (fileType.toLowerCase()) {
        case '.txt':
        case '.md':
        case '.markdown':
          await loadTextDocument()
          break
        case '.html':
        case '.htm':
          await loadHtmlDocument()
          break
        case '.json':
          await loadJsonDocument()
          break
        case '.pdf':
          await loadPdfDocument()
          break
        case '.doc':
        case '.docx':
          await loadWordDocument()
          break
        default:
          // 尝试作为文本文件加载
          await loadTextDocument()
      }
    } catch (err) {
      const errorMsg = `加载文档失败: ${err instanceof Error ? err.message : '未知错误'}`
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const loadTextDocument = async () => {
    try {
      // 如果有文件内容（拖拽上传的文件），直接读取
      if (fileContent) {
        const text = await fileContent.text()
        setContent(text)
        return
      }
      
      // 使用Electron的文件API读取文本文件
      if (window.electronAPI?.file?.read) {
        const result = await window.electronAPI.file.read(filePath)
        setContent(result)
      } else {
        // 备用方案：使用FileReader API
        const response = await fetch(`file://${filePath}`)
        const text = await response.text()
        setContent(text)
      }
    } catch (err) {
      throw new Error(`读取文本文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadHtmlDocument = async () => {
    try {
      // 如果有文件内容（拖拽上传的文件），直接读取
      if (fileContent) {
        const html = await fileContent.text()
        setContent(html)
        return
      }
      
      const response = await fetch(`file://${filePath}`)
      const html = await response.text()
      setContent(html)
    } catch (err) {
      throw new Error(`读取HTML文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadJsonDocument = async () => {
    try {
      let jsonText: string
      
      // 如果有文件内容（拖拽上传的文件），直接读取
      if (fileContent) {
        jsonText = await fileContent.text()
      } else {
        const response = await fetch(`file://${filePath}`)
        jsonText = await response.text()
      }
      
      // 格式化JSON显示
      const formatted = JSON.stringify(JSON.parse(jsonText), null, 2)
      setContent(formatted)
    } catch (err) {
      throw new Error(`读取JSON文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadPdfDocument = async () => {
    // PDF需要特殊处理，这里先显示占位符
    setContent('PDF文档预览功能开发中...')
    // TODO: 集成PDF.js或其他PDF查看器
  }

  const loadWordDocument = async () => {
    // Word文档需要特殊处理，这里先显示占位符
    setContent('Word文档预览功能开发中...')
    // TODO: 集成mammoth.js或其他Word文档解析器
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '200px' 
        }}>
          <Spin size="large" />
        </div>
      )
    }

    if (error) {
      return (
        <Alert
          message="文档加载失败"
          description={error}
          type="error"
          showIcon
        />
      )
    }

    // 根据文件类型渲染不同的内容
    switch (fileType.toLowerCase()) {
      case '.md':
      case '.markdown':
        return (
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #f0f0f0'
          }}>
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )
      
      case '.html':
      case '.htm':
        return (
          <div 
            style={{ 
              backgroundColor: '#fff', 
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #f0f0f0'
            }}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )
      
      case '.json':
        return (
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #f0f0f0'
          }}>
            <pre style={{ 
              backgroundColor: '#f8f8f8', 
              padding: '16px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '14px',
              lineHeight: '1.4'
            }}>
              {content}
            </pre>
          </div>
        )
      
      default:
        // 普通文本文件
        return (
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #f0f0f0'
          }}>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: 0,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace'
            }}>
              {content}
            </pre>
          </div>
        )
    }
  }

  return (
    <div style={{ height: '100%' }}>
      {/* 文档头部信息 */}
      <div style={{ 
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #f0f0f0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Title level={5} style={{ margin: 0, flex: 1 }}>
            {fileName}
          </Title>
          <span style={{ 
            fontSize: '12px', 
            color: '#666',
            backgroundColor: '#f0f0f0',
            padding: '2px 6px',
            borderRadius: '3px'
          }}>
            {fileType.replace('.', '').toUpperCase()}
          </span>
        </div>
      </div>

      {/* 文档内容 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {renderContent()}
      </div>
    </div>
  )
}

export default DocumentViewer