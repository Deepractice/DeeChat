/**
 * 增强的系统提示词提供器
 * 集成DeeChat专属提示词系统，基于PromptX生态设计
 * 
 * 核心特性：
 * 1. 基于PromptX认知框架的智能角色系统
 * 2. DeeChat原生的用户自主权保护
 * 3. 意图驱动的对话连续性管理
 * 4. MCP工具生态的深度集成
 */

import { SystemPromptProvider } from '../services/SystemPromptProvider';
import { DeeChatPromptInitializer } from './DeeChatPromptInitializer';
import { DeeChatFeature } from './FeatureContextProvider';
import { intentDrivenPromptProvider, SessionState } from './IntentDrivenPromptProvider';
import { conversationContextAnalyzer, ConversationContext } from './ConversationContextAnalyzer';
import { UnifiedToolProvider } from './UnifiedToolProvider';
import { MCPIntegrationService } from '../../main/services/mcp/client/MCPIntegrationService';
import log from 'electron-log';

/**
 * DeeChat增强系统提示词提供器
 */
export class EnhancedSystemPromptProvider extends SystemPromptProvider {
  private deeChatInitializer: DeeChatPromptInitializer;
  private autoInitialized: boolean = false;
  private intentSystemEnabled: boolean = true;
  private unifiedToolProvider: UnifiedToolProvider;
  private mcpIntegrationService: MCPIntegrationService;
  
  constructor() {
    super();
    this.deeChatInitializer = new DeeChatPromptInitializer(this);
    this.unifiedToolProvider = new UnifiedToolProvider();
    this.mcpIntegrationService = MCPIntegrationService.getInstance();
    log.info('🚀 [增强提示词系统] 初始化DeeChat+PromptX集成系统');
  }

  /**
   * 初始化DeeChat提示词系统
   */
  async initializeDeeChat(): Promise<void> {
    if (!this.deeChatInitializer.initialized) {
      await this.deeChatInitializer.initialize();
      this.autoInitialized = true;
    }
  }

  /**
   * 确保初始化（懒加载模式）
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.autoInitialized) {
      await this.initializeDeeChat();
    }
  }

  /**
   * 重写buildSystemPrompt，集成意图驱动系统
   */
  buildSystemPrompt(): string {
    // 同步版本，不包含动态工具发现
    return this.buildBasicSystemPrompt();
  }

  /**
   * 异步版本的系统提示词构建，包含动态工具发现
   */
  async buildSystemPromptWithTools(): Promise<string> {
    // 获取基础提示词
    let systemPrompt = this.buildBasicSystemPrompt();

    try {
      // 🔥 动态工具发现
      log.info('[增强提示词系统] 开始动态工具发现...');
      const toolsSection = await this.unifiedToolProvider.getAvailableToolsDescription(this.mcpIntegrationService);
      
      // 将工具描述添加到系统提示词中
      systemPrompt += `\n\n${toolsSection}`;
      
      log.info('[增强提示词系统] 动态工具发现完成并集成到系统提示词');
    } catch (error) {
      log.error('[增强提示词系统] 动态工具发现失败:', error);
      // 如果工具发现失败，添加一个说明
      systemPrompt += `\n\n## 工具状态\n\n当前工具发现遇到问题，系统将以基础对话模式运行。`;
    }

    return systemPrompt;
  }

  /**
   * 构建基础系统提示词（不包含工具发现）
   */
  private buildBasicSystemPrompt(): string {
    // 确保传统系统初始化
    if (!this.autoInitialized) {
      try {
        this.initializeDeeChat().catch(error => {
          log.warn('⚠️ [增强提示词系统] DeeChat系统延迟初始化失败:', error);
        });
      } catch (error) {
        log.warn('⚠️ [增强提示词系统] DeeChat系统初始化失败:', error);
      }
    }

    // 获取基础提示词
    let systemPrompt = super.buildSystemPrompt();

    // 如果启用意图系统，追加意图驱动的提示词
    if (this.intentSystemEnabled) {
      try {
        const intentSegments = intentDrivenPromptProvider.getSegments();
        if (intentSegments.length > 0) {
          const intentPrompt = intentSegments
            .filter(seg => seg.enabled && (!seg.condition || seg.condition()))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map(seg => seg.content)
            .join('\n\n');

          if (intentPrompt.trim()) {
            systemPrompt = systemPrompt ? 
              `${systemPrompt}\n\n${intentPrompt}` : 
              intentPrompt;
            
            log.debug(`🧠 [意图系统] 集成了${intentSegments.length}个智能提示片段`);
          }
        }
      } catch (error) {
        log.error('❌ [意图系统] 提示词集成失败:', error);
      }
    }

    return systemPrompt;
  }

