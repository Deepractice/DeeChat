/**
 * DeeChat智能分层提示词系统 - 主集成类（4层架构版本）
 * 
 * 这是系统的核心集成类，协调四个层级的工作：
 * 第1层：角色状态监控层 - 保持AI角色身份，监控token使用，处理角色加载和UI意图
 * 第2层：历史对话管理层 - 智能压缩历史，保持对话连贯性
 * 第3层：工具集成层 - 发现、格式化、注入MCP工具信息，由AI自主决策工具使用
 * 第4层：当前消息层 - 处理当前用户输入和UI意图注入
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
import { ToolIntegrationLayer, ToolIntegrationResult } from './layers/ToolIntegrationLayer';
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

// 完整的提示词构建响应
export interface SmartPromptResponse {
  messages: BaseMessage[];
  compressionTriggered: boolean;
  totalTokens: number;
  uiIntentProcessed?: boolean; // 新增：是否处理了UI意图
  
  // 🎯 核心：角色状态信息
  roleStatus: {
    activeRole: string | null;           // 当前激活的角色
    isActivated: boolean;                // 角色是否成功激活
    activationSuccess: boolean;          // 角色激活是否成功
    roleContent?: string;                // 角色内容（调试用）
    roleMetadata?: {                     // 角色元数据
      name: string;
      description?: string;
      lastActivated: Date;
    };
    error?: string;                      // 角色激活错误信息
  };
  
  // 🔧 工具状态信息
  toolsStatus: {
    toolsCount: number;                  // 可用工具数量
    availableServers: string[];          // 可用服务器列表
  };
  
  // 📊 构建元数据
  metadata: {
    layers: string[];                    // 执行的层级列表
    totalLength: number;                 // 最终提示词长度
    buildTime: number;                   // 构建耗时（毫秒）
  };
}

// 4层级执行结果
interface LayerExecutionResult {
  layer1: RoleStatusResult;
  layer2: string;
  layer3: ToolIntegrationResult;
  layer4: HumanMessage;
  compressionResult?: CompressionResult;
}

/**
 * 将MCPToolEntity适配为MCPTool格式（XML转换器需要的格式）
 * @param entity MCPToolEntity实例
 * @returns MCPTool格式的对象
 */

/**
 * DeeChat智能分层提示词系统（4层架构版本）
 * 
 * 核心创新：
 * 1. 4层架构职责分离，避免职责混乱
 * 2. 独立的工具集成层，AI自主决策工具使用
 * 3. AI自主压缩历史对话保持连贯性
 * 4. 智能缓存机制大幅减少token重复使用
 * 5. 实时角色状态监控防止身份丢失
 * 6. UI驱动的角色激活和意图注入
 */
export class SmartLayeredPromptSystem {
  private config: SmartPromptSystemConfig;
  
  // 核心组件
  private tokenCounter: TokenCounter;
  
  // 4个层级
  private layer1: RoleStatusMonitorLayer;
  private layer2: HistoryContextLayer;
  private layer3: ToolIntegrationLayer;
  private layer4: CurrentMessageLayer;

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
    
    // 初始化4个层级
    // 🔥 修复：为角色状态监控层注入PromptX服务
    let promptxService;
    try {
      // 获取PromptX服务实例（仅在主进程中有效）
      const { getPromptXLocalService } = require('../../main/services/promptx/PromptXLocalService');
      promptxService = getPromptXLocalService();
    } catch (error) {
      // 在渲染进程中忽略此错误，使用fallback模式
      console.warn('[SmartLayeredPrompt] PromptX服务获取失败，使用fallback模式:', error instanceof Error ? error.message : String(error));
    }
    
    this.layer1 = new RoleStatusMonitorLayer();
    this.layer2 = new HistoryContextLayer(llmFactory);
    this.layer3 = new ToolIntegrationLayer();
    this.layer4 = new CurrentMessageLayer();

