/**
 * 智能分层提示词领域服务
 * 🏗️ DDD重构: 从SmartLayeredPromptSystem重构的核心智能服务
 */

import { LayeredPrompt, LayeredPromptConfig, LayerResult } from '../entities/LayeredPrompt';
import { PromptXRole } from '../entities/PromptXRole';
import { PromptContent } from '../value-objects/PromptContent';
import { TokenUsage } from '../value-objects/TokenUsage';
import { RoleActivationService } from './RoleActivationService';
import { RoleId } from '../value-objects/RoleId';

export interface ConversationContext {
  sessionId: string;
  currentModel: string;
  activeRole?: string;
  chatHistory?: any[];
  maxTokens?: number;
}

export interface UIInjectionContext {
  selectedRole?: string;
  specialModes?: Record<string, boolean>;
  userIntent?: string;
}

export interface LayerProcessor {
  name: string;
  process(context: any): Promise<LayerResult>;
}

export interface SmartPromptResponse {
  layeredPrompt: LayeredPrompt;
  finalContent: PromptContent;
  tokenUsage: TokenUsage;
  roleStatus: {
    activeRole: string | null;
    isActivated: boolean;
    roleContent?: string;
  };
  toolsStatus: {
    toolsCount: number;
    availableServers: string[];
  };
  metadata: {
    layers: string[];
    totalLength: number;
    buildTime: number;
  };
}

/**
 * 智能分层提示词服务
 * 重构后的4层架构：角色监控 -> 历史上下文 -> 工具集成 -> 当前消息
 */
export class SmartLayeredPromptService {
  private readonly layerProcessors = new Map<string, LayerProcessor>();

  constructor(
    private readonly roleActivationService: RoleActivationService,
    private readonly tokenCounter: any, // TokenCounter依赖
    private readonly eventPublisher: (event: any) => void
  ) {
    this.initializeProcessors();
  }

