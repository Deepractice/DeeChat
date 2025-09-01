/**
 * DeeChat智能分层提示词系统 - Token计数器
 * 
 * 功能：
 * 1. 精确计算不同模型的token使用量 (基于gpt-tokenizer库)
 * 2. 实时监控对话轮次的token累计
 * 3. 支持多种编码方式（tiktoken、anthropic等）
 * 4. 提供token预估和预算管理
 */

import log from 'electron-log';

// 引入gpt-tokenizer库进行精确的token计算
// 需要先安装: npm install gpt-tokenizer
let gptTokenizer: typeof import('gpt-tokenizer') | null = null;

// 动态导入gpt-tokenizer，避免构建时的问题
try {
  // @ts-ignore
  gptTokenizer = require('gpt-tokenizer');
  log.info('📊 [TokenCounter] 已加载gpt-tokenizer库，将使用精确token计算');
} catch (error) {
  log.warn('⚠️ [TokenCounter] gpt-tokenizer库未安装，将使用估算方法');
}

// Token计数接口
export interface TokenCountResult {
  tokens: number;
  characters: number;
  estimatedCost?: number;
}

// 会话token统计
export interface ConversationTokenStats {
  totalTokens: number;
  systemPromptTokens: number;
  userMessagesTokens: number;
  assistantMessagesTokens: number;
  roundCount: number;
  averageTokensPerRound: number;
  lastUpdateTime: Date;
}

// 模型token配置
export interface ModelTokenConfig {
  provider: string;
  model: string;
  maxContextLength: number;
  estimatedCostPer1000Tokens?: number;
  encoding?: string;
}

/**
 * 通用Token计数器
 * 支持多种模型的token估算
 */
export class TokenCounter {
  private static instance?: TokenCounter;
  private tokenConfigs: Map<string, ModelTokenConfig> = new Map();
  private conversationStats: Map<string, ConversationTokenStats> = new Map();

  constructor() {
    this.initializeModelConfigs();
    log.info('📊 [TokenCounter] Token计数器初始化完成');
  }

  /**
   * 单例模式获取实例
   */
  static getInstance(): TokenCounter {
    if (!TokenCounter.instance) {
      TokenCounter.instance = new TokenCounter();
    }
    return TokenCounter.instance;
  }

  /**
   * 初始化模型配置
   */
  private initializeModelConfigs(): void {
    // Claude系列 (使用cl100k_base作为近似编码)
    this.tokenConfigs.set('claude-3-5-sonnet', {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxContextLength: 200000,
      estimatedCostPer1000Tokens: 0.003,
      encoding: 'cl100k_base' // gpt-tokenizer支持的编码
    });

    this.tokenConfigs.set('claude-3-5-haiku', {
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      maxContextLength: 200000,
      estimatedCostPer1000Tokens: 0.0005,
      encoding: 'cl100k_base'
    });

    // GPT系列
    this.tokenConfigs.set('gpt-4o', {
      provider: 'openai',
      model: 'gpt-4o',
      maxContextLength: 128000,
      estimatedCostPer1000Tokens: 0.005,
      encoding: 'o200k_base' // GPT-4o使用的编码
    });

    this.tokenConfigs.set('gpt-4o-mini', {
      provider: 'openai',
      model: 'gpt-4o-mini',
      maxContextLength: 128000,
      estimatedCostPer1000Tokens: 0.00015,
      encoding: 'o200k_base'
    });

    this.tokenConfigs.set('gpt-4', {
      provider: 'openai',
      model: 'gpt-4',
      maxContextLength: 128000, // 🔧 修复：GPT-4 Turbo有128k上下文，不是8k
      estimatedCostPer1000Tokens: 0.03,
      encoding: 'cl100k_base'
    });

    this.tokenConfigs.set('gpt-3.5-turbo', {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      maxContextLength: 16385,
      estimatedCostPer1000Tokens: 0.0015,
      encoding: 'cl100k_base'
    });

    // Gemini系列 (使用cl100k_base作为近似编码)
    this.tokenConfigs.set('gemini-1.5-pro', {
      provider: 'google',
      model: 'gemini-1.5-pro',
      maxContextLength: 2000000,
      estimatedCostPer1000Tokens: 0.0035,
      encoding: 'cl100k_base'
    });

    log.debug(`📊 [TokenCounter] 已加载 ${this.tokenConfigs.size} 个模型配置`);
  }

