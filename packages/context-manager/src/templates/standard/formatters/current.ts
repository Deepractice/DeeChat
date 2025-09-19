/**
 * 当前消息层格式化器实体
 */

import type { AIMessage } from "../../../core/CoreTypes.js";

export class CurrentFormatter {
  content: string;
  messages: AIMessage[];

  constructor(current: string) {
    this.content = current.trim();
    this.messages = [{ role: "user", content: this.content }];
  }

  toXML(): string {
    return `<current>${this.content}</current>`;
  }

  toMessages(): AIMessage[] {
    return this.messages;
  }
}

// 兼容函数接口
export function formatCurrent(current: string): CurrentFormatter {
  return new CurrentFormatter(current);
}