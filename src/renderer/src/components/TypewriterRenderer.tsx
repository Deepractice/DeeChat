/**
 * TypewriterRenderer 打字机效果的智能内容渲染组件
 * 结合 TypewriterText 和 MessageRenderer，为AI消息提供打字机效果的智能内容渲染
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react'
import MessageRenderer from './MessageRenderer'

interface TypewriterRendererProps {
  text: string
  speed?: number
  onComplete?: () => void
  className?: string
  style?: React.CSSProperties
}

/**
 * 带打字机效果的智能内容渲染器
 * 在文本逐字显示完成后，切换到智能内容渲染
 */
const TypewriterRenderer: React.FC<TypewriterRendererProps> = ({
  text,
  speed = 30,
  onComplete,
  className,
  style
}) => {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)

      return () => clearTimeout(timer)
    } else if (!isComplete) {
      setIsComplete(true)
      // 延迟一点时间让用户看到完成状态，然后切换到智能渲染
      const switchTimer = setTimeout(() => {
        onComplete?.()
      }, 200)
      
      return () => clearTimeout(switchTimer)
    }
  }, [currentIndex, text, speed, onComplete, isComplete])

  // 重置当文本改变时
  useEffect(() => {
    setDisplayedText('')
    setCurrentIndex(0)
    setIsComplete(false)
  }, [text])

  // 如果打字机效果完成，使用智能渲染器
  if (isComplete && displayedText === text) {
    return (
      <MessageRenderer 
        content={text}
        className={className}
        style={style}
      />
    )
  }

  // 打字机效果进行中，显示纯文本
  return (
    <div className={className} style={style}>
      <span style={{ 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style
      }}>
        {displayedText}
        {currentIndex < text.length && (
          <span
            style={{
              animation: 'blink 1s infinite',
              marginLeft: '2px'
            }}
          >
            |
          </span>
        )}
      </span>
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  )
}

export default TypewriterRenderer
export type { TypewriterRendererProps }