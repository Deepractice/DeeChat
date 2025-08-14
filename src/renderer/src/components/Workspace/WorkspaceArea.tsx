import React, { useState } from 'react'
import { Layout, Tabs, Empty, message } from 'antd'
import { FileTextOutlined, CloudUploadOutlined } from '@ant-design/icons'
import DocumentViewer from './DocumentViewer'
import useDragDrop from '../../hooks/useDragDrop'

const { Content } = Layout

interface WorkspaceAreaProps {
  // 工作区属性
}

interface DocumentTab {
  key: string
  label: string
  content: React.ReactNode
  type: 'document' | 'browser'
  filePath?: string
  fileName?: string
}

const WorkspaceArea: React.FC<WorkspaceAreaProps> = () => {
  const [activeKey, setActiveKey] = useState<string>()
  const [documents, setDocuments] = useState<DocumentTab[]>([])

  // 处理文件加载 - 将拖拽文件保存到工作区以便编辑
  const handleFileLoad = async (file: File) => {
    try {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      
      // 将拖拽的文件保存到工作区目录，这样就可以编辑了
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = new Uint8Array(arrayBuffer)
      
      // 调用后端API上传文件到工作区
      const result = await window.electronAPI.file.upload(fileBuffer, {
        name: file.name,
        mimeType: file.type || 'text/plain'
      })
      
      if (result.success && result.data) {
        // 获取上传后的文件信息
        const fileData = await window.electronAPI.file.get(result.data.fileId)
        
        if (fileData.success && fileData.data) {
          const filePath = fileData.data.path // 使用实际文件路径
          
          const documentViewer = (
            <DocumentViewer
              filePath={filePath}
              fileName={file.name}
              fileType={fileExtension}
              // 不传递 fileContent，这样就可以编辑了
              onError={(error) => {
                console.error('文档加载错误:', error)
                message.error(`加载 ${file.name} 失败: ${error}`)
              }}
            />
          )

          const newTab: DocumentTab = {
            key: `doc-${Date.now()}-${file.name}`,
            label: `📝 ${file.name}`, // 添加标识表示这是可编辑的
            content: documentViewer,
            type: 'document',
            filePath: filePath,
            fileName: file.name
          }
          
          setDocuments(prev => [...prev, newTab])
          setActiveKey(newTab.key)
          message.success(`已加载文档并可编辑: ${file.name}`)
        } else {
          throw new Error('无法获取文件信息')
        }
      } else {
        throw new Error(result.error || '文件保存失败')
      }
    } catch (error) {
      console.error('处理拖拽文件失败:', error)
      message.error(`处理 ${file.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 处理拖拽文件
  const handleFileDrop = (files: File[]) => {
    files.forEach(file => {
      handleFileLoad(file)
    })
  }

  // 拖拽功能
  const { isDragActive, isDragOver, dragProps } = useDragDrop({
    onFileDrop: handleFileDrop,
    acceptedTypes: ['.pdf', '.doc', '.docx', '.txt', '.md', '.markdown', '.html', '.htm', '.json']
  })

  // 加载示例文档（后续可以通过props或API调用）
  const loadSampleDocument = (fileName: string, fileType: string, filePath: string) => {
    const documentViewer = (
      <DocumentViewer
        filePath={filePath}
        fileName={fileName}
        fileType={fileType}
        onError={(error) => {
          console.error('文档加载错误:', error)
        }}
      />
    )

    const newTab: DocumentTab = {
      key: `doc-${Date.now()}`,
      label: fileName,
      content: documentViewer,
      type: 'document',
      filePath: filePath,
      fileName: fileName
    }
    
    setDocuments(prev => [...prev, newTab])
    setActiveKey(newTab.key)
  }

  // 处理标签页关闭
  const handleTabClose = (targetKey: string) => {
    const newDocs = documents.filter(doc => doc.key !== targetKey)
    setDocuments(newDocs)
    
    if (targetKey === activeKey) {
      setActiveKey(newDocs.length > 0 ? newDocs[newDocs.length - 1].key : undefined)
    }
  }

  // 渲染空状态
  const renderEmptyState = () => (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      position: 'relative'
    }}>
      {/* 拖拽覆盖层 */}
      {isDragActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isDragOver ? 'rgba(24, 144, 255, 0.1)' : 'rgba(0, 0, 0, 0.03)',
          border: isDragOver ? '2px dashed #1890ff' : '2px dashed #d9d9d9',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          transition: 'all 0.2s ease'
        }}>
          <div style={{ textAlign: 'center' }}>
            <CloudUploadOutlined style={{ 
              fontSize: 48, 
              color: isDragOver ? '#1890ff' : '#999',
              marginBottom: 16 
            }} />
            <p style={{ 
              color: isDragOver ? '#1890ff' : '#666',
              fontSize: '16px',
              fontWeight: '500',
              margin: 0 
            }}>
              {isDragOver ? '释放文件以加载' : '拖拽文档到此处'}
            </p>
            <p style={{ 
              color: '#999', 
              fontSize: '12px', 
              margin: '8px 0 0 0' 
            }}>
              支持 PDF, Word, TXT, Markdown, HTML, JSON
            </p>
          </div>
        </div>
      )}

      <Empty
        image={<FileTextOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
        description={
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: 8, color: '#666' }}>文档工作区</h3>
            <p style={{ color: '#999', marginBottom: 16 }}>
              暂无加载的文档
            </p>
            <p style={{ color: '#bbb', fontSize: '14px', margin: 0 }}>
              拖拽文档到此处即可开始工作和编辑
            </p>
            <p style={{ color: '#ccc', fontSize: '12px', marginTop: 8 }}>
              支持 PDF, Word, TXT, Markdown, HTML, JSON 等格式
            </p>
          </div>
        }
      />
    </div>
  )

  return (
    <Layout style={{ height: '100%', backgroundColor: '#f5f5f5' }} {...dragProps}>
      <Content style={{ height: '100%', overflow: 'hidden', position: 'relative' }}>
        {/* 全局拖拽覆盖层 - 当有文档时也显示 */}
        {isDragActive && documents.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDragOver ? 'rgba(24, 144, 255, 0.1)' : 'rgba(0, 0, 0, 0.03)',
            border: isDragOver ? '2px dashed #1890ff' : '2px dashed #d9d9d9',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'all 0.2s ease'
          }}>
            <div style={{ textAlign: 'center' }}>
              <CloudUploadOutlined style={{ 
                fontSize: 48, 
                color: isDragOver ? '#1890ff' : '#999',
                marginBottom: 16 
              }} />
              <p style={{ 
                color: isDragOver ? '#1890ff' : '#666',
                fontSize: '16px',
                fontWeight: '500',
                margin: 0 
              }}>
                {isDragOver ? '释放文件以加载新文档' : '拖拽文档到此处'}
              </p>
              <p style={{ 
                color: '#999', 
                fontSize: '12px', 
                margin: '8px 0 0 0' 
              }}>
                支持 PDF, Word, TXT, Markdown, HTML, JSON
              </p>
            </div>
          </div>
        )}

        {documents.length === 0 ? (
          renderEmptyState()
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 标签页区域 */}
            <Tabs
              type="editable-card"
              activeKey={activeKey}
              onChange={setActiveKey}
              onEdit={(targetKey, action) => {
                if (action === 'remove') {
                  handleTabClose(targetKey as string)
                }
              }}
              style={{ 
                flex: 1, 
                height: '100%',
                backgroundColor: '#fff',
                display: 'flex',
                flexDirection: 'column'
              }}
              tabBarStyle={{
                margin: 0,
                paddingLeft: 16,
                borderBottom: '1px solid #f0f0f0',
                flexShrink: 0
              }}
              className="workspace-tabs"
              items={documents.map(doc => ({
                key: doc.key,
                label: doc.label,
                children: (
                  <div style={{ 
                    height: '100%', 
                    overflow: 'auto',
                    padding: '16px'
                  }}>
                    {doc.content}
                  </div>
                )
              }))}
            />
          </div>
        )}
      </Content>
    </Layout>
  )
}

export default WorkspaceArea