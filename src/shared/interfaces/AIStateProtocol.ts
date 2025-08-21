/**
 * AI状态机协议定义
 * 用于解决对话中断问题，实现自动对话续接
 */

/**
 * AI状态枚举
 */
export enum AIState {
  /** AI正在工作中，需要继续对话 */
  WORKING = 'working',
  /** 任务已完成 */
  COMPLETED = 'completed', 
  /** 等待用户输入 */
  WAITING_INPUT = 'waiting_input',
  /** 发生错误 */
  ERROR = 'error'
}

/**
 * AI状态输出接口
 * AI在响应末尾输出此格式的状态信息
 */
export interface AIStateOutput {
  /** 当前AI状态 */
  aiState: AIState;
  /** 任务进度百分比 (0-100) */
  taskProgress: number;
  /** 下一步动作描述 */
  nextAction: string;
  /** 错误信息（仅当状态为error时） */
  errorMessage?: string;
  /** 任务总结（仅当状态为completed时） */
  taskSummary?: string;
}

/**
 * 状态路由决策接口
 */
export interface StateRoutingDecision {
  /** 是否应该继续对话 */
  shouldContinue: boolean;
  /** 下一轮对话的消息内容 */
  nextMessage?: string;
  /** 延迟时间（毫秒） */
  delayMs?: number;
  /** 路由原因说明 */
  reason?: string;
}

/**
 * 对话循环配置
 */
export interface ConversationLoopConfig {
  /** 最大迭代次数，防止无限循环 */
  maxIterations: number;
  /** 每次迭代间的延迟（毫秒） */
  iterationDelay: number;
  /** 是否启用状态机功能 */
  enableStateMachine: boolean;
}

/**
 * 对话循环结果
 */
export interface ConversationLoopResult {
  /** 最终AI响应 */
  finalResponse: string;
  /** 总迭代次数 */
  totalIterations: number;
  /** 最终AI状态 */
  finalState: AIState;
  /** 所有工具执行记录 */
  allToolExecutions: any[];
  /** 循环停止原因 */
  stopReason: 'completed' | 'max_iterations' | 'error' | 'user_input_needed';
}

/**
 * AI状态机事件接口
 */
export interface AIStateMachineEvent {
  /** 事件类型 */
  type: 'state_change' | 'progress_update' | 'iteration_start' | 'iteration_end';
  /** 当前状态 */
  currentState: AIState;
  /** 迭代次数 */
  iteration: number;
  /** 进度信息 */
  progress: number;
  /** 事件数据 */
  data?: any;
  /** 时间戳 */
  timestamp: number;
}