  // ==================== DeeChat+PromptX特有方法 ====================

  /**
   * 🧠 智能消息处理 - DeeChat独有的意图驱动对话
   * 这是与其他AI工具最大的区别：我们有PromptX认知框架
   */
  async processUserMessage(
    userMessage: string,
    sessionInfo: {
      sessionId: string;
      userId?: string;
      currentFeature: DeeChatFeature;
      activeRole?: string;
      availableTools: string[];
    }
  ): Promise<{
    context: ConversationContext;
    enhancedPrompt: string;
    shouldRemember: boolean;
    suggestedActions: string[];
  }> {
    if (!this.intentSystemEnabled) {
      return this.createFallbackResponse(userMessage, sessionInfo);
    }

    try {
      // 使用DeeChat独有的意图分析系统
      const context = await intentDrivenPromptProvider.updateSession(userMessage, sessionInfo);
      
      // 构建增强的系统提示词（包含用户心理状态理解）
      const enhancedPrompt = this.buildSystemPrompt();
      
      // 判断是否需要记忆（基于PromptX记忆系统）
      const shouldRemember = context.shouldRemember || context.isCorrection;
      
      log.info(`🎯 [智能处理] 用户意图: ${context.detectedIntent}, 置信度: ${(context.confidence * 100).toFixed(0)}%`);
      
      return {
        context,
        enhancedPrompt,
        shouldRemember,
        suggestedActions: context.suggestedActions
      };
    } catch (error) {
      log.error('❌ [智能处理] 消息分析失败，使用基础模式:', error);
      return this.createFallbackResponse(userMessage, sessionInfo);
    }
  }

  /**
   * 🔧 更新MCP工具状态 - 集成PromptX工具生态
   */
  updateMCPToolStatus(availableTools: string[]): void {
    this.deeChatInitializer.updateMCPToolStatus(availableTools);
    
    // 通知意图系统工具状态变化
    if (this.intentSystemEnabled) {
      const currentSession = intentDrivenPromptProvider.getCurrentSession();
      if (currentSession) {
        currentSession.availableTools = availableTools;
        log.info(`🔧 [工具状态] 更新可用工具: ${availableTools.length}个`);
      }
    }
  }

  /**
   * 🎭 设置PromptX角色上下文 - DeeChat独有的专业角色系统
   */
  setPromptXRole(role: string, description?: string, capabilities?: string[]): void {
    this.deeChatInitializer.setPromptXRole(role, description, capabilities);
    
    // 同时更新意图系统的角色状态
    if (this.intentSystemEnabled) {
      const currentSession = intentDrivenPromptProvider.getCurrentSession();
      if (currentSession) {
        currentSession.activeRole = role;
        log.info(`🎭 [角色激活] 切换到专业角色: ${role}`);
      }
    }
  }

  /**
   * 清除PromptX角色
   */
  clearPromptXRole(): void {
    this.deeChatInitializer.clearPromptXRole();
  }

  /**
   * 设置功能上下文
   */
  setFeatureContext(feature: DeeChatFeature, data?: Record<string, any>): void {
    this.deeChatInitializer.setFeatureContext(feature, data);
  }

  /**
   * 添加自定义提示词片段
   */
  addCustomSegment(id: string, content: string, priority: number = 100, condition?: () => boolean): void {
    this.deeChatInitializer.addCustomSegment(id, content, priority, condition);
  }

  /**
   * 移除自定义提示词片段
   */
  removeCustomSegment(id: string): void {
    this.deeChatInitializer.removeCustomSegment(id);
  }

  /**
   * 重置DeeChat提示词系统
   */
  resetDeeChat(): void {
    this.deeChatInitializer.reset();
    this.autoInitialized = false;
  }

  /**
   * 获取当前DeeChat配置（调试用）
   */
  getDeeChatConfiguration() {
    return this.deeChatInitializer.exportConfiguration();
  }

  /**
   * 获取初始化状态
   */
  get isDeeChatInitialized(): boolean {
    return this.deeChatInitializer.initialized;
  }

  // ==================== 便利方法 ====================

  /**
   * 快速设置聊天模式
   */
  async setChatMode(): Promise<void> {
    await this.ensureInitialized();
    this.setFeatureContext('chat');
  }

