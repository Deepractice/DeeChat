import React, { useState, useEffect, useRef } from 'react'
import { Spin, Alert, Typography, Button, Input, message } from 'antd'
import { EditOutlined, SaveOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import 'highlight.js/styles/github.css'
import { WorkspaceFile } from '../../../../shared/types/WorkspaceFile'

const { Title, Paragraph } = Typography
const { TextArea } = Input

// 注册语言
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', html)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('py', python)

// 语法高亮代码组件
function SyntaxHighlightedCode(props) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (ref.current && props.className?.includes('lang-') && window.hljs) {
      window.hljs.highlightElement(ref.current)
      // hljs won't reprocess the element unless this attribute is removed
      ref.current.removeAttribute('data-highlighted')
    }
  }, [props.className, props.children])

  return <code {...props} ref={ref} />
}

// 将hljs添加到window对象
if (typeof window !== 'undefined') {
  window.hljs = hljs
}

interface DocumentViewerProps {
  filePath: string
  fileName: string
  fileType: string
  fileContent?: File  // 可选的File对象，用于拖拽上传的文件
  workspaceFile?: WorkspaceFile  // 工作区文件对象
  onError?: (error: string) => void
  onContentChange?: (workspaceFile: WorkspaceFile, newContent: string) => void // 内容变化回调
  onSelectionReference?: (workspaceFile: WorkspaceFile, selectedText: string) => void // 选中文字引用回调
  isEditing?: boolean  // 外部传入的编辑状态
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  filePath, 
  fileName, 
  fileType, 
  fileContent,
  workspaceFile,
  onError,
  onContentChange,
  onSelectionReference,
  isEditing: externalIsEditing
}) => {
  const [content, setContent] = useState<string>('')
  const [editedContent, setEditedContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedText, setSelectedText] = useState<string>('')
  
  // 使用外部传入的编辑状态（如果提供）
  const actualIsEditing = externalIsEditing !== undefined ? externalIsEditing : isEditing

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
      // 优先使用WorkspaceFile的内容
      if (workspaceFile?.content) {
        setContent(workspaceFile.content)
        setEditedContent(workspaceFile.content)
        return
      }
      
      // 如果有文件内容（拖拽上传的文件），直接读取
      if (fileContent) {
        const text = await fileContent.text()
        setContent(text)
        setEditedContent(text)
        return
      }
      
      // 使用file API读取文件内容（备用方案）
      try {
        const fileId = filePath.split('/').pop() || filePath
        const result = await window.electronAPI.file.read(fileId)
        if (result) {
          setContent(result)
          setEditedContent(result)
        } else {
          throw new Error('无法读取文件内容')
        }
      } catch (apiError) {
        // 备用方案：显示基础信息
        const fallbackContent = `文件: ${fileName}\n路径: ${filePath}\n\n无法加载文件内容，请检查文件是否存在。`
        setContent(fallbackContent)
        setEditedContent(fallbackContent)
      }
    } catch (err) {
      throw new Error(`读取文本文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadHtmlDocument = async () => {
    try {
      if (fileContent) {
        const html = await fileContent.text()
        setContent(html)
        return
      }
      
      const fileId = filePath.split('/').pop() || filePath
      const result = await window.electronAPI.file.read(fileId)
      if (result) {
        setContent(result)
      } else {
        throw new Error('无法读取HTML文件')
      }
    } catch (err) {
      throw new Error(`读取HTML文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadJsonDocument = async () => {
    try {
      let jsonText: string
      
      if (fileContent) {
        jsonText = await fileContent.text()
      } else {
        const fileId = filePath.split('/').pop() || filePath
        const result = await window.electronAPI.file.read(fileId)
        jsonText = result || '{}'
      }
      
      // 格式化JSON显示
      try {
        const formatted = JSON.stringify(JSON.parse(jsonText), null, 2)
        setContent(formatted)
      } catch {
        setContent(jsonText) // 如果不是有效JSON，显示原文
      }
    } catch (err) {
      throw new Error(`读取JSON文件失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  const loadPdfDocument = async () => {
    setContent('PDF文档预览功能开发中...\n\n文件信息:\n名称: ' + fileName + '\n路径: ' + filePath)
  }

  const loadWordDocument = async () => {
    try {
      if (fileContent) {
        setContent('Word文档预览功能有限，建议先保存到本地后查看。\n\n文件信息:\n名称: ' + fileName)
        return
      }
      
      const fileId = filePath.split('/').pop() || filePath
      try {
        const result = await window.electronAPI.file.read(fileId)
        if (result) {
          setContent(result)
        } else {
          throw new Error('无法读取Word文件')
        }
      } catch {
        setContent('Word文档预览功能有限。\n\n文件信息:\n名称: ' + fileName + '\n路径: ' + filePath)
      }
    } catch (err) {
      throw new Error(`读取Word文档失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  // 保存文档内容
  const saveDocument = async () => {
    try {
      setSaving(true)
      
      // 如果有WorkspaceFile，使用新的保存逻辑
      if (workspaceFile && onContentChange) {
        await onContentChange(workspaceFile, editedContent)
        setContent(editedContent)
        if (externalIsEditing === undefined) setIsEditing(false)
      } else {
        // 备用方案：只更新内存中的内容
        setContent(editedContent)
        message.success('文档内容已更新')
        if (externalIsEditing === undefined) setIsEditing(false)
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
    const contentToExport = actualIsEditing ? editedContent : content
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

  // 切换编辑模式
  const toggleEditMode = () => {
    if (externalIsEditing !== undefined) return // 外部控制编辑状态时，不允许切换
    
    if (isEditing) {
      if (editedContent !== content) {
        setEditedContent(content)
      }
      setIsEditing(false)
    } else {
      setIsEditing(true)
      setEditedContent(content)
    }
  }

  // 处理文字选中
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim()) {
      const selectedText = selection.toString().trim()
      setSelectedText(selectedText)
      console.log('选中文字:', selectedText)
    } else {
      setSelectedText('')
    }
  }

  // 处理引用选中文字到聊天
  const handleReferenceSelection = () => {
    if (!selectedText.trim()) {
      message.warning('请先选中要引用的文字')
      return
    }

    if (!workspaceFile) {
      message.error('工作区文件信息不可用')
      return
    }

    if (onSelectionReference) {
      onSelectionReference(workspaceFile, selectedText)
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
            padding: '32px',
            overflow: 'auto',
            maxHeight: '100%',
            lineHeight: '1.8',
            fontSize: '16px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            <div 
              className="markdown-content"
              onMouseUp={handleTextSelection}
              onKeyUp={handleTextSelection}
              style={{ userSelect: 'text', cursor: 'text' }}
            >
              <Markdown
                options={{
                  overrides: {
                    code: SyntaxHighlightedCode,
                    h1: {
                      props: {
                        style: {
                          fontSize: '32px',
                          fontWeight: 700,
                          marginBottom: '24px',
                          marginTop: '32px',
                          color: '#1f2937',
                          borderBottom: '2px solid #e5e7eb',
                          paddingBottom: '8px'
                        }
                      }
                    },
                    h2: {
                      props: {
                        style: {
                          fontSize: '28px',
                          fontWeight: 600,
                          marginBottom: '20px',
                          marginTop: '28px',
                          color: '#374151',
                          borderBottom: '1px solid #f3f4f6',
                          paddingBottom: '6px'
                        }
                      }
                    },
                    h3: {
                      props: {
                        style: {
                          fontSize: '24px',
                          fontWeight: 600,
                          marginBottom: '16px',
                          marginTop: '24px',
                          color: '#4b5563'
                        }
                      }
                    },
                    p: {
                      props: {
                        style: {
                          marginBottom: '16px',
                          lineHeight: '1.75',
                          color: '#374151'
                        }
                      }
                    },
                    ul: {
                      props: {
                        style: {
                          marginBottom: '16px',
                          marginTop: '16px',
                          paddingLeft: '24px'
                        }
                      }
                    },
                    li: {
                      props: {
                        style: {
                          marginBottom: '8px',
                          color: '#374151'
                        }
                      }
                    },
                    blockquote: {
                      props: {
                        style: {
                          borderLeft: '4px solid #3b82f6',
                          paddingLeft: '16px',
                          margin: '24px 0',
                          fontStyle: 'italic',
                          backgroundColor: '#f8fafc',
                          padding: '16px',
                          borderRadius: '0 8px 8px 0'
                        }
                      }
                    },
                    pre: {
                      props: {
                        style: {
                          backgroundColor: '#f6f8fa',
                          padding: '16px',
                          borderRadius: '6px',
                          overflow: 'auto',
                          fontSize: '14px',
                          lineHeight: '1.45',
                          margin: '16px 0',
                          border: '1px solid #e1e4e8'
                        }
                      }
                    }
                  }
                }}
              >
                {content}
              </Markdown>
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
      
      default:
        return (
          <div 
            style={{ 
              backgroundColor: '#fff', 
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid #f0f0f0',
              overflow: 'auto',
              maxHeight: '100%'
            }}
            onMouseUp={handleTextSelection}
            onKeyUp={handleTextSelection}
          >
            <pre style={{ 
              whiteSpace: 'pre-wrap', 
              wordBreak: 'break-word',
              fontSize: '14px',
              lineHeight: '1.6',
              margin: 0,
              userSelect: 'text',
              cursor: 'text',
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

  // 是否支持编辑 - 工作区的文本文件都可以编辑
  const isEditable = ['.md', '.markdown', '.txt', '.json', '.html', '.htm'].includes(fileType.toLowerCase())

  return (
    <div style={{ 
      height: '100%', 
      overflow: 'auto'
    }}>
      {/* 文档内容 */}
      {actualIsEditing && isEditable ? renderEditContent() : renderContent()}
    </div>
  )
}

export default DocumentViewer