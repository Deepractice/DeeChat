/**
 * 标准四层模板 - 基于现有 formatters 架构的标准模板
 */

import type { ContextData, AIMessage } from "../../core/CoreTypes.js";
import type { ContextTemplate } from "../types.js";
import type { StandardInput } from './types.js';
import { formatRole, formatTools, formatConversation, formatCurrent } from "./formatters/index.js";

export type { StandardInput };

export class StandardTemplate implements ContextTemplate<StandardInput> {
  readonly id = "standard";
  readonly name = "标准四层模板";
  readonly description =
    "基于现有四层结构的标准模板：角色、工具、对话、当前消息";

  build(input: StandardInput): ContextData {
    return {
      role: input.role,
      tools: input.tools,
      conversation: input.conversation,
      current: input.current,
    };
  }

  /**
   * 构建格式化的XML字符串
   * @param input 标准输入
   * @returns 格式化的XML上下文字符串
   */
  format(input: StandardInput): string {
    const parts: string[] = [];

    // 1. 角色层（必需）
    parts.push(formatRole(input.role).toXML());

    // 2. 工具层（可选）
    if (input.tools && input.tools.length > 0) {
      parts.push(formatTools(input.tools).toXML());
    }

    // 3. 对话历史层（可选）
    if (input.conversation) {
      parts.push(formatConversation(input.conversation).toXML());
    }

    // 4. 当前消息层（可选）
    if (input.current) {
      parts.push(formatCurrent(input.current).toXML());
    }

    // 用空行连接各层
    return `<context>\n${parts.join('\n\n')}\n</context>`;
  }

  /**
   * 构建 AI 消息数组
   * @param input 标准输入
   * @returns AIMessage 数组
   */
  buildMessages(input: StandardInput): AIMessage[] {
    const messages: AIMessage[] = [];

    // 1. 系统消息：使用格式化的XML上下文
    const systemContent = this.format(input);
    messages.push({
      role: "system",
      content: systemContent,
    });

    // 2. 对话历史：使用 formatter 实体处理
    if (input.conversation) {
      const conversationFormatter = formatConversation(input.conversation);
      messages.push(...conversationFormatter.toMessages());
    }

    // 3. 当前消息：使用 formatter 实体处理
    if (input.current) {
      const currentFormatter = formatCurrent(input.current);
      messages.push(...currentFormatter.toMessages());
    }

    return messages;
  }
}
