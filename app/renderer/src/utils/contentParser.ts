/**
 * 智能内容解析器
 * 基于Roo-Code的设计思路，但针对DeeChat的需求进行了扩展
 */

export interface ContentParseResult {
  type: 'json' | 'markdown' | 'xml' | 'code' | 'plain'
  isComplete: boolean
  formatted: string
  language?: string // 用于代码高亮
  metadata?: {
    size?: string // 内容大小描述
    structure?: string // 结构描述，如 "object with 5 properties"
  }
}

export class ContentParser {
  /**
   * 解析工具执行结果内容
   */
  static parseToolResult(content: string, isStreaming: boolean = false): ContentParseResult {
    if (!content || content.trim().length === 0) {
      return {
        type: 'plain',
        isComplete: true,
        formatted: ''
      }
    }

    const trimmed = content.trim()

    // 1. JSON 检测和解析
    const jsonResult = this.tryParseJson(trimmed, isStreaming)
    if (jsonResult.isJson) {
      return {
        type: 'json',
        isComplete: jsonResult.isComplete,
        formatted: jsonResult.formatted,
        language: 'json',
        metadata: jsonResult.metadata
      }
    }

    // 2. XML 检测
    const xmlResult = this.tryParseXml(trimmed, isStreaming)
    if (xmlResult.isXml) {
      return {
        type: 'xml',
        isComplete: xmlResult.isComplete,
        formatted: xmlResult.formatted,
        language: 'xml'
      }
    }

    // 3. Markdown 检测
    if (this.isMarkdown(trimmed)) {
      return {
        type: 'markdown',
        isComplete: !isStreaming,
        formatted: trimmed
      }
    }

    // 4. 代码检测
    const codeResult = this.detectCodeLanguage(trimmed)
    if (codeResult.isCode) {
      return {
        type: 'code',
        isComplete: !isStreaming,
        formatted: trimmed,
        language: codeResult.language
      }
    }

    // 5. 默认为纯文本
    return {
      type: 'plain',
      isComplete: !isStreaming,
      formatted: trimmed
    }
  }

  /**
   * 尝试解析JSON，增强版本支持流式内容
   */
  private static tryParseJson(text: string, isStreaming: boolean): {
    isJson: boolean
    isComplete: boolean
    formatted: string
    metadata?: { size: string; structure: string }
  } {
    if (!text) return { isJson: false, isComplete: true, formatted: '' }

    // 基本JSON结构检测
    const hasJsonStructure = (
      (text.startsWith('{') || text.startsWith('[')) ||
      text.includes('":') || text.includes('": ')
    )

    if (!hasJsonStructure) {
      return { isJson: false, isComplete: true, formatted: text }
    }

    // 检查是否为完整的JSON结构
    const looksComplete = this.isCompleteJsonStructure(text)

    if (!looksComplete && isStreaming) {
      // 流式内容中的不完整JSON，先显示原文
      return {
        isJson: true,
        isComplete: false,
        formatted: text
      }
    }

    try {
      const parsed = JSON.parse(text)
      const formatted = JSON.stringify(parsed, null, 2)

      // 生成元数据
      const metadata = this.generateJsonMetadata(parsed)

      return {
        isJson: true,
        isComplete: true,
        formatted,
        metadata
      }
    } catch (error) {
      // JSON结构存在但解析失败，可能是不完整的流式内容
      if (isStreaming && hasJsonStructure) {
        return {
          isJson: true,
          isComplete: false,
          formatted: text
        }
      }

      return { isJson: false, isComplete: true, formatted: text }
    }
  }

  /**
   * 检查JSON结构是否完整
   */
  private static isCompleteJsonStructure(text: string): boolean {
    if (!text.trim()) return false

    const trimmed = text.trim()

    // 对象结构检查
    if (trimmed.startsWith('{')) {
      let braceCount = 0
      let inString = false
      let escapeNext = false

      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i]

        if (escapeNext) {
          escapeNext = false
          continue
        }

        if (char === '\\') {
          escapeNext = true
          continue
        }

        if (char === '"' && !escapeNext) {
          inString = !inString
          continue
        }

        if (inString) continue

        if (char === '{') braceCount++
        if (char === '}') braceCount--
      }

