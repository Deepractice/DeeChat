/**
 * 对话上下文分析器
 * 基于Cursor记忆系统和Windsurf计划机制的混合实现
 * 
 * 核心功能：
 * 1. 分析用户消息的意图类型和上下文需求
 * 2. 评估信息的记忆价值(1-5分评分系统)
 * 3. 维护动态对话状态和执行计划
 * 4. 提供智能的下一步行动建议
 */

import { PromptProvider, PromptSegment } from '../interfaces/ISystemPromptProvider';
import log from 'electron-log';

/**
 * 用户意图类型枚举
 * 基于Perplexity的查询类型分类系统
 */
export enum UserIntentType {
  // 技术实现类
  CODING = 'coding',                    // 编程、调试、代码分析
  DEBUGGING = 'debugging',              // 问题诊断、错误修复
  ARCHITECTURE = 'architecture',        // 系统设计、架构决策
  
  // 工具操作类  
  TOOL_ACTIVATION = 'tool_activation',  // 工具调用、角色激活
  RESOURCE_QUERY = 'resource_query',    // 资源查询、能力发现
  CONFIGURATION = 'configuration',      // 配置修改、设置调整
  
  // 信息查询类
  EXPLANATION = 'explanation',          // 概念解释、知识查询
  RESEARCH = 'research',               // 深度研究、学术分析
  COMPARISON = 'comparison',           // 对比分析、评估选择
  
  // 对话交互类
  CASUAL_CHAT = 'casual_chat',         // 闲聊、问候
  FEEDBACK = 'feedback',               // 反馈、纠错、评价
  PLANNING = 'planning',               // 计划制定、任务分解
  
  // 特殊类型
  UNCLEAR = 'unclear',                 // 模糊不清的请求
  COMPLEX = 'complex'                  // 复杂多步骤任务
}

/**
 * 对话上下文信息
 */
export interface ConversationContext {
  // 基础信息
  userId?: string;
  sessionId: string;
  timestamp: Date;
  
  // 消息分析
  userMessage: string;
  detectedIntent: UserIntentType;
  confidence: number;  // 0-1的置信度
  
  // 上下文状态
  currentFeature: string;  // 当前功能模块
  activeRole?: string;     // 激活的专业角色
  availableTools: string[]; // 可用工具列表
  
  // 记忆相关
  memoryScore: number;     // 1-5的记忆价值评分
  shouldRemember: boolean; // 是否需要记忆此交互
  memoryReason?: string;   // 记忆原因说明
  
  // 计划状态
  currentPlan?: string;    // 当前执行计划
  planNeedsUpdate: boolean; // 计划是否需要更新
  suggestedActions: string[]; // 建议的下一步行动
  
  // 特殊标记
  isCorrection: boolean;   // 是否是用户纠错
  isFrustration: boolean;  // 是否表达挫败感
  requiresTools: boolean;  // 是否需要工具支持
}

/**
 * 记忆评估标准
 * 基于Cursor记忆评分系统
 */
interface MemoryEvaluationCriteria {
  // 正面因素 (+分)
  isGeneral: boolean;      // 通用性规则
  isActionable: boolean;   // 可操作性
  isCorrection: boolean;   // 用户纠错
  expressesFrustration: boolean; // 表达挫败感
  isWorkflowPreference: boolean; // 工作流偏好
  
  // 负面因素 (-分)
  isFileSpecific: boolean;    // 特定文件相关
  isTaskSpecific: boolean;    // 特定任务相关
  isObvious: boolean;         // 显而易见的
  isVague: boolean;           // 模糊不清的
  isTemporary: boolean;       // 临时性的
}

/**
 * 对话上下文分析器核心类
 */
export class ConversationContextAnalyzer implements PromptProvider {
  private conversationHistory: ConversationContext[] = [];
  private currentContext?: ConversationContext;
  private maxHistorySize = 50; // 保留最近50次交互

