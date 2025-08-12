/**
 * DeeChat智能分层提示词系统 - 第1层：角色状态监控层（增强版）
 * 
 * 核心职责：
 * 1. 防止AI在长对话中忘记专业角色身份
 * 2. 实时监控Token使用和稀疏注意力风险
 * 3. 智能决策何时触发历史对话压缩
 * 4. 提供角色重激活机制
 * 5. **新增**：集成角色内容加载和变量注入功能（原第四层功能）
 * 6. **新增**：UI驱动的角色激活支持
 */

import log from 'electron-log';
import { TokenCounter } from '../components/TokenCounter';
import { ModelContextManager, ContextAnalysisResult } from '../components/ModelContextManager';



// UI意图注入上下文（新增：支持UI驱动的角色激活）
export interface UIInjectionContext {
  selectedRole?: string;           // UI选择的角色ID
  roleActivationRequest?: boolean; // 是否请求激活角色
  specialModes?: {
    codeAnalysis?: boolean;        // 代码分析模式
    detailedExplanation?: boolean; // 详细解释模式
    quickAnswer?: boolean;         // 快速回答模式
    creativeMode?: boolean;        // 创意模式
  };
  customInstructions?: string[];   // 用户自定义指令
}

// 动态注入变量接口（从第四层移入）
export interface InjectionVariables {
  PROJECT_NAME: string;
  PROJECT_PATH: string;
  TECH_STACK: string;
  CONVERSATION_ROUNDS: number;
  AVAILABLE_TOOLS_DETAILED: string;
  RUNTIME_INJECTION: string;
  USER_CONTEXT: string;
  TOOL_SUBSTITUTION_RULES: string;
  EXECUTION_CONSTRAINTS: string;
}

// 对话上下文信息
export interface ConversationContext {
  sessionId: string;
  currentModel: string;
  activeRole?: string;
  lastRoleActivationTime?: Date;
  conversationStartTime: Date;
  totalRounds: number;
  lastUserInput?: string;
  lastAIResponse?: string;
  
  // 🔥 新增：工具调用结果注入支持
  roleContent?: any;              // 角色激活工具返回的完整内容 
  toolActivationContext?: {       // 工具激活上下文
    toolName: string;
    activatedAt: Date;
    contentLength: number;
    roleId?: string;
  };
}

// 角色状态监控结果（增强版：包含角色渲染信息）
export interface RoleStatusResult {
  roleStatus: 'active' | 'passive' | 'context_heavy';
  tokenStatus: {
    current: number;
    incoming: number;
    total: number;
    percentage: number;
    level: string;
  };
  recommendations: {
    action: 'continue' | 'compress_history' | 'emergency_compress';
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  roleInfo: {
    activeRole: string;
    totalTokens: number; // 当前会话总token数
    rolePresence: 'strong' | 'medium' | 'weak'; // 基于token的角色存在感
    roleRendered: boolean; // 是否成功渲染了角色内容
    injectedVariables?: Partial<InjectionVariables>; // 注入的变量
  };
  systemPrompt: string;
  metadata?: {
    uiInjectionProcessed: boolean; // 是否处理了UI注入
    roleContentSource: 'file' | 'cache' | 'fallback'; // 角色内容来源
  };
}

/**
 * 第1层：角色状态监控层（增强版：集成角色加载功能）
 * 
 * 这一层负责：
 * - 维护AI的专业角色身份
 * - 监控token使用情况
 * - 检测稀疏注意力风险
 * - 决策压缩时机
 * - **新增**：角色内容加载和变量注入（原第四层功能）
 * - **新增**：UI驱动的角色激活支持
 */
export class RoleStatusMonitorLayer {
  private tokenCounter: TokenCounter;
  private contextManager: ModelContextManager;
  private roleActivationHistory: Map<string, Date> = new Map();
  
  // 角色状态监控阈值（基于上下文使用百分比，更智能的动态判断）
  private readonly CONTEXT_LIGHT_THRESHOLD = 0.25; // 25%以内为轻量上下文
  private readonly CONTEXT_HEAVY_THRESHOLD = 0.60; // 60%以上为重度上下文

  // **修改**：支持从PromptX获取角色内容，不再依赖硬编码文件
  private roleContentCache: Map<string, {content: string, timestamp: Date}> = new Map();
  private promptxService?: any; // PromptX服务引用

