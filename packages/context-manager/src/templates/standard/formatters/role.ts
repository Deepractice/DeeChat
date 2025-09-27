/**
 * 角色层格式化器实体
 */

import type { AIMessage } from "../../../core/CoreTypes.js";

export class RoleFormatter {
  content: string;
  messages: AIMessage[];

  constructor(role: string) {
    this.content = role.trim();
    this.messages = [{ role: "system", content: this.content }];
  }

  toXML(): string {
    return `<role>${this.content}</role>`;
  }

  toMessages(): AIMessage[] {
    return this.messages;
  }
}

// 兼容函数接口
export function formatRole(role: string): RoleFormatter {
  return new RoleFormatter(role);
}