  /**
   * 分析用户消息并生成对话上下文
   */
  async analyzeUserMessage(
    userMessage: string,
    sessionInfo: {
      sessionId: string;
      currentFeature: string;
      activeRole?: string;
      availableTools: string[];
    }
  ): Promise<ConversationContext> {
    // 1. 意图检测
    const { intent, confidence } = this.detectIntent(userMessage);
    
    // 2. 记忆价值评估
    const memoryEvaluation = this.evaluateMemoryValue(userMessage, intent);
    
    // 3. 计划状态分析
    const planAnalysis = this.analyzePlanNeeds(userMessage, intent);
    
    // 4. 构建上下文
    const context: ConversationContext = {
      sessionId: sessionInfo.sessionId,
      timestamp: new Date(),
      userMessage,
      detectedIntent: intent,
      confidence,
      currentFeature: sessionInfo.currentFeature,
      activeRole: sessionInfo.activeRole,
      availableTools: sessionInfo.availableTools,
      memoryScore: memoryEvaluation.score,
      shouldRemember: memoryEvaluation.score >= 4 || memoryEvaluation.forceRemember,
      memoryReason: memoryEvaluation.reason,
      currentPlan: this.getCurrentPlan(),
      planNeedsUpdate: planAnalysis.needsUpdate,
      suggestedActions: planAnalysis.suggestedActions,
      isCorrection: this.detectCorrection(userMessage),
      isFrustration: this.detectFrustration(userMessage),
      requiresTools: this.detectToolRequirement(userMessage, intent)
    };
    
    // 5. 更新历史记录
    this.addToHistory(context);
    this.currentContext = context;
    
    log.info(`🧠 [对话分析] 意图: ${intent}, 置信度: ${confidence.toFixed(2)}, 记忆分: ${memoryEvaluation.score}`);
    
    return context;
  }

  /**
   * 意图检测算法
   * 基于关键词匹配和语义模式识别
   */
  private detectIntent(message: string): { intent: UserIntentType; confidence: number } {
    const msg = message.toLowerCase().trim();
    
    // 工具激活类 (高优先级)
    if (this.matchesPatterns(msg, [
      'activate', 'action', '激活', '切换', 'switch to', '使用.*角色',
      'promptx.*action', 'call.*tool', '执行.*工具'
    ])) {
      return { intent: UserIntentType.TOOL_ACTIVATION, confidence: 0.9 };
    }
    
    // 资源查询类
    if (this.matchesPatterns(msg, [
      'welcome', 'list.*roles', '显示.*角色', '有什么.*工具', 'what.*available',
      '可用.*功能', 'show.*tools', 'promptx.*welcome'
    ])) {
      return { intent: UserIntentType.RESOURCE_QUERY, confidence: 0.85 };
    }
    
    // 编程实现类
    if (this.matchesPatterns(msg, [
      'implement', 'create.*function', 'write.*code', '实现.*功能', '编写.*代码',
      'add.*feature', '新增.*功能', 'build.*component', 'develop.*module'
    ])) {
      return { intent: UserIntentType.CODING, confidence: 0.8 };
    }
    
    // 调试诊断类
    if (this.matchesPatterns(msg, [
      'debug', 'fix.*error', '修复.*问题', 'troubleshoot', '解决.*bug',
      'why.*not.*work', '为什么.*不.*工作', 'error.*occurred', '出现.*错误'
    ])) {
      return { intent: UserIntentType.DEBUGGING, confidence: 0.85 };
    }
    
    // 架构设计类
    if (this.matchesPatterns(msg, [
      'architecture', 'design.*system', '设计.*架构', '如何.*组织', 'structure.*project',
      'best.*practice', '最佳.*实践', 'pattern.*recommend', '推荐.*模式'
    ])) {
      return { intent: UserIntentType.ARCHITECTURE, confidence: 0.75 };
    }
    
    // 配置设置类
    if (this.matchesPatterns(msg, [
      'configure', 'setup', '配置.*设置', '修改.*参数', 'change.*setting',
      'update.*config', '更新.*配置', 'modify.*option', '调整.*选项'
    ])) {
      return { intent: UserIntentType.CONFIGURATION, confidence: 0.8 };
    }
    
    // 解释说明类
    if (this.matchesPatterns(msg, [
      'what.*is', 'explain', '解释.*什么', '什么.*意思', 'how.*work',
      'tell.*me.*about', '介绍.*一下', 'define', '定义.*什么'
    ])) {
      return { intent: UserIntentType.EXPLANATION, confidence: 0.7 };
    }
    
    // 对比分析类
    if (this.matchesPatterns(msg, [
      'compare', 'vs', '对比.*区别', 'difference.*between', '选择.*哪个',
      'better.*option', '更好.*选择', 'pros.*cons', '优缺点'
    ])) {
      return { intent: UserIntentType.COMPARISON, confidence: 0.75 };
    }
    
    // 计划制定类
    if (this.matchesPatterns(msg, [
      'plan.*project', '制定.*计划', 'organize.*task', '组织.*任务',
      'step.*by.*step', '分步.*执行', 'roadmap', '路线图'
    ])) {
      return { intent: UserIntentType.PLANNING, confidence: 0.8 };
    }
    
    // 反馈纠错类 (重要指标)
    if (this.matchesPatterns(msg, [
      'wrong', 'incorrect', '错了', '不对', 'actually', '实际上',
      'should.*be', '应该.*是', 'not.*what.*i.*want', '不是.*我.*想要'
    ])) {
      return { intent: UserIntentType.FEEDBACK, confidence: 0.9 };
    }
    
    // 复杂任务检测
    if (this.isComplexRequest(msg)) {
      return { intent: UserIntentType.COMPLEX, confidence: 0.6 };
    }
    
    // 闲聊检测
    if (this.matchesPatterns(msg, [
      'hello', 'hi', '你好', '问候', 'how.*are.*you', '怎么样',
      'thank', '谢谢', 'bye', '再见', 'nice', '不错'
    ])) {
      return { intent: UserIntentType.CASUAL_CHAT, confidence: 0.8 };
    }
    
    // 默认：模糊意图
    return { intent: UserIntentType.UNCLEAR, confidence: 0.3 };
  }

