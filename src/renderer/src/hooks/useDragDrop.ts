import { useState, useRef, useCallback } from 'react'

interface UseDragDropOptions {
  onFileDrop: (files: File[]) => void
  acceptedTypes?: string[]
}

export const useDragDrop = ({ onFileDrop, acceptedTypes }: UseDragDropOptions) => {
  const [isDragActive, setIsDragActive] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounter = useRef(0)

  const validateFileType = (file: File): boolean => {
    if (!acceptedTypes || acceptedTypes.length === 0) return true
    
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    return acceptedTypes.some(type => 
      type === fileExtension || 
      file.type.includes(type.replace('.', ''))
    )
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current++
    
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragActive(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    dragCounter.current--
    
    if (dragCounter.current === 0) {
      setIsDragActive(false)
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragOver(true)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    setIsDragActive(false)
    setIsDragOver(false)
    dragCounter.current = 0
    
    const files = Array.from(e.dataTransfer?.files || [])
    const validFiles = files.filter(validateFileType)
    
    if (validFiles.length > 0) {
      onFileDrop(validFiles)
    } else if (files.length > 0) {
      console.warn('不支持的文件类型')
    }
  }, [onFileDrop, acceptedTypes])

  const dragProps = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
  }

  return {
    isDragActive,
    isDragOver,
    dragProps,
  }
}

export default useDragDrop