  constructor(promptxService?: any) {
    this.tokenCounter = TokenCounter.getInstance();
    this.contextManager = ModelContextManager.getInstance();
    this.promptxService = promptxService;
    log.info('🎭 [RoleStatusMonitorLayer] 第1层：角色状态监控层（增强版）初始化完成', {
      promptxServiceAvailable: !!this.promptxService
    });
  }

  /**
   * 渲染第1层内容：角色状态监控（增强版：支持UI注入和角色加载）
   * @param context 对话上下文
   * @param systemPrompt 基础系统提示词
   * @param userInput 当前用户输入
   * @param uiContext UI意图注入上下文
   * @param availableTools 可用工具列表
   * @returns 角色状态监控结果
   */
  async render(
    context: ConversationContext, 
    systemPrompt: string, 
    userInput: string,
    uiContext?: UIInjectionContext,
    availableTools?: any[]
  ): Promise<RoleStatusResult> {
    log.info(`🎭 [角色监控Enhanced] 开始增强分析 - 会话: ${context.sessionId.slice(0, 8)}, UI角色: ${uiContext?.selectedRole || '未选择'}, 上下文角色: ${context.activeRole || '未选择'}`);
    
    // **步骤1**：检测角色选择，准备角色激活引导
    let finalSystemPrompt = systemPrompt;
    let roleRendered = false;
    let roleContentSource: 'promptx' | 'fallback' = 'fallback';
    
    const targetRole = uiContext?.selectedRole || context.activeRole;
    if (targetRole) {
      log.info(`🎭 [角色检测] 检测到角色选择: ${targetRole}`);
      roleRendered = false; // 等待AI主动激活
      roleContentSource = 'promptx';
    } else {
      log.info(`❓ [角色检测] 未检测到角色选择`);
    }

    // **步骤2**：分析Token状态
    const incomingTokens = this.estimateIncomingTokens(finalSystemPrompt, userInput, context.currentModel);
    const currentStats = this.tokenCounter.getConversationStats(context.sessionId);
    const currentTokens = currentStats?.totalTokens || 0;
    
    log.info(`📊 [Token分析] 当前: ${currentTokens}, 新增: ${incomingTokens}, 总计: ${currentTokens + incomingTokens}`);
    
    // **步骤3**：获取上下文分析
    const contextAnalysis = this.contextManager.analyzeContextStatus(
      context.currentModel,
      currentTokens,
      incomingTokens,
      context.sessionId
    );

    // **步骤4**：分析角色状态
    const roleAnalysis = this.analyzeRoleStatus(context, contextAnalysis);
    log.info(`🎯 [角色状态] ${roleAnalysis.status}, 存在感: ${roleAnalysis.rolePresence}, 原因: ${roleAnalysis.reason}`);

    // **步骤5**：生成综合建议
    const finalRecommendations = this.generateFinalRecommendations(contextAnalysis);
    log.info(`💡 [系统建议] 动作: ${finalRecommendations.action}, 紧急度: ${finalRecommendations.urgency}`);

    // **步骤6**：构建增强的系统提示词（加入UI意图注入）
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      finalSystemPrompt,
      context,
      contextAnalysis,
      roleAnalysis,
      finalRecommendations,
      uiContext
    );
    log.info(`📝 [最终提示词] 构建完成，长度: ${enhancedSystemPrompt.length} 字符`);

    // **步骤7**：构建动态注入变量（如果有可用工具）
    const injectedVariables = availableTools ? this.buildInjectionVariables(context, availableTools) : undefined;

    // **步骤8**：构建增强结果
    const result: RoleStatusResult = {
      roleStatus: roleAnalysis.status,
      tokenStatus: {
        current: currentTokens,
        incoming: incomingTokens,
        total: currentTokens + incomingTokens,
        percentage: contextAnalysis.usage.percentage,
        level: contextAnalysis.usage.level
      },
      recommendations: finalRecommendations,
      roleInfo: {
        activeRole: uiContext?.selectedRole || context.activeRole || '通用助手',
        totalTokens: roleAnalysis.totalTokens,
        rolePresence: roleAnalysis.rolePresence,
        roleRendered,
        injectedVariables
      },
      systemPrompt: enhancedSystemPrompt,
      metadata: {
        uiInjectionProcessed: !!uiContext,
        roleContentSource: roleContentSource === 'promptx' ? 'cache' : 'fallback'
      }
    };

