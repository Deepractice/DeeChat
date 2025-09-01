/**
 * 文件引用服务
 * 负责工作区与聊天区域的文件内容传递
 */

import { WorkspaceFile } from '../types/WorkspaceFile'

export interface FileReference {
  fileId: string
  fileName: string
  filePath: string
  content: string
  timestamp: Date
  referenceType: 'workspace-to-chat' | 'chat-to-workspace'
  selectedText?: string  // 选中的文字片段
  selectionRange?: {     // 选中文字的位置信息
    start: number
    end: number
    lineStart?: number
    lineEnd?: number
  }
}

export interface FileReferenceMessage {
  content: string
  references: FileReference[]
}

export class FileReferenceService {
  private static instance: FileReferenceService
  private references: Map<string, FileReference> = new Map()

  static getInstance(): FileReferenceService {
    if (!FileReferenceService.instance) {
      FileReferenceService.instance = new FileReferenceService()
    }
    return FileReferenceService.instance
  }

  /**
   * 从工作区文件创建引用
   */
  createWorkspaceReference(workspaceFile: WorkspaceFile): FileReference {
    const reference: FileReference = {
      fileId: workspaceFile.id,
      fileName: workspaceFile.name,
      filePath: workspaceFile.path,
      content: workspaceFile.content || '',
      timestamp: new Date(),
      referenceType: 'workspace-to-chat'
    }

    this.references.set(reference.fileId, reference)
    console.log(`📎 创建工作区文件引用: ${reference.fileName}`)
    
    return reference
  }

  /**
   * 从工作区文件创建选中文字引用
   */
  createWorkspaceSelectionReference(
    workspaceFile: WorkspaceFile, 
    selectedText: string,
    selectionRange?: { start: number; end: number; lineStart?: number; lineEnd?: number }
  ): FileReference {
    const selectionId = `${workspaceFile.id}_sel_${Date.now()}`
    const reference: FileReference = {
      fileId: selectionId,
      fileName: workspaceFile.name,
      filePath: workspaceFile.path,
      content: workspaceFile.content || '',
      selectedText: selectedText,
      selectionRange: selectionRange,
      timestamp: new Date(),
      referenceType: 'workspace-to-chat'
    }

    this.references.set(reference.fileId, reference)
    console.log(`📎 创建工作区选中文字引用: ${reference.fileName} - "${selectedText.substring(0, 50)}..."`)
    
    return reference
  }

  /**
   * 生成文件引用的聊天消息格式
   */
  generateChatMessage(reference: FileReference, userMessage?: string): string {
    const isSelection = !!reference.selectedText
    const title = isSelection 
      ? `📎 **引用文件片段：${reference.fileName}**` 
      : `📎 **引用文件：${reference.fileName}**`
    
    const contentToDisplay = isSelection ? reference.selectedText : reference.content
    
    const referenceBlock = `${title}
\`\`\`${this.getFileLanguage(reference.fileName)}
${contentToDisplay}
\`\`\`

---
`
    
    return userMessage ? `${referenceBlock}\n${userMessage}` : referenceBlock
  }

  /**
   * 从聊天内容创建工作区文件
   */
  async createWorkspaceFileFromChat(
    content: string, 
    fileName: string
  ): Promise<FileReference> {
    const fileId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const reference: FileReference = {
      fileId,
      fileName,
      filePath: `workspace/temp/${fileId}_${fileName}`,
      content,
      timestamp: new Date(),
      referenceType: 'chat-to-workspace'
    }

    this.references.set(fileId, reference)
    console.log(`💾 创建聊天到工作区文件引用: ${fileName}`)
    
    return reference
  }

  /**
   * 解析聊天消息中的文件引用标记
   */
  parseFileReferences(message: string): FileReferenceMessage {
    const referenceRegex = /📎\s*\*\*引用文件：([^*]+)\*\*\s*```[\s\S]*?```/g
    const references: FileReference[] = []
    let cleanContent = message

    let match
    while ((match = referenceRegex.exec(message)) !== null) {
      const fileName = match[1]
      // 从已有引用中查找匹配的文件
      for (const ref of this.references.values()) {
        if (ref.fileName === fileName) {
          references.push(ref)
          break
        }
      }
      // 从消息中移除引用块
      cleanContent = cleanContent.replace(match[0], '').trim()
    }

    return {
      content: cleanContent,
      references
    }
  }

  /**
   * 获取文件的语言类型（用于代码高亮）
   */
  private getFileLanguage(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase()
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'css': 'css',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
      'txt': 'text',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml'
    }
    
    return languageMap[ext || 'txt'] || 'text'
  }

  /**
   * 获取所有引用
   */
  getAllReferences(): FileReference[] {
    return Array.from(this.references.values())
  }

  /**
   * 根据ID获取引用
   */
  getReference(fileId: string): FileReference | undefined {
    return this.references.get(fileId)
  }

  /**
   * 清理过期引用
   */
  cleanupExpiredReferences(maxAgeInHours: number = 24): void {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeInHours)

    for (const [fileId, reference] of this.references.entries()) {
      if (reference.timestamp < cutoffTime) {
        this.references.delete(fileId)
        console.log(`🗑️ 清理过期文件引用: ${reference.fileName}`)
      }
    }
  }
}