  /**
   * 计算文本的token数量
   * @param text 文本内容
   * @param modelKey 模型标识
   * @returns Token计数结果
   */
  countTokens(text: string, modelKey: string = 'claude-3-5-sonnet'): TokenCountResult {
    const config = this.tokenConfigs.get(modelKey);
    
    if (!config) {
      log.warn(`⚠️ [TokenCounter] 未知模型 ${modelKey}，使用默认估算`);
      return this.estimateTokensDefault(text);
    }

    // 如果有gpt-tokenizer库，使用精确计算
    if (gptTokenizer) {
      try {
        return this.countTokensWithGptTokenizer(text, config);
      } catch (error) {
        log.warn(`⚠️ [TokenCounter] gpt-tokenizer计算失败，降级到估算方法:`, error);
        return this.estimateTokensByConfig(text, config);
      }
    }

    // 降级到估算方法
    return this.estimateTokensByConfig(text, config);
  }

  /**
   * 使用gpt-tokenizer库进行精确计算
   */
  private countTokensWithGptTokenizer(text: string, config: ModelTokenConfig): TokenCountResult {
    if (!gptTokenizer) {
      throw new Error('gpt-tokenizer not available');
    }

    const characters = text.length;
    let tokens: number;

    // 根据编码类型使用对应的tokenizer
    switch (config.encoding) {
      case 'cl100k_base':
        tokens = gptTokenizer.countTokens(text);
        break;
      case 'o200k_base':
        tokens = gptTokenizer.countTokens(text);
        break;
      case 'p50k_base':
        tokens = gptTokenizer.countTokens(text);
        break;
      case 'r50k_base':
        tokens = gptTokenizer.countTokens(text);
        break;
      default:
        // 默认使用cl100k_base
        tokens = gptTokenizer.countTokens(text);
        break;
    }

    return {
      tokens,
      characters,
      estimatedCost: config.estimatedCostPer1000Tokens ? 
        (tokens / 1000) * config.estimatedCostPer1000Tokens : undefined
    };
  }

  /**
   * 根据配置进行估算
   */
  private estimateTokensByConfig(text: string, config: ModelTokenConfig): TokenCountResult {
    // 根据不同编码方式计算token
    switch (config.encoding) {
      case 'cl100k_base':
      case 'o200k_base':
        return this.estimateTokensOpenAI(text, config);
      
      case 'p50k_base':
      case 'r50k_base':
        return this.estimateTokensOpenAI(text, config);
      
      default:
        return this.estimateTokensDefault(text, config);
    }
  }


  /**
   * OpenAI模型token估算
   * 基于tiktoken的近似估算，英文约4字符/token，中文约1.5字符/token
   */
  private estimateTokensOpenAI(text: string, config: ModelTokenConfig): TokenCountResult {
    const characters = text.length;
    
    // 简单的中英文混合估算
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = characters - chineseChars;
    
    const tokens = Math.ceil(chineseChars / 1.5 + otherChars / 4);
    
    return {
      tokens,
      characters,
      estimatedCost: config.estimatedCostPer1000Tokens ? 
        (tokens / 1000) * config.estimatedCostPer1000Tokens : undefined
    };
  }


  /**
   * 默认token估算
   * 通用的保守估算方案
   */
  private estimateTokensDefault(text: string, config?: ModelTokenConfig): TokenCountResult {
    const characters = text.length;
    const tokens = Math.ceil(characters / 3); // 保守估算
    
    return {
      tokens,
      characters,
      estimatedCost: config?.estimatedCostPer1000Tokens ? 
        (tokens / 1000) * config.estimatedCostPer1000Tokens : undefined
    };
  }

