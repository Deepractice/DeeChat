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
// 移除跨进程导入，改为构造函数依赖注入方式获取PromptX服务
import { WorkspaceFile } from '../../types/WorkspaceFile';



// UI意图注入上下文（新增：支持UI驱动的角色激活和工作区感知）
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
  // 🔥 新增：工作区UI状态
  workspaceState?: {
    isOpen: boolean;               // 工作区是否打开（打开就注入提示词）
    files: WorkspaceFile[];        // 工作区文件列表
  };
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
  
  // （已删除）工具调用结果注入支持，现在使用直接内容注入
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

  // **简化**：移除角色内容缓存，由CoreLLMService统一处理

  constructor() {
    this.tokenCounter = TokenCounter.getInstance();
    this.contextManager = ModelContextManager.getInstance();
    log.info('🎭 [RoleStatusMonitorLayer] 第1层：角色状态监控层初始化完成');
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
    uiContext?: UIInjectionContext
  ): Promise<RoleStatusResult> {
    log.info(`🎭 [角色监控Enhanced] 开始增强分析 - 会话: ${context.sessionId.slice(0, 8)}, UI角色: ${uiContext?.selectedRole || '未选择'}, 上下文角色: ${context.activeRole || '未选择'}`);
    
    // **步骤1**：角色状态检测（不再获取角色内容，由CoreLLMService统一处理）
    const targetRole = uiContext?.selectedRole || context.activeRole;
    if (targetRole) {
      log.info(`🎭 [角色检测] 检测到角色选择: ${targetRole}`);
    } else {
      log.info(`❓ [角色检测] 未检测到角色选择`);
    }

    // **步骤2**：分析Token状态
    const incomingTokens = this.estimateIncomingTokens(systemPrompt, userInput, context.currentModel);
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

    // **步骤6**：构建基础注入变量（不包含工具信息）
    const injectedVariables = this.buildBasicInjectionVariables(context);

    // **步骤7**：构建增强的系统提示词（只包含角色内容，不包含工具信息）
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      systemPrompt,
      context,
      contextAnalysis,
      roleAnalysis,
      finalRecommendations,
      uiContext,
      injectedVariables
    );
    log.info(`📝 [最终提示词] 构建完成，长度: ${enhancedSystemPrompt.length} 字符`);

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
        roleRendered: true,
        injectedVariables: injectedVariables
      },
      systemPrompt: enhancedSystemPrompt,
      metadata: {
        uiInjectionProcessed: !!uiContext,
        roleContentSource: 'file'
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
   * 构建增强的系统提示词（新版：直接注入角色内容，无需工具调用）
   */
  private buildEnhancedSystemPrompt(
    baseSystemPrompt: string,
    context: ConversationContext,
    contextAnalysis: ContextAnalysisResult,
    roleAnalysis: any,
    _recommendations: any,
    uiContext?: UIInjectionContext,
    injectedVariables?: Partial<InjectionVariables>
  ): string {
    const sections: string[] = [];

    // 1. 角色状态监控信息（基于上下文百分比的智能监控）
    sections.push(`# 🎭 ROLE_CONTEXT_INFO
当前角色: ${context.activeRole || '通用助手'} | 上下文使用率: ${Math.round(contextAnalysis.usage.percentage * 100)}% (${roleAnalysis.totalTokens} tokens) | 角色存在感: ${roleAnalysis.rolePresence}
模型级别: ${contextAnalysis.usage.level} | 状态: ${roleAnalysis.reason}`);

    // 2. 🎯 角色状态记录（简化，不再处理角色内容）
    const currentUIRole = uiContext?.selectedRole || context.activeRole;
    
    if (currentUIRole) {
      log.info(`🎭 [角色检测] 当前激活角色: ${currentUIRole}`);
      
      // 添加简单的状态提示
      const statusNotice = `# 🎭 角色状态
✅ 当前激活角色：${currentUIRole}`;
      sections.push(statusNotice);
    } else {
      // 无特定角色时的简单状态
      log.info(`🤖 [默认模式] 使用基础模板，无特定角色激活`);
    }

    // 3. 上下文压力预警（重要）
    if (contextAnalysis.usage.level === 'sparse_attention' || contextAnalysis.usage.level === 'critical') {
      sections.push(`# 🧠 CONTEXT_ATTENTION_WARNING
⚠️ 上下文压力提醒：当前对话已达到 ${Math.round(contextAnalysis.usage.percentage * 100)}% 容量
🎯 重点关注：用户的最新需求和核心问题
💡 建议：优先处理重要信息，保持回复精准简洁`);
    }

    // 4. （已删除）老的动态角色内容注入逻辑，现在直接在步骤2中处理

    // 5. UI驱动的意图注入（原有）
    if (uiContext) {
      const uiIntentSection = this.buildUIIntentSection(uiContext);
      if (uiIntentSection.trim()) {
        sections.push(uiIntentSection);
        log.info(`🎯 [UI意图注入] 已添加UI意图指令`);
      }
    }

    // 🚨 Layer1职责边界修复：工具信息应该由Layer3处理，Layer1不应该处理工具注入
    // Layer1职责：只处理角色状态监控和角色内容，不处理工具集成
    console.log(`🎭 [Layer1-职责边界] Layer1不处理工具信息，工具集成由Layer3负责`);
    log.info(`🎭 [Layer1-职责边界] 跳过工具信息注入，保持Layer1职责纯净`);

    // 7. 基础系统提示词
    sections.push(`# 📝 BASE_SYSTEM_PROMPT\n${baseSystemPrompt}`);

    const finalPrompt = sections.join('\n\n');
    console.log(`📝 [DEBUG-系统提示词] 最终系统提示词构建完成:`);
    console.log(`📝 [DEBUG-系统提示词] - 总长度: ${finalPrompt.length}字符`);
    console.log(`📝 [DEBUG-系统提示词] - sections数量: ${sections.length}`);
    console.log(`📝 [DEBUG-系统提示词] - 前500字符预览: ${finalPrompt.substring(0, 500)}...`);
    
    return finalPrompt;
  }

  // shouldTriggerRoleActivation 方法已删除，因为不再需要工具调用激活逻辑

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
      highRiskSessions: 0
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

    // 角色激活请求（已简化：角色内容已直接注入，无需工具调用）
    if (uiContext.roleActivationRequest && uiContext.selectedRole) {
      intentions.push(`🎭 用户已通过UI选择角色：${uiContext.selectedRole}`);
      intentions.push(`角色能力已自动激活，请以该角色身份提供专业服务。`);
    }

    // 🔥 工作区状态处理（核心逻辑：工作区打开 = 注入提示词）
    if (uiContext.workspaceState?.isOpen) {
      // const { files } = uiContext.workspaceState; // Available but not used in current implementation
      
      intentions.push(`📁 工作区已打开，您可以使用以下工具操作文件：`);
      intentions.push(`  📖 deechat_workspace_read - 读取文件内容`);
      intentions.push(`  ✏️ deechat_workspace_write - 写入/修改文件`);
      intentions.push(`  📊 deechat_workspace_diff - 比较文件差异`);
      intentions.push(`  📋 deechat_workspace_list - 列出所有文件`);
      intentions.push(`  📈 deechat_workspace_stats - 获取工作区统计信息`);
      intentions.push(`  🗑️ deechat_workspace_delete - 删除指定文件`);
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


  /**
   * 构建基础注入变量（不包含工具信息）
   */
  private buildBasicInjectionVariables(
    context: ConversationContext
  ): Partial<InjectionVariables> {
    return {
      PROJECT_NAME: 'DeeChat',
      PROJECT_PATH: process.cwd(),
      TECH_STACK: 'TypeScript, Electron, React, PromptX, MCP',
      CONVERSATION_ROUNDS: context.totalRounds,
      AVAILABLE_TOOLS_DETAILED: '工具信息由独立工具层处理', // 占位符，实际由工具层提供
      RUNTIME_INJECTION: this.buildRuntimeInjection(context),
      USER_CONTEXT: this.buildUserContext(context),
      TOOL_SUBSTITUTION_RULES: this.buildToolSubstitutionRules(),
      EXECUTION_CONSTRAINTS: this.buildExecutionConstraints()
    };
  }


  // 工具格式化功能已移动到 ToolIntegrationLayer

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
- 继续输出：工具调用后必须继续提供解释或后续步骤
- 等待确认：不假设工具调用成功
- XML格式：确保格式正确性
- 思考先行：使用<thinking>分析需求`;
  }



  /**
   * 清除角色内容缓存（已简化，无实际操作）
   */
  clearRoleCache(): void {
    log.info('🗑️ [角色缓存] 角色内容缓存清除（无操作，由CoreLLMService管理）');
  }

}