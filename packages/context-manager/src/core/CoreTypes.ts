/**
 * Context Manager 类型定义
 */

export interface ContextData {
  /** 角色定义（必需） */
  role: string;
  /** 工具列表（可选） */
  tools?: string[];
  /** 对话历史（可选） */
  conversation?: string | string[] | AIMessage[];
  /** 当前消息（可选） */
  current?: string;
  /** 完整消息数组（现代格式，优先级最高） */
  messages?: AIMessage[];
}

/**
 * AI 生态标准角色类型
 */
export type AIRole = "system" | "user" | "assistant" | "tool";

/**
 * 工具调用定义
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * AI 消息对象 - 兼容 OpenAI、Anthropic、Google 等主流 AI 服务
 */
export interface AIMessage {
  /** 消息角色 */
  role: AIRole;
  /** 消息内容 */
  content: string;
  /** 工具调用（仅限 assistant 角色）*/
  tool_calls?: ToolCall[];
  /** 工具调用ID（仅限 tool 角色）*/
  tool_call_id?: string;
}
