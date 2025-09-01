/**
 * DeeChat智能分层提示词系统 - 第2层：历史对话管理层
 * 
 * 核心职责：
 * 1. 管理对话轮次和历史内容
 * 2. 智能压缩历史对话避免token爆炸
 * 3. 保持对话逻辑的连贯性
 * 4. 提供高效的上下文缓存机制
 */

import log from 'electron-log';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { TokenCounter } from '../components/TokenCounter';

// 对话轮次定义
export interface ConversationRound {
  round: number;
  userMessage: string;
  assistantMessage: string;
  timestamp: Date;
  tokens: number;
  importance: number; // 0-1，重要度评分
  hasToolCalls: boolean;
  metadata?: {
    intent?: string;
    complexity?: number;
    emotions?: string[];
    keyTopics?: string[];
  };
}

// 压缩结果
export interface CompressionResult {
  originalRounds: number;
  compressedSummary: string;
  tokensSaved: number;
  compressionRatio: number;
  retainedRounds: ConversationRound[];
  compressionTime: Date;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
}

// 历史上下文配置
export interface HistoryContextConfig {
  maxRetainedRounds: number;        // 最大保留轮次
  compressionTriggerRounds: number; // 触发压缩的轮次数
  importanceThreshold: number;      // 重要度阈值
  maxSummaryLength: number;         // 最大摘要长度
  compressionModel: string;         // 压缩使用的模型
}

// 缓存条目
interface CacheEntry {
  content: string;
  timestamp: Date;
  accessCount: number;
  lastAccess: Date;
  tokens: number;
  hitRate: number;
}

/**
 * 第2层：历史对话管理层
 * 
 * 核心创新：让AI自己进行智能压缩，避免人工规则导致的信息丢失
 */
export class HistoryContextLayer {
  private conversationRounds: Map<string, ConversationRound[]> = new Map();
  private compressedSummaries: Map<string, string> = new Map();
  private lastCompressionTime: Map<string, Date> = new Map();
  private compressionCache: Map<string, CacheEntry> = new Map();
  
  private tokenCounter: TokenCounter;
  
  // 默认配置
  private readonly defaultConfig: HistoryContextConfig = {
    maxRetainedRounds: 3,           // 保留最近3轮完整对话
    compressionTriggerRounds: 6,    // 超过6轮开始压缩
    importanceThreshold: 0.6,       // 重要度阈值
    maxSummaryLength: 200,          // 摘要最长200字
    compressionModel: 'claude-3-5-haiku' // 使用更便宜的模型压缩
  };

  constructor(private llmFactory?: (modelKey: string) => Promise<BaseChatModel>) {
    this.tokenCounter = TokenCounter.getInstance();
    log.info('💾 [HistoryContextLayer] 第2层：历史对话管理层初始化完成');
  }

  /**
   * 添加新的对话轮次
   * @param sessionId 会话ID
   * @param userMessage 用户消息
   * @param aiResponse AI回复
   * @param metadata 元数据
   */
  addRound(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    metadata?: {
      intent?: string;
      hasToolCalls?: boolean;
      complexity?: number;
      emotions?: string[];
      keyTopics?: string[];
    }
  ): void {
    const rounds = this.conversationRounds.get(sessionId) || [];
    const roundNumber = rounds.length + 1;
    
    // 计算token数量
    const tokens = this.tokenCounter.countTokens(
      `User: ${userMessage}\nAssistant: ${aiResponse}`,
      'claude-3-5-sonnet'
    ).tokens;

    // 计算重要度评分
    const importance = this.calculateImportance(userMessage, aiResponse, metadata);

    const newRound: ConversationRound = {
      round: roundNumber,
      userMessage,
      assistantMessage: aiResponse,
      timestamp: new Date(),
      tokens,
      importance,
      hasToolCalls: metadata?.hasToolCalls || false,
      metadata
    };

    rounds.push(newRound);
    this.conversationRounds.set(sessionId, rounds);
    
    log.debug(`💾 [HistoryContext] 会话 ${sessionId.slice(0, 8)} 添加第${roundNumber}轮对话 (${tokens} tokens, 重要度${importance.toFixed(2)})`);

    // 检查是否需要压缩
    if (rounds.length >= this.defaultConfig.compressionTriggerRounds) {
      this.scheduleCompression(sessionId);
    }
  }