  /**
   * 记忆价值评估
   * 基于Cursor记忆评分标准
   */
  private evaluateMemoryValue(message: string, intent: UserIntentType): {
    score: number;
    reason: string;
    forceRemember: boolean;
  } {
    const criteria = this.analyzeMemoryFactors(message, intent);
    let score = 3; // 基础分数
    let reasons: string[] = [];
    let forceRemember = false;
    
    // 正面因素加分
    if (criteria.isCorrection) {
      score += 2;
      reasons.push('用户纠错信息');
      forceRemember = true; // 用户纠错必须记住
    }
    
    if (criteria.expressesFrustration) {
      score += 1;
      reasons.push('用户挫败感表达');
      forceRemember = true;
    }
    
    if (criteria.isWorkflowPreference) {
      score += 1;
      reasons.push('工作流偏好');
    }
    
    if (criteria.isActionable && criteria.isGeneral) {
      score += 1;
      reasons.push('通用可操作规则');
    }
    
    // 负面因素减分
    if (criteria.isFileSpecific) {
      score -= 2;
      reasons.push('特定文件相关');
    }
    
    if (criteria.isTaskSpecific) {
      score -= 1;
      reasons.push('特定任务相关');
    }
    
    if (criteria.isObvious) {
      score -= 2;
      reasons.push('显而易见的信息');
    }
    
    if (criteria.isVague) {
      score -= 1;
      reasons.push('模糊不清的描述');
    }
    
    if (criteria.isTemporary) {
      score -= 1;
      reasons.push('临时性信息');
    }
    
    // 特殊情况：用户明确要求记住
    if (message.toLowerCase().includes('remember') || 
        message.includes('记住') || 
        message.includes('保存')) {
      score = 5;
      forceRemember = true;
      reasons = ['用户明确要求记忆'];
    }
    
    // 分数范围限制
    score = Math.max(1, Math.min(5, score));
    
    return {
      score,
      reason: reasons.join(', ') || '标准评估',
      forceRemember
    };
  }

  /**
   * 计划状态分析
   * 基于Windsurf的动态计划更新机制
   * 强调用户决策权的建议生成
   */
  private analyzePlanNeeds(_message: string, intent: UserIntentType): {
    needsUpdate: boolean;
    suggestedActions: string[];
  } {
    const suggestedActions: string[] = [];
    let needsUpdate = false;
    
    // 根据意图类型提供建议（以用户为决策者的语言）
    switch (intent) {
      case UserIntentType.TOOL_ACTIVATION:
        suggestedActions.push('询问是否调用promptx_action工具激活角色');
        suggestedActions.push('激活后询问是否学习角色相关资源');
        break;
        
      case UserIntentType.RESOURCE_QUERY:
        suggestedActions.push('询问是否调用promptx_welcome展示可用资源');
        break;
        
      case UserIntentType.CODING:
        suggestedActions.push('分析需求并提供技术栈选择');
        suggestedActions.push('制定实现计划草案，等待用户确认');
        suggestedActions.push('用户确认后开始编码实现');
        needsUpdate = true;
        break;
        
      case UserIntentType.DEBUGGING:
        suggestedActions.push('收集错误信息并展示给用户');
        suggestedActions.push('分析问题根本原因，提供诊断结果');
        suggestedActions.push('提供多种解决方案让用户选择');
        break;
        
      case UserIntentType.COMPLEX:
        suggestedActions.push('分解复杂任务为子步骤，展示给用户');
        suggestedActions.push('制定详细执行计划，等待用户审核');
        suggestedActions.push('用户同意后按步骤逐一执行');
        needsUpdate = true;
        break;
        
      case UserIntentType.FEEDBACK:
        if (this.currentContext) {
          suggestedActions.push('立即承认并感谢用户纠错');
          suggestedActions.push('记录用户纠错信息到记忆系统');
          suggestedActions.push('询问是否需要调整当前执行策略');
          needsUpdate = true;
        }
        break;
        
      case UserIntentType.ARCHITECTURE:
        suggestedActions.push('提供多种架构设计选项');
        suggestedActions.push('解释每种方案的优劣');
        suggestedActions.push('等待用户选择偏好的方案');
        break;
        
      case UserIntentType.PLANNING:
        suggestedActions.push('制定初步计划草案');
        suggestedActions.push('展示计划给用户审核');
        suggestedActions.push('根据用户反馈调整细节');
        needsUpdate = true;
        break;
    }
    
    return { needsUpdate, suggestedActions };
  }

