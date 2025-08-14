/**
 * DeeChat智能分层提示词系统 - 主集成类（3层架构版本）
 * 
 * 这是系统的核心集成类，协调三个层级的工作：
 * 第1层：角色状态监控层（增强版） - 保持AI角色身份，监控token使用，集成角色加载和UI意图处理
 * 第2层：历史对话管理层 - 智能压缩历史，保持对话连贯性
 * 第3层：当前消息层（增强版） - 处理当前用户输入和UI意图注入
 */

import log from 'electron-log';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { TokenCounter } from './components/TokenCounter';
import { RoleStatusMonitorLayer, RoleStatusResult } from './layers/RoleStatusMonitorLayer';
import type { ConversationContext, UIInjectionContext } from './layers/RoleStatusMonitorLayer';

// 重新导出类型供外部使用
export type { ConversationContext, UIInjectionContext };
import { HistoryContextLayer, CompressionResult } from './layers/HistoryContextLayer';
import { CurrentMessageLayer } from './layers/CurrentMessageLayer';
import { MCPToolEntity } from '../entities/MCPToolEntity';

// 简化的MCP工具接口（用于向后兼容）
interface MCPTool {
  name: string;
  description?: string;
  serverName: string;
  serverId?: string;
  inputSchema?: any;
}


// 简化的系统配置接口
export interface SmartPromptSystemConfig {
  defaultModel: string;
  maxRetainedRounds: number;
  compressionThreshold: number;
}

// 3层架构系统响应（更新版）
export interface SmartPromptResponse {
  messages: BaseMessage[];
  compressionTriggered: boolean;
  totalTokens: number;
  uiIntentProcessed?: boolean; // 新增：是否处理了UI意图
  // 🔥 新增：角色状态跟踪
  roleStatus?: {
    previousRole?: string;      // 之前的角色
    currentRole?: string;       // 当前请求的角色
    activatedRole?: string;     // AI实际激活的角色
    roleChanged: boolean;       // 是否发生角色变化
  };
}

// 3层级执行结果（移除第4层）
interface LayerExecutionResult {
  layer1: RoleStatusResult;
  layer2: string;
  layer3: HumanMessage;
  compressionResult?: CompressionResult;
}

/**
 * 将MCPToolEntity适配为MCPTool格式（XML转换器需要的格式）
 * @param entity MCPToolEntity实例
 * @returns MCPTool格式的对象
 */

/**
 * DeeChat智能分层提示词系统（3层架构版本）
 * 
 * 核心创新：
 * 1. 3层架构避免稀疏注意力问题
 * 2. AI自主压缩历史对话保持连贯性
 * 3. 智能缓存机制大幅减少token重复使用
 * 4. 实时角色状态监控防止身份丢失
 * 5. **新增**：UI驱动的角色激活和意图注入
 */
export class SmartLayeredPromptSystem {
  private config: SmartPromptSystemConfig;
  
  // 核心组件
  private tokenCounter: TokenCounter;
  
  // 3个层级（移除第4层）
  private layer1: RoleStatusMonitorLayer;
  private layer2: HistoryContextLayer;
  private layer3: CurrentMessageLayer;

  constructor(
    config?: Partial<SmartPromptSystemConfig>,
    llmFactory?: (modelKey: string) => Promise<BaseChatModel>
  ) {
    // 默认配置
    this.config = {
      defaultModel: 'claude-3-5-sonnet',
      maxRetainedRounds: 3,
      compressionThreshold: 100000,
      ...config
    };

    // 初始化核心组件
    this.tokenCounter = TokenCounter.getInstance();
    
    // 初始化3个层级
    this.layer1 = new RoleStatusMonitorLayer();
    this.layer2 = new HistoryContextLayer(llmFactory);
    this.layer3 = new CurrentMessageLayer();

    log.info('🎯 [SmartLayeredPrompt] 智能分层提示词系统（3层架构）初始化完成');
    log.info(`📊 [SmartLayeredPrompt] 配置: 模型=${this.config.defaultModel}, 最大保留轮次=${this.config.maxRetainedRounds}, 压缩阈值=${this.config.compressionThreshold}`);
  }