  /**
   * 更新会话token统计
   * @param sessionId 会话ID
   * @param systemTokens 系统提示词token数
   * @param userTokens 用户消息token数
   * @param assistantTokens AI响应token数
   */
  updateConversationStats(
    sessionId: string,
    systemTokens: number,
    userTokens: number,
    assistantTokens: number
  ): void {
    const current = this.conversationStats.get(sessionId);
    
    if (current) {
      // 更新现有统计
      current.totalTokens = current.systemPromptTokens + current.userMessagesTokens + current.assistantMessagesTokens;
      current.systemPromptTokens = systemTokens; // 系统提示词可能会变化
      current.userMessagesTokens += userTokens;
      current.assistantMessagesTokens += assistantTokens;
      current.roundCount += 1;
      current.averageTokensPerRound = current.totalTokens / current.roundCount;
      current.lastUpdateTime = new Date();
      
      current.totalTokens = current.systemPromptTokens + current.userMessagesTokens + current.assistantMessagesTokens;
    } else {
      // 创建新统计
      const totalTokens = systemTokens + userTokens + assistantTokens;
      this.conversationStats.set(sessionId, {
        totalTokens,
        systemPromptTokens: systemTokens,
        userMessagesTokens: userTokens,
        assistantMessagesTokens: assistantTokens,
        roundCount: 1,
        averageTokensPerRound: totalTokens,
        lastUpdateTime: new Date()
      });
    }

    log.debug(`📊 [TokenCounter] 会话 ${sessionId.slice(0, 8)} token统计已更新`);
  }

  /**
   * 获取会话token统计
   * @param sessionId 会话ID
   * @returns 会话统计信息
   */
  getConversationStats(sessionId: string): ConversationTokenStats | null {
    return this.conversationStats.get(sessionId) || null;
  }

  /**
   * 估算当前invoke的token数量
   * @param systemPrompt 系统提示词
   * @param userMessage 用户消息
   * @param modelKey 模型标识
   * @returns 本次调用的预估token数
   */
  estimateThisInvokeTokens(systemPrompt: string, userMessage: string, modelKey: string): number {
    const systemResult = this.countTokens(systemPrompt, modelKey);
    const userResult = this.countTokens(userMessage, modelKey);
    
    return systemResult.tokens + userResult.tokens;
  }

  /**
   * 获取模型配置
   * @param modelKey 模型标识
   * @returns 模型token配置
   */
  getModelConfig(modelKey: string): ModelTokenConfig | null {
    return this.tokenConfigs.get(modelKey) || null;
  }

  /**
   * 添加或更新模型配置
   * @param modelKey 模型标识
   * @param config 模型配置
   */
  setModelConfig(modelKey: string, config: ModelTokenConfig): void {
    this.tokenConfigs.set(modelKey, config);
    log.info(`📊 [TokenCounter] 已更新模型配置: ${modelKey}`);
  }

  /**
   * 清理过期的会话统计
   * @param maxAge 最大保留时间（小时）
   */
  cleanupExpiredStats(maxAge: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [sessionId, stats] of this.conversationStats.entries()) {
      if (stats.lastUpdateTime < cutoffTime) {
        this.conversationStats.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      log.info(`🧹 [TokenCounter] 已清理 ${cleaned} 个过期会话统计`);
    }
  }

  /**
   * 获取所有会话的统计摘要
   */
  getAllStatsSpeedily(): {
    totalSessions: number;
    totalTokens: number;
    averageTokensPerSession: number;
    totalEstimatedCost: number;
  } {
    let totalSessions = 0;
    let totalTokens = 0;
    let totalEstimatedCost = 0;
    
    for (const stats of this.conversationStats.values()) {
      totalSessions++;
      totalTokens += stats.totalTokens;
      // 简单估算成本（使用Claude 3.5 Sonnet价格）
      totalEstimatedCost += (stats.totalTokens / 1000) * 0.003;
    }
    
    return {
      totalSessions,
      totalTokens,
      averageTokensPerSession: totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
      totalEstimatedCost
    };
  }
}

/**
 * 全局token计数器实例
 */
export const tokenCounter = TokenCounter.getInstance();