  /**
   * 获取系统提示词片段
   * 实现PromptProvider接口
   */
  getSegments(): PromptSegment[] {
    if (!this.currentContext) {
      return [];
    }
    
    const segments: PromptSegment[] = [];
    
    // 添加对话状态提示
    segments.push({
      id: 'conversation-context',
      content: this.buildContextPrompt(),
      enabled: true,
      priority: 500,  // 高优先级，在功能上下文之上
      condition: () => !!this.currentContext
    });
    
    // 添加意图识别指导
    if (this.currentContext.detectedIntent !== UserIntentType.UNCLEAR) {
      segments.push({
        id: 'intent-guidance',
        content: this.buildIntentGuidancePrompt(),
        enabled: true,
        priority: 450,
        condition: () => this.currentContext!.confidence > 0.6
      });
    }
    
    // 添加工具调用建议
    if (this.currentContext.requiresTools) {
      segments.push({
        id: 'tool-recommendation',
        content: this.buildToolRecommendationPrompt(),
        enabled: true,
        priority: 400,
        condition: () => this.currentContext!.requiresTools
      });
    }
    
    return segments;
  }

  /**
   * 构建对话上下文提示词
   */
  private buildContextPrompt(): string {
    const ctx = this.currentContext!;
    
    return `## 对话上下文分析 🧠

**用户意图**: ${this.getIntentDisplayName(ctx.detectedIntent)} (置信度: ${(ctx.confidence * 100).toFixed(0)}%)
**当前功能**: ${ctx.currentFeature}
**激活角色**: ${ctx.activeRole || '无'}
**可用工具**: ${ctx.availableTools.length}个

### 上下文特征
${ctx.isCorrection ? '⚠️ **用户纠错** - 需要特别注意并记忆此信息' : ''}
${ctx.isFrustration ? '😤 **用户挫败** - 需要耐心解释并提供更好的解决方案' : ''}
${ctx.shouldRemember ? `🧠 **需要记忆** - 记忆价值: ${ctx.memoryScore}/5 (${ctx.memoryReason})` : ''}
${ctx.planNeedsUpdate ? '📋 **计划更新** - 当前情况需要调整执行计划' : ''}

### 建议行动
${ctx.suggestedActions.map(action => `- ${action}`).join('\n')}`;
  }

