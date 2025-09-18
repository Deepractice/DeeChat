/**
 * Context Formatter - 简单清晰的4层XML格式化器
 */

import type { ContextData } from './types.js';
import { formatRole } from './formatters/role.js';
import { formatTools } from './formatters/tools.js';
import { formatConversation } from './formatters/conversation.js';
import { formatCurrent } from './formatters/current.js';
import { templateManager } from './templates/TemplateManager.js';

export class ContextFormatter {
  /**
   * 将数据格式化为4层XML结构
   */
  static format(data: ContextData): string {
    const parts: string[] = [];

    // 第1层：角色定义（必需）
    if (data.role) {
      parts.push(formatRole(data.role));
    }

    // 第2层：工具列表（可选）
    if (data.tools && data.tools.length > 0) {
      parts.push(formatTools(data.tools));
    }

    // 第3层：对话历史（可选）
    if (data.conversation) {
      parts.push(formatConversation(data.conversation));
    }

    // 第4层：当前消息（可选）
    if (data.current) {
      parts.push(formatCurrent(data.current));
    }

    // 用context标签包装
    if (parts.length === 0) {
      return '<context></context>';
    }

    return `<context>\n${parts.join('\n\n')}\n</context>`;
  }

  /**
   * 使用模板构建上下文
   */
  static fromTemplate<T>(templateId: string, input: T): string {
    return templateManager.build(templateId, input);
  }

  /**
   * 获取模板管理器
   */
  static get templates() {
    return templateManager;
  }
}
