/**
 * StreamingTypewriter 真正的流式打字机组件
 * 专门处理增量文本更新，实现真正的逐字显示效果
 */

import React, { useState, useEffect, useRef } from 'react'
import MessageRenderer from './MessageRenderer'

interface StreamingTypewriterProps {
  /** 当前累积的文本内容 */
  currentText: string
  /** 是否流式输出完成 */
  isComplete: boolean
  /** 打字机速度（毫秒/字符） */
  speed?: number
  /** 完成回调 */
  onComplete?: () => void
  /** 样式 */
  className?: string
  style?: React.CSSProperties
}

/**
 * 流式打字机组件
 * 根据currentText的变化实时显示内容，模拟打字机效果
 */
const StreamingTypewriter: React.FC<StreamingTypewriterProps> = ({
  currentText,
  isComplete,
  speed = 80,
  onComplete,
  className,
  style
}) => {
  const [displayedText, setDisplayedText] = useState('')
  const [isTypingComplete, setIsTypingComplete] = useState(false)
  const currentTextRef = useRef('')
  const displayIndexRef = useRef(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // 清理定时器
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  // 打字机效果核心逻辑
  const typeNextCharacter = () => {
    const targetText = currentTextRef.current
    const currentIndex = displayIndexRef.current

    if (currentIndex < targetText.length) {
      // 继续打字
      setDisplayedText(targetText.substring(0, currentIndex + 1))
      displayIndexRef.current = currentIndex + 1
      
      // 设置下一个字符的定时器
      timerRef.current = setTimeout(typeNextCharacter, speed)
    } else if (isComplete && !isTypingComplete) {
      // 流式完成且打字完成
      setIsTypingComplete(true)
      setTimeout(() => {
        onComplete?.()
      }, 200)
    }
  }

  // 监听currentText变化
  useEffect(() => {
    currentTextRef.current = currentText
    
    // 如果新文本比当前显示的长，继续打字
    if (currentText.length > displayedText.length && !timerRef.current) {
      typeNextCharacter()
    }
  }, [currentText, displayedText.length])

  // 监听完成状态
  useEffect(() => {
    if (isComplete && displayedText === currentText && !isTypingComplete) {
      setIsTypingComplete(true)
      setTimeout(() => {
        onComplete?.()
      }, 200)
    }
  }, [isComplete, displayedText, currentText, isTypingComplete, onComplete])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [])

  // 如果打字完成且流式完成，使用智能渲染器
  if (isTypingComplete && isComplete && displayedText === currentText) {
    return (
      <MessageRenderer 
        content={currentText}
        className={className}
        style={style}
      />
    )
  }

  // 打字机效果进行中
  return (
    <div className={className} style={style}>
      <span style={{ 
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...style
      }}>
        {displayedText}
        {(!isComplete || displayedText.length < currentText.length) && (
          <span
            style={{
              animation: 'streamingBlink 1s infinite',
              marginLeft: '2px',
              color: '#1890ff'
            }}
          >
            |
          </span>
        )}
      </span>
      <style>
        {`
          @keyframes streamingBlink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  )
}

export default StreamingTypewriter