  /**
   * 构建意图指导提示词
   */
  private buildIntentGuidancePrompt(): string {
    const intent = this.currentContext!.detectedIntent;
    
    const guidanceMap: Record<UserIntentType, string> = {
      [UserIntentType.TOOL_ACTIVATION]: '用户想要激活专业角色或调用工具。**征得同意后**使用相应的MCP工具。',
      [UserIntentType.RESOURCE_QUERY]: '用户想了解可用资源。**经用户确认后**调用promptx_welcome展示角色和工具列表。',
      [UserIntentType.CODING]: '用户需要编程实现。**先提供方案选择**，分析需求后**经用户确认**再制定计划并提供代码。',
      [UserIntentType.DEBUGGING]: '用户遇到技术问题。**提供诊断建议**，**让用户选择**解决方案后执行。',
      [UserIntentType.ARCHITECTURE]: '用户需要架构设计指导。**提供多个设计选项**，解释优劣后**让用户决定**。',
      [UserIntentType.CONFIGURATION]: '用户需要配置帮助。**展示配置选项**，说明影响后**等待用户选择**。',
      [UserIntentType.EXPLANATION]: '用户需要概念解释。直接提供清晰说明，**询问是否需要更多细节**。',
      [UserIntentType.RESEARCH]: '用户需要深度分析。**询问研究重点**，提供全面分析。',
      [UserIntentType.COMPARISON]: '用户需要对比分析。提供客观对比表格，**让用户根据需求选择**。',
      [UserIntentType.PLANNING]: '用户需要制定计划。**提供计划草案**，**经用户审核确认**后细化。',
      [UserIntentType.FEEDBACK]: '用户在提供反馈或纠错。**立即承认并感谢**，认真记忆用户纠正。',
      [UserIntentType.CASUAL_CHAT]: '用户在进行轻松对话。保持友好氛围，**尊重用户交流节奏**。',
      [UserIntentType.COMPLEX]: '用户提出复杂需求。**先分解任务展示给用户**，**经用户同意**后制定详细计划。',
      [UserIntentType.UNCLEAR]: '用户意图不够清晰。**礼貌询问澄清**，提供选项帮助用户表达需求。'
    };
    
    return `## 意图处理指导 🎯

**检测意图**: ${this.getIntentDisplayName(intent)}

**处理策略**: ${guidanceMap[intent]}

⚠️ **决策权原则**: 用户永远是决策者，AI只提供建议和选择，任何关键行动都需要用户明确同意。

**注意事项**: ${this.getIntentSpecificNotes(intent)}`;
  }

  /**
   * 构建工具推荐提示词
   */
  private buildToolRecommendationPrompt(): string {
    const ctx = this.currentContext!;
    const recommendedTools = this.getRecommendedTools(ctx.detectedIntent, ctx.availableTools);
    
    return `## 推荐工具调用 🔧

基于当前用户意图，建议使用以下工具：

${recommendedTools.map(tool => `- **${tool.name}**: ${tool.reason}`).join('\n')}

**调用时机**: ${this.getToolCallTiming(ctx.detectedIntent)}`;
  }

