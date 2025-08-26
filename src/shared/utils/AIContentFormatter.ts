/**
 * AI内容格式化工具类
 * 智能检测和解析AI返回的混合内容（Markdown、Mermaid图表、代码块、纯文本）
 * 
 * @author DeeChat Team
 * @version 1.0.0
 */

export interface ContentBlock {
  type: 'markdown' | 'mermaid' | 'code' | 'text'
  content: string
  language?: string // 代码块语言类型
  metadata?: Record<string, any> // 额外元数据
}

export interface ParsedContent {
  blocks: ContentBlock[]
  hasMarkdown: boolean
  hasMermaid: boolean
  hasCode: boolean
}

/**
 * AI内容格式化核心类
 * 提供智能内容类型检测、解析和格式化功能
 */
export class AIContentFormatter {
  // Mermaid图表关键词模式
  private static readonly MERMAID_PATTERNS = [
    /```mermaid\s*([\s\S]*?)\s*```/gim,
    /^\s*(graph|flowchart|sequenceDiagram|classDiagram|gantt|pie|gitgraph|mindmap|timeline|quadrantChart|requirement|journey|erDiagram|stateDiagram|sankey)/im
  ]

  // 代码块模式
  private static readonly CODE_BLOCK_PATTERN = /```(\w+)?\s*([\s\S]*?)\s*```/gim

