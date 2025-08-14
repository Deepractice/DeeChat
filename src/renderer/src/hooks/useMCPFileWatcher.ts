import { useCallback, useEffect, useRef } from 'react'
import { message } from 'antd'

interface MCPFileEvent {
  type: 'file_created' | 'file_updated' | 'file_read'
  filePath: string
  fileName: string
  content?: string
  source: 'promptx-filesystem' | 'other'
}

interface UseMCPFileWatcherProps {
  onFileCreated?: (event: MCPFileEvent) => void
  onFileUpdated?: (event: MCPFileEvent) => void
  onFileRead?: (event: MCPFileEvent) => void
}

export const useMCPFileWatcher = ({ 
  onFileCreated, 
  onFileUpdated, 
  onFileRead 
}: UseMCPFileWatcherProps = {}) => {
  const eventHandlers = useRef({ onFileCreated, onFileUpdated, onFileRead })
  
  // 更新处理函数引用
  useEffect(() => {
    eventHandlers.current = { onFileCreated, onFileUpdated, onFileRead }
  }, [onFileCreated, onFileUpdated, onFileRead])

  // 监听MCP工具调用结果
  const handleMCPToolResult = useCallback(async (toolName: string, toolResult: any, toolParams?: any) => {
    try {
      // 只处理PromptX filesystem工具的结果
      if (toolName === 'promptx_tool' && toolParams?.tool_resource?.includes('filesystem')) {
        const result = toolResult
        
        // 处理写文件操作结果
        if (result && typeof result === 'object' && 'bytesWritten' in result && 'path' in result) {
          const filePath = result.path as string
          const fileName = filePath.split('/').pop() || 'untitled'
          
          // 读取刚创建的文件内容
          try {
            const readResult = await window.electronAPI.mcp.callTool({
              toolName: 'promptx_tool',
              parameters: {
                tool_resource: '@tool://filesystem',
                parameters: {
                  method: 'read_text_file',
                  path: filePath
                }
              }
            })
            
            const fileContent = readResult.success ? readResult.data : ''
            
            const event: MCPFileEvent = {
              type: 'file_created',
              filePath,
              fileName,
              content: fileContent,
              source: 'promptx-filesystem'
            }
            
            eventHandlers.current.onFileCreated?.(event)
            message.success(`AI创建的文件已检测到: ${fileName}`)
          } catch (readError) {
            console.error('读取AI创建的文件失败:', readError)
          }
        }
        
        // 处理读文件操作结果
        else if (typeof result === 'string' && toolParams?.parameters?.method === 'read_text_file') {
          const filePath = toolParams.parameters.path || 'unknown'
          const fileName = filePath.split('/').pop() || 'unknown'
          
          const event: MCPFileEvent = {
            type: 'file_read',
            filePath,
            fileName,
            content: result,
            source: 'promptx-filesystem'
          }
          
          eventHandlers.current.onFileRead?.(event)
        }
      }
    } catch (error) {
      console.error('处理MCP工具结果失败:', error)
    }
  }, [])

  // 监听聊天消息中的工具使用
  const watchChatMessage = useCallback((messageContent: any) => {
    // 这里可以解析聊天消息，检测是否包含MCP工具调用
    // 如果消息中包含filesystem工具的使用，可以触发相应的处理
    try {
      if (messageContent && typeof messageContent === 'object') {
        // 检查是否是工具使用消息
        if (messageContent.type === 'tool_use' || messageContent.tools) {
          // 处理工具使用消息
          console.log('检测到工具使用消息:', messageContent)
        }
      }
    } catch (error) {
      console.error('解析聊天消息失败:', error)
    }
  }, [])

  return {
    handleMCPToolResult,
    watchChatMessage
  }
}