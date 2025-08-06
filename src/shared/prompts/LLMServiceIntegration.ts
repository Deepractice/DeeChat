/**
 * LLMService集成补丁
 * 为LangChainLLMService添加DeeChat提示词系统集成
 */

import { enhancedSystemPromptProvider, initializeDeeChatPrompts } from './index';
import { DeeChatFeature } from './FeatureContextProvider';

/**
 * LLMService提示词集成助手
 * 提供与LLMService集成的便利方法
 */
export class LLMServicePromptIntegration {
  private static instance: LLMServicePromptIntegration;
  private initialized: boolean = false;

  private constructor() {}

  static getInstance(): LLMServicePromptIntegration {
    if (!LLMServicePromptIntegration.instance) {
      LLMServicePromptIntegration.instance = new LLMServicePromptIntegration();
    }
    return LLMServicePromptIntegration.instance;
  }

  /**
   * 初始化LLM服务的提示词系统
   */
  async initializeLLMServicePrompts(): Promise<void> {
    if (this.initialized) {
      console.log('LLM服务提示词系统已初始化，跳过重复初始化');
      return;
    }

    try {
      // 初始化DeeChat提示词系统
      await initializeDeeChatPrompts();
      
      console.log('✅ LLM服务提示词系统初始化完成');
      this.initialized = true;
    } catch (error) {
      console.error('❌ LLM服务提示词系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取增强的提示词提供器
   */
  getEnhancedPromptProvider() {
    return enhancedSystemPromptProvider;
  }

  /**
   * 为LLM调用设置上下文
   */
  async setupLLMContext(options: {
    feature?: DeeChatFeature;
    promptxRole?: string;
    roleDescription?: string;
    roleCapabilities?: string[];
    mcpTools?: string[];
    customSegments?: Array<{id: string; content: string; priority?: number}>;
  } = {}): Promise<void> {
    // 确保初始化
    await this.ensureInitialized();

    // 设置功能上下文
    if (options.feature) {
      enhancedSystemPromptProvider.setFeatureContext(options.feature);
    }

    // 设置PromptX角色
    if (options.promptxRole) {
      enhancedSystemPromptProvider.setPromptXRole(
        options.promptxRole,
        options.roleDescription,
        options.roleCapabilities
      );
    }

    // 更新MCP工具状态
    if (options.mcpTools) {
      enhancedSystemPromptProvider.updateMCPToolStatus(options.mcpTools);
    }

    // 添加自定义片段
    if (options.customSegments) {
      options.customSegments.forEach(segment => {
        enhancedSystemPromptProvider.addCustomSegment(
          segment.id,
          segment.content,
          segment.priority || 100
        );
      });
    }
  }

  /**
   * 清理LLM上下文
   */
  cleanupLLMContext(): void {
    enhancedSystemPromptProvider.clearPromptXRole();
    enhancedSystemPromptProvider.setFeatureContext('chat');
  }

  /**
   * 获取当前LLM系统提示词
   */
  async getCurrentLLMSystemPrompt(): Promise<string> {
    await this.ensureInitialized();
    return enhancedSystemPromptProvider.buildSystemPrompt();
  }

  /**
   * 确保初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeLLMServicePrompts();
    }
  }

  /**
   * 获取系统状态（调试用）
   */
  getSystemStatus() {
    return {
      initialized: this.initialized,
      promptProvider: enhancedSystemPromptProvider.getDeeChatConfiguration(),
      stats: enhancedSystemPromptProvider.getPromptStats()
    };
  }
}

/**
 * 全局LLM服务提示词集成实例
 */
export const llmPromptIntegration = LLMServicePromptIntegration.getInstance();

/**
 * 便利函数：快速设置聊天模式LLM上下文
 */
export async function setupChatContext(mcpTools?: string[]): Promise<void> {
  await llmPromptIntegration.setupLLMContext({
    feature: 'chat',
    mcpTools
  });
}

/**
 * 便利函数：快速设置文件管理模式LLM上下文
 */
export async function setupFileManagerContext(mcpTools?: string[]): Promise<void> {
  await llmPromptIntegration.setupLLMContext({
    feature: 'file-manager',
    mcpTools
  });
}

/**
 * 便利函数：快速设置资源管理模式LLM上下文
 */
export async function setupResourcesContext(mcpTools?: string[]): Promise<void> {
  await llmPromptIntegration.setupLLMContext({
    feature: 'resources',
    mcpTools
  });
}

/**
 * 便利函数：快速设置带角色的LLM上下文
 */
export async function setupRoleContext(
  role: string,
  description?: string,
  capabilities?: string[],
  mcpTools?: string[]
): Promise<void> {
  await llmPromptIntegration.setupLLMContext({
    feature: 'chat',
    promptxRole: role,
    roleDescription: description,
    roleCapabilities: capabilities,
    mcpTools
  });
}

/**
 * 便利函数：获取LLM系统提示词（用于调试）
 */
export async function getLLMSystemPrompt(): Promise<string> {
  return await llmPromptIntegration.getCurrentLLMSystemPrompt();
}

/**
 * 便利函数：清理LLM上下文
 */
export function cleanupLLMContext(): void {
  llmPromptIntegration.cleanupLLMContext();
}