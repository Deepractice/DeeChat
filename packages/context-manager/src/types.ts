/**
 * Context Manager 类型定义
 */

export interface ContextData {
  /** 角色定义（必需） */
  role: string;
  /** 工具列表（可选） */
  tools?: string[];
  /** 对话历史（可选） */
  conversation?: string | string[];
  /** 当前消息（可选） */
  current?: string;
}
