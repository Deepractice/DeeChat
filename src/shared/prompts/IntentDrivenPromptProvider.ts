/**
 * 意图驱动的提示词提供器
 * 整合用户自主权、对话上下文分析和智能意图识别
 * 
 * 核心特性：
 * 1. 用户永远是决策者的原则（最高优先级）
 * 2. 智能意图识别和上下文分析
 * 3. 基于Cursor记忆系统的学习机制
 * 4. 基于Windsurf的动态计划更新
 * 5. Theory of Mind的主动理解能力
 */

import { PromptProvider, PromptSegment } from '../interfaces/ISystemPromptProvider';
import { userAutonomyProvider } from './UserAutonomyProvider';
import { conversationContextAnalyzer, ConversationContext, UserIntentType } from './ConversationContextAnalyzer';
import { featureContextProvider, DeeChatFeature } from './FeatureContextProvider';
import log from 'electron-log';

/**
 * 会话状态信息
 */
export interface SessionState {
  sessionId: string;
  userId?: string;
  currentFeature: DeeChatFeature;
  activeRole?: string;
  availableTools: string[];
  lastUserMessage?: string;
  conversationTurn: number;
}

/**
 * 意图驱动的智能提示词系统
 */
export class IntentDrivenPromptProvider implements PromptProvider {
  private currentSession?: SessionState;
  private isAnalysisEnabled = true;

  /**
   * 更新会话状态
   * 每次用户消息到达时都应该调用此方法
   */
  async updateSession(
    userMessage: string,
    sessionInfo: {
      sessionId: string;
      userId?: string;
      currentFeature: DeeChatFeature;
      activeRole?: string;
      availableTools: string[];
    }
  ): Promise<ConversationContext> {
    // 更新当前会话状态
    this.currentSession = {
      sessionId: sessionInfo.sessionId,
      userId: sessionInfo.userId,
      currentFeature: sessionInfo.currentFeature,
      activeRole: sessionInfo.activeRole,
      availableTools: sessionInfo.availableTools,
      lastUserMessage: userMessage,
      conversationTurn: (this.currentSession?.conversationTurn || 0) + 1
    };

    // 更新功能上下文
    featureContextProvider.setCurrentFeature(sessionInfo.currentFeature);

    // 分析用户消息的意图和上下文（如果启用）
    let context: ConversationContext;
    if (this.isAnalysisEnabled) {
      try {
        context = await conversationContextAnalyzer.analyzeUserMessage(userMessage, {
          sessionId: sessionInfo.sessionId,
          currentFeature: sessionInfo.currentFeature,
          activeRole: sessionInfo.activeRole,
          availableTools: sessionInfo.availableTools
        });

        log.info(`🎯 [意图识别] ${context.detectedIntent} (${(context.confidence * 100).toFixed(0)}%) - ${userMessage.substring(0, 50)}...`);
      } catch (error) {
        log.error('🚨 [意图识别] 分析失败，使用基础模式:', error);
        context = this.createFallbackContext(userMessage, sessionInfo);
      }
    } else {
      context = this.createFallbackContext(userMessage, sessionInfo);
    }

    return context;
  }