  /**
   * 核心方法：构建智能分层提示词（3层架构 + UI意图注入版本）
   * @param userInput 用户输入
   * @param conversationContext 对话上下文
   * @param baseSystemPrompt 基础系统提示词
   * @param availableTools 可用工具列表（支持MCPToolEntity格式）
   * @param uiContext UI意图注入上下文
   * @returns 智能构建的消息数组和元数据
   */
  async buildMessages(
    userInput: string,
    conversationContext: ConversationContext,
    baseSystemPrompt: string = '',
    availableTools?: MCPTool[] | MCPToolEntity[],
    uiContext?: UIInjectionContext
  ): Promise<SmartPromptResponse> {

    try {
      const uiInfo = uiContext ? `UI角色: ${uiContext.selectedRole || '无'}, 特殊模式: ${Object.keys(uiContext.specialModes || {}).filter(k => (uiContext.specialModes as any)?.[k]).join('、') || '无'}` : '无UI注入';
      log.info(`🔄 [智能提示词3层] 开始构建 - 会话: ${conversationContext.sessionId.slice(0, 8)}, 角色: ${conversationContext.activeRole || '未选择'}, 模型: ${conversationContext.currentModel}, ${uiInfo}`);

      // 适配工具格式：将MCPToolEntity转换为MCPTool（如果需要）
      let adaptedTools: MCPTool[] | undefined;
      if (availableTools && availableTools.length > 0) {
        // 检查第一个元素来判断是哪种格式
        const firstTool = availableTools[0];
        if ('inputSchema' in firstTool) {
          // 这是MCPToolEntity[]，需要适配
          log.info(`🔄 [工具适配] 检测到MCPToolEntity格式，正在适配 ${availableTools.length} 个工具`);
          // 简单转换MCPToolEntity到MCPTool格式
          adaptedTools = (availableTools as MCPToolEntity[]).map(entity => ({
            name: entity.name,
            description: entity.description || '',
            serverName: entity.serverName,
            serverId: entity.serverId,
            inputSchema: entity.inputSchema
          }));
        } else {
          // 这已经是MCPTool[]格式
          adaptedTools = availableTools as MCPTool[];
        }
      }

      // 执行3层处理（移除第4层）
      const layerResults = await this.executeAllLayers(
        userInput,
        conversationContext,
        baseSystemPrompt,
        adaptedTools,
        uiContext
      );

      // 构建最终消息数组
      const messages = await this.buildFinalMessages(layerResults);

      // 计算token统计
      const tokenStats = this.calculateTokenStats(messages, conversationContext.currentModel);

      // 更新token统计
      this.tokenCounter.updateConversationStats(
        conversationContext.sessionId,
        tokenStats.systemPromptTokens,
        tokenStats.userMessageTokens,
        0 // AI响应tokens稍后更新
      );

      // 记录角色激活（支持UI驱动）
      const activeRole = uiContext?.selectedRole || conversationContext.activeRole;
      if (activeRole) {
        this.layer1.recordRoleActivation(conversationContext.sessionId, activeRole);
      }

      // 🔥 构建角色状态跟踪信息
      const previousRole = conversationContext.activeRole;
      const currentRole = uiContext?.selectedRole || conversationContext.activeRole;
      const activatedRole = conversationContext.toolActivationContext?.roleId;
      const roleChanged = !!(
        (currentRole && currentRole !== previousRole) ||
        (activatedRole && activatedRole !== currentRole)
      );

      // 构建3层架构响应
      const response: SmartPromptResponse = {
        messages,
        compressionTriggered: !!layerResults.compressionResult,
        totalTokens: tokenStats.totalTokens,
        uiIntentProcessed: !!uiContext,
        // 🔥 包含角色状态信息
        roleStatus: {
          previousRole,
          currentRole,
          activatedRole,
          roleChanged
        }
      };

      log.info(`✅ [SmartLayeredPrompt3层] 会话 ${conversationContext.sessionId.slice(0, 8)} 提示词构建完成 (${tokenStats.totalTokens} tokens, UI处理: ${!!uiContext})`);

      return response;

    } catch (error) {
      log.error(`❌ [SmartLayeredPrompt] 会话 ${conversationContext.sessionId.slice(0, 8)} 提示词构建失败:`, error);
      
      // 降级到基础模式
      const fallbackMessages = [
        new SystemMessage(baseSystemPrompt || '你是一个有帮助的AI助手。'),
        new HumanMessage(userInput)
      ];

      const tokenStats = this.calculateTokenStats(fallbackMessages, conversationContext.currentModel);

      return {
        messages: fallbackMessages,
        compressionTriggered: false,
        totalTokens: tokenStats.totalTokens
      };
    }
  }