  /**
   * 核心方法：构建智能分层提示词
   */
  async buildSmartPrompt(
    userInput: string,
    context: ConversationContext,
    availableTools?: any[],
    uiContext?: UIInjectionContext
  ): Promise<SmartPromptResponse> {
    const startTime = Date.now();

    // 创建分层提示词实体
    const config = this.createLayeredPromptConfig(context);
    const layeredPrompt = LayeredPrompt.create(config);

    try {
      // 1. 激活或获取角色
      const activeRole = await this.ensureRoleActivation(context, uiContext);
      
      // 2. 执行各层级处理
      await this.executeLayerProcessing(layeredPrompt, {
        userInput,
        context,
        activeRole,
        availableTools,
        uiContext
      });

      // 3. 生成最终提示词内容
      const finalContent = await this.generateFinalPrompt(layeredPrompt, activeRole, {
        userInput,
        context,
        availableTools,
        uiContext
      });

      // 4. 计算Token使用情况
      const tokenUsage = this.calculateTokenUsage(finalContent, context.currentModel);

      // 5. 检查是否需要压缩
      const compressionTriggered = tokenUsage.needsCompression();
      if (compressionTriggered) {
        // TODO: 实现压缩逻辑
        console.warn('Token使用量过高，建议启用压缩');
      }

      // 6. 完成构建
      const buildTime = Date.now() - startTime;
      layeredPrompt.complete(finalContent, tokenUsage, buildTime, compressionTriggered);

      // 7. 构建响应
      return this.createSmartPromptResponse(
        layeredPrompt,
        activeRole,
        availableTools || [],
        buildTime
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      layeredPrompt.fail([errorMessage]);
      throw error;
    }
  }

  /**
   * 基于角色内容构建系统提示词（简化版本）
   */
  async buildSystemPromptFromRole(
    roleContent: string,
    userInput: string,
    context: ConversationContext,
    availableTools?: any[],
    uiContext?: UIInjectionContext
  ): Promise<string> {
    // 收集业务数据
    const businessData = await this.collectBusinessData(
      userInput,
      context,
      availableTools,
      uiContext
    );

    // 使用PromptContent进行变量注入
    const promptContent = PromptContent.fromString(roleContent);
    const injectedContent = promptContent.inject(businessData);

    return injectedContent.content;
  }

  /**
   * 确保角色激活
   */
  private async ensureRoleActivation(
    context: ConversationContext,
    uiContext?: UIInjectionContext
  ): Promise<PromptXRole> {
    const roleId = new RoleId(context.activeRole || uiContext?.selectedRole || 'deechat-assistant');

    // 检查是否已激活
    if (this.roleActivationService.isRoleActive(roleId)) {
      return this.roleActivationService.getCurrentRole()!;
    }

    // 激活角色
    const activationContext = {
      sessionId: context.sessionId,
      currentModel: context.currentModel,
      conversationHistory: context.chatHistory || [],
      uiContext
    };

    return await this.roleActivationService.activateRole(roleId, activationContext);
  }

  /**
   * 执行层级处理
   */
  private async executeLayerProcessing(
    layeredPrompt: LayeredPrompt,
    processingContext: any
  ): Promise<void> {
    const enabledLayers = layeredPrompt.getEnabledLayers();

    for (const layerName of enabledLayers) {
      const processor = this.layerProcessors.get(layerName);
      
      if (processor) {
        try {
          const layerResult = await processor.process(processingContext);
          layeredPrompt.addLayerResult(layerResult);
        } catch (error) {
          console.error(`层级 ${layerName} 处理失败:`, error);
          // 继续处理其他层级
        }
      }
    }
  }

  /**
   * 生成最终提示词
   */
  private async generateFinalPrompt(
    layeredPrompt: LayeredPrompt,
    activeRole: PromptXRole,
    context: any
  ): Promise<PromptContent> {
    // 收集所有层级的内容
    const layerContents: string[] = [];
    
    layeredPrompt.layers.forEach((layerResult) => {
      if (layerResult.content.length > 0) {
        layerContents.push(layerResult.content.content);
      }
    });

    // 收集业务数据
    const businessData = await this.collectBusinessData(
      context.userInput,
      context.context,
      context.availableTools,
      context.uiContext
    );

    // 使用角色内容生成最终提示词
    return activeRole.generatePrompt(businessData);
  }

  /**
   * 收集业务数据
   */
  private async collectBusinessData(
    userInput: string,
    context: ConversationContext,
    availableTools?: any[],
    uiContext?: UIInjectionContext
  ): Promise<Record<string, any>> {
    const businessData: Record<string, any> = {};

    // 基本信息
    businessData.USER_INPUT = userInput;
    businessData.SESSION_ID = context.sessionId;
    businessData.CURRENT_MODEL = context.currentModel;

    // 历史对话
    if (context.chatHistory && context.chatHistory.length > 0) {
      businessData.HISTORY_CONTEXT = 'true';
      const recentHistory = context.chatHistory.slice(-5); // 最近5条
      businessData.HISTORY_SUMMARY = recentHistory
        .map((msg: any) => `${msg.role}: ${msg.content}`)
        .join('\n');
    }

    // 工具信息
    if (availableTools && availableTools.length > 0) {
      businessData.TOOL_INTEGRATION = 'true';
      businessData.AVAILABLE_TOOLS_COUNT = availableTools.length;
      businessData.AVAILABLE_TOOLS_DETAILED = availableTools
        .map(tool => `- ${tool.name}: ${tool.description || ''}`)
        .join('\n');
    }

    // UI上下文
    if (uiContext) {
      businessData.UI_CONTEXT = 'true';
      if (uiContext.selectedRole) {
        businessData.SELECTED_ROLE = uiContext.selectedRole;
      }
      if (uiContext.userIntent) {
        businessData.USER_INTENT = uiContext.userIntent;
      }
    }

    // Token状态
    try {
      const currentTokens = this.tokenCounter?.countTokens?.(userInput, context.currentModel)?.tokens || 0;
      businessData.CURRENT_TOKENS = currentTokens;
    } catch (error) {
      businessData.CURRENT_TOKENS = 0;
    }

    // 构建智能分层内容
    const contentParts = [];
    
    if (businessData.HISTORY_CONTEXT) {
      contentParts.push(`## 📚 对话历史\n${businessData.HISTORY_SUMMARY}`);
    }
    
    if (businessData.TOOL_INTEGRATION) {
      contentParts.push(`## 🔧 可用工具 (${businessData.AVAILABLE_TOOLS_COUNT}个)\n${businessData.AVAILABLE_TOOLS_DETAILED}`);
    }

    businessData.SMART_LAYERED_CONTENT = contentParts.join('\n\n');

    return businessData;
  }

  /**
   * 计算Token使用情况
   */
  private calculateTokenUsage(content: PromptContent, modelKey: string): TokenUsage {
    try {
      const tokenResult = this.tokenCounter?.countTokens?.(content.content, modelKey);
      const currentTokens = tokenResult?.tokens || content.length / 4; // 简单估算
      
      // 获取模型的最大Token限制
      const modelConfig = this.tokenCounter?.getModelConfig?.(modelKey);
      const maxTokens = modelConfig?.maxContextLength || 200000;
      
      return new TokenUsage(currentTokens, maxTokens, modelKey);
    } catch (error) {
      console.error('Token计算失败:', error);
      return TokenUsage.default();
    }
  }

  /**
   * 创建分层提示词配置
   */
  private createLayeredPromptConfig(context: ConversationContext): LayeredPromptConfig {
    return {
      sessionId: context.sessionId,
      modelKey: context.currentModel,
      maxTokens: context.maxTokens || 200000,
      layers: {
        roleMonitoring: { enabled: true, priority: 1, cacheEnabled: true },
        historyContext: { enabled: true, priority: 2, cacheEnabled: true },
        toolIntegration: { enabled: true, priority: 3, cacheEnabled: false },
        currentMessage: { enabled: true, priority: 4, cacheEnabled: false }
      }
    };
  }

  /**
   * 创建智能提示词响应
   */
  private createSmartPromptResponse(
    layeredPrompt: LayeredPrompt,
    activeRole: PromptXRole,
    availableTools: any[],
    buildTime: number
  ): SmartPromptResponse {
    return {
      layeredPrompt,
      finalContent: layeredPrompt.finalContent!,
      tokenUsage: layeredPrompt.tokenUsage!,
      roleStatus: {
        activeRole: activeRole.getDisplayName(),
        isActivated: activeRole.isActivated,
        roleContent: activeRole.content.content.substring(0, 200) + '...'
      },
      toolsStatus: {
        toolsCount: availableTools.length,
        availableServers: [...new Set(availableTools.map(t => t.serverName || 'unknown'))]
      },
      metadata: {
        layers: layeredPrompt.getExecutionOrder(),
        totalLength: layeredPrompt.finalContent?.length || 0,
        buildTime
      }
    };
  }

  /**
   * 初始化层级处理器
   */
  private initializeProcessors(): void {
    // TODO: 实现具体的层级处理器
    // 这里暂时使用占位符，在后续实现中会创建具体的处理器
    
    this.layerProcessors.set('roleMonitoring', {
      name: 'roleMonitoring',
      process: async (context) => ({
        layerName: 'roleMonitoring',
        content: PromptContent.fromString('角色监控层内容'),
        tokens: 100,
        executionTime: 10,
        metadata: { status: 'active' }
      })
    });

    // 其他处理器将在后续实现...
  }
}