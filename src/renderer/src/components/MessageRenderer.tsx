/**
 * MessageRenderer 智能消息渲染组件
 * 根据内容类型智能选择渲染方式：Markdown、Mermaid、代码块或纯文本
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

import React from 'react'
import { AIContentFormatter, ContentBlock } from '../../../shared/utils/AIContentFormatter'
import MarkdownBlock from './content/MarkdownBlock'
import MermaidBlock from './content/MermaidBlock'
import CodeBlock from './content/CodeBlock'
import TextBlock from './content/TextBlock'

interface MessageRendererProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

interface ContentBlockRendererProps {
  block: ContentBlock
  index: number
}

/**
 * 单个内容块渲染组件
 */
const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ block, index }) => {
  const key = `content-block-${index}-${block.type}`

  switch (block.type) {
    case 'markdown':
      return <MarkdownBlock key={key} content={block.content} />
    
    case 'mermaid':
      return <MermaidBlock key={key} content={block.content} />
    
    case 'code':
      return (
        <CodeBlock 
          key={key} 
          content={block.content} 
          language={block.language || 'text'} 
        />
      )
    
    case 'text':
    default:
      return <TextBlock key={key} content={block.content} />
  }
}

/**
 * 智能消息渲染器主组件
 * 自动检测内容类型并选择合适的渲染方式
 */
const MessageRenderer: React.FC<MessageRendererProps> = ({ 
  content, 
  className = '', 
  style = {} 
}) => {
  // 解析内容为结构化块
  const parsedContent = React.useMemo(() => {
    try {
      return AIContentFormatter.parseContent(content)
    } catch (error) {
      console.error('MessageRenderer: 内容解析失败', error)
      // 解析失败时降级为纯文本渲染
      return {
        blocks: [{ type: 'text' as const, content }],
        hasMarkdown: false,
        hasMermaid: false,
        hasCode: false
      }
    }
  }, [content])

  // 生成容器的CSS类名
  const containerClassName = React.useMemo(() => {
    const baseClasses = ['message-renderer']
    
    // 根据内容类型添加特定类名
    if (parsedContent.hasMarkdown) baseClasses.push('has-markdown')
    if (parsedContent.hasMermaid) baseClasses.push('has-mermaid')
    if (parsedContent.hasCode) baseClasses.push('has-code')
    
    // 添加自定义类名
    if (className) baseClasses.push(className)
    
    return baseClasses.join(' ')
  }, [parsedContent, className])

  // 如果没有有效内容，渲染空白
  if (!content || content.trim().length === 0) {
    return (
      <div className={containerClassName} style={style}>
        <TextBlock content="" />
      </div>
    )
  }

  // 如果只有一个块且为文本类型，直接渲染
  if (parsedContent.blocks.length === 1 && parsedContent.blocks[0].type === 'text') {
    return (
      <div className={containerClassName} style={style}>
        <TextBlock content={parsedContent.blocks[0].content} />
      </div>
    )
  }

  // 渲染多个内容块
  return (
    <div className={containerClassName} style={style}>
      {parsedContent.blocks.map((block, index) => (
        <ContentBlockRenderer 
          key={`block-${index}`} 
          block={block} 
          index={index} 
        />
      ))}
    </div>
  )
}

/**
 * MessageRenderer的高阶组件版本
 * 提供错误边界和性能优化
 */
interface MessageRendererWithBoundaryProps extends MessageRendererProps {
  fallbackContent?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

class MessageRendererErrorBoundary extends React.Component<
  MessageRendererWithBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: MessageRendererWithBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MessageRenderer Error Boundary:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // 错误降级：渲染为纯文本
      return (
        this.props.fallbackContent || (
          <div className="message-renderer-error">
            <TextBlock content={this.props.content} />
          </div>
        )
      )
    }

    return <MessageRenderer {...this.props} />
  }
}

/**
 * 带错误边界的MessageRenderer导出
 */
export const MessageRendererWithBoundary: React.FC<MessageRendererWithBoundaryProps> = (props) => {
  return <MessageRendererErrorBoundary {...props} />
}

/**
 * MessageRenderer工具函数
 */
export const MessageRendererUtils = {
  /**
   * 检测内容类型
   */
  detectContentType: (content: string) => AIContentFormatter.detectContentType(content),
  
  /**
   * 获取内容统计
   */
  getContentStats: (content: string) => AIContentFormatter.getContentStats(content),
  
  /**
   * 格式化预览
   */
  formatPreview: (content: string, maxLength?: number) => 
    AIContentFormatter.formatPreview(content, maxLength),
  
  /**
   * 解析内容
   */
  parseContent: (content: string) => AIContentFormatter.parseContent(content)
}

export default MessageRenderer
export type { MessageRendererProps, ContentBlock }