import React, { useState } from 'react'
import { Layout, Tabs, Empty, message, Button } from 'antd'
import { FileTextOutlined, CloudUploadOutlined, SaveOutlined, RobotOutlined, MessageOutlined, SelectOutlined } from '@ant-design/icons'
import DocumentViewer from './DocumentViewer'
import useDragDrop from '../../hooks/useDragDrop'
import { WorkspaceFileManager } from '../../services/WorkspaceFileManager'
import { WorkspaceFile } from '../../../../shared/types/WorkspaceFile'
import { FileReferenceService } from '../../../../shared/services/FileReferenceService'

const { Content } = Layout

interface WorkspaceAreaProps {
  // 工作区属性
}

interface DocumentTab {
  key: string
  label: string
  content: React.ReactNode
  type: 'document' | 'browser'
  workspaceFile?: WorkspaceFile  // 关联的工作区文件
  isEditing?: boolean
}

const WorkspaceArea: React.FC<WorkspaceAreaProps> = () => {
  const [activeKey, setActiveKey] = useState<string>()
  const [documents, setDocuments] = useState<DocumentTab[]>([])
  const [selectedText, setSelectedText] = useState<string>('')
  const [selectedTextFromFile, setSelectedTextFromFile] = useState<string>('')
  
  // 获取文件管理器实例
  const fileManager = WorkspaceFileManager.getInstance()
  const fileReferenceService = FileReferenceService.getInstance()

  // 处理文件加载 - 使用新的WorkspaceFileManager
  const handleFileLoad = async (file: File) => {
    try {
      // 通过WorkspaceFileManager保存文件到PromptX
      const workspaceFile = await fileManager.addUserFile(file)
      
      // 创建标签页
      const tabKey = `ws-${workspaceFile.id}`
      const newTab: DocumentTab = {
        key: tabKey,
        label: `📁 ${workspaceFile.name}`, // 工作区文件标识
        content: null, // 稍后动态渲染
        type: 'document',
        workspaceFile: workspaceFile,
        isEditing: false
      }
      
      setDocuments(prev => [...prev, newTab])
      setActiveKey(newTab.key)
      
    } catch (error) {
      console.error('处理拖拽文件失败:', error)
      // 错误已在fileManager中显示，这里不重复显示
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

  // 处理文件保存到永久目录
  const handleSaveFilePermanent = async (fileId: string) => {
    try {
      await fileManager.markFileAsSaved(fileId)
      
      // 更新文档标签显示状态
      setDocuments(prev => prev.map(doc => {
        if (doc.workspaceFile?.id === fileId) {
          return {
            ...doc,
            label: `💾 ${doc.workspaceFile.name}`, // 更新标签显示已保存状态
            workspaceFile: {
              ...doc.workspaceFile,
              type: 'saved' as const
            }
          }
        }
        return doc
      }))
      
    } catch (error) {
      console.error('保存文件到永久目录失败:', error)
      message.error('保存失败，请重试')
    }
  }

  // 处理文档内容变化（文档编辑时调用）
  const handleDocumentContentChange = async (workspaceFile: WorkspaceFile, newContent: string) => {
    try {
      // 直接保存到PromptX物理文件，用户和AI都能访问
      await fileManager.saveFile(workspaceFile, newContent)
      
      // 更新本地缓存
      setDocuments(prev => prev.map(doc => {
        if (doc.workspaceFile?.id === workspaceFile.id) {
          return {
            ...doc,
            workspaceFile: {
              ...doc.workspaceFile,
              content: newContent,
              lastAccessed: new Date()
            }
          }
        }
        return doc
      }))

      // 更新文件管理器中的内容
      const file = fileManager.getFile(workspaceFile.id)
      if (file) {
        file.content = newContent
        file.lastAccessed = new Date()
      }
      
    } catch (error) {
      console.error('保存文档内容失败:', error)
      message.error('保存失败，请重试')
    }
  }

  // 处理引用文件到聊天
  const handleReferenceToChat = (workspaceFile: WorkspaceFile) => {
    try {
      // 创建文件引用
      const reference = fileReferenceService.createWorkspaceReference(workspaceFile)
      
      // 生成引用消息
      const referenceMessage = fileReferenceService.generateChatMessage(reference)
      
      // 这里需要与聊天组件通信，暂时用事件方式
      // TODO: 后续可以考虑使用全局状态管理或者父组件通信
      window.dispatchEvent(new CustomEvent('insertChatReference', {
        detail: { referenceMessage, reference }
      }))
      
      message.success(`已引用文件到聊天：${workspaceFile.name}`)
      
    } catch (error) {
      console.error('引用文件到聊天失败:', error)
      message.error('引用失败，请重试')
    }
  }

  // 处理引用选中文字到聊天
  const handleReferenceSelectionToChat = (workspaceFile: WorkspaceFile, selectedText: string) => {
    try {
      if (!selectedText.trim()) {
        message.warning('请先选中要引用的文字')
        return
      }

      // 更新选中文字状态
      setSelectedText(selectedText)
      setSelectedTextFromFile(workspaceFile.name)

      // 创建选中文字引用
      const reference = fileReferenceService.createWorkspaceSelectionReference(workspaceFile, selectedText)
      
      // 生成引用消息
      const referenceMessage = fileReferenceService.generateChatMessage(reference)
      
      // 发送事件通知聊天组件
      window.dispatchEvent(new CustomEvent('insertChatReference', {
        detail: { referenceMessage, reference }
      }))
      
      message.success(`已引用选中文字到聊天：${workspaceFile.name}`)
      
    } catch (error) {
      console.error('引用选中文字到聊天失败:', error)
      message.error('引用失败，请重试')
    }
  }

  // 手动引用选中的文字（通过按钮）
  const handleManualReferenceSelection = () => {
    const activeDoc = documents.find(doc => doc.key === activeKey)
    if (!activeDoc?.workspaceFile) {
      message.error('无法找到当前文档')
      return
    }

    // 获取当前选中的文字
    const selection = window.getSelection()
    const currentSelectedText = selection?.toString().trim() || ''
    
    if (!currentSelectedText) {
      message.warning('请先选中要引用的文字')
      return
    }

    handleReferenceSelectionToChat(activeDoc.workspaceFile, currentSelectedText)
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
              tabBarExtraContent={{
                right: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16 }}>
                    {/* 当前活动文件的操作按钮 */}
                    {activeKey && (() => {
                      const activeDoc = documents.find(doc => doc.key === activeKey)
                      if (activeDoc?.workspaceFile) {
                        return (
                          <>
                            {/* AI可访问状态指示器 */}
                            <Button
                              type="text"
                              size="small"
                              icon={<RobotOutlined style={{ color: '#52c41a' }} />}
                              title="AI可直接访问此文件"
                              disabled
                            >
                              AI可访问
                            </Button>
                            {/* 引用到聊天 */}
                            <Button
                              type="text"
                              size="small"
                              icon={<MessageOutlined />}
                              title="引用文件内容到聊天"
                              onClick={() => handleReferenceToChat(activeDoc.workspaceFile!)}
                            >
                              引用到聊天
                            </Button>
                            {/* 引用选中文字 */}
                            <Button
                              type="text"
                              size="small"
                              icon={<SelectOutlined />}
                              title="引用选中文字到聊天"
                              onClick={handleManualReferenceSelection}
                            >
                              引用选中文字
                            </Button>
                            {/* 保存到永久目录 */}
                            {activeDoc.workspaceFile.type === 'temp' && (
                              <Button
                                type="text"
                                size="small"
                                icon={<SaveOutlined />}
                                title="保存到永久目录"
                                onClick={() => handleSaveFilePermanent(activeDoc.workspaceFile!.id)}
                              >
                                保存
                              </Button>
                            )}
                          </>
                        )
                      }
                      return null
                    })()}
                  </div>
                )
              }}
              items={documents.map(doc => ({
                key: doc.key,
                label: doc.label,
                children: (
                  <div style={{ 
                    height: '100%', 
                    overflow: 'auto',
                    padding: '16px'
                  }}>
                    {doc.workspaceFile ? (
                      <DocumentViewer
                        filePath={doc.workspaceFile.path}
                        fileName={doc.workspaceFile.name}
                        fileType={doc.workspaceFile.fileType}
                        workspaceFile={doc.workspaceFile}
                        onContentChange={handleDocumentContentChange}
                        onSelectionReference={handleReferenceSelectionToChat}
                        onError={(error) => {
                          console.error('文档加载错误:', error)
                        }}
                      />
                    ) : (
                      doc.content
                    )}
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