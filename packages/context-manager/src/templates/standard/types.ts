/**
 * 标准模板类型定义
 */

import type { AIMessage } from "../../core/CoreTypes.js";

/**
 * 标准模板输入 - 直接对应四层结构
 * 支持传统字符串格式和现代消息对象格式
 */
export interface StandardInput {
  role: string;
  tools?: string[];
  conversation?: string | string[] | AIMessage[];
  current?: string;

  // 新增：直接传递完整消息数组的选项（优先级更高）
  messages?: AIMessage[];
}