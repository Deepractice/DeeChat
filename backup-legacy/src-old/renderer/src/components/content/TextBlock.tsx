/**
 * TextBlock 纯文本内容渲染组件
 * 处理纯文本内容的显示，保持原有的换行和空格格式
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

import React from 'react'

interface TextBlockProps {
  content: string
  className?: string
  style?: React.CSSProperties
  preserveWhitespace?: boolean
}

/**
 * 纯文本块组件
 * 保持简单的文本渲染，支持换行显示
 */
const TextBlock: React.FC<TextBlockProps> = ({ 
  content, 
  className = '',
  style = {},
  preserveWhitespace = true
}) => {
  // 生成CSS类名
  const textClassName = React.useMemo(() => {
    const baseClasses = ['text-block']
    if (preserveWhitespace) baseClasses.push('text-block-preserve-whitespace')
    if (className) baseClasses.push(className)
    return baseClasses.join(' ')
  }, [className, preserveWhitespace])

  // 如果内容为空，渲染空div
  if (!content && content !== '') {
    return <div className={textClassName} style={style} />
  }

  const textStyle: React.CSSProperties = {
    whiteSpace: preserveWhitespace ? 'pre-wrap' : 'normal',
    wordBreak: 'break-word',
    margin: 0,
    ...style
  }

  return (
    <div className={textClassName} style={textStyle}>
      {content}
    </div>
  )
}

export default TextBlock
export type { TextBlockProps }