  // Markdown特征模式
  private static readonly MARKDOWN_PATTERNS = [
    /^#{1,6}\s+.+$/gim,           // 标题
    /^\*\s+.+$/gim,              // 无序列表
    /^\d+\.\s+.+$/gim,           // 有序列表
    /\*\*(.*?)\*\*/gim,          // 加粗
    /\*(.*?)\*/gim,              // 斜体
    /\[([^\]]+)\]\([^)]+\)/gim,  // 链接
    /!\[([^\]]*)\]\([^)]+\)/gim, // 图片
    /`([^`]+)`/gim,              // 行内代码
    /^\>\s+.+$/gim,              // 引用
    /^\|.*\|.*$/gim,             // 表格
    /^---+$/gim,                 // 分隔线
  ]

  /**
   * 解析混合内容为结构化内容块
   * @param content 原始内容字符串
   * @returns 解析后的内容结构
   */
  static parseContent(content: string): ParsedContent {
    if (!content || typeof content !== 'string') {
      return {
        blocks: [{ type: 'text', content: content || '' }],
        hasMarkdown: false,
        hasMermaid: false,
        hasCode: false
      }
    }

    // 🔥 保持原始内容顺序的解析策略
    const blocks: ContentBlock[] = []
    let hasMarkdown = false
    let hasMermaid = false
    let hasCode = false
    
    // 查找所有特殊块的位置，但保持原有顺序
    const specialBlocks: Array<{
      start: number
      end: number
      type: 'mermaid' | 'code'
      content: string
      language?: string
      match: string
    }> = []

    // 1. 查找所有代码块位置（包括mermaid）
    const codeMatches = Array.from(content.matchAll(this.CODE_BLOCK_PATTERN))
    for (const match of codeMatches) {
      const start = match.index!
      const end = start + match[0].length
      const language = match[1]?.toLowerCase()
      const codeContent = match[2]?.trim()

      if (codeContent) {
        if (language === 'mermaid') {
          specialBlocks.push({
            start,
            end,
            type: 'mermaid',
            content: codeContent,
            match: match[0]
          })
        } else {
          specialBlocks.push({
            start,
            end,
            type: 'code',
            content: codeContent,
            language: language || 'text',
            match: match[0]
          })
        }
      }
    }

    // 2. 查找独立的Mermaid块位置
    const lines = content.split('\n')
    let currentPos = 0
    let inMermaidBlock = false
    let mermaidStart = 0
    let currentMermaidContent = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      const lineStart = currentPos
      const lineEnd = currentPos + lines[i].length + 1 // +1 for newline

      // 检查这一行是否在已知的代码块中
      const inCodeBlock = specialBlocks.some(block => 
        lineStart >= block.start && lineEnd <= block.end
      )

      if (!inCodeBlock) {
        if (this.MERMAID_PATTERNS[1].test(line) && !inMermaidBlock) {
          inMermaidBlock = true
          mermaidStart = lineStart
          currentMermaidContent = lines[i] + '\n'
        } else if (inMermaidBlock) {
          if (line === '' || this.isMermaidSyntaxLine(line)) {
            currentMermaidContent += lines[i] + '\n'
          } else {
            // Mermaid块结束
            if (currentMermaidContent.trim()) {
              specialBlocks.push({
                start: mermaidStart,
                end: currentPos,
                type: 'mermaid',
                content: currentMermaidContent.trim(),
                match: currentMermaidContent
              })
            }
            inMermaidBlock = false
            currentMermaidContent = ''
          }
        }
      }

      currentPos = lineEnd
    }

    // 处理文件末尾的Mermaid块
    if (inMermaidBlock && currentMermaidContent.trim()) {
      specialBlocks.push({
        start: mermaidStart,
        end: currentPos,
        type: 'mermaid',
        content: currentMermaidContent.trim(),
        match: currentMermaidContent
      })
    }

    // 3. 按位置排序特殊块
    specialBlocks.sort((a, b) => a.start - b.start)

    // 4. 按顺序构建内容块
    let lastEnd = 0
    for (const block of specialBlocks) {
      // 添加特殊块之前的文本
      if (block.start > lastEnd) {
        const textContent = content.slice(lastEnd, block.start).trim()
        if (textContent) {
          if (this.hasMarkdownFeatures(textContent)) {
            hasMarkdown = true
            blocks.push({
              type: 'markdown',
              content: textContent
            })
          } else {
            blocks.push({
              type: 'text',
              content: textContent
            })
          }
        }
      }

      // 添加特殊块
      if (block.type === 'mermaid') {
        hasMermaid = true
        blocks.push({
          type: 'mermaid',
          content: block.content
        })
      } else {
        hasCode = true
        blocks.push({
          type: 'code',
          content: block.content,
          language: block.language || 'text'
        })
      }

      lastEnd = block.end
    }

    // 5. 添加最后剩余的内容
    if (lastEnd < content.length) {
      const textContent = content.slice(lastEnd).trim()
      if (textContent) {
        if (this.hasMarkdownFeatures(textContent)) {
          hasMarkdown = true
          blocks.push({
            type: 'markdown',
            content: textContent
          })
        } else {
          blocks.push({
            type: 'text',
            content: textContent
          })
        }
      }
    }

    // 如果没有提取到任何块，至少返回原始内容作为文本块
    if (blocks.length === 0) {
      if (this.hasMarkdownFeatures(content)) {
        hasMarkdown = true
        blocks.push({
          type: 'markdown',
          content: content
        })
      } else {
        blocks.push({
          type: 'text',
          content: content
        })
      }
    }

    return {
      blocks,
      hasMarkdown,
      hasMermaid,
      hasCode
    }
  }



  /**
   * 检测内容是否包含Markdown特征
   */
  private static hasMarkdownFeatures(content: string): boolean {
    if (!content || content.trim().length === 0) {
      return false
    }

    // 检查各种Markdown模式
    for (const pattern of this.MARKDOWN_PATTERNS) {
      if (pattern.test(content)) {
        return true
      }
    }

    return false
  }

  /**
   * 判断是否为Mermaid语法行
   */
  private static isMermaidSyntaxLine(line: string): boolean {
    if (!line || line.trim() === '') return true

    // 常见Mermaid语法模式
    const mermaidSyntaxPatterns = [
      /^\s*[A-Z0-9]+(\[[^\]]+\])?(\([^)]+\))?(\{[^}]+\})?/i, // 节点定义
      /^\s*[A-Z0-9]+\s*--[->]*\s*[A-Z0-9]+/i,              // 连接线
      /^\s*[A-Z0-9]+\s*-\|->\s*[A-Z0-9]+/i,                // 特殊连接
      /^\s*[A-Z0-9]+\s*:\s*.+/i,                           // 标签定义
      /^\s*subgraph\s+/i,                                  // 子图
      /^\s*end\s*$/i,                                      // 结束标记
      /^\s*classDef\s+/i,                                  // 类定义
      /^\s*class\s+/i,                                     // 类应用
      /^\s*click\s+/i,                                     // 点击事件
      /^\s*%%/,                                            // 注释
    ]

    return mermaidSyntaxPatterns.some(pattern => pattern.test(line))
  }

  /**
   * 检测内容是否主要是Mermaid图表
   * @param content 内容字符串
   * @returns 是否为Mermaid内容
   */
  static isMermaidContent(content: string): boolean {
    if (!content) return false

    // 检查是否包含```mermaid代码块
    if (this.MERMAID_PATTERNS[0].test(content)) {
      return true
    }

    // 检查是否以Mermaid图表类型开始
    const lines = content.split('\n').map(line => line.trim()).filter(line => line)
    if (lines.length > 0 && this.MERMAID_PATTERNS[1].test(lines[0])) {
      return true
    }

    return false
  }

  /**
   * 检测内容类型的便捷方法
   * @param content 内容字符串
   * @returns 主要内容类型
   */
  static detectContentType(content: string): 'markdown' | 'mermaid' | 'code' | 'text' {
    if (!content || typeof content !== 'string') {
      return 'text'
    }

    // 优先检测Mermaid
    if (this.isMermaidContent(content)) {
      return 'mermaid'
    }

    // 检测代码块
    if (this.CODE_BLOCK_PATTERN.test(content)) {
      return 'code'
    }

    // 检测Markdown
    if (this.hasMarkdownFeatures(content)) {
      return 'markdown'
    }

    // 默认为文本
    return 'text'
  }

  /**
   * 格式化内容用于预览
   * @param content 原始内容
   * @param maxLength 最大长度
   * @returns 格式化后的预览文本
   */
  static formatPreview(content: string, maxLength: number = 100): string {
    if (!content) return ''

    const cleanContent = content
      .replace(/```[\s\S]*?```/g, '[代码块]')      // 替换代码块
      .replace(/^#{1,6}\s+/gm, '')               // 移除标题标记
      .replace(/\*\*(.*?)\*\*/g, '$1')           // 移除加粗标记
      .replace(/\*(.*?)\*/g, '$1')               // 移除斜体标记
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // 保留链接文本
      .replace(/`([^`]+)`/g, '$1')               // 移除行内代码标记
      .trim()

    if (cleanContent.length <= maxLength) {
      return cleanContent
    }

    return cleanContent.substring(0, maxLength) + '...'
  }

  /**
   * 统计内容特征
   * @param content 内容字符串
   * @returns 内容统计信息
   */
  static getContentStats(content: string) {
    const parsed = this.parseContent(content)
    
    return {
      totalBlocks: parsed.blocks.length,
      blockTypes: parsed.blocks.map(block => block.type),
      hasMarkdown: parsed.hasMarkdown,
      hasMermaid: parsed.hasMermaid,
      hasCode: parsed.hasCode,
      characterCount: content.length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      lineCount: content.split('\n').length
    }
  }
}

export default AIContentFormatter