      return braceCount === 0
    }

    // 数组结构检查
    if (trimmed.startsWith('[')) {
      let bracketCount = 0
      let inString = false
      let escapeNext = false

      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i]

        if (escapeNext) {
          escapeNext = false
          continue
        }

        if (char === '\\') {
          escapeNext = true
          continue
        }

        if (char === '"' && !escapeNext) {
          inString = !inString
          continue
        }

        if (inString) continue

        if (char === '[') bracketCount++
        if (char === ']') bracketCount--
      }

      return bracketCount === 0
    }

    return false
  }

  /**
   * 生成JSON元数据
   */
  private static generateJsonMetadata(parsed: any): { size: string; structure: string } {
    const size = JSON.stringify(parsed).length
    let sizeStr = ''

    if (size < 1000) {
      sizeStr = `${size} chars`
    } else if (size < 1000000) {
      sizeStr = `${(size / 1000).toFixed(1)}K chars`
    } else {
      sizeStr = `${(size / 1000000).toFixed(1)}M chars`
    }

    let structure = ''
    if (Array.isArray(parsed)) {
      structure = `array with ${parsed.length} items`
    } else if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed)
      structure = `object with ${keys.length} properties`
    } else {
      structure = typeof parsed
    }

    return { size: sizeStr, structure }
  }

  /**
   * 尝试解析XML
   */
  private static tryParseXml(text: string, isStreaming: boolean): {
    isXml: boolean
    isComplete: boolean
    formatted: string
  } {
    const hasXmlStructure = text.includes('<') && text.includes('>')
    if (!hasXmlStructure) {
      return { isXml: false, isComplete: true, formatted: text }
    }

    // 简单的XML完整性检查
    const xmlTagRegex = /<(\/?[^>]+)>/g
    const tags: string[] = []
    let match

    while ((match = xmlTagRegex.exec(text)) !== null) {
      const tag = match[1]
      if (tag.startsWith('/')) {
        // 结束标签
        const tagName = tag.substring(1)
        const lastOpenTag = tags.pop()
        if (lastOpenTag !== tagName) {
          // 标签不匹配，可能不完整
          if (isStreaming) {
            return { isXml: true, isComplete: false, formatted: text }
          }
        }
      } else if (!tag.endsWith('/')) {
        // 开始标签（非自闭合）
        tags.push(tag.split(' ')[0]) // 只取标签名，忽略属性
      }
    }

    const isComplete = tags.length === 0

    if (!isComplete && isStreaming) {
      return { isXml: true, isComplete: false, formatted: text }
    }

    return {
      isXml: true,
      isComplete,
      formatted: text // XML格式化可以后续添加
    }
  }

  /**
   * 检测是否为Markdown
   */
  private static isMarkdown(text: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+/, // 标题
      /^\*\*.*\*\*/, // 粗体
      /^\*.*\*/, // 斜体
      /^\[.*\]\(.*\)/, // 链接
      /^```[\w]*\n/, // 代码块
      /^`.*`/, // 行内代码
      /^[-*+]\s+/, // 列表
      /^\d+\.\s+/, // 有序列表
      /^>\s+/, // 引用
    ]

    return markdownPatterns.some(pattern => pattern.test(text))
  }

  /**
   * 检测代码语言
   */
  private static detectCodeLanguage(text: string): { isCode: boolean; language?: string } {
    // 代码特征检测
    const codePatterns = [
      { pattern: /^(function|const|let|var|class)\s+/, language: 'javascript' },
      { pattern: /^(def|import|from|class|if __name__)/m, language: 'python' },
      { pattern: /^(public|private|class|interface)\s+/, language: 'java' },
      { pattern: /^(SELECT|INSERT|UPDATE|DELETE)\s+/i, language: 'sql' },
      { pattern: /^(\$|curl|wget|ls|cd|mkdir)\s+/, language: 'bash' },
      { pattern: /^(<\?php|\$[a-zA-Z_])/m, language: 'php' },
    ]

    for (const { pattern, language } of codePatterns) {
      if (pattern.test(text)) {
        return { isCode: true, language }
      }
    }

    // 检查是否包含大量代码特征字符
    const codeChars = /[{}();[\]<>=+\-*\/]/g
    const matches = text.match(codeChars)
    const codeCharRatio = matches ? matches.length / text.length : 0

    if (codeCharRatio > 0.1) {
      return { isCode: true } // 可能是代码但无法确定语言
    }

    return { isCode: false }
  }

  /**
   * 获取内容的简短摘要（用于预览）
   */
  static getContentSummary(parseResult: ContentParseResult): string {
    if (parseResult.type === 'json' && parseResult.metadata) {
      return `JSON ${parseResult.metadata.structure} (${parseResult.metadata.size})`
    }

    if (parseResult.formatted.length <= 50) {
      return parseResult.formatted
    }

    const preview = parseResult.formatted.substring(0, 47) + '...'
    return preview
  }

  /**
   * 判断内容是否应该默认折叠显示
   */
  static shouldCollapse(parseResult: ContentParseResult): boolean {
    // JSON或XML内容超过500字符时折叠
    if (['json', 'xml'].includes(parseResult.type) && parseResult.formatted.length > 500) {
      return true
    }

    // 代码内容超过300字符时折叠
    if (parseResult.type === 'code' && parseResult.formatted.length > 300) {
      return true
    }

    // 普通文本超过1000字符时折叠
    if (parseResult.type === 'plain' && parseResult.formatted.length > 1000) {
      return true
    }

    return false
  }
}