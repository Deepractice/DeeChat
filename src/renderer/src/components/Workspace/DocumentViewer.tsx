import React, { useState, useEffect } from 'react'
import { Spin, Alert, Typography, Button, Input, message, Dropdown } from 'antd'
import { FileTextOutlined, EditOutlined, SaveOutlined, EyeOutlined, DownloadOutlined, MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import ReactMarkdown from 'react-markdown'

const { Title, Paragraph } = Typography
const { TextArea } = Input

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
  const [editedContent, setEditedContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

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
        case '.xlsx':
        case '.xls':
          await loadExcelDocument()
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
        setEditedContent(text)
        return
      }
      
      // 使用新的统一文件操作API读取文件
      if (window.electronAPI?.fileOp?.read) {
        const fileContent = await window.electronAPI.fileOp.read(filePath)
        const textContent = typeof fileContent.content === 'string' 
          ? fileContent.content 
          : String(fileContent.content)
        setContent(textContent)
        setEditedContent(textContent)
      } else {
        // 备用方案：使用FileReader API
        const response = await fetch(`file://${filePath}`)
        const text = await response.text()
        setContent(text)
        setEditedContent(text)
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
    try {
      // 如果有文件内容（拖拽上传的文件），先保存到临时位置再处理
      if (fileContent) {
        try {
          // 创建临时文件路径
          const tempDir = '/tmp'
          const tempFileName = `temp_${Date.now()}_${fileName}`
          const tempPath = `${tempDir}/${tempFileName}`
          
          // 将文件保存到临时位置
          const arrayBuffer = await fileContent.arrayBuffer()
          const uint8Array = new Uint8Array(arrayBuffer)
          
          console.log('拖拽Word文档处理:', {
            fileName,
            fileSize: arrayBuffer.byteLength,
            tempPath
          })
          
          // 使用文件操作API保存临时文件
          if (window.electronAPI?.fileOp?.write) {
            await window.electronAPI.fileOp.write(tempPath, {
              type: 'binary' as const,
              content: uint8Array,
              metadata: { format: 'word' }
            })
            
            // 然后读取处理后的内容
            const result = await window.electronAPI.fileOp.read(tempPath)
            
            console.log('Word文档读取结果:', {
              type: result.type,
              contentType: typeof result.content,
              hasHtml: result.content?.html ? 'yes' : 'no',
              hasText: result.content?.text ? 'yes' : 'no'
            })
            
            if (result.type === 'structured' && typeof result.content === 'object' && result.content.html) {
              const htmlContent = result.content.html || ''
              const textContent = result.content.text || ''
              
              // 检查HTML内容是否有效
              if (htmlContent && htmlContent.length > 0 && !htmlContent.match(/^\d+([,\d\.]*\d+)*$/)) {
                setContent(htmlContent)
                setEditedContent(textContent)
              } else {
                // HTML内容无效，显示纯文本
                setContent(`<p>${textContent || '文档内容为空'}</p>`)
                setEditedContent(textContent || '文档内容为空')
              }
            } else {
              // 降级处理：显示错误信息
              console.error('Word文档解析失败，返回数据格式不正确:', result)
              setContent('<p style="color: red;">Word文档解析失败，可能是文档格式不受支持</p>')
              setEditedContent('Word文档解析失败')
            }
          } else {
            setContent('<p style="color: red;">Word文档预览功能不可用</p>')
            setEditedContent('Word文档预览功能不可用')
          }
        } catch (err) {
          console.error('处理拖拽Word文档失败:', err)
          setContent('<p style="color: red;">拖拽的Word文档处理失败，请重试</p>')
          setEditedContent('拖拽的Word文档处理失败，请重试')
        }
        return
      }
      
      // 使用新的统一文件操作API读取Word文档
      if (window.electronAPI?.fileOp?.read) {
        const fileContent = await window.electronAPI.fileOp.read(filePath)
        
        if (fileContent.type === 'structured' && typeof fileContent.content === 'object') {
          // 使用转换后的HTML内容进行显示
          const htmlContent = fileContent.content.html || ''
          const textContent = fileContent.content.text || ''
          
          setContent(htmlContent)
          setEditedContent(textContent) // 编辑时使用纯文本
        } else {
          // 降级处理
          const textContent = String(fileContent.content)
          setContent(textContent)
          setEditedContent(textContent)
        }
      } else {
        setContent('Word文档预览功能不可用')
        setEditedContent('Word文档预览功能不可用')
      }
    } catch (err) {
      throw new Error(`读取Word文档失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadExcelDocument = async () => {
    try {
      // 如果有文件内容（拖拽上传的文件），暂时不支持
      if (fileContent) {
        setContent('拖拽的Excel文档暂不支持预览，请保存到本地后打开')
        setEditedContent('拖拽的Excel文档暂不支持预览，请保存到本地后打开')
        return
      }
      
      // 使用新的统一文件操作API读取Excel文档
      if (window.electronAPI?.fileOp?.read) {
        const fileContent = await window.electronAPI.fileOp.read(filePath)
        
        if (fileContent.type === 'structured' && typeof fileContent.content === 'object') {
          // 使用转换后的文本内容进行显示
          const textContent = fileContent.content.text || ''
          const sheetNames = fileContent.content.sheetNames || []
          
          // 生成更友好的显示内容
          const displayContent = `Excel工作簿：${sheetNames.length}个工作表\n工作表：${sheetNames.join(', ')}\n\n${textContent}`
          
          setContent(displayContent)
          setEditedContent(textContent) // 编辑时使用原始CSV格式
        } else {
          // 降级处理
          const textContent = String(fileContent.content)
          setContent(textContent)
          setEditedContent(textContent)
        }
      } else {
        setContent('Excel文档预览功能不可用')
        setEditedContent('Excel文档预览功能不可用')
      }
    } catch (err) {
      throw new Error(`读取Excel文档失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  // 保存文档内容到工作区缓存
  const saveDocument = async () => {
    try {
      setSaving(true)
      
      // 使用新的统一文件操作API保存文件到工作区缓存
      if (window.electronAPI?.fileOp?.write) {
        const fileContent = {
          type: 'text' as const,
          content: editedContent,
          metadata: { encoding: 'utf-8' }
        }
        await window.electronAPI.fileOp.write(filePath, fileContent)
        setContent(editedContent)
        message.success('文档已保存到工作区缓存')
        setIsEditing(false)
      } else {
        throw new Error('文件保存功能不可用')
      }
    } catch (err) {
      const errorMsg = `保存失败: ${err instanceof Error ? err.message : '未知错误'}`
      message.error(errorMsg)
      onError?.(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  // 导出文档内容
  const exportDocument = () => {
    const contentToExport = isEditing ? editedContent : content
    const blob = new Blob([contentToExport], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    message.success(`已导出文档: ${fileName}`)
  }

  // 导出为不同格式
  const exportAsFormat = (format: string) => {
    const contentToExport = isEditing ? editedContent : content
    let blob: Blob
    let downloadName: string
    
    switch (format) {
      case 'txt':
        blob = new Blob([contentToExport], { type: 'text/plain;charset=utf-8' })
        downloadName = fileName.replace(/\.[^/.]+$/, '.txt')
        break
      case 'md':
        blob = new Blob([contentToExport], { type: 'text/markdown;charset=utf-8' })
        downloadName = fileName.replace(/\.[^/.]+$/, '.md')
        break
      case 'html':
        // 如果是markdown，转换为HTML预览
        if (fileType.toLowerCase().includes('md')) {
          const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${fileName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        code { background-color: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; padding-left: 16px; margin-left: 0; }
    </style>
</head>
<body>
    <div>${content}</div>
</body>
</html>`
          blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
        } else {
          blob = new Blob([contentToExport], { type: 'text/html;charset=utf-8' })
        }
        downloadName = fileName.replace(/\.[^/.]+$/, '.html')
        break
      default:
        blob = new Blob([contentToExport], { type: 'text/plain;charset=utf-8' })
        downloadName = fileName
    }
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    message.success(`已导出为 ${format.toUpperCase()}: ${downloadName}`)
  }

  // 切换编辑模式
  const toggleEditMode = () => {
    if (isEditing) {
      // 从编辑模式切换到预览模式，检查是否有未保存的内容
      if (editedContent !== content) {
        // 可以添加确认对话框
        setEditedContent(content) // 重置编辑内容
      }
      setIsEditing(false)
    } else {
      setIsEditing(true)
      setEditedContent(content)
    }
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
            padding: '32px 40px',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            overflow: 'auto',
            maxHeight: '100%',
            lineHeight: '1.7',
            fontSize: '16px',
            color: '#24292f'
          }}>
            <div className="markdown-content">
              <ReactMarkdown
                components={{
                  h1: ({children}) => <h1 style={{ 
                    fontSize: '32px', 
                    fontWeight: '600', 
                    marginBottom: '16px', 
                    marginTop: '0',
                    color: '#24292f',
                    borderBottom: '1px solid #d0d7de',
                    paddingBottom: '8px',
                    lineHeight: '1.25'
                  }}>{children}</h1>,
                  h2: ({children}) => <h2 style={{ 
                    fontSize: '24px', 
                    fontWeight: '600', 
                    marginBottom: '16px', 
                    marginTop: '24px',
                    color: '#24292f',
                    borderBottom: '1px solid #d0d7de',
                    paddingBottom: '8px',
                    lineHeight: '1.25'
                  }}>{children}</h2>,
                  h3: ({children}) => <h3 style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    marginBottom: '16px', 
                    marginTop: '24px',
                    color: '#24292f',
                    lineHeight: '1.25'
                  }}>{children}</h3>,
                  h4: ({children}) => <h4 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    marginBottom: '16px', 
                    marginTop: '24px',
                    color: '#24292f',
                    lineHeight: '1.25'
                  }}>{children}</h4>,
                  h5: ({children}) => <h5 style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    marginBottom: '16px', 
                    marginTop: '24px',
                    color: '#24292f',
                    lineHeight: '1.25'
                  }}>{children}</h5>,
                  h6: ({children}) => <h6 style={{ 
                    fontSize: '13px', 
                    fontWeight: '600', 
                    marginBottom: '16px', 
                    marginTop: '24px',
                    color: '#656d76',
                    lineHeight: '1.25'
                  }}>{children}</h6>,
                  p: ({children}) => <p style={{ 
                    marginBottom: '16px', 
                    marginTop: '0',
                    color: '#24292f',
                    lineHeight: '1.6'
                  }}>{children}</p>,
                  ul: ({children}) => <ul style={{ 
                    marginBottom: '16px',
                    marginTop: '0', 
                    paddingLeft: '2em',
                    color: '#24292f'
                  }}>{children}</ul>,
                  ol: ({children}) => <ol style={{ 
                    marginBottom: '16px',
                    marginTop: '0', 
                    paddingLeft: '2em',
                    color: '#24292f'
                  }}>{children}</ol>,
                  li: ({children}) => <li style={{ 
                    marginTop: '0.25em',
                    color: '#24292f'
                  }}>{children}</li>,
                  code: ({children, className, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '')
                    return !match ? (
                      <code style={{
                        backgroundColor: 'rgba(175,184,193,0.2)',
                        padding: '0.2em 0.4em',
                        borderRadius: '6px',
                        fontSize: '85%',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        color: '#24292f'
                      }} {...props}>{children}</code>
                    ) : (
                      <code style={{
                        backgroundColor: '#f6f8fa',
                        padding: '16px',
                        borderRadius: '6px',
                        fontSize: '85%',
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                        display: 'block',
                        overflow: 'auto',
                        border: '1px solid #d0d7de',
                        lineHeight: '1.45',
                        color: '#24292f'
                      }} {...props}>{children}</code>
                    )
                  },
                  pre: ({children}) => <pre style={{
                    backgroundColor: '#f6f8fa',
                    marginBottom: '16px',
                    marginTop: '0',
                    overflow: 'auto',
                    borderRadius: '6px',
                    border: '1px solid #d0d7de',
                    padding: '16px'
                  }}>{children}</pre>,
                  blockquote: ({children}) => <blockquote style={{
                    borderLeft: '0.25em solid #d0d7de',
                    paddingLeft: '1em',
                    marginLeft: '0',
                    marginRight: '0',
                    marginBottom: '16px',
                    marginTop: '0',
                    color: '#656d76'
                  }}>{children}</blockquote>,
                  table: ({children}) => <table style={{
                    borderSpacing: '0',
                    borderCollapse: 'collapse',
                    display: 'block',
                    overflow: 'auto',
                    width: '100%',
                    marginBottom: '16px',
                    marginTop: '0'
                  }}>{children}</table>,
                  thead: ({children}) => <thead>{children}</thead>,
                  tbody: ({children}) => <tbody>{children}</tbody>,
                  tr: ({children}) => <tr style={{
                    backgroundColor: '#fff',
                    borderTop: '1px solid hsla(210,18%,87%,1)'
                  }}>{children}</tr>,
                  td: ({children}) => <td style={{
                    padding: '6px 13px',
                    border: '1px solid #d0d7de'
                  }}>{children}</td>,
                  th: ({children}) => <th style={{
                    padding: '6px 13px',
                    border: '1px solid #d0d7de',
                    fontWeight: '600'
                  }}>{children}</th>,
                  strong: ({children}) => <strong style={{
                    fontWeight: '600'
                  }}>{children}</strong>,
                  em: ({children}) => <em style={{
                    fontStyle: 'italic'
                  }}>{children}</em>,
                  del: ({children}) => <del>{children}</del>,
                  hr: () => <hr style={{
                    height: '0.25em',
                    padding: '0',
                    margin: '24px 0',
                    backgroundColor: '#d0d7de',
                    border: '0'
                  }} />
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
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
      
      case '.docx':
      case '.doc':
        return (
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '32px 40px',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            overflow: 'auto',
            maxHeight: '100%',
            lineHeight: '1.7',
            fontSize: '16px',
            color: '#24292f'
          }}>
            <div 
              className="word-content"
              dangerouslySetInnerHTML={{ __html: content }}
              style={{
                fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif'
              }}
            />
          </div>
        )
      
      case '.xlsx':
      case '.xls':
        return (
          <div style={{ 
            backgroundColor: '#fff', 
            padding: '24px',
            borderRadius: '8px',
            border: '1px solid #f0f0f0',
            overflow: 'auto',
            maxHeight: '100%'
          }}>
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: 0,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              backgroundColor: '#f8f9fa',
              padding: '16px',
              borderRadius: '4px',
              border: '1px solid #e9ecef'
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
            border: '1px solid #f0f0f0',
            overflow: 'auto',
            maxHeight: '100%'
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

  // 渲染编辑内容
  const renderEditContent = () => {
    return (
      <div style={{ 
        height: '100%',
        padding: '16px'
      }}>
        <TextArea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          placeholder="开始编辑文档内容..."
          style={{
            height: '100%',
            resize: 'none',
            fontFamily: fileType.toLowerCase().includes('json') 
              ? 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
              : 'inherit',
            fontSize: '14px',
            lineHeight: '1.6'
          }}
          bordered={false}
        />
      </div>
    )
  }

  // 是否支持编辑（使用新的文件操作API检查）
  const [isEditable, setIsEditable] = useState(false)
  const [editorType, setEditorType] = useState<string>('text')

  // 检查文件是否可编辑
  useEffect(() => {
    const checkEditability = async () => {
      if (!fileContent && window.electronAPI?.fileOp?.isEditable) {
        try {
          const result = await window.electronAPI.fileOp.isEditable(filePath)
          setIsEditable(result.isEditable)
          setEditorType(result.editorType)
        } catch (error) {
          console.warn('检查文件可编辑性失败:', error)
          // 降级处理：基于文件扩展名判断
          const editableExtensions = ['.md', '.markdown', '.txt', '.json', '.html', '.htm']
          setIsEditable(editableExtensions.includes(fileType.toLowerCase()))
          setEditorType('text')
        }
      } else {
        // 拖拽文件不支持编辑
        setIsEditable(false)
        setEditorType('text')
      }
    }
    
    checkEditability()
  }, [filePath, fileType, fileContent])

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'auto'
    }}>
      {/* 工具栏 */}
      {isEditable && (
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileTextOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: '14px', color: '#666' }}>{fileName}</span>
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
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {isEditing ? (
              <>
                <Button
                  size="small"
                  icon={<SaveOutlined />}
                  type="primary"
                  loading={saving}
                  onClick={saveDocument}
                  disabled={editedContent === content}
                >
                  保存到缓存
                </Button>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={toggleEditMode}
                >
                  预览
                </Button>
              </>
            ) : (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={toggleEditMode}
              >
                编辑
              </Button>
            )}
            
            {/* 导出功能 */}
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'export-original',
                    icon: <DownloadOutlined />,
                    label: '导出原格式',
                    onClick: exportDocument
                  },
                  {
                    type: 'divider'
                  },
                  {
                    key: 'export-txt',
                    label: '导出为 TXT',
                    onClick: () => exportAsFormat('txt')
                  },
                  {
                    key: 'export-md',
                    label: '导出为 Markdown',
                    onClick: () => exportAsFormat('md')
                  },
                  {
                    key: 'export-html',
                    label: '导出为 HTML',
                    onClick: () => exportAsFormat('html')
                  }
                ] as MenuProps['items']
              }}
              placement="bottomRight"
            >
              <Button
                size="small"
                icon={<DownloadOutlined />}
              >
                导出
              </Button>
            </Dropdown>
          </div>
        </div>
      )}

      {/* 文档内容 */}
      <div style={{ 
        flex: 1,
        minHeight: 0,
        overflow: 'auto'
      }}>
        {isEditing && isEditable ? renderEditContent() : renderContent()}
      </div>
    </div>
  )
}

export default DocumentViewer