  /**
   * 执行所有层级处理（3层架构版本）
   */
  private async executeAllLayers(
    userInput: string,
    conversationContext: ConversationContext,
    baseSystemPrompt: string,
    availableTools?: MCPTool[],
    uiContext?: UIInjectionContext
  ): Promise<LayerExecutionResult> {
    
    // 第1层：角色状态监控 + 角色加载 + UI意图处理（集成原第4层功能）
    const layer1Result = await this.layer1.render(
      conversationContext, 
      baseSystemPrompt, 
      userInput,
      uiContext,
      availableTools
    );
    log.info(`🎭 [3层架构-L1] 第1层增强处理完成: 角色渲染=${layer1Result.roleInfo.roleRendered}, UI处理=${!!uiContext}`);

    // 如果有工具，记录工具数量（实际工具绑定在LangChain模型层处理）
    if (availableTools && availableTools.length > 0) {
      log.info(`🔧 [3层架构-L1] 检测到 ${availableTools.length} 个可用工具，将通过LangChain标准调用`);
    }

    // 检查是否需要压缩历史对话
    let compressionResult: CompressionResult | undefined;
    if (layer1Result.recommendations.action === 'compress_history' ||
        layer1Result.recommendations.action === 'emergency_compress') {
      
      log.info(`🔄 [3层架构-L2] 触发历史压缩: ${layer1Result.recommendations.reason}`);
      compressionResult = await this.layer2.compressHistoryIfNeeded(
        conversationContext.sessionId,
        layer1Result.recommendations.urgency === 'critical'
      ) || undefined;
    }

    // 第2层：渲染历史上下文
    const layer2Result = this.layer2.render(conversationContext.sessionId);
    log.info(`📚 [3层架构-L2] 第2层历史上下文处理完成`);

    // 第3层：处理当前消息 + UI意图注入
    const layer3Result = this.layer3.render(userInput, uiContext);
    log.info(`📝 [3层架构-L3] 第3层当前消息处理完成: UI注入=${!!uiContext}`);

    return {
      layer1: layer1Result,
      layer2: layer2Result,
      layer3: layer3Result,
      compressionResult
    };
  }

  /**
   * 构建最终的消息数组（3层架构版本）
   */
  private async buildFinalMessages(layerResults: LayerExecutionResult): Promise<BaseMessage[]> {
    log.info('🔄 [消息构建3层] 构建最终消息数组，使用3层架构');
    
    // 第1层已经包含了角色化提示词（集成了原第4层功能）
    let systemContent = layerResults.layer1.systemPrompt;
    
    // 添加第2层的历史上下文
    if (layerResults.layer2.trim().length > 0) {
      systemContent += '\n\n# 📚 CONVERSATION_HISTORY\n' + layerResults.layer2;
      log.info('📚 [消息构建3层] 已添加历史上下文');
    }

    const messages = [
      new SystemMessage(systemContent),
      layerResults.layer3
    ];

    log.info(`✅ [消息构建3层] 最终消息数组构建完成: SystemMessage(${systemContent.length}字符) + HumanMessage`);
    
    return messages;
  }

  /**
   * 计算token统计
   */
  private calculateTokenStats(messages: BaseMessage[], modelKey: string): {
    totalTokens: number;
    systemPromptTokens: number;
    userMessageTokens: number;
  } {
    let systemPromptTokens = 0;
    let userMessageTokens = 0;

    for (const message of messages) {
      const content = message.content as string;
      const tokens = this.tokenCounter.countTokens(content, modelKey).tokens;

      if (message instanceof SystemMessage) {
        systemPromptTokens += tokens;
      } else if (message instanceof HumanMessage) {
        userMessageTokens += tokens;
      }
    }

    return {
      totalTokens: systemPromptTokens + userMessageTokens,
      systemPromptTokens,
      userMessageTokens
    };
  }



