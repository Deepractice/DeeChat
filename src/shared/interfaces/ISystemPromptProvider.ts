/**
 * 系统提示词提供器接口定义
 */

/**
 * 提示词片段
 */
export interface PromptSegment {
  /** 唯一标识 */
  id: string;
  /** 提示词内容 */
  content: string;
  /** 是否启用 */
  enabled: boolean;
  /** 优先级（数字越大越优先） */
  priority?: number;
  /** 动态条件（返回true时才包含此片段） */
  condition?: () => boolean;
}

/**
 * 提示词片段提供者
 */
export interface PromptProvider {
  /** 获取提示词片段列表 */
  getSegments(): PromptSegment[];
}

/**
 * 系统提示词提供器
 */
export interface ISystemPromptProvider {
  /** 获取基础系统提示词 */
  getBasePrompt(): string;
  
  /** 设置基础系统提示词 */
  setBasePrompt(prompt: string): void;
  
  /** 注册提示词提供者 */
  registerProvider(provider: PromptProvider): void;
  
  /** 添加单个提示词片段 */
  addSegment(segment: PromptSegment): void;
  
  /** 移除提示词片段 */
  removeSegment(id: string): void;
  
  /** 获取所有有效的提示词片段 */
  getSegments(): PromptSegment[];
  
  /** 构建完整的系统提示词 */
  buildSystemPrompt(): string;
  
  /** 清除所有片段（不包括基础提示词） */
  clearSegments(): void;
}