  /**
   * 计算对话轮次的重要度评分
   */
  private calculateImportance(
    userMessage: string, 
    aiResponse: string, 
    metadata?: any
  ): number {
    let importance = 0.5; // 基础分数

    // 基于消息长度
    const totalLength = userMessage.length + aiResponse.length;
    if (totalLength > 500) importance += 0.1;
    if (totalLength > 1000) importance += 0.1;

    // 基于是否有工具调用
    if (metadata?.hasToolCalls) {
      importance += 0.2;
    }

    // 基于复杂度
    if (metadata?.complexity && metadata.complexity > 0.7) {
      importance += 0.15;
    }

    // 基于关键词
    const importantKeywords = [
      'error', 'bug', 'fix', 'solve', 'problem', 'issue',
      'important', 'critical', 'urgent', 'key', 'main',
      '错误', '问题', '解决', '修复', '重要', '关键', '主要'
    ];
    
    const text = `${userMessage} ${aiResponse}`.toLowerCase();
    const keywordMatches = importantKeywords.filter(keyword => text.includes(keyword)).length;
    importance += keywordMatches * 0.05;

    // 基于情感状态
    if (metadata?.emotions?.includes('frustrated') || metadata?.emotions?.includes('urgent')) {
      importance += 0.1;
    }

    // 限制在0-1范围内
    return Math.max(0, Math.min(1, importance));
  }

  /**
   * 安排压缩任务
   */
  private scheduleCompression(sessionId: string): void {
    // 异步执行压缩，避免阻塞当前请求
    setImmediate(() => {
      this.compressHistoryIfNeeded(sessionId).catch(error => {
        log.error(`❌ [HistoryContext] 会话 ${sessionId.slice(0, 8)} 压缩失败:`, error);
      });
    });
  }

  /**
   * 智能压缩历史对话
   * @param sessionId 会话ID
   * @param force 是否强制压缩
   * @returns 压缩结果
   */
  async compressHistoryIfNeeded(sessionId: string, force: boolean = false): Promise<CompressionResult | null> {
    const rounds = this.conversationRounds.get(sessionId) || [];
    
    if (!force && rounds.length < this.defaultConfig.compressionTriggerRounds) {
      return null; // 不需要压缩
    }

    log.info(`🔄 [HistoryContext] 开始压缩会话 ${sessionId.slice(0, 8)} (${rounds.length}轮对话)`);

    // 分析哪些轮次需要压缩，哪些需要保留
    const { toCompress, toRetain } = this.selectRoundsForCompression(rounds);
    
    if (toCompress.length === 0) {
      log.debug(`💾 [HistoryContext] 会话 ${sessionId.slice(0, 8)} 无需压缩`);
      return null;
    }

    try {
      // 检查缓存
      const cacheKey = this.generateCompressionCacheKey(toCompress);
      const cachedResult = this.compressionCache.get(cacheKey);
      
      let compressedSummary: string;
      
      if (cachedResult && this.isCacheValid(cachedResult)) {
        compressedSummary = cachedResult.content;
        cachedResult.accessCount++;
        cachedResult.lastAccess = new Date();
        log.debug(`💾 [HistoryContext] 使用缓存的压缩结果`);
      } else {
        // 调用AI进行压缩
        compressedSummary = await this.callAIForCompression(toCompress, sessionId);
        
        // 缓存结果
        this.compressionCache.set(cacheKey, {
          content: compressedSummary,
          timestamp: new Date(),
          accessCount: 1,
          lastAccess: new Date(),
          tokens: this.tokenCounter.countTokens(compressedSummary).tokens,
          hitRate: 0
        });
      }

      // 计算压缩统计
      const originalTokens = toCompress.reduce((sum, round) => sum + round.tokens, 0);
      const summaryTokens = this.tokenCounter.countTokens(compressedSummary).tokens;
      const tokensSaved = originalTokens - summaryTokens;
      const compressionRatio = tokensSaved / originalTokens;

      // 评估压缩质量
      const quality = this.evaluateCompressionQuality(compressionRatio, compressedSummary, toCompress);

      const result: CompressionResult = {
        originalRounds: toCompress.length,
        compressedSummary,
        tokensSaved,
        compressionRatio,
        retainedRounds: toRetain,
        compressionTime: new Date(),
        quality
      };

      // 更新会话状态
      this.conversationRounds.set(sessionId, toRetain);
      this.compressedSummaries.set(sessionId, compressedSummary);
      this.lastCompressionTime.set(sessionId, new Date());

      log.info(`✅ [HistoryContext] 会话 ${sessionId.slice(0, 8)} 压缩完成: ${toCompress.length}轮 → 摘要 (节省${tokensSaved} tokens, 质量${quality})`);

      return result;

    } catch (error) {
      log.error(`❌ [HistoryContext] 会话 ${sessionId.slice(0, 8)} 压缩失败:`, error);
      return null;
    }
  }