  /**
   * 获取系统提示词片段
   * 按优先级整合所有提供器的片段
   */
  getSegments(): PromptSegment[] {
    const allSegments: PromptSegment[] = [];

    // 1. 用户自主权原则（最高优先级）
    allSegments.push(...userAutonomyProvider.getSegments());

    // 2. 对话上下文分析（如果有当前上下文）
    if (this.currentSession && this.isAnalysisEnabled) {
      allSegments.push(...conversationContextAnalyzer.getSegments());
    }

    // 3. 功能上下文
    allSegments.push(...featureContextProvider.getSegments());

    // 4. Theory of Mind 增强（如果分析启用）
    if (this.isAnalysisEnabled && this.currentSession) {
      const tomSegment = this.buildTheoryOfMindSegment();
      if (tomSegment) {
        allSegments.push(tomSegment);
      }
    }

    // 5. 会话连续性增强（如果有历史上下文）
    const continuitySegment = this.buildContinuitySegment();
    if (continuitySegment) {
      allSegments.push(continuitySegment);
    }

    return allSegments.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 构建Theory of Mind（心智理论）段落
   * 让AI主动理解和推测用户的心理状态和需求
   */
  private buildTheoryOfMindSegment(): PromptSegment | null {
    if (!this.currentSession) return null;

    const context = conversationContextAnalyzer.getCurrentContext();
    if (!context) return null;

    return {
      id: 'theory-of-mind-enhancement',
      content: `## 用户心理状态理解 🧠

### 当前用户状态推测：
${this.analyzeUserMentalState(context)}

### 主动理解指导：
1. **意图背景理解**: ${this.getIntentBackground(context.detectedIntent)}
2. **情绪状态感知**: ${this.getEmotionalState(context)}
3. **期望结果预测**: ${this.predictUserExpectations(context)}
4. **潜在关注点**: ${this.identifyPotentialConcerns(context)}

### Theory of Mind 行动原则：
- **主动询问确认**：不确定时主动问"我理解你是想要...，这样对吗？"
- **解释推理过程**：让用户了解你的思考路径
- **预判后续需求**：提前考虑用户可能的下一步需要
- **情感共鸣响应**：识别并适当回应用户的情感状态
- **个性化适应**：根据用户的交流风格调整回复方式`,
      enabled: true,
      priority: 350,
      condition: () => context!.confidence > 0.5
    };
  }

  /**
   * 构建会话连续性段落
   * 基于历史对话提供上下文连续性
   */
  private buildContinuitySegment(): PromptSegment | null {
    if (!this.currentSession) return null;

    const history = conversationContextAnalyzer.getConversationHistory();
    if (history.length === 0) return null;

    const recentContexts = history.slice(-3); // 最近3轮对话
    const continuityInsights = this.analyzeContinuity(recentContexts);

    return {
      id: 'conversation-continuity',
      content: `## 对话连续性分析 🔄

### 对话轮次：第 ${this.currentSession.conversationTurn} 轮

### 近期对话模式：
${continuityInsights.patterns.map(pattern => `- ${pattern}`).join('\n')}

### 用户偏好总结：
${continuityInsights.preferences.map(pref => `- ${pref}`).join('\n')}

### 连续性指导：
- **保持话题连贯性**：${continuityInsights.topicContinuity}
- **风格一致性**：${continuityInsights.styleConsistency}
- **避免重复问询**：已确认的用户偏好无需重复询问
- **渐进式深入**：在用户感兴趣的领域逐步深入

${continuityInsights.hasCorrections ? '⚠️ **注意**：用户在最近的对话中有纠错，请特别留意相关偏好。' : ''}`,
      enabled: true,
      priority: 250,
      condition: () => history.length > 1
    };
  }

  /**
   * 分析用户心理状态
   */
  private analyzeUserMentalState(context: ConversationContext): string {
    const states: string[] = [];

    // 基于意图分析心理状态
    switch (context.detectedIntent) {
      case UserIntentType.DEBUGGING:
        states.push('可能感到困扰，需要技术支持');
        break;
      case UserIntentType.COMPLEX:
        states.push('面临复杂挑战，需要分步指导');
        break;
      case UserIntentType.FEEDBACK:
        states.push('有明确意见，希望得到正确回应');
        break;
      case UserIntentType.UNCLEAR:
        states.push('目标不够明确，需要引导澄清');
        break;
      case UserIntentType.TOOL_ACTIVATION:
        states.push('有明确目标，希望快速获得专业能力');
        break;
    }

    // 基于特殊标记分析
    if (context.isCorrection) {
      states.push('**正在纠正误解**，需要认真对待');
    }
    if (context.isFrustration) {
      states.push('**可能感到挫败**，需要耐心和共鸣');
    }

    // 基于置信度分析
    if (context.confidence > 0.8) {
      states.push('意图表达清晰，用户目标明确');
    } else if (context.confidence < 0.5) {
      states.push('表达可能模糊，需要主动确认理解');
    }

    return states.join('\n- ');
  }

  /**
   * 获取意图背景理解
   */
  private getIntentBackground(intent: UserIntentType): string {
    const backgrounds: Record<UserIntentType, string> = {
      [UserIntentType.CODING]: '用户想要解决具体的编程问题，可能有时间压力',
      [UserIntentType.DEBUGGING]: '用户遇到了阻碍进展的技术障碍，可能已经尝试了一些方法',
      [UserIntentType.ARCHITECTURE]: '用户需要在多个方案中做出重要决策，关注长远影响',
      [UserIntentType.TOOL_ACTIVATION]: '用户知道需要专业能力，希望快速获得工具支持',
      [UserIntentType.RESOURCE_QUERY]: '用户在探索可能性，可能是项目初期的信息收集',
      [UserIntentType.CONFIGURATION]: '用户需要调整系统以适应特定需求，可能缺乏经验',
      [UserIntentType.EXPLANATION]: '用户遇到了知识空白，希望理解概念或机制',
      [UserIntentType.RESEARCH]: '用户需要深入了解某个主题，可能是为了做出决策',
      [UserIntentType.COMPARISON]: '用户面临选择困难，需要客观分析来支持决策',
      [UserIntentType.PLANNING]: '用户准备开始新项目或任务，需要结构化指导',
      [UserIntentType.FEEDBACK]: '用户发现了问题或有改进建议，希望得到回应',
      [UserIntentType.CASUAL_CHAT]: '用户想要轻松的交流，可能是休息或建立关系',
      [UserIntentType.COMPLEX]: '用户面临多方面的挑战，可能感到压力或不知从何开始',
      [UserIntentType.UNCLEAR]: '用户可能在思考过程中，尚未完全明确自己的需求'
    };

    return backgrounds[intent] || '用户意图需要进一步理解';
  }

  /**
   * 获取情绪状态分析
   */
  private getEmotionalState(context: ConversationContext): string {
    if (context.isFrustration) return '**挫败或困扰** - 需要耐心和积极的支持';
    if (context.isCorrection) return '**需要准确理解** - 用户希望得到正确的回应';
    
    const emotionMap: Partial<Record<UserIntentType, string>> = {
      [UserIntentType.DEBUGGING]: '可能**焦虑或急迫** - 需要快速有效的解决方案',
      [UserIntentType.COMPLEX]: '可能**压力较大** - 需要分解任务减轻认知负担',
      [UserIntentType.TOOL_ACTIVATION]: '**目标导向** - 希望快速获得能力',
      [UserIntentType.RESOURCE_QUERY]: '**探索状态** - 对新可能性感兴趣',
      [UserIntentType.CASUAL_CHAT]: '**轻松愉快** - 享受交流过程',
      [UserIntentType.FEEDBACK]: '**认真专注** - 重视准确性和质量'
    };

    return emotionMap[context.detectedIntent] || '**中性状态** - 保持专业友好';
  }

  /**
   * 预测用户期望结果
   */
  private predictUserExpectations(context: ConversationContext): string {
    const expectations: Partial<Record<UserIntentType, string>> = {
      [UserIntentType.CODING]: '可运行的代码 + 清晰的解释',
      [UserIntentType.DEBUGGING]: '问题的根本原因 + 具体解决步骤',
      [UserIntentType.ARCHITECTURE]: '多个方案选择 + 优劣分析 + 推荐建议',
      [UserIntentType.TOOL_ACTIVATION]: '立即获得专业角色能力',
      [UserIntentType.RESOURCE_QUERY]: '完整的可用选项列表 + 使用指导',
      [UserIntentType.EXPLANATION]: '清晰易懂的概念解释 + 实际例子',
      [UserIntentType.PLANNING]: '详细可行的行动计划 + 时间预估',
      [UserIntentType.FEEDBACK]: '认真对待 + 改进承诺 + 感谢确认'
    };

    return expectations[context.detectedIntent] || '准确理解需求 + 有针对性的帮助';
  }

  /**
   * 识别潜在关注点
   */
  private identifyPotentialConcerns(context: ConversationContext): string {
    const concerns: string[] = [];

    if (context.detectedIntent === UserIntentType.CODING) {
      concerns.push('代码质量和最佳实践', '性能和安全性', '维护性和扩展性');
    }
    
    if (context.detectedIntent === UserIntentType.ARCHITECTURE) {
      concerns.push('扩展性和未来兼容性', '技术债务', '团队能力匹配');
    }
    
    if (context.detectedIntent === UserIntentType.DEBUGGING) {
      concerns.push('时间成本', '是否会引入新问题', '根本解决vs临时修复');
    }

    if (context.requiresTools) {
      concerns.push('工具使用的安全性', '对现有系统的影响');
    }

    if (context.confidence < 0.6) {
      concerns.push('AI是否真正理解了需求');
    }

    return concerns.length > 0 ? concerns.join('、') : '暂无明显关注点';
  }

  /**
   * 分析对话连续性
   */
  private analyzeContinuity(contexts: ConversationContext[]): {
    patterns: string[];
    preferences: string[];
    topicContinuity: string;
    styleConsistency: string;
    hasCorrections: boolean;
  } {
    const patterns: string[] = [];
    const _preferences: string[] = [];
    let hasCorrections = false;

    // 分析意图模式
    const intentCounts: Record<string, number> = {};
    contexts.forEach(ctx => {
      intentCounts[ctx.detectedIntent] = (intentCounts[ctx.detectedIntent] || 0) + 1;
      if (ctx.isCorrection) hasCorrections = true;
    });

    const dominantIntent = Object.keys(intentCounts).reduce((a, b) => 
      intentCounts[a] > intentCounts[b] ? a : b
    );

    if (intentCounts[dominantIntent] > 1) {
      patterns.push(`偏好${this.getIntentDisplayName(dominantIntent as UserIntentType)}类型的交互`);
    }

    // 分析工具使用模式
    const toolUsers = contexts.filter(ctx => ctx.requiresTools);
    if (toolUsers.length > 0) {
      patterns.push('倾向于使用工具增强的解决方案');
    }

    // 分析记忆模式
    const highValueMemories = contexts.filter(ctx => ctx.memoryScore >= 4);
    if (highValueMemories.length > 0) {
      patterns.push('提供了有价值的个人偏好信息');
    }

    // 分析功能使用模式
    const features = [...new Set(contexts.map(ctx => ctx.currentFeature))];
    if (features.length === 1) {
      patterns.push(`主要在${features[0]}功能中活动`);
    }

    return {
      patterns,
      preferences: _preferences, // 可以从记忆系统中获取
      topicContinuity: '保持在相关技术领域的深度交流',
      styleConsistency: '维持专业而友好的交流风格',
      hasCorrections
    };
  }

  /**
   * 创建回退上下文（当分析失败时使用）
   */
  private createFallbackContext(userMessage: string, sessionInfo: any): ConversationContext {
    return {
      sessionId: sessionInfo.sessionId,
      timestamp: new Date(),
      userMessage,
      detectedIntent: UserIntentType.UNCLEAR,
      confidence: 0.3,
      currentFeature: sessionInfo.currentFeature,
      activeRole: sessionInfo.activeRole,
      availableTools: sessionInfo.availableTools,
      memoryScore: 1,
      shouldRemember: false,
      currentPlan: undefined,
      planNeedsUpdate: false,
      suggestedActions: ['询问用户澄清需求', '提供常见选项供参考'],
      isCorrection: false,
      isFrustration: false,
      requiresTools: false
    };
  }

  /**
   * 获取意图显示名称
   */
  private getIntentDisplayName(intent: UserIntentType): string {
    const displayNames: Record<UserIntentType, string> = {
      [UserIntentType.CODING]: '编程实现',
      [UserIntentType.DEBUGGING]: '问题调试',
      [UserIntentType.ARCHITECTURE]: '架构设计',
      [UserIntentType.TOOL_ACTIVATION]: '工具激活',
      [UserIntentType.RESOURCE_QUERY]: '资源查询',
      [UserIntentType.CONFIGURATION]: '配置设置',
      [UserIntentType.EXPLANATION]: '概念解释',
      [UserIntentType.RESEARCH]: '深度研究',
      [UserIntentType.COMPARISON]: '对比分析',
      [UserIntentType.CASUAL_CHAT]: '轻松交流',
      [UserIntentType.FEEDBACK]: '反馈纠错',
      [UserIntentType.PLANNING]: '计划制定',
      [UserIntentType.UNCLEAR]: '意图不明',
      [UserIntentType.COMPLEX]: '复杂任务'
    };
    
    return displayNames[intent] || '未知意图';
  }

  /**
   * 获取当前会话状态
   */
  getCurrentSession(): SessionState | undefined {
    return this.currentSession;
  }

  /**
   * 启用/禁用意图分析
   */
  setAnalysisEnabled(enabled: boolean): void {
    this.isAnalysisEnabled = enabled;
    log.info(`🧠 [意图分析] ${enabled ? '启用' : '禁用'} 智能分析功能`);
  }

  /**
   * 重置会话状态
   */
  resetSession(): void {
    this.currentSession = undefined;
    conversationContextAnalyzer.clearHistory();
    log.info('🔄 [会话重置] 清空对话历史和会话状态');
  }
}

/**
 * 全局意图驱动提示词提供器实例
 */
export const intentDrivenPromptProvider = new IntentDrivenPromptProvider();