    // 记录状态
    this.logStatusUpdate(context.sessionId, result);

    return result;
  }

  /**
   * 估算即将产生的Token数量
   */
  private estimateIncomingTokens(systemPrompt: string, userInput: string, modelKey: string): number {
    return this.tokenCounter.estimateThisInvokeTokens(systemPrompt, userInput, modelKey);
  }

  /**
   * 分析角色状态（基于上下文使用百分比，动态适配不同模型，纯监控不触发自动操作）
   */
  private analyzeRoleStatus(
    _context: ConversationContext,
    contextAnalysis: ContextAnalysisResult
  ): {
    status: 'active' | 'passive' | 'context_heavy';
    totalTokens: number;
    rolePresence: 'strong' | 'medium' | 'weak';
    reason: string;
  } {
    const totalTokens = contextAnalysis.currentTokens;
    const usagePercentage = contextAnalysis.usage.percentage;
    let status: 'active' | 'passive' | 'context_heavy' = 'active';
    let rolePresence: 'strong' | 'medium' | 'weak' = 'strong';
    let reason = '角色状态正常';
    
    log.info(`🔍 [角色分析] 开始分析 - 总tokens: ${totalTokens}, 使用率: ${Math.round(usagePercentage * 100)}%, 阈值: 轻量${this.CONTEXT_LIGHT_THRESHOLD * 100}% / 重度${this.CONTEXT_HEAVY_THRESHOLD * 100}%`);

    // 基于上下文使用百分比判断状态和角色存在感（动态适配模型）
    if (usagePercentage > this.CONTEXT_HEAVY_THRESHOLD) {
      status = 'context_heavy';
      reason = `重度上下文（${Math.round(usagePercentage * 100)}%, ${totalTokens} tokens）`;
      // 进一步细分：超过80%时角色存在感变弱
      rolePresence = usagePercentage > 0.80 ? 'weak' : 'medium';
      log.info(`⚠️ [角色分析] 触发重度上下文 - ${Math.round(usagePercentage * 100)}% > ${this.CONTEXT_HEAVY_THRESHOLD * 100}%, 角色存在感: ${rolePresence}`);
    } else if (usagePercentage > this.CONTEXT_LIGHT_THRESHOLD) {
      status = 'passive';
      rolePresence = 'medium';
      reason = `中等上下文（${Math.round(usagePercentage * 100)}%, ${totalTokens} tokens）`;
      log.info(`📊 [角色分析] 触发中等上下文 - ${Math.round(usagePercentage * 100)}% > ${this.CONTEXT_LIGHT_THRESHOLD * 100}%, 角色存在感: ${rolePresence}`);
    } else {
      log.info(`✅ [角色分析] 轻量上下文 - ${Math.round(usagePercentage * 100)}% <= ${this.CONTEXT_LIGHT_THRESHOLD * 100}%, 角色存在感: ${rolePresence}`);
    }

    // 基于模型上下文使用级别进一步调整
    if (contextAnalysis.usage.level === 'sparse_attention' || contextAnalysis.usage.level === 'critical') {
      const oldStatus = status;
      const oldPresence = rolePresence;
      status = 'context_heavy';
      rolePresence = 'weak';
      reason = `上下文压力：${contextAnalysis.usage.description} (${Math.round(usagePercentage * 100)}%, ${totalTokens} tokens)`;
      log.info(`🚨 [角色分析] 模型级别覆盖 - 从 ${oldStatus}/${oldPresence} 改为 ${status}/${rolePresence}, 级别: ${contextAnalysis.usage.level}`);
    }

    return {
      status,
      totalTokens,
      rolePresence,
      reason
    };
  }


  /**
   * 生成最终建议（不包含自动角色重激活）
   */
  private generateFinalRecommendations(
    contextAnalysis: ContextAnalysisResult
  ): {
    action: 'continue' | 'compress_history' | 'emergency_compress';
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  } {
    // 仅基于上下文压力进行建议，不自动重激活角色
    
    if (contextAnalysis.recommendations.action === 'emergency_compress') {
      return {
        action: 'emergency_compress',
        reason: `上下文临界：${contextAnalysis.recommendations.reason}`,
        urgency: 'critical'
      };
    }

    // 过滤掉旧的reactivate_role操作，直接继承其他建议
    const recommendations = contextAnalysis.recommendations;
    if (recommendations.action === 'reactivate_role') {
      return {
        action: 'continue',
        reason: '角色状态正常',
        urgency: 'low'
      };
    }

    // 直接继承上下文分析的建议
    return recommendations as {
      action: 'continue' | 'compress_history' | 'emergency_compress';
      reason: string;
      urgency: 'low' | 'medium' | 'high' | 'critical';
    };
  }

