/**
 * MarkdownBlock Markdown内容渲染组件
 * 使用 react-markdown 渲染 Markdown 内容，支持 GitHub Flavored Markdown
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownBlockProps {
  content: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Markdown块组件
 * 提供完整的Markdown渲染支持，包括代码高亮
 */
const MarkdownBlock: React.FC<MarkdownBlockProps> = ({ 
  content, 
  className = '',
  style = {}
}) => {
  // 生成CSS类名
  const markdownClassName = React.useMemo(() => {
    const baseClasses = ['markdown-block']
    if (className) baseClasses.push(className)
    return baseClasses.join(' ')
  }, [className])

  // 如果内容为空，不渲染
  if (!content || content.trim().length === 0) {
    return null
  }

  const containerStyle: React.CSSProperties = {
    ...style
  }

  return (
    <div className={markdownClassName} style={containerStyle}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // 代码块渲染
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const language = match ? match[1] : ''
            
            if (!inline && language) {
              return (
                <SyntaxHighlighter
                  style={oneLight as any}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: '8px 0',
                    borderRadius: '6px',
                    fontSize: '14px'
                  } as any}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )
            }

            // 行内代码
            return (
              <code 
                className={className} 
                style={{
                  backgroundColor: '#f6f8fa',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontSize: '0.9em',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace'
                }}
                {...props}
              >
                {children}
              </code>
            )
          },
          
          // 标题渲染
          h1: ({ children }) => (
            <h1 style={{ 
              color: '#24292e', 
              fontSize: '2em', 
              fontWeight: '600', 
              marginTop: '24px', 
              marginBottom: '16px',
              borderBottom: '1px solid #eaecef',
              paddingBottom: '10px'
            }}>
              {children}
            </h1>
          ),
          
          h2: ({ children }) => (
            <h2 style={{ 
              color: '#24292e', 
              fontSize: '1.5em', 
              fontWeight: '600', 
              marginTop: '24px', 
              marginBottom: '16px',
              borderBottom: '1px solid #eaecef',
              paddingBottom: '10px'
            }}>
              {children}
            </h2>
          ),
          
          h3: ({ children }) => (
            <h3 style={{ 
              color: '#24292e', 
              fontSize: '1.25em', 
              fontWeight: '600', 
              marginTop: '24px', 
              marginBottom: '16px'
            }}>
              {children}
            </h3>
          ),
          
          h4: ({ children }) => (
            <h4 style={{ 
              color: '#24292e', 
              fontSize: '1em', 
              fontWeight: '600', 
              marginTop: '24px', 
              marginBottom: '16px'
            }}>
              {children}
            </h4>
          ),
          
          h5: ({ children }) => (
            <h5 style={{ 
              color: '#24292e', 
              fontSize: '0.875em', 
              fontWeight: '600', 
              marginTop: '24px', 
              marginBottom: '16px'
            }}>
              {children}
            </h5>
          ),
          
          h6: ({ children }) => (
            <h6 style={{ 
              color: '#6a737d', 
              fontSize: '0.85em', 
              fontWeight: '600', 
              marginTop: '24px', 
              marginBottom: '16px'
            }}>
              {children}
            </h6>
          ),
          
          // 段落渲染
          p: ({ children }) => (
            <p style={{ 
              marginTop: '0', 
              marginBottom: '16px',
              lineHeight: '1.6',
              color: '#24292e'
            }}>
              {children}
            </p>
          ),
          
          // 列表渲染
          ul: ({ children }) => (
            <ul style={{ 
              paddingLeft: '2em',
              marginTop: '0',
              marginBottom: '16px'
            }}>
              {children}
            </ul>
          ),
          
          ol: ({ children }) => (
            <ol style={{ 
              paddingLeft: '2em',
              marginTop: '0',
              marginBottom: '16px'
            }}>
              {children}
            </ol>
          ),
          
          li: ({ children }) => (
            <li style={{ 
              marginBottom: '0.25em',
              color: '#24292e'
            }}>
              {children}
            </li>
          ),
          
          // 引用块渲染
          blockquote: ({ children }) => (
            <blockquote style={{
              padding: '0 1em',
              color: '#6a737d',
              borderLeft: '0.25em solid #dfe2e5',
              margin: '0 0 16px 0'
            }}>
              {children}
            </blockquote>
          ),
          
          // 链接渲染
          a: ({ href, children }) => (
            <a 
              href={href}
              style={{
                color: '#0366d6',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = 'underline'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = 'none'
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          
          // 表格渲染
          table: ({ children }) => (
            <table style={{
              borderSpacing: '0',
              borderCollapse: 'collapse',
              marginTop: '0',
              marginBottom: '16px',
              width: '100%'
            }}>
              {children}
            </table>
          ),
          
          th: ({ children }) => (
            <th style={{
              padding: '6px 13px',
              border: '1px solid #dfe2e5',
              backgroundColor: '#f6f8fa',
              fontWeight: '600',
              textAlign: 'left'
            }}>
              {children}
            </th>
          ),
          
          td: ({ children }) => (
            <td style={{
              padding: '6px 13px',
              border: '1px solid #dfe2e5'
            }}>
              {children}
            </td>
          ),
          
          // 分隔线渲染
          hr: () => (
            <hr style={{
              height: '0.25em',
              padding: '0',
              margin: '24px 0',
              backgroundColor: '#e1e4e8',
              border: '0'
            }} />
          ),
          
          // 强调文本
          strong: ({ children }) => (
            <strong style={{ fontWeight: '600' }}>
              {children}
            </strong>
          ),
          
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic' }}>
              {children}
            </em>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownBlock
export type { MarkdownBlockProps }