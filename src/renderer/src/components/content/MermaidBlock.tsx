/**
 * MermaidBlock Mermaid图表渲染组件
 * 使用 mermaid 库渲染各种图表类型
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { Spin, Alert } from 'antd'

interface MermaidBlockProps {
  content: string
  className?: string
  style?: React.CSSProperties
  theme?: 'default' | 'dark' | 'forest' | 'neutral'
}

/**
 * Mermaid图表渲染状态
 */
interface MermaidState {
  loading: boolean
  error: string | null
  svgContent: string | null
}

/**
 * Mermaid图表块组件
 * 支持异步渲染和错误处理
 */
const MermaidBlock: React.FC<MermaidBlockProps> = ({ 
  content, 
  className = '',
  style = {},
  theme = 'default'
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<MermaidState>({
    loading: true,
    error: null,
    svgContent: null
  })

  // 生成唯一ID
  const mermaidId = React.useMemo(() => {
    return `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // 生成CSS类名
  const mermaidClassName = React.useMemo(() => {
    const baseClasses = ['mermaid-block']
    if (className) baseClasses.push(className)
    return baseClasses.join(' ')
  }, [className])

  // 初始化Mermaid配置
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme,
      securityLevel: 'loose',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 14,
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      gantt: {
        useMaxWidth: true,
        leftPadding: 75,
        rightPadding: 20
      },
      sequence: {
        useMaxWidth: true,
        diagramMarginX: 50,
        diagramMarginY: 10,
        boxTextMargin: 5,
        noteMargin: 10,
        messageMargin: 35
      }
    })
  }, [theme])

  // 渲染Mermaid图表
  useEffect(() => {
    if (!content || content.trim().length === 0) {
      setState({
        loading: false,
        error: 'Mermaid内容为空',
        svgContent: null
      })
      return
    }

    const renderMermaid = async () => {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }))

        // 验证语法
        const isValid = await mermaid.parse(content)
        if (!isValid) {
          throw new Error('Mermaid语法无效')
        }

        // 渲染图表
        const { svg } = await mermaid.render(mermaidId, content)
        
        setState({
          loading: false,
          error: null,
          svgContent: svg
        })
      } catch (error) {
        console.error('Mermaid渲染失败:', error)
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Mermaid渲染失败',
          svgContent: null
        })
      }
    }

    // 延迟渲染以避免阻塞UI
    const timer = setTimeout(renderMermaid, 100)
    
    return () => clearTimeout(timer)
  }, [content, mermaidId])

  const containerStyle: React.CSSProperties = {
    ...style
  }

  // 如果内容为空，不渲染
  if (!content || content.trim().length === 0) {
    return null
  }

  // 加载状态
  if (state.loading) {
    return (
      <div className={mermaidClassName} style={containerStyle}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          backgroundColor: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e8e8e8'
        }}>
          <Spin size="small" />
          <span style={{ marginLeft: '8px', color: '#666' }}>
            正在渲染Mermaid图表...
          </span>
        </div>
      </div>
    )
  }

  // 错误状态
  if (state.error) {
    return (
      <div className={mermaidClassName} style={containerStyle}>
        <Alert
          type="warning"
          message="Mermaid图表渲染失败"
          description={
            <div>
              <p style={{ marginBottom: '8px' }}>{state.error}</p>
              <details style={{ fontSize: '12px', color: '#666' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>
                  查看原始内容
                </summary>
                <pre style={{
                  backgroundColor: '#f6f8fa',
                  padding: '12px',
                  borderRadius: '3px',
                  overflow: 'auto',
                  fontSize: '12px',
                  margin: 0
                }}>
                  {content}
                </pre>
              </details>
            </div>
          }
          showIcon
          style={{ margin: '8px 0' }}
        />
      </div>
    )
  }

  // 成功渲染
  if (state.svgContent) {
    return (
      <div className={mermaidClassName} style={containerStyle}>
        <div 
          ref={containerRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '16px',
            backgroundColor: '#fafafa',
            borderRadius: '6px',
            border: '1px solid #e8e8e8',
            margin: '8px 0',
            overflow: 'auto'
          }}
          dangerouslySetInnerHTML={{ 
            __html: state.svgContent 
          }}
        />
      </div>
    )
  }

  // 兜底渲染
  return (
    <div className={mermaidClassName} style={containerStyle}>
      <div style={{
        padding: '16px',
        backgroundColor: '#f6f8fa',
        borderRadius: '6px',
        border: '1px solid #e8e8e8',
        margin: '8px 0'
      }}>
        <pre style={{
          margin: 0,
          fontSize: '12px',
          color: '#586069',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}>
          {content}
        </pre>
      </div>
    </div>
  )
}

export default MermaidBlock
export type { MermaidBlockProps }