  /**
   * 构建增强的系统提示词（增强版：支持UI意图注入）
   */
  private buildEnhancedSystemPrompt(
    baseSystemPrompt: string,
    context: ConversationContext,
    contextAnalysis: ContextAnalysisResult,
    roleAnalysis: any,
    _recommendations: any,
    uiContext?: UIInjectionContext
  ): string {
    const sections: string[] = [];

    // 1. 角色状态监控信息（基于上下文百分比的智能监控）
    sections.push(`# 🎭 ROLE_CONTEXT_INFO
当前角色: ${context.activeRole || '通用助手'} | 上下文使用率: ${Math.round(contextAnalysis.usage.percentage * 100)}% (${roleAnalysis.totalTokens} tokens) | 角色存在感: ${roleAnalysis.rolePresence}
模型级别: ${contextAnalysis.usage.level} | 状态: ${roleAnalysis.reason}`);

    // 2. 角色切换通知和激活引导（智能检测角色状态变化）
    const currentUIRole = uiContext?.selectedRole; // UI当前选择的角色
    const previousSessionRole = context.activeRole; // 会话中之前的角色
    
    log.info(`🔍 [角色检测] UI角色: ${currentUIRole || '无'}, 会话角色: ${previousSessionRole || '无'}`);
    
    if (currentUIRole) {
      // 用户选择了角色
      if (previousSessionRole && previousSessionRole !== currentUIRole) {
        // 场景1：角色切换 - 从一个角色切换到另一个角色
        const roleSwitchNotice = `# 🔄 ROLE_SWITCH_NOTIFICATION
🎭 **重要：用户已从 \`${previousSessionRole}\` 切换到 \`${currentUIRole}\` 角色**
💡 **必须立即调用工具切换角色！**

🔧 **工具调用指令**：
请调用 promptx_action 工具，参数设置为：
- role: "${currentUIRole}"

📝 激活后，你将以 \`${currentUIRole}\` 角色身份提供专业服务。
⚠️ **重要**：请忘记之前的 \`${previousSessionRole}\` 角色身份，完全切换到新角色！
💬 **调用工具后**：请继续以新角色身份正常回答用户问题。`;
        sections.push(roleSwitchNotice);
        log.info(`🔄 [角色切换] 检测到角色切换: ${previousSessionRole} → ${currentUIRole}`);
      } else if (!previousSessionRole || this.shouldTriggerRoleActivation(context, currentUIRole)) {
        // 场景2：首次激活 - 之前没有角色或需要重新激活
        const activationGuidance = `# 🎯 ROLE_ACTIVATION_GUIDANCE
🚀 用户已选择角色：${currentUIRole}
💡 **必须立即调用工具激活角色！**

🔧 **工具调用指令**：
请调用 promptx_action 工具，参数设置为：
- role: "${currentUIRole}"

📝 激活后，你将自动获得该角色的完整专业定义和能力。
⚠️ **重要**：不调用工具就无法获得角色能力！
💬 **调用工具后**：请继续以该角色身份正常回答用户问题。`;
        sections.push(activationGuidance);
        log.info(`🎯 [角色激活] 已添加角色激活引导: ${currentUIRole}`);
      } else {
        // 场景3：角色已激活 - 添加角色身份提醒
        const roleReminder = `# 🎭 CURRENT_ROLE_REMINDER
✅ **当前激活角色：\`${currentUIRole}\`**
💡 请继续以 \`${currentUIRole}\` 角色身份提供专业服务。`;
        sections.push(roleReminder);
        log.info(`😊 [角色状态] 角色${currentUIRole}已激活，添加身份提醒`);
      }
    } else {
      // 用户没有选择角色
      if (previousSessionRole) {
        // 场景4：角色清除 - 从有角色状态切换到无角色状态
        const roleClearNotice = `# 🔄 ROLE_CLEAR_NOTIFICATION
🔄 **用户已清除角色选择，从 \`${previousSessionRole}\` 恢复到默认AI模式**
💡 请忘记之前的 \`${previousSessionRole}\` 角色身份，恢复为通用AI助手。`;
        sections.push(roleClearNotice);
        log.info(`🔄 [角色清除] 检测到角色清除: ${previousSessionRole} → 默认模式`);
      } else {
        // 场景5：默认状态 - 没有角色选择
        log.info(`❓ [角色提醒] 未选择角色，使用默认AI模式`);
      }
    }

    // 3. 上下文压力预警（重要）
    if (contextAnalysis.usage.level === 'sparse_attention' || contextAnalysis.usage.level === 'critical') {
      sections.push(`# 🧠 CONTEXT_ATTENTION_WARNING
⚠️ 上下文压力提醒：当前对话已达到 ${Math.round(contextAnalysis.usage.percentage * 100)}% 容量
🎯 重点关注：用户的最新需求和核心问题
💡 建议：优先处理重要信息，保持回复精准简洁`);
    }

    // 4. 🔥 动态角色内容注入（关键修复）
    if (context.roleContent && context.toolActivationContext) {
      log.info(`🔥 [角色内容注入] 检测到已激活的角色内容 - 角色: ${context.toolActivationContext.roleId}, 内容长度: ${context.toolActivationContext.contentLength}`);
      
      const roleContentSection = `# 🎭 ACTIVATED_ROLE_CONTENT
✅ **角色已激活：\`${context.toolActivationContext.roleId}\`** (激活时间: ${context.toolActivationContext.activatedAt.toISOString()})
📊 **角色定义内容长度**: ${context.toolActivationContext.contentLength} 字符

🔥 **完整角色定义**：
${JSON.stringify(context.roleContent, null, 2)}

⚠️ **重要指示**：
- 你现在完全具备了该角色的所有能力和知识
- 请严格按照上述角色定义来回答问题
- 体现角色的专业特征、思维方式和行为模式
- 不要提及"工具调用"，直接以角色身份回答`;
      
      sections.push(roleContentSection);
      log.info(`✅ [角色内容注入] 已将${context.toolActivationContext.contentLength}字符的角色内容注入系统提示词`);
    } else if (currentUIRole && !context.roleContent) {
      log.info(`⚠️ [角色内容缺失] UI选择了角色${currentUIRole}但缺少注入内容，等待工具调用结果`);
    }

    // 5. UI驱动的意图注入（原有）
    if (uiContext) {
      const uiIntentSection = this.buildUIIntentSection(uiContext);
      if (uiIntentSection.trim()) {
        sections.push(uiIntentSection);
        log.info(`🎯 [UI意图注入] 已添加UI意图指令`);
      }
    }

    // 6. 基础系统提示词
    sections.push(`# 📝 BASE_SYSTEM_PROMPT\n${baseSystemPrompt}`);

    return sections.join('\n\n');
  }