  /**
   * 选择需要压缩和保留的对话轮次
   */
  private selectRoundsForCompression(rounds: ConversationRound[]): {
    toCompress: ConversationRound[];
    toRetain: ConversationRound[];
  } {
    const totalRounds = rounds.length;
    const retainCount = Math.min(this.defaultConfig.maxRetainedRounds, totalRounds);
    
    // 策略1：保留最新的几轮
    let toRetain = rounds.slice(-retainCount);
    let toCompress = rounds.slice(0, -retainCount);

    // 策略2：基于重要度进行调整
    if (toCompress.length > 0) {
      // 从待压缩轮次中找出高重要度的轮次
      const highImportanceRounds = toCompress.filter(
        round => round.importance > this.defaultConfig.importanceThreshold
      );

      // 如果有高重要度轮次，将其加入保留列表
      if (highImportanceRounds.length > 0 && toRetain.length < this.defaultConfig.maxRetainedRounds + 2) {
        // 最多额外保留2轮高重要度对话
        const extraRetain = highImportanceRounds.slice(-2);
        toRetain = extraRetain.concat(toRetain);
        toCompress = toCompress.filter(round => !extraRetain.includes(round));
      }
    }

    // 按时间排序
    toRetain.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    toCompress.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return { toCompress, toRetain };
  }

  /**
   * 调用AI进行智能压缩
   */
  private async callAIForCompression(rounds: ConversationRound[], _sessionId: string): Promise<string> {
    if (!this.llmFactory) {
      // 降级到简单摘要
      return this.generateSimpleSummary(rounds);
    }

    const model = await this.llmFactory(this.defaultConfig.compressionModel);

    // 构建压缩提示词
    const compressionPrompt = this.buildCompressionPrompt(rounds);
    
    const messages: BaseMessage[] = [
      new SystemMessage(`你是专业的对话摘要助手。请将用户提供的对话轮次压缩成简洁的摘要，保留关键决策、重要信息和上下文连续性。

要求：
1. 摘要长度控制在${this.defaultConfig.maxSummaryLength}字以内
2. 保留用户的核心需求和AI的重要回应
3. 突出工具调用和问题解决过程
4. 维持时间顺序和逻辑关系
5. 使用第三人称客观描述`),
      new HumanMessage(compressionPrompt)
    ];

    const response = await model.invoke(messages);
    const summary = response.content as string;

    // 验证摘要长度
    if (summary.length > this.defaultConfig.maxSummaryLength * 2) {
      log.warn(`⚠️ [HistoryContext] 压缩摘要过长 (${summary.length}字)，进行截断`);
      return summary.substring(0, this.defaultConfig.maxSummaryLength * 2) + '...';
    }

    return summary;
  }