  /**
   * 🔥 核心方法：带工具调用结果的智能消息构建（动态内容注入）
   * 解决角色激活后内容丢失的关键问题
   * @param userInput 用户输入
   * @param conversationContext 对话上下文
   * @param toolResults 工具调用结果数组
   * @param baseSystemPrompt 基础系统提示词
   * @param availableTools 可用工具列表
   * @param uiContext UI意图注入上下文
   * @returns 智能构建的消息数组和元数据
   */
  async buildMessagesWithToolResults(
    userInput: string,
    conversationContext: ConversationContext,
    toolResults: any[], // ToolExecution[]类型
    baseSystemPrompt: string = '',
    availableTools?: MCPTool[] | MCPToolEntity[],
    uiContext?: UIInjectionContext
  ): Promise<SmartPromptResponse> {
    
    log.info(`🔥 [工具结果注入] 开始处理 ${toolResults.length} 个工具调用结果 - 会话: ${conversationContext.sessionId.slice(0, 8)}`);
    
    // 🔥 检测角色激活工具并注入内容到上下文
    const roleActivationResult = toolResults.find(tool => tool.toolName === 'promptx_action');
    if (roleActivationResult && roleActivationResult.result) {
      log.info(`🎭 [角色内容注入] 检测到角色激活工具调用，注入内容长度: ${JSON.stringify(roleActivationResult.result).length} 字符`);
      
      // 将角色内容注入到会话上下文 - 关键修复点
      const enhancedContext: ConversationContext = {
        ...conversationContext,
        roleContent: roleActivationResult.result, // 🔥 注入15891字符的角色内容
        activeRole: roleActivationResult.params?.role || conversationContext.activeRole,
        lastRoleActivationTime: new Date(),
        toolActivationContext: {
          toolName: roleActivationResult.toolName,
          activatedAt: new Date(),
          contentLength: JSON.stringify(roleActivationResult.result).length,
          roleId: roleActivationResult.params?.role
        }
      };
      
      log.info(`✅ [角色内容注入] 角色内容已注入上下文 - 角色: ${enhancedContext.activeRole}, 内容长度: ${enhancedContext.toolActivationContext?.contentLength}`);
      
      // 使用增强后的上下文重新构建消息
      return await this.buildMessages(userInput, enhancedContext, baseSystemPrompt, availableTools, uiContext);
    }
    
    // 如果没有角色激活工具，执行标准流程
    log.info(`📝 [标准流程] 未检测到角色激活工具，执行标准消息构建`);
    return await this.buildMessages(userInput, conversationContext, baseSystemPrompt, availableTools, uiContext);
  }

  /**
   * 添加AI响应到历史记录
   * 在AI回复后调用此方法
   */
  addAIResponse(sessionId: string, userMessage: string, aiResponse: string): void {
    this.layer2.addRound(sessionId, userMessage, aiResponse);
    log.debug(`📝 [SmartLayeredPrompt] 会话 ${sessionId.slice(0, 8)} 已添加新的对话轮次`);
  }

  /**
   * 强制压缩历史对话
   * @param sessionId 会话ID
   * @returns 压缩结果
   */
  async forceCompressHistory(sessionId: string): Promise<CompressionResult | null> {
    log.info(`🔄 [SmartLayeredPrompt] 强制压缩会话 ${sessionId.slice(0, 8)} 的历史对话`);
    return await this.layer2.compressHistoryIfNeeded(sessionId, true);
  }

  /**
   * 获取会话统计信息
   * @param sessionId 会话ID
   * @returns 详细的会话统计
   */
  getSessionStats(sessionId: string): {
    tokenStats: any;
    roleStats: any;
    historyStats: any;
  } {
    return {
      tokenStats: this.tokenCounter.getConversationStats(sessionId),
      roleStats: this.layer1.getMonitorStats(),
      historyStats: this.layer2.getSessionStats(sessionId)
    };
  }

  /**
   * 获取系统整体性能统计
   */
  getSystemPerformanceStats(): {
    layerStats: {
      layer1: any;
      layer2: any;
    };
  } {
    return {
      layerStats: {
        layer1: this.layer1.getMonitorStats(),
        layer2: this.layer2.getLayerStats()
      }
    };
  }

  /**
   * 更新系统配置
   * @param newConfig 新的配置
   */
  updateConfig(newConfig: Partial<SmartPromptSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log.info('⚙️ [SmartLayeredPrompt] 系统配置已更新', newConfig);
  }

  /**
   * 清理过期数据
   * 建议定期调用此方法
   * @param maxAge 最大保留时间（小时）
   */
  cleanup(maxAge: number = 24): void {
    log.info(`🧹 [SmartLayeredPrompt] 开始清理过期数据 (保留${maxAge}小时)`);
    
    this.tokenCounter.cleanupExpiredStats(maxAge);
    this.layer1.cleanupRoleHistory(maxAge);
    this.layer2.cleanupExpiredData(maxAge * 2); // 历史数据保留更久
    // this.layer3.cleanupExpiredStats(maxAge); // CurrentMessageLayer简化版本无此方法
    
    log.info('✅ [SmartLayeredPrompt] 过期数据清理完成');
  }

  /**
   * 获取当前配置
   */
  getConfig(): SmartPromptSystemConfig {
    return { ...this.config };
  }





}