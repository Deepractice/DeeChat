/**
 * 消息内容值对象
 * 🏗️ DDD重构: 强类型化的消息内容，包含丰富的业务方法
 */

export type MessageType = 'text' | 'image' | 'file' | 'tool_call' | 'tool_result' | 'system';

export interface MessageAttachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  url?: string;
  size?: number;
  mimeType?: string;
}

export class MessageContent {
  private readonly _text: string;
  private readonly _type: MessageType;
  private readonly _attachments: MessageAttachment[];
  private readonly _metadata: Record<string, any>;

  constructor(
    text: string,
    type: MessageType = 'text',
    attachments: MessageAttachment[] = [],
    metadata: Record<string, any> = {}
  ) {
    if (text === null || text === undefined) {
      throw new Error('消息内容不能为null或undefined');
    }
    
    this._text = text;
    this._type = type;
    this._attachments = [...attachments]; // 创建副本确保不可变性
    this._metadata = { ...metadata };
  }

  get text(): string {
    return this._text;
  }

  get type(): MessageType {
    return this._type;
  }

  get attachments(): readonly MessageAttachment[] {
    return this._attachments;
  }

  get metadata(): Readonly<Record<string, any>> {
    return this._metadata;
  }

  /**
   * 获取消息长度
   */
  get length(): number {
    return this._text.length;
  }

  /**
   * 检查是否为空消息
   */
  isEmpty(): boolean {
    return this._text.trim() === '' && this._attachments.length === 0;
  }

  /**
   * 检查是否包含附件
   */
  hasAttachments(): boolean {
    return this._attachments.length > 0;
  }

  /**
   * 检查是否为系统消息
   */
  isSystemMessage(): boolean {
    return this._type === 'system';
  }

  /**
   * 检查是否为工具调用
   */
  isToolCall(): boolean {
    return this._type === 'tool_call';
  }

  /**
   * 获取纯文本内容（去除格式化）
   */
  getPlainText(): string {
    // 移除Markdown格式、HTML标签等
    return this._text
      .replace(/!\[.*?\]\(.*?\)/g, '[图片]') // 图片
      .replace(/\[.*?\]\(.*?\)/g, '[链接]') // 链接
      .replace(/```[\s\S]*?```/g, '[代码块]') // 代码块
      .replace(/`.*?`/g, '[代码]') // 内联代码
      .replace(/<[^>]*>/g, '') // HTML标签
      .trim();
  }

  /**
   * 获取消息摘要（截断长消息）
   */
  getSummary(maxLength: number = 100): string {
    const plainText = this.getPlainText();
    
    if (plainText.length <= maxLength) {
      return plainText;
    }
    
    return plainText.substring(0, maxLength - 3) + '...';
  }

  /**
   * 获取字符数统计
   */
  getWordCount(): {
    characters: number;
    charactersNoSpaces: number;
    words: number;
    lines: number;
  } {
    const text = this._text;
    
    return {
      characters: text.length,
      charactersNoSpaces: text.replace(/\s/g, '').length,
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
      lines: text.split('\n').length
    };
  }

  /**
   * 检查是否包含特定关键词
   */
  contains(keyword: string, caseSensitive: boolean = false): boolean {
    const text = caseSensitive ? this._text : this._text.toLowerCase();
    const searchTerm = caseSensitive ? keyword : keyword.toLowerCase();
    return text.includes(searchTerm);
  }

  /**
   * 添加附件（返回新实例）
   */
  withAttachment(attachment: MessageAttachment): MessageContent {
    return new MessageContent(
      this._text,
      this._type,
      [...this._attachments, attachment],
      this._metadata
    );
  }

  /**
   * 添加元数据（返回新实例）
   */
  withMetadata(key: string, value: any): MessageContent {
    return new MessageContent(
      this._text,
      this._type,
      this._attachments,
      { ...this._metadata, [key]: value }
    );
  }

  /**
   * 截断内容（返回新实例）
   */
  truncate(maxLength: number): MessageContent {
    if (this._text.length <= maxLength) {
      return this;
    }
    
    const truncatedText = this._text.substring(0, maxLength - 3) + '...';
    return new MessageContent(truncatedText, this._type, this._attachments, this._metadata);
  }

  /**
   * 静态工厂方法：创建文本消息
   */
  static text(content: string): MessageContent {
    return new MessageContent(content, 'text');
  }

  /**
   * 静态工厂方法：创建系统消息
   */
  static system(content: string): MessageContent {
    return new MessageContent(content, 'system');
  }

  /**
   * 静态工厂方法：创建空消息
   */
  static empty(): MessageContent {
    return new MessageContent('');
  }

  /**
   * 验证消息内容
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查内容长度
    if (this._text.length > 50000) {
      errors.push('消息内容过长，超过50,000字符');
    }
    
    // 检查附件
    if (this._attachments.length > 10) {
      errors.push('附件数量过多，超过10个');
    }
    
    // 检查空消息
    if (this.isEmpty()) {
      errors.push('消息内容和附件都为空');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 转换为字符串表示
   */
  toString(): string {
    let result = this._text;
    
    if (this.hasAttachments()) {
      const attachmentInfo = this._attachments.map(att => `[${att.type}: ${att.name}]`).join(' ');
      result = result ? `${result} ${attachmentInfo}` : attachmentInfo;
    }
    
    return result;
  }
}