  /**
   * 构建压缩提示词
   */
  private buildCompressionPrompt(rounds: ConversationRound[]): string {
    const roundsText = rounds.map(round => {
      const importance = round.importance > 0.7 ? ' [重要]' : '';
      const tools = round.hasToolCalls ? ' [使用工具]' : '';
      const topics = round.metadata?.keyTopics ? ` [主题: ${round.metadata.keyTopics.join(', ')}]` : '';
      
      return `第${round.round}轮${importance}${tools}${topics}:
用户: ${round.userMessage}
助手: ${round.assistantMessage.substring(0, 500)}${round.assistantMessage.length > 500 ? '...' : ''}`;
    }).join('\n\n');

    return `请将以下${rounds.length}轮对话压缩成简洁摘要：

${roundsText}

请重点保留：
- 用户的主要问题和需求变化
- AI的关键解决方案和建议
- 工具调用的结果和影响
- 重要的决策点和转折点
- 未完成的任务或待解决问题`;
  }

  /**
   * 生成简单摘要（降级方案）
   */
  private generateSimpleSummary(rounds: ConversationRound[]): string {
    const keyPoints: string[] = [];
    
    // 提取关键信息
    for (const round of rounds) {
      if (round.importance > 0.7) {
        keyPoints.push(`第${round.round}轮：用户询问关于${this.extractKeywords(round.userMessage).join('、')}的问题`);
      }
      if (round.hasToolCalls) {
        keyPoints.push(`第${round.round}轮：使用了工具辅助解决问题`);
      }
    }

    if (keyPoints.length === 0) {
      keyPoints.push(`用户与AI进行了${rounds.length}轮对话，涵盖多个技术问题和解决方案`);
    }

    return keyPoints.join('；');
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set(['的', '了', '在', '是', '有', '和', '个', '中', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words = text.split(/[\s\W]+/).filter(word => 
      word.length > 1 && !commonWords.has(word.toLowerCase())
    );
    
    return words.slice(0, 3); // 返回前3个关键词
  }

  /**
   * 生成压缩缓存键
   */
  private generateCompressionCacheKey(rounds: ConversationRound[]): string {
    const roundsSignature = rounds.map(r => 
      `${r.round}_${r.userMessage.substring(0, 50)}_${r.importance.toFixed(2)}`
    ).join('|');
    
    return `compress_${Buffer.from(roundsSignature).toString('base64').substring(0, 32)}`;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cacheEntry: CacheEntry): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    return (Date.now() - cacheEntry.timestamp.getTime()) < maxAge;
  }

  /**
   * 评估压缩质量
   */
  private evaluateCompressionQuality(
    compressionRatio: number, 
    _summary: string, 
    _originalRounds: ConversationRound[]
  ): 'excellent' | 'good' | 'acceptable' | 'poor' {
    // 基于压缩比例评估
    if (compressionRatio > 0.8) {
      return 'excellent'; // 压缩率超过80%
    } else if (compressionRatio > 0.6) {
      return 'good'; // 压缩率60-80%
    } else if (compressionRatio > 0.4) {
      return 'acceptable'; // 压缩率40-60%
    } else {
      return 'poor'; // 压缩率低于40%
    }
  }

  /**
   * 渲染第2层内容：历史上下文
   * @param sessionId 会话ID
   * @returns 历史上下文字符串
   */
  render(sessionId: string): string {
    const summary = this.compressedSummaries.get(sessionId);
    const rounds = this.conversationRounds.get(sessionId) || [];
    const parts: string[] = [];

    // 添加压缩摘要
    if (summary) {
      parts.push(`📚 历史摘要: ${summary}`);
    }

    // 添加近期对话轮次
    if (rounds.length > 0) {
      const recentRounds = rounds.slice(-3).map(round => {
        const importance = round.importance > 0.7 ? ' ⭐' : '';
        const tools = round.hasToolCalls ? ' 🔧' : '';
        return `第${round.round}轮${importance}${tools}: ${this.summarizeRound(round)}`;
      }).join(' | ');
      
      parts.push(`💬 近期对话: ${recentRounds}`);
    }

    if (parts.length === 0) {
      return `# 📝 HISTORY_CONTEXT\n新会话开始`;
    }

    return `# 📝 HISTORY_CONTEXT\n${parts.join('\n')}`;
  }

  /**
   * 总结单轮对话
   */
  private summarizeRound(round: ConversationRound): string {
    const userSummary = round.userMessage.length > 30 ? 
      round.userMessage.substring(0, 30) + '...' : 
      round.userMessage;
    
    const aiSummary = round.assistantMessage.length > 50 ? 
      round.assistantMessage.substring(0, 50) + '...' : 
      round.assistantMessage;

    return `用户问"${userSummary}"，AI回复"${aiSummary}"`;
  }

  /**
   * 获取会话统计
   * @param sessionId 会话ID
   * @returns 会话统计信息
   */
  getSessionStats(sessionId: string): {
    totalRounds: number;
    retainedRounds: number;
    compressedRounds: number;
    lastCompressionTime?: Date;
    totalTokens: number;
    avgImportance: number;
  } {
    const rounds = this.conversationRounds.get(sessionId) || [];
    const summary = this.compressedSummaries.get(sessionId);
    const lastCompression = this.lastCompressionTime.get(sessionId);
    
    const totalTokens = rounds.reduce((sum, round) => sum + round.tokens, 0) +
      (summary ? this.tokenCounter.countTokens(summary).tokens : 0);
    
    const avgImportance = rounds.length > 0 ? 
      rounds.reduce((sum, round) => sum + round.importance, 0) / rounds.length : 0;

    return {
      totalRounds: rounds.reduce((max, round) => Math.max(max, round.round), 0),
      retainedRounds: rounds.length,
      compressedRounds: summary ? 1 : 0, // 简化统计
      lastCompressionTime: lastCompression,
      totalTokens,
      avgImportance
    };
  }

  /**
   * 清理过期数据
   * @param maxAge 最大保留时间（小时）
   */
  cleanupExpiredData(maxAge: number = 48): void {
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    let cleanedSessions = 0;
    let cleanedCache = 0;

    // 清理过期会话
    for (const [sessionId, rounds] of this.conversationRounds.entries()) {
      const lastRound = rounds[rounds.length - 1];
      if (lastRound && lastRound.timestamp < cutoffTime) {
        this.conversationRounds.delete(sessionId);
        this.compressedSummaries.delete(sessionId);
        this.lastCompressionTime.delete(sessionId);
        cleanedSessions++;
      }
    }

    // 清理过期缓存
    for (const [cacheKey, entry] of this.compressionCache.entries()) {
      if (!this.isCacheValid(entry)) {
        this.compressionCache.delete(cacheKey);
        cleanedCache++;
      }
    }

    if (cleanedSessions > 0 || cleanedCache > 0) {
      log.info(`🧹 [HistoryContext] 已清理 ${cleanedSessions} 个过期会话, ${cleanedCache} 个过期缓存`);
    }
  }

  /**
   * 获取管理层统计信息
   */
  getLayerStats(): {
    activeSessions: number;
    totalRounds: number;
    compressionCacheSize: number;
    avgCompressionRatio: number;
  } {
    const activeSessions = this.conversationRounds.size;
    const totalRounds = Array.from(this.conversationRounds.values())
      .reduce((sum, rounds) => sum + rounds.length, 0);
    
    const cacheEntries = Array.from(this.compressionCache.values());
    const avgCompressionRatio = cacheEntries.length > 0 ? 
      cacheEntries.reduce((sum, entry) => sum + (entry.hitRate || 0.7), 0) / cacheEntries.length : 0;

    return {
      activeSessions,
      totalRounds,
      compressionCacheSize: this.compressionCache.size,
      avgCompressionRatio
    };
  }
}