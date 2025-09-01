/**
 * CodeBlock 代码块渲染组件
 * 使用 react-syntax-highlighter 提供语法高亮功能
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

import React, { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Button, message, Tooltip } from 'antd'
import { CopyOutlined, CheckOutlined } from '@ant-design/icons'

interface CodeBlockProps {
  content: string
  language: string
  className?: string
  style?: React.CSSProperties
  theme?: 'light' | 'dark'
  showCopyButton?: boolean
  showLanguageLabel?: boolean
}

/**
 * 代码块组件
 * 提供语法高亮和复制功能
 */
const CodeBlock: React.FC<CodeBlockProps> = ({ 
  content, 
  language,
  className = '',
  style = {},
  theme = 'light',
  showCopyButton = true,
  showLanguageLabel = true
}) => {
  const [copied, setCopied] = useState(false)

  // 生成CSS类名
  const codeClassName = React.useMemo(() => {
    const baseClasses = ['code-block']
    if (className) baseClasses.push(className)
    return baseClasses.join(' ')
  }, [className])

  // 选择语法高亮主题
  const syntaxTheme = theme === 'dark' ? oneDark : oneLight

  // 复制代码到剪贴板
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      message.success('代码已复制到剪贴板')
      
      // 2秒后重置复制状态
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('复制失败:', error)
      message.error('复制失败，请手动选择复制')
    }
  }

  // 获取语言显示名称
  const getLanguageDisplayName = (lang: string): string => {
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'jsx': 'JavaScript (JSX)',
      'ts': 'TypeScript',
      'tsx': 'TypeScript (TSX)',
      'py': 'Python',
      'python': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'scala': 'Scala',
      'sql': 'SQL',
      'html': 'HTML',
      'xml': 'XML',
      'css': 'CSS',
      'scss': 'SCSS',
      'sass': 'Sass',
      'less': 'Less',
      'json': 'JSON',
      'yaml': 'YAML',
      'yml': 'YAML',
      'toml': 'TOML',
      'ini': 'INI',
      'sh': 'Shell',
      'bash': 'Bash',
      'zsh': 'Zsh',
      'fish': 'Fish',
      'powershell': 'PowerShell',
      'dockerfile': 'Dockerfile',
      'makefile': 'Makefile',
      'vim': 'Vim',
      'markdown': 'Markdown',
      'md': 'Markdown',
      'text': '纯文本',
      'txt': '纯文本'
    }
    
    return languageMap[lang.toLowerCase()] || lang.toUpperCase()
  }

  // 如果内容为空，不渲染
  if (!content || content.trim().length === 0) {
    return null
  }

  const containerStyle: React.CSSProperties = {
    ...style
  }

  return (
    <div className={codeClassName} style={containerStyle}>
      <div style={{
        position: 'relative',
        margin: '8px 0'
      }}>
        {/* 代码块头部 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: theme === 'dark' ? '#2d3748' : '#f6f8fa',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          borderBottom: `1px solid ${theme === 'dark' ? '#4a5568' : '#e1e4e8'}`,
          fontSize: '12px',
          color: theme === 'dark' ? '#a0aec0' : '#586069'
        }}>
          {/* 语言标签 */}
          {showLanguageLabel && (
            <span style={{ fontWeight: '500' }}>
              {getLanguageDisplayName(language)}
            </span>
          )}
          
          {/* 复制按钮 */}
          {showCopyButton && (
            <Tooltip title={copied ? '已复制' : '复制代码'}>
              <Button
                type="text"
                size="small"
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                style={{
                  color: copied ? '#52c41a' : (theme === 'dark' ? '#a0aec0' : '#586069'),
                  padding: '4px'
                }}
              />
            </Tooltip>
          )}
        </div>

        {/* 代码内容 */}
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderBottomLeftRadius: '6px',
            borderBottomRightRadius: '6px',
            fontSize: '14px',
            lineHeight: '1.45'
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
            }
          }}
          wrapLines
          showLineNumbers={content.split('\n').length > 5}
          lineNumberStyle={{
            minWidth: '3em',
            paddingRight: '1em',
            paddingLeft: '0.5em',
            color: theme === 'dark' ? '#6b7280' : '#a0a0a0',
            backgroundColor: theme === 'dark' ? '#374151' : '#f8f8f8',
            borderRight: `1px solid ${theme === 'dark' ? '#4b5563' : '#e5e5e5'}`,
            textAlign: 'right',
            userSelect: 'none'
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export default CodeBlock
export type { CodeBlockProps }