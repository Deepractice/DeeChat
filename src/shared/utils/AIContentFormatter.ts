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

    const blocks: ContentBlock[] = []
    let remainingContent = content.trim()
    let hasMarkdown = false
    let hasMermaid = false
    let hasCode = false

    // 1. 提取Mermaid图表块
    remainingContent = this.extractMermaidBlocks(remainingContent, blocks)
    if (blocks.some(block => block.type === 'mermaid')) {
      hasMermaid = true
    }

    // 2. 提取代码块（除了已处理的mermaid）
    remainingContent = this.extractCodeBlocks(remainingContent, blocks)
    if (blocks.some(block => block.type === 'code')) {
      hasCode = true
    }

    // 3. 检测剩余内容是否包含Markdown特征
    if (this.hasMarkdownFeatures(remainingContent)) {
      hasMarkdown = true
      blocks.push({
        type: 'markdown',
        content: remainingContent
      })
    } else {
      // 4. 作为纯文本处理
      if (remainingContent.trim()) {
        blocks.push({
          type: 'text',
          content: remainingContent
        })
      }
    }

    // 如果没有提取到任何块，至少返回原始内容作为文本块
    if (blocks.length === 0) {
      blocks.push({
        type: 'text',
        content: content
      })
    }

    return {
      blocks,
      hasMarkdown,
      hasMermaid,
      hasCode
    }
  }

  /**
   * 提取Mermaid图表块
   */
  private static extractMermaidBlocks(content: string, blocks: ContentBlock[]): string {
    let remainingContent = content

    // 处理```mermaid代码块
    const mermaidMatches = Array.from(content.matchAll(this.MERMAID_PATTERNS[0]))
    for (const match of mermaidMatches) {
      const mermaidContent = match[1]?.trim()
      if (mermaidContent) {
        blocks.push({
          type: 'mermaid',
          content: mermaidContent,
          metadata: {
            originalMatch: match[0]
          }
        })
        remainingContent = remainingContent.replace(match[0], '')
      }
    }

    // 检测独立的Mermaid语法（未包装在代码块中）
    const lines = remainingContent.split('\n')
    let currentMermaidBlock = ''
    let inMermaidBlock = false
    let filteredLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // 检测Mermaid图表开始
      if (this.MERMAID_PATTERNS[1].test(line)) {
        inMermaidBlock = true
        currentMermaidBlock = line + '\n'
        continue
      }

      if (inMermaidBlock) {
        // 如果是空行或者看起来像Mermaid语法，继续添加
        if (line === '' || this.isMermaidSyntaxLine(line)) {
          currentMermaidBlock += lines[i] + '\n'
          continue
        } else {
          // Mermaid块结束
          if (currentMermaidBlock.trim()) {
            blocks.push({
              type: 'mermaid',
              content: currentMermaidBlock.trim()
            })
          }
          inMermaidBlock = false
          currentMermaidBlock = ''
          filteredLines.push(lines[i])
        }
      } else {
        filteredLines.push(lines[i])
      }
    }

    // 处理文件末尾的Mermaid块
    if (inMermaidBlock && currentMermaidBlock.trim()) {
      blocks.push({
        type: 'mermaid',
        content: currentMermaidBlock.trim()
      })
    }

    return filteredLines.join('\n')
  }

  /**
   * 提取代码块
   */
  private static extractCodeBlocks(content: string, blocks: ContentBlock[]): string {
    let remainingContent = content

    const codeMatches = Array.from(content.matchAll(this.CODE_BLOCK_PATTERN))
    for (const match of codeMatches) {
      const language = match[1]?.toLowerCase()
      const codeContent = match[2]?.trim()

      // 跳过mermaid代码块（已在前面处理）
      if (language === 'mermaid') {
        continue
      }

      if (codeContent) {
        blocks.push({
          type: 'code',
          content: codeContent,
          language: language || 'text',
          metadata: {
            originalMatch: match[0]
          }
        })
        remainingContent = remainingContent.replace(match[0], '')
      }
    }

    return remainingContent
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