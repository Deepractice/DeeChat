/**
 * Context Formatter - 模板驱动的AI消息数组生成器
 */

import type { AIMessage } from "./CoreTypes.js";
import { templateManager } from "./TemplateManager.js";

export class ContextFormatter {
  /**
   * 获取模板管理器
   */
  static get templates() {
    return templateManager;
  }

  /**
   * 使用模板构建AI消息数组 - 核心API
   */
  static fromTemplateAsMessages<T>(templateId: string, input: T): AIMessage[] {
    const template = templateManager.get(templateId);

    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // 统一调用模板的 buildMessages 方法
    return template.buildMessages(input);
  }

  /**
   * 格式化上下文数据为XML字符串 - 兼容原API
   */
  static format(contextData: any): string {
    // 使用标准模板进行格式化
    const standardTemplate = templateManager.get('standard');

    if (!standardTemplate) {
      throw new Error('Standard template not found');
    }

    // 如果是 StandardTemplate，调用其 format 方法
    if ('format' in standardTemplate) {
      return (standardTemplate as any).format(contextData);
    }

    throw new Error('Template does not support format method');
  }
}
