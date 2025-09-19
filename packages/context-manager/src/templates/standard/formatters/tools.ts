/**
 * 工具层格式化器实体
 */

import type { AIMessage } from "../../../core/CoreTypes.js";

export class ToolsFormatter {
  content: string;
  messages: AIMessage[];
  tools: string[];

  constructor(tools: string[]) {
    this.tools = tools
      .filter(tool => tool.trim().length > 0)
      .map(tool => tool.trim());

    this.content = this.tools.join('\n');

    // 工具列表通常作为系统消息的一部分
    this.messages = [{
      role: "system",
      content: `可用工具：\n${this.content}`
    }];
  }

  toXML(): string {
    return `<tools>\n${this.content}\n</tools>`;
  }

  toMessages(): AIMessage[] {
    return this.messages;
  }
}

// 兼容函数接口
export function formatTools(tools: string[]): ToolsFormatter {
  return new ToolsFormatter(tools);
}