    log.info('🎯 [SmartLayeredPrompt] 智能分层提示词系统（4层架构）初始化完成');
    log.info(`📊 [SmartLayeredPrompt] 配置: 模型=${this.config.defaultModel}, 最大保留轮次=${this.config.maxRetainedRounds}, 压缩阈值=${this.config.compressionThreshold}`);
  }

  /**
   * 新方法：基于PromptX角色内容构建系统提示词
   * @param roleContent PromptX角色内容
   * @param userInput 用户输入
   * @param conversationContext 对话上下文  
   * @param availableTools 可用工具列表
   * @param uiContext UI意图注入上下文
   * @returns 完整的系统提示词
   */
  async buildSystemPromptFromRole(
    roleContent: string,
    userInput: string,
    conversationContext: ConversationContext,
    availableTools?: MCPTool[] | MCPToolEntity[],
    uiContext?: UIInjectionContext
  ): Promise<string> {
    log.info(`🎭 [统一提示词] 开始构建 - 会话: ${conversationContext.sessionId.slice(0, 8)}, 角色: ${conversationContext.activeRole || '未选择'}`);

    try {
      // 收集业务数据
      const businessData = await this.collectBusinessData(
        userInput,
        conversationContext,
        availableTools,
        uiContext
      );

      // 使用VariableInjector注入到角色内容
      try {
        const { VariableInjector } = await import('../utils/VariableInjector');
        const finalSystemPrompt = VariableInjector.inject(roleContent, businessData);
        log.info(`🎯 [统一提示词] VariableInjector注入成功，最终提示词长度: ${finalSystemPrompt.length}`);
        return finalSystemPrompt;
      } catch (error) {
        log.warn(`⚠️ [统一提示词] VariableInjector导入失败，使用完整回退注入:`, error);
        
        // 完整的变量注入回退实现
        let result = roleContent;
        
        // 处理所有可能的变量
        Object.keys(businessData).forEach(key => {
          const value = businessData[key as keyof typeof businessData];
          if (value !== undefined) {
            // 处理普通变量 {{VARIABLE_NAME}}
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(pattern, String(value));
            
            // 处理条件变量 {{#VARIABLE}}content{{/VARIABLE}}
            const conditionalPattern = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
            result = result.replace(conditionalPattern, (match, content) => {
              return value && String(value).trim() !== '' ? content.trim() : '';
            });
            
            // 处理反向条件变量 {{^VARIABLE}}content{{/VARIABLE}}
            const inversePattern = new RegExp(`\\{\\{\\^${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
            result = result.replace(inversePattern, (match, content) => {
              return !value || String(value).trim() === '' ? content.trim() : '';
            });
          }
        });
        
        log.info(`🔧 [统一提示词] 回退注入完成，最终提示词长度: ${result.length}`);
        return result;
      }

    } catch (error) {
      log.error(`❌ [统一提示词] 构建失败:`, error);
      // 失败时返回原始角色内容
      return roleContent;
    }
  }

  /**
   * 收集业务数据用于注入
   * @param userInput 用户输入
   * @param conversationContext 对话上下文
   * @param availableTools 可用工具列表
   * @param uiContext UI上下文
   * @returns 业务数据对象
   */
  private async collectBusinessData(
    userInput: string,
    conversationContext: ConversationContext,
    availableTools?: MCPTool[] | MCPToolEntity[],
    uiContext?: UIInjectionContext
  ): Promise<Record<string, any>> {
    const businessData: Record<string, any> = {};

    try {
      // Layer1: 角色状态监控数据
      if (this.layer1) {
        const roleStatusResult = await this.layer1.render(conversationContext, '', userInput, uiContext);
        businessData.ROLE_STATUS = roleStatusResult.roleStatus;
        businessData.ACTIVE_ROLE = roleStatusResult.roleInfo.activeRole;
        businessData.CURRENT_TOKENS = roleStatusResult.tokenStatus.current;
        businessData.CONTEXT_USAGE_PERCENTAGE = Math.round(roleStatusResult.tokenStatus.percentage);
        businessData.CONTEXT_LEVEL = roleStatusResult.tokenStatus.level;

        if (roleStatusResult.recommendations.action !== 'continue') {
          businessData.SYSTEM_RECOMMENDATIONS = 'true';
          businessData.RECOMMENDED_ACTION = roleStatusResult.recommendations.action;
          businessData.URGENCY_LEVEL = roleStatusResult.recommendations.urgency;
        }
      }

      // Layer2: 历史对话数据
      if (this.layer2) {
        const historyResult = this.layer2.render(conversationContext.sessionId);
        if (historyResult && historyResult.trim()) {
          businessData.HISTORY_CONTEXT = 'true';
          businessData.HISTORY_SUMMARY = historyResult;
        }
      }

      // Layer3: 工具集成数据
      if (this.layer3 && availableTools && availableTools.length > 0) {
        // 适配工具格式
        let adaptedTools: MCPTool[] = [];
        if (availableTools.length > 0) {
          const firstTool = availableTools[0];
          if ('inputSchema' in firstTool) {
            adaptedTools = (availableTools as MCPToolEntity[]).map(entity => ({
              name: entity.name,
              description: entity.description || '',
              serverName: entity.serverName,
              serverId: entity.serverId,
              inputSchema: entity.inputSchema
            }));
          } else {
            adaptedTools = availableTools as MCPTool[];
          }
        }

        const toolResult = await this.layer3.render(adaptedTools);
        if (toolResult.toolsPrompt && toolResult.toolsPrompt.trim()) {
          businessData.TOOL_INTEGRATION = 'true';
          businessData.AVAILABLE_TOOLS_DETAILED = toolResult.toolsPrompt;
        }
      }

      // Layer4: 当前消息处理数据
      if (this.layer4 && uiContext) {
        const messageResult = await this.layer4.render(userInput, uiContext);
        if (messageResult.content !== userInput) {
          businessData.CURRENT_MESSAGE_CONTEXT = 'true';
          businessData.UI_INTENT_DESCRIPTION = '界面驱动的特殊需求处理';
        }
      }

      // 构建SMART_LAYERED_CONTENT
      const contentParts = [];
      
      if (businessData.HISTORY_CONTEXT) {
        contentParts.push(`## 📚 对话历史\n${businessData.HISTORY_SUMMARY}`);
      }
      
      if (businessData.TOOL_INTEGRATION) {
        contentParts.push(businessData.AVAILABLE_TOOLS_DETAILED);
      }
      
      if (businessData.ROLE_STATUS) {
        contentParts.push(`## 📊 系统状态\n- 角色: ${businessData.ACTIVE_ROLE}\n- Token使用: ${businessData.CURRENT_TOKENS} (${businessData.CONTEXT_USAGE_PERCENTAGE}%)`);
      }

      businessData.SMART_LAYERED_CONTENT = contentParts.join('\n\n');

      log.debug(`📊 [业务数据] 收集完成 - 包含: ${Object.keys(businessData).join(', ')}`);
      return businessData;

    } catch (error) {
      log.error(`❌ [业务数据] 收集失败:`, error);
      return { SMART_LAYERED_CONTENT: '## 📊 智能分层内容\n数据加载中...' };
    }
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
        
        log.info(`🔍 [SmartLayered] 工具适配完成: ${adaptedTools?.length || 0}个工具`);
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

      // 简化调试：只记录关键统计信息
      const systemMessage = messages.find(msg => msg._getType() === 'system');
      if (systemMessage && typeof systemMessage.content === 'string') {
        const toolMatches = systemMessage.content.match(/promptx-builtin__\w+/g) || [];
        log.info(`🔍 [SmartLayeredPrompt] 系统提示词构建完成: ${systemMessage.content.length}字符, ${toolMatches.length}个工具`);
      }

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
      const targetRole = uiContext?.selectedRole || conversationContext.activeRole;
      if (targetRole) {
        this.layer1.recordRoleActivation(conversationContext.sessionId, targetRole);
      }

      // 🎯 构建完整的角色状态信息
      const startTime = Date.now();
      const activeRole = uiContext?.selectedRole || conversationContext.activeRole;
      const roleActivationSuccess = !!(activeRole && layerResults.layer1.roleInfo.roleRendered);
      
      // 构建完整响应
      const response: SmartPromptResponse = {
        messages,
        compressionTriggered: !!layerResults.compressionResult,
        totalTokens: tokenStats.totalTokens,
        uiIntentProcessed: !!uiContext,
        
        // 🎯 核心：角色状态信息
        roleStatus: {
          activeRole: activeRole || null,
          isActivated: roleActivationSuccess,
          activationSuccess: roleActivationSuccess,
          roleContent: layerResults.layer1.roleInfo.roleRendered ? layerResults.layer1.systemPrompt.substring(0, 200) + '...' : undefined,
          roleMetadata: activeRole ? {
            name: activeRole,
            description: `${activeRole}角色`,
            lastActivated: new Date()
          } : undefined,
          error: !roleActivationSuccess && activeRole ? `角色${activeRole}激活失败` : undefined
        },
        
        // 🔧 工具状态信息
        toolsStatus: {
          toolsCount: layerResults.layer3.toolsCount,
          availableServers: layerResults.layer3.availableServers
        },
        
        // 📊 构建元数据
        metadata: {
          layers: ['角色层', '上下文层', '工具层', '消息层'],
          totalLength: typeof messages[0]?.content === 'string' ? (messages[0].content as string).length : 0,
          buildTime: Date.now() - startTime
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
        totalTokens: tokenStats.totalTokens,
        uiIntentProcessed: false,
        roleStatus: {
          activeRole: null,
          isActivated: false,
          activationSuccess: false,
          error: error instanceof Error ? error.message : String(error)
        },
        toolsStatus: {
          toolsCount: 0,
          availableServers: []
        },
        metadata: {
          layers: ['fallback'],
          totalLength: tokenStats.totalTokens,
          buildTime: 0
        }
      };
    }
  }

  /**
   * 执行所有层级处理（4层架构版本）
   */
  private async executeAllLayers(
    userInput: string,
    conversationContext: ConversationContext,
    baseSystemPrompt: string,
    availableTools?: MCPTool[],
    uiContext?: UIInjectionContext
  ): Promise<LayerExecutionResult> {
    
    // 第1层：角色状态监控 + 角色加载 + UI意图处理
    const layer1Result = await this.layer1.render(
      conversationContext, 
      baseSystemPrompt, 
      userInput,
      uiContext
    );
    log.info(`🎭 [4层架构-L1] 第1层角色处理完成: 角色渲染=${layer1Result.roleInfo.roleRendered}, UI处理=${!!uiContext}`);

    // 检查是否需要压缩历史对话
    let compressionResult: CompressionResult | undefined;
    if (layer1Result.recommendations.action === 'compress_history' ||
        layer1Result.recommendations.action === 'emergency_compress') {
      
      log.info(`🔄 [4层架构-L2] 触发历史压缩: ${layer1Result.recommendations.reason}`);
      compressionResult = await this.layer2.compressHistoryIfNeeded(
        conversationContext.sessionId,
        layer1Result.recommendations.urgency === 'critical'
      ) || undefined;
    }

    // 第2层：渲染历史上下文
    const layer2Result = this.layer2.render(conversationContext.sessionId);
    log.info(`📚 [4层架构-L2] 第2层历史上下文处理完成`);

    // 第3层：工具集成处理
    const layer3Result = await this.layer3.render(availableTools);
    log.info(`🔧 [4层架构-L3] 第3层工具集成完成: ${layer3Result.toolsCount}个工具`);

    // 第4层：处理当前消息 + UI意图注入
    const layer4Result = this.layer4.render(userInput, uiContext);
    log.info(`📝 [4层架构-L4] 第4层当前消息处理完成: UI注入=${!!uiContext}`);

    return {
      layer1: layer1Result,
      layer2: layer2Result,
      layer3: layer3Result,
      layer4: layer4Result,
      compressionResult
    };
  }

  /**
   * 构建最终的消息数组（4层架构版本）
   */
  private async buildFinalMessages(layerResults: LayerExecutionResult): Promise<BaseMessage[]> {
    log.info('🔄 [消息构建4层] 构建最终消息数组，使用4层架构');
    
    // 第1层：角色化提示词
    let systemContent = layerResults.layer1.systemPrompt;
    log.info('🎭 [消息构建4层] 已添加角色层');
    
    // 第2层：添加历史上下文
    if (layerResults.layer2.trim().length > 0) {
      systemContent += '\n\n# 📚 CONVERSATION_HISTORY\n' + layerResults.layer2;
      log.info('📚 [消息构建4层] 已添加历史上下文层');
    }

    // 第3层：添加工具集成信息
    if (layerResults.layer3.toolsPrompt.trim().length > 0) {
      systemContent += '\n\n' + layerResults.layer3.toolsPrompt;
      log.info(`🔧 [消息构建4层] 已添加工具集成层: ${layerResults.layer3.toolsCount}个工具`);
    }

    const messages = [
      new SystemMessage(systemContent),
      layerResults.layer4  // 第4层：用户消息
    ];

    log.info(`✅ [消息构建4层] 最终消息数组构建完成: SystemMessage(${systemContent.length}字符) + HumanMessage`);
    
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



  // buildMessagesWithToolResults 方法已删除，因为角色内容现在直接注入，无需工具调用结果处理

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