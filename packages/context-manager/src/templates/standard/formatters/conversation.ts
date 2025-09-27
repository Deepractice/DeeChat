/**
 * 对话层格式化器实体
 */

import type { AIMessage } from "../../../core/CoreTypes.js";

export class ConversationFormatter {
  content: string;
  messages: AIMessage[];

  constructor(conversation: string | string[] | AIMessage[]) {
    this.messages = [];

    if (typeof conversation === 'string') {
      this.content = conversation.trim();
      // 简单处理单个字符串，假设为用户消息
      if (this.content) {
        this.messages.push({ role: "user", content: this.content });
      }
    } else if (Array.isArray(conversation) && conversation.length > 0 && typeof conversation[0] === 'string') {
      // 处理字符串数组
      const stringArray = conversation as string[];
      this.content = stringArray
        .filter(msg => msg.trim().length > 0)
        .map(msg => msg.trim())
        .join('\n');

      // 处理对话数组，交替分配 user/assistant
      stringArray
        .filter(msg => msg.trim().length > 0)
        .forEach((msg, index) => {
          const role = index % 2 === 0 ? "user" : "assistant";
          this.messages.push({ role, content: msg.trim() });
        });
    } else if (Array.isArray(conversation) && conversation.length > 0 && typeof conversation[0] === 'object') {
      // 处理 AIMessage 数组 - 直接使用，保持工具调用信息
      const messageArray = conversation as AIMessage[];
      this.messages = [...messageArray];

      // 为 XML 生成简化的内容表示
      this.content = messageArray
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
    } else {
      // 空数组或其他情况
      this.content = '';
      this.messages = [];
    }
  }

  toXML(): string {
    return `<conversation>\n${this.content}\n</conversation>`;
  }

  toMessages(): AIMessage[] {
    return this.messages;
  }
}

// 兼容函数接口
export function formatConversation(conversation: string | string[] | AIMessage[]): ConversationFormatter {
  return new ConversationFormatter(conversation);
}