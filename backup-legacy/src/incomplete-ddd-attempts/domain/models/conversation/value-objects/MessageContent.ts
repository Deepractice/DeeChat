/**
 * 消息内容值对象
 */

import { ValueObject } from '../../../core/ValueObject'

export class MessageContent extends ValueObject {
  private constructor(private readonly value: string) {
    super()
    this.validate()
  }

  /**
   * 创建消息内容
   */
  static create(content: string): MessageContent {
    return new MessageContent(content)
  }

  /**
   * 创建空内容
   */
  static empty(): MessageContent {
    return new MessageContent('')
  }

  /**
   * 获取内容值
   */
  getValue(): string {
    return this.value
  }

  /**
   * 获取内容长度
   */
  getLength(): number {
    return this.value.length
  }

  /**
   * 检查是否为空
   */
  isEmpty(): boolean {
    return this.value.trim().length === 0
  }

  /**
   * 获取预览文本（截取前N个字符）
   */
  getPreview(maxLength: number = 50): string {
    if (this.value.length <= maxLength) {
      return this.value
    }
    return this.value.slice(0, maxLength) + '...'
  }

  /**
   * 检查是否包含特定文本
   */
  contains(text: string, caseSensitive: boolean = false): boolean {
    if (caseSensitive) {
      return this.value.includes(text)
    }
    return this.value.toLowerCase().includes(text.toLowerCase())
  }

  /**
   * 获取单词数量
   */
  getWordCount(): number {
    if (this.isEmpty()) return 0
    return this.value.trim().split(/\s+/).length
  }

  /**
   * 检查是否是代码块
   */
  isCodeBlock(): boolean {
    return this.value.includes('```')
  }

  /**
   * 检查是否包含Markdown
   */
  hasMarkdown(): boolean {
    const markdownPatterns = [
      /\*\*.*\*\*/, // 粗体
      /\*.*\*/, // 斜体
      /`.*`/, // 内联代码
      /```[\s\S]*```/, // 代码块
      /#{1,6}\s/, // 标题
      /\[.*\]\(.*\)/, // 链接
      /!\[.*\]\(.*\)/ // 图片
    ]
    
    return markdownPatterns.some(pattern => pattern.test(this.value))
  }

  /**
   * 内容相等性比较
   */
  equals(other: ValueObject): boolean {
    if (!(other instanceof MessageContent)) return false
    return this.value === other.value
  }

  /**
   * 获取哈希码
   */
  getHashCode(): string {
    return this.value
  }

  /**
   * 字符串表示
   */
  toString(): string {
    return this.value
  }

  /**
   * 验证内容
   */
  protected validate(): void {
    // 内容可以为空，但不能是null或undefined
    if (this.value === null || this.value === undefined) {
      throw new Error('Message content cannot be null or undefined')
    }

    // 检查内容长度限制（例如：100KB）
    const maxLength = 100 * 1024 // 100KB
    if (this.value.length > maxLength) {
      throw new Error(`Message content cannot be longer than ${maxLength} characters`)
    }
  }
}