  /**
   * 快速设置文件管理模式
   */
  async setFileManagerMode(): Promise<void> {
    await this.ensureInitialized();
    this.setFeatureContext('file-manager');
  }

  /**
   * 快速设置资源管理模式
   */
  async setResourcesMode(): Promise<void> {
    await this.ensureInitialized();
    this.setFeatureContext('resources');
  }

  /**
   * 快速设置设置模式
   */
  async setSettingsMode(): Promise<void> {
    await this.ensureInitialized();
    this.setFeatureContext('settings');
  }

  /**
   * 快速设置MCP管理模式
   */
  async setMCPManagementMode(): Promise<void> {
    await this.ensureInitialized();
    this.setFeatureContext('mcp-management');
  }

  /**
   * 快速设置模型配置模式
   */
  async setModelConfigMode(): Promise<void> {
    await this.ensureInitialized();
    this.setFeatureContext('model-config');
  }

  // ==================== 调试和监控方法 ====================

  /**
   * 打印当前提示词（调试用）
   */
  debugPrintCurrentPrompt(): void {
    console.log('=== 当前系统提示词 ===');
    console.log(this.buildSystemPrompt());
    console.log('=== 结束 ===');
  }

  /**
   * 获取提示词统计信息
   */
  getPromptStats(): {
    totalLength: number;
    segmentCount: number;
    activeSegmentCount: number;
    basePromptLength: number;
    topSegments: Array<{id: string; priority: number; length: number}>;
  } {
    const segments = this.getSegments();
    const basePrompt = this.getBasePrompt();
    const currentPrompt = this.buildSystemPrompt();

    return {
      totalLength: currentPrompt.length,
      segmentCount: segments.length,
      activeSegmentCount: segments.filter(s => s.enabled).length,
      basePromptLength: basePrompt.length,
      topSegments: segments
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 5)
        .map(s => ({
          id: s.id,
          priority: s.priority || 0,
          length: s.content.length
        }))
    };
  }

  /**
   * 验证提示词完整性 - 包含意图系统检查
   */
  validatePromptIntegrity(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
    intentSystemStatus: string;
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 检查基础提示词
    const basePrompt = this.getBasePrompt();
    if (!basePrompt || basePrompt.length < 100) {
      issues.push('基础提示词过短或缺失');
    }

    // 检查提示词总长度
    const totalLength = this.buildSystemPrompt().length;
    if (totalLength > 12000) {  // DeeChat支持更长的上下文
      issues.push('提示词总长度过长，可能影响性能');
      recommendations.push('考虑移除低优先级的提示词片段');
    } else if (totalLength < 500) {
      issues.push('提示词总长度过短，可能缺少重要指导');
    }

    // 检查段落数量
    const segments = this.getSegments();
    if (segments.length > 25) {  // DeeChat支持更多片段
      recommendations.push('提示词片段较多，考虑合并相关片段');
    }

    // 检查传统系统初始化状态
    if (!this.isDeeChatInitialized) {
      issues.push('DeeChat传统提示词系统未初始化');
      recommendations.push('调用initializeDeeChat()方法进行初始化');
    }

    // 检查意图系统状态
    let intentSystemStatus = '未启用';
    if (this.intentSystemEnabled) {
      const currentSession = intentDrivenPromptProvider.getCurrentSession();
      if (currentSession) {
        intentSystemStatus = `活跃中 (${currentSession.conversationTurn}轮对话)`;
      } else {
        intentSystemStatus = '已启用但无活跃会话';
        recommendations.push('调用processUserMessage()开始智能对话');
      }
    } else {
      recommendations.push('启用意图系统以获得更好的对话体验');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
      intentSystemStatus
    };
  }

  // ==================== DeeChat特有的私有方法 ====================

  /**
   * 创建回退响应（当意图系统不可用时）
   */
  private createFallbackResponse(userMessage: string, sessionInfo: any): {
    context: ConversationContext;
    enhancedPrompt: string;
    shouldRemember: boolean;
    suggestedActions: string[];
  } {
    // 创建基础上下文
    const context: ConversationContext = {
      sessionId: sessionInfo.sessionId,
      timestamp: new Date(),
      userMessage,
      detectedIntent: 'unclear' as any,
      confidence: 0.3,
      currentFeature: sessionInfo.currentFeature,
      activeRole: sessionInfo.activeRole,
      availableTools: sessionInfo.availableTools,
      memoryScore: 1,
      shouldRemember: false,
      planNeedsUpdate: false,
      suggestedActions: ['使用基础对话模式', '如需专业能力请激活对应角色'],
      isCorrection: false,
      isFrustration: false,
      requiresTools: false
    };

    return {
      context,
      enhancedPrompt: this.buildSystemPrompt(),
      shouldRemember: false,
      suggestedActions: context.suggestedActions
    };
  }

  // ==================== 新增：DeeChat独有功能 ====================

  /**
   * 🎛️ 意图系统控制
   */
  enableIntentSystem(): void {
    this.intentSystemEnabled = true;
    log.info('🧠 [意图系统] 已启用DeeChat智能对话系统');
  }

  disableIntentSystem(): void {
    this.intentSystemEnabled = false;
    intentDrivenPromptProvider.resetSession();
    log.info('🔇 [意图系统] 已禁用智能对话系统，回到基础模式');
  }

  isIntentSystemEnabled(): boolean {
    return this.intentSystemEnabled;
  }

  /**
   * 🧠 获取对话智能分析
   */
  getConversationInsights(): {
    currentSession?: SessionState;
    conversationHistory: ConversationContext[];
    patterns: string[];
    recommendations: string[];
  } {
    if (!this.intentSystemEnabled) {
      return {
        conversationHistory: [],
        patterns: ['未启用智能分析'],
        recommendations: ['启用意图系统以获得对话分析']
      };
    }

    const currentSession = intentDrivenPromptProvider.getCurrentSession();
    const history = conversationContextAnalyzer.getConversationHistory();
    
    // 分析对话模式
    const patterns: string[] = [];
    const recommendations: string[] = [];
    
    if (history.length > 0) {
      const intentCounts: Record<string, number> = {};
      let correctionCount = 0;
      let frustrationCount = 0;
      
      history.forEach(ctx => {
        intentCounts[ctx.detectedIntent] = (intentCounts[ctx.detectedIntent] || 0) + 1;
        if (ctx.isCorrection) correctionCount++;
        if (ctx.isFrustration) frustrationCount++;
      });

      // 分析主要意图模式
      const dominantIntent = Object.keys(intentCounts).reduce((a, b) => 
        intentCounts[a] > intentCounts[b] ? a : b
      );
      patterns.push(`主要交互类型: ${dominantIntent} (${intentCounts[dominantIntent]}次)`);

      // 分析用户反馈模式
      if (correctionCount > 0) {
        patterns.push(`用户纠错: ${correctionCount}次`);
        recommendations.push('注意记忆用户纠正的信息');
      }
      
      if (frustrationCount > 0) {
        patterns.push(`挫败表达: ${frustrationCount}次`);
        recommendations.push('需要更耐心和详细的解释');
      }

      // 分析工具使用模式
      const toolUsage = history.filter(ctx => ctx.requiresTools).length;
      if (toolUsage > 0) {
        patterns.push(`工具使用倾向: ${toolUsage}/${history.length}`);
      }
    }

    return {
      currentSession,
      conversationHistory: history,
      patterns,
      recommendations
    };
  }

  /**
   * 📊 获取DeeChat系统统计
   */
  getDeeChatStats(): {
    traditionalSystem: any;
    intentSystem: {
      enabled: boolean;
      sessionsCount: number;
      conversationTurns: number;
      avgConfidence: number;
    };
    integration: {
      totalPromptLength: number;
      segmentCount: number;
      mcpToolsCount: number;
      activeRole?: string;
    };
  } {
    const traditionalStats = this.getPromptStats();
    const currentSession = intentDrivenPromptProvider.getCurrentSession();
    const history = conversationContextAnalyzer.getConversationHistory();
    
    // 计算平均置信度
    const avgConfidence = history.length > 0 ? 
      history.reduce((sum, ctx) => sum + ctx.confidence, 0) / history.length : 
      0;

    return {
      traditionalSystem: traditionalStats,
      intentSystem: {
        enabled: this.intentSystemEnabled,
        sessionsCount: currentSession ? 1 : 0,
        conversationTurns: currentSession?.conversationTurn || 0,
        avgConfidence: avgConfidence
      },
      integration: {
        totalPromptLength: this.buildSystemPrompt().length,
        segmentCount: this.getSegments().length,
        mcpToolsCount: currentSession?.availableTools.length || 0,
        activeRole: currentSession?.activeRole
      }
    };
  }
}

/**
 * 全局增强系统提示词提供器实例
 */
export const enhancedSystemPromptProvider = new EnhancedSystemPromptProvider();