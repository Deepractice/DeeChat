/**
 * messageParser - 消息内容解析工具
 *
 * 职责:
 * 1. 解析混合内容（文本 + 工具标记）
 * 2. 提取工具执行信息
 * 3. 格式化时间戳
 */

export interface ToolExecutionInfo {
  id: string
  toolName: string
  status: 'pending' | 'executing' | 'completed' | 'error'
  result?: string
  error?: string
}

export interface ParsedContent {
  type: 'text' | 'tool'
  content?: string
  toolInfo?: ToolExecutionInfo
}

/**
 * 解析混合内容：包含文本和工具执行标记
 */
export function parseMixedContent(content: string): ParsedContent[] {
  if (!content) return []

  // 检测工具执行标记的正则表达式
  const toolPattern = /(✅ \*\*工具执行完成\*\*\n结果: (.+))|(❌ \*\*工具执行失败\*\*\n错误: (.+))/g

  // 如果没有工具标记，直接返回纯文本
  if (!toolPattern.test(content)) {
    return [{ type: 'text', content }]
  }

  // 重置正则表达式
  toolPattern.lastIndex = 0

  const parts: ParsedContent[] = []
  let lastIndex = 0
  let match

  while ((match = toolPattern.exec(content)) !== null) {
    // 添加工具标记前的文本
    if (match.index > lastIndex) {
      const textPart = content.substring(lastIndex, match.index)
      if (textPart.trim()) {
        parts.push({ type: 'text', content: textPart })
      }
    }

    // 解析工具执行信息
    const isSuccess = match[1] !== undefined
    const result = isSuccess ? match[2] : match[4]

    parts.push({
      type: 'tool',
      toolInfo: {
        id: `tool-${parts.length}`,
        toolName: '未知工具', // 暂时硬编码
        status: isSuccess ? 'completed' : 'error',
        result: isSuccess ? result : undefined,
        error: isSuccess ? undefined : result
      }
    })

    lastIndex = match.index + match[0].length
  }

  // 添加最后剩余的文本
  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex)
    if (remainingText.trim()) {
      parts.push({ type: 'text', content: remainingText })
    }
  }

  return parts
}

/**
 * 格式化时间戳
 */
export function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 截断长文本
 */
export function truncateText(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}