  /**
   * 检查是否应该触发角色激活
   * @param context 对话上下文
   * @param roleId 角色ID
   * @returns 是否应该激活角色
   */
  private shouldTriggerRoleActivation(context: ConversationContext, roleId: string): boolean {
    const roleKey = `${context.sessionId}_${roleId}`;
    const hasActivated = this.roleActivationHistory.has(roleKey);
    
    // 如果从未激活过这个角色，就应该激活
    const shouldActivate = !hasActivated;
    
    log.info(`🔍 [激活检查] 角色: ${roleId}, 已激活: ${hasActivated}, 应激活: ${shouldActivate}`);
    
    return shouldActivate;
  }

  /**
   * 记录角色激活
   * @param sessionId 会话ID
   * @param roleId 角色ID
   */
  recordRoleActivation(sessionId: string, roleId: string): void {
    const roleKey = `${sessionId}_${roleId}`;
    this.roleActivationHistory.set(roleKey, new Date());
    log.info(`📝 [角色记录] 记录角色激活: ${roleId} (会话 ${sessionId.slice(0, 8)})`);
  }

  /**
   * 检查是否需要压缩
   * @param sessionId 会话ID
   * @param modelKey 模型标识
   * @returns 是否需要压缩
   */
  shouldTriggerCompression(sessionId: string, modelKey: string): boolean {
    const stats = this.tokenCounter.getConversationStats(sessionId);
    if (!stats) return false;

    return this.contextManager.shouldCompress(modelKey, stats.totalTokens);
  }