  // ==================== 辅助方法 ====================
  
  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    });
  }
  
  private isComplexRequest(message: string): boolean {
    // 检测复杂请求的特征
    const complexIndicators = [
      message.length > 200,  // 长消息
      (message.match(/\band\b/gi) || []).length > 3,  // 多个"and"
      (message.match(/[,;]/g) || []).length > 3,      // 多个分隔符
      /step.*\d.*step|phase.*\d.*phase/i.test(message), // 多步骤
      /first.*then.*finally|initially.*subsequently.*ultimately/i.test(message) // 时序词
    ];
    
    return complexIndicators.filter(Boolean).length >= 2;
  }
  
  private analyzeMemoryFactors(message: string, _intent: UserIntentType): MemoryEvaluationCriteria {
    const msg = message.toLowerCase();
    
    return {
      isGeneral: !this.matchesPatterns(msg, ['this.*file', '这个.*文件', 'current.*project', '当前.*项目']),
      isActionable: this.matchesPatterns(msg, ['should.*', 'must.*', '应该.*', '必须.*', 'prefer.*', '偏好.*']),
      isCorrection: this.detectCorrection(message),
      expressesFrustration: this.detectFrustration(message),
      isWorkflowPreference: this.matchesPatterns(msg, ['workflow', '工作流', 'process', '流程', 'method', '方法']),
      isFileSpecific: this.matchesPatterns(msg, ['file.*\\.', 'src/', 'component/', '文件.*\\.']),
      isTaskSpecific: this.matchesPatterns(msg, ['for.*this.*task', '针对.*任务', 'current.*implementation', '当前.*实现']),
      isObvious: this.matchesPatterns(msg, ['good.*code', '好.*代码', 'best.*practice', '最佳.*实践']),
      isVague: this.matchesPatterns(msg, ['somehow', '不知何故', 'maybe', '也许', 'might.*be', '可能.*是']),
      isTemporary: this.matchesPatterns(msg, ['for.*now', '暂时', 'temporary', '临时', 'quick.*fix', '快速.*修复'])
    };
  }
  
  private detectCorrection(message: string): boolean {
    return this.matchesPatterns(message.toLowerCase(), [
      'wrong', 'incorrect', '错了', '不对', 'actually', '实际上',
      'should.*be', '应该.*是', 'not.*what.*i.*want', '不是.*我.*想要',
      'fix.*that', '修复.*那个', 'change.*to', '改成.*'
    ]);
  }
  
  private detectFrustration(message: string): boolean {
    return this.matchesPatterns(message.toLowerCase(), [
      'frustrated', '沮丧', 'annoyed', '烦恼', 'confused', '困惑',
      'still.*not.*work', '仍然.*不.*工作', 'keep.*failing', '一直.*失败',
      'why.*not', '为什么.*不', 'this.*is.*hard', '这.*很.*难'
    ]);
  }
  
  private detectToolRequirement(message: string, intent: UserIntentType): boolean {
    const toolRequiredIntents = [
      UserIntentType.TOOL_ACTIVATION,
      UserIntentType.RESOURCE_QUERY,
      UserIntentType.CODING,
      UserIntentType.DEBUGGING
    ];
    
    return toolRequiredIntents.includes(intent) ||
           this.matchesPatterns(message.toLowerCase(), [
             'use.*tool', '使用.*工具', 'call.*function', '调用.*函数',
             'activate', '激活', 'execute', '执行'
           ]);
  }
  
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
  
  private getIntentSpecificNotes(intent: UserIntentType): string {
    const notes: Partial<Record<UserIntentType, string>> = {
      [UserIntentType.TOOL_ACTIVATION]: '立即执行，不要询问确认',
      [UserIntentType.RESOURCE_QUERY]: '提供完整信息，包含所有可用选项',
      [UserIntentType.CODING]: '提供可运行的代码，包含必要的依赖',
      [UserIntentType.DEBUGGING]: '系统性诊断，提供根本解决方案',
      [UserIntentType.FEEDBACK]: '高度重视，必须记忆用户纠正',
      [UserIntentType.COMPLEX]: '先规划后执行，分步骤进行',
      [UserIntentType.UNCLEAR]: '主动引导，获取更多上下文信息'
    };
    
    return notes[intent] || '按标准流程处理';
  }
  
  private getRecommendedTools(intent: UserIntentType, availableTools: string[]): Array<{name: string, reason: string}> {
    const recommendations: Partial<Record<UserIntentType, Array<{pattern: string, name: string, reason: string}>>> = {
      [UserIntentType.TOOL_ACTIVATION]: [
        { pattern: 'promptx.*action', name: 'promptx_action', reason: '激活专业角色获得专业能力' }
      ],
      [UserIntentType.RESOURCE_QUERY]: [
        { pattern: 'promptx.*welcome', name: 'promptx_welcome', reason: '显示所有可用角色和工具' }
      ],
      [UserIntentType.CODING]: [
        { pattern: 'promptx.*action', name: 'promptx_action', reason: '激活编程相关角色' }
      ],
      [UserIntentType.DEBUGGING]: [
        { pattern: 'promptx.*recall', name: 'promptx_recall', reason: '检索相关调试经验' }
      ]
    };
    
    const intentRecs = recommendations[intent] || [];
    return intentRecs
      .filter(rec => availableTools.some(tool => tool.includes(rec.pattern)))
      .map(rec => ({ name: rec.name, reason: rec.reason }));
  }
  
  private getToolCallTiming(intent: UserIntentType): string {
    const timings: Partial<Record<UserIntentType, string>> = {
      [UserIntentType.TOOL_ACTIVATION]: '立即调用，响应开始时',
      [UserIntentType.RESOURCE_QUERY]: '作为第一步操作',
      [UserIntentType.CODING]: '在分析需求后，实现前调用',
      [UserIntentType.DEBUGGING]: '在收集错误信息后调用'
    };
    
    return timings[intent] || '根据具体情况判断';
  }
  
  private addToHistory(context: ConversationContext): void {
    this.conversationHistory.push(context);
    
    // 保持历史记录大小限制
    if (this.conversationHistory.length > this.maxHistorySize) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistorySize);
    }
  }
  
  private getCurrentPlan(): string | undefined {
    // 从历史记录中获取最近的计划
    const recentPlan = this.conversationHistory
      .slice()
      .reverse()
      .find(ctx => ctx.currentPlan);
    
    return recentPlan?.currentPlan;
  }

  /**
   * 获取当前对话上下文
   */
  getCurrentContext(): ConversationContext | undefined {
    return this.currentContext;
  }

  /**
   * 获取对话历史
   */
  getConversationHistory(): ConversationContext[] {
    return [...this.conversationHistory];
  }

  /**
   * 清空对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
    this.currentContext = undefined;
  }
}

/**
 * 全局对话上下文分析器实例
 */
export const conversationContextAnalyzer = new ConversationContextAnalyzer();