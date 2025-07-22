/**
 * LangChain集成模块
 * 提供ProjectS与LangChain的集成功能
 */

// 核心类
export { LangChainModelFactory } from './LangChainModelFactory';
export { LangChainLLMService } from './LangChainLLMService';

// 提示词模板
export {
  BUILT_IN_TEMPLATES,
  FEW_SHOT_TEMPLATES,
  TemplateManager
} from './PromptTemplates';

// 重新导出LangChain核心类型，方便使用
export type { 
  BaseChatModel 
} from "@langchain/core/language_models/chat_models";

export type { 
  ChatPromptTemplate 
} from "@langchain/core/prompts";

export type { 
  BaseMessage, 
  HumanMessage, 
  SystemMessage, 
  AIMessage 
} from "@langchain/core/messages";