  /**
   * 获取压缩建议
   * @param sessionId 会话ID
   * @param modelKey 模型标识
   * @returns 压缩建议详情
   */
  getCompressionAdvice(sessionId: string, modelKey: string): {
    shouldCompress: boolean;
    urgency: 'low' | 'medium' | 'high' | 'critical';
    benefit: any;
    optimalPoint: number;
  } {
    const stats = this.tokenCounter.getConversationStats(sessionId);
    if (!stats) {
      return {
        shouldCompress: false,
        urgency: 'low',
        benefit: null,
        optimalPoint: 0
      };
    }

    const shouldCompress = this.contextManager.shouldCompress(modelKey, stats.totalTokens);
    const analysis = this.contextManager.analyzeContextStatus(modelKey, stats.totalTokens);
    const benefit = this.contextManager.calculateCompressionBenefit(modelKey, stats.totalTokens);
    const optimalPoint = this.contextManager.getOptimalCompressionPoint(modelKey, stats.totalTokens);

    return {
      shouldCompress,
      urgency: analysis.recommendations.urgency,
      benefit,
      optimalPoint
    };
  }

  /**
   * 记录状态更新日志
   */
  private logStatusUpdate(sessionId: string, result: RoleStatusResult): void {
    const shortSessionId = sessionId.slice(0, 8);
    const tokenInfo = `${result.tokenStatus.total} tokens (${Math.round(result.tokenStatus.percentage * 100)}%)`;
    
    if (result.recommendations.urgency === 'high' || result.recommendations.urgency === 'critical') {
      log.warn(`⚠️ [RoleStatusMonitor] 会话 ${shortSessionId}: ${result.roleStatus} | ${tokenInfo} | 建议: ${result.recommendations.action}`);
    } else {
      log.debug(`🎭 [RoleStatusMonitor] 会话 ${shortSessionId}: ${result.roleStatus} | ${tokenInfo} | 建议: ${result.recommendations.action}`);
    }
  }

  /**
   * 清理过期的角色激活记录
   * @param maxAge 最大保留时间（小时）
   */
  cleanupRoleHistory(maxAge: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [roleKey, activationTime] of this.roleActivationHistory.entries()) {
      if (activationTime < cutoffTime) {
        this.roleActivationHistory.delete(roleKey);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log.info(`🧹 [RoleStatusMonitor] 已清理 ${cleaned} 个过期角色激活记录`);
    }
  }

  /**
   * 获取监控统计
   */
  getMonitorStats(): {
    activeRoles: number;
    totalSessions: number;
    avgTokenUsage: number;
    highRiskSessions: number;
  } {
    const tokenStats = this.tokenCounter.getAllStatsSpeedily();
    
    return {
      activeRoles: this.roleActivationHistory.size,
      totalSessions: tokenStats.totalSessions,
      avgTokenUsage: tokenStats.averageTokensPerSession,
      highRiskSessions: 0 // TODO: 实现高风险会话统计
    };
  }

  // =============================================
  // **新增方法**：角色内容加载功能（从第四层移入）
  // =============================================

  /**
   * 构建UI意图注入部分
   */
  private buildUIIntentSection(uiContext: UIInjectionContext): string {
    const intentions: string[] = [];

    // 角色激活请求
    if (uiContext.roleActivationRequest && uiContext.selectedRole) {
      intentions.push(`🎭 用户通过UI明确选择激活角色：${uiContext.selectedRole}`);
      intentions.push(`请立即调用promptx_action工具激活此角色。`);
    }

    // 特殊模式
    if (uiContext.specialModes) {
      if (uiContext.specialModes.codeAnalysis) {
        intentions.push(`🔍 用户启用代码分析模式：重点关注代码质量、架构和性能分析`);
      }
      if (uiContext.specialModes.detailedExplanation) {
        intentions.push(`📚 用户选择详细解释模式：提供步骤化的详细说明和深入分析`);
      }
      if (uiContext.specialModes.quickAnswer) {
        intentions.push(`⚡ 用户选择快速回答模式：提供简洁精准的回复`);
      }
      if (uiContext.specialModes.creativeMode) {
        intentions.push(`🎨 用户启用创意模式：鼓励创新思维和多元化解决方案`);
      }
    }

    // 自定义指令
    if (uiContext.customInstructions && uiContext.customInstructions.length > 0) {
      intentions.push(`⚡ 用户自定义指令：`);
      uiContext.customInstructions.forEach((instruction, index) => {
        intentions.push(`  ${index + 1}. ${instruction}`);
      });
    }

    if (intentions.length === 0) {
      return '';
    }

    return `# 🎯 UI_DRIVEN_INTENTIONS\n用户通过UI明确表达的意图：\n${intentions.join('\n')}`;
  }

