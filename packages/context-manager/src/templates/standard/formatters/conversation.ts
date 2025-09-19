/**
 * 对话层格式化器实体
 */

import type { AIMessage } from "../../../core/CoreTypes.js";

export class ConversationFormatter {
  content: string;
  messages: AIMessage[];

  constructor(conversation: string | string[]) {
    this.messages = [];

    if (typeof conversation === 'string') {
      this.content = conversation.trim();
      // 简单处理单个字符串，假设为用户消息
      if (this.content) {
        this.messages.push({ role: "user", content: this.content });
      }
    } else {
      this.content = conversation
        .filter(msg => msg.trim().length > 0)
        .map(msg => msg.trim())
        .join('\n');

      // 处理对话数组，交替分配 user/assistant
      conversation
        .filter(msg => msg.trim().length > 0)
        .forEach((msg, index) => {
          const role = index % 2 === 0 ? "user" : "assistant";
          this.messages.push({ role, content: msg.trim() });
        });
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
export function formatConversation(conversation: string | string[]): ConversationFormatter {
  return new ConversationFormatter(conversation);
}