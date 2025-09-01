/**
 * 消息内容值对象
 * 
 * 为什么要单独做成值对象？
 * - 封装验证逻辑（长度检查、内容过滤等）
 * - 未来可能添加格式化、清理等功能
 */

import { ValueObject } from '../../shared/primitives/ValueObject'

interface IMessageContentProps {
  value: string
}

export class MessageContent extends ValueObject<IMessageContentProps> {
  private constructor(props: IMessageContentProps) {
    super(props)
  }

  public static create(content: string): MessageContent {
    // 基本验证
    if (!content || content.trim().length === 0) {
      throw new Error('消息内容不能为空')
    }

    if (content.length > 10000) {
      throw new Error('消息内容不能超过10000字符')
    }

    // 清理内容（去掉多余空白）
    const cleanedContent = content.trim().replace(/\s+/g, ' ')

    return new MessageContent({ value: cleanedContent })
  }

  public getValue(): string {
    return this.props.value
  }

  public getLength(): number {
    return this.props.value.length
  }

  public isEmpty(): boolean {
    return this.props.value.trim().length === 0
  }

  // 未来可能的功能
  public containsCode(): boolean {
    return /```[\s\S]*```/.test(this.props.value)
  }

  public extractMentions(): string[] {
    const mentions = this.props.value.match(/@\w+/g)
    return mentions || []
  }
}