  // 删除了getRolePromptContent方法 - AI将通过promptx_action工具获取角色内容

  // 删除了buildRoleSpecificPrompt方法 - 使用PromptX工具获取角色内容

  /**
   * 构建动态注入变量
   */
  private buildInjectionVariables(
    context: ConversationContext,
    availableTools: any[]
  ): Partial<InjectionVariables> {
    return {
      PROJECT_NAME: 'DeeChat',
      PROJECT_PATH: process.cwd(),
      TECH_STACK: 'TypeScript, Electron, React, PromptX, MCP',
      CONVERSATION_ROUNDS: context.totalRounds,
      AVAILABLE_TOOLS_DETAILED: this.formatToolsDetailed(availableTools),
      RUNTIME_INJECTION: this.buildRuntimeInjection(context),
      USER_CONTEXT: this.buildUserContext(context),
      TOOL_SUBSTITUTION_RULES: this.buildToolSubstitutionRules(),
      EXECUTION_CONSTRAINTS: this.buildExecutionConstraints()
    };
  }


  /**
   * 格式化工具详细信息
   */
  private formatToolsDetailed(tools: any[]): string {
    if (!tools || tools.length === 0) {
      return '暂无可用工具';
    }

    return tools.map(tool => {
      const name = tool.name || '未知工具';
      const description = tool.description || '无描述';
      
      return `**${name}**: ${description}
XML调用格式:
<tool_call>
<tool_name>${name}</tool_name>
<parameters>
  <!-- 根据具体工具填写参数 -->
</parameters>
</tool_call>`;
    }).join('\n\n');
  }

  /**
   * 构建运行时注入内容
   */
  private buildRuntimeInjection(context: ConversationContext): string {
    const injections = [];
    
    // 根据对话轮次调整
    if (context.totalRounds > 10) {
      injections.push('💡 长对话模式：保持回复简洁精准');
    }
    
    // 根据活跃角色调整
    if (context.activeRole) {
      injections.push(`🎯 当前选择角色：${context.activeRole}`);
    }
    
    return injections.length > 0 ? injections.join('\n') : '🎯 标准对话模式';
  }

  /**
   * 构建用户上下文
   */
  private buildUserContext(context: ConversationContext): string {
    const contextParts = [];
    
    contextParts.push(`会话ID: ${context.sessionId.slice(0, 8)}`);
    contextParts.push(`对话轮次: ${context.totalRounds}`);
    contextParts.push(`当前模型: ${context.currentModel}`);
    
    if (context.lastUserInput) {
      contextParts.push(`最近输入: ${context.lastUserInput.slice(0, 100)}...`);
    }
    
    return contextParts.join(' | ');
  }

  /**
   * 构建工具替代规则
   */
  private buildToolSubstitutionRules(): string {
    return `🚨 强制工具替代：
- 禁用 find → 使用 Glob 工具
- 禁用 grep → 使用 Grep 工具  
- 禁用 cat/head/tail → 使用 Read 工具
- 禁用 ls → 使用 LS 工具
- 所有工具调用必须使用XML格式`;
  }

  /**
   * 构建执行约束
   */
  private buildExecutionConstraints(): string {
    return `⚡ 执行约束：
- 单次调用：每条消息只能调用一个工具
- 等待确认：不假设工具调用成功
- XML格式：确保格式正确性
- 思考先行：使用<thinking>分析需求`;
  }

  // 删除了getFallbackRolePrompt方法 - 简化架构，使用PromptX工具


  /**
   * 清除角色内容缓存
   */
  clearRoleCache(): void {
    this.roleContentCache.clear();
    log.info('🗑️ [角色缓存] 角色内容缓存已清除');
  }
}