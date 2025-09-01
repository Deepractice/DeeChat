import React, { useState, useCallback, useRef, useEffect } from 'react'
import { message } from 'antd'

interface DragDropOverlayProps {
  onFileDrop: (files: File[]) => void
  disabled?: boolean
  children: React.ReactNode
}

export const DragDropOverlay: React.FC<DragDropOverlayProps> = ({
  onFileDrop,
  disabled = false,
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return

    dragCounterRef.current++
    
    // 检查是否拖拽的是文件
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return

    dragCounterRef.current--
    
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [disabled])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return

    // 设置拖拽效果
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [disabled])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (disabled) return

    setIsDragOver(false)
    dragCounterRef.current = 0

    const files = Array.from(e.dataTransfer?.files || [])
    if (files.length > 0) {
      onFileDrop(files)
    }
  }, [disabled, onFileDrop])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (disabled) return

    const items = e.clipboardData?.items
    if (!items) return

    const files: File[] = []
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) {
          files.push(file)
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault()
      onFileDrop(files)
    }
  }, [disabled, onFileDrop])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 添加拖拽事件监听器
    container.addEventListener('dragenter', handleDragEnter)
    container.addEventListener('dragleave', handleDragLeave)
    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('drop', handleDrop)

    // 添加粘贴事件监听器
    document.addEventListener('paste', handlePaste)

    return () => {
      container.removeEventListener('dragenter', handleDragEnter)
      container.removeEventListener('dragleave', handleDragLeave)
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('drop', handleDrop)
      document.removeEventListener('paste', handlePaste)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop, handlePaste])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      {children}
      
      {/* 拖拽遮罩层 */}
      {isDragOver && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(24, 144, 255, 0.1)',
            border: '2px dashed #1890ff',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: '#1890ff',
              color: 'white',
              padding: '12px 24px',
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
            }}
          >
            松开鼠标以添加文件
          </div>
        </div>
      )}
    </div>
  )
}

export default DragDropOverlay