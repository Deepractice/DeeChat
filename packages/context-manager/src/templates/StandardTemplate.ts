/**
 * 标准四层模板 - 基于现有 formatters 架构的标准模板
 */

import type { ContextData } from '../types.js';
import type { ContextTemplate } from './types.js';

/**
 * 标准模板输入 - 直接对应四层结构
 */
export interface StandardInput {
  role: string;
  tools?: string[];
  conversation?: string | string[];
  current?: string;
}

export class StandardTemplate implements ContextTemplate<StandardInput> {
  readonly id = 'standard';
  readonly name = '标准四层模板';
  readonly description = '基于现有四层结构的标准模板：角色、工具、对话、当前消息';

  build(input: StandardInput): ContextData {
    return {
      role: input.role,
      tools: input.tools,
      conversation: input.conversation,
      current: input.current
    };
  }
}