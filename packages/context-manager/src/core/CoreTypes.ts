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

/**
 * AI 生态标准角色类型
 */
export type AIRole = "system" | "user" | "assistant" | "tool";

/**
 * AI 消息对象 - 兼容 OpenAI、Anthropic、Google 等主流 AI 服务
 */
export interface AIMessage {
  /** 消息角色 */
  role: AIRole;
  /** 消息内容 */
  content: string;
}
