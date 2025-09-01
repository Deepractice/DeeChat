/**
 * DeeChat智能分层提示词系统 - 模型上下文管理器
 * 
 * 功能：
 * 1. 管理不同模型的上下文配置和限制
 * 2. 检测和预防稀疏注意力触发
 * 3. 提供智能的上下文预算管理
 * 4. 支持动态的模型上下文策略调整
 */

import log from 'electron-log';

// 模型上下文配置
export interface ModelContextConfig {
  modelKey: string;
  provider: string;
  maxContextLength: number;
  effectiveAttentionWindow: number;  // 有效注意力窗口 (80% of max)
  sparseAttentionStart: number;      // 稀疏注意力开始阈值 (60% of max)
  optimalContextLength: number;      // 最佳上下文长度 (40% of max)
  compressionThreshold: number;      // 压缩触发阈值 (50% of max)
  tokenCostPerK: number;             // 每千token成本
}

// 上下文分析结果
export interface ContextAnalysisResult {
  currentTokens: number;
  usage: {
    percentage: number;
    level: 'optimal' | 'good' | 'attention_warning' | 'sparse_attention' | 'critical';
    description: string;
  };
  recommendations: {
    action: 'continue' | 'compress_history' | 'reactivate_role' | 'emergency_compress';
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
  costEstimate: {
    currentCost: number;
    projectedCost: number;
    efficiency: 'excellent' | 'good' | 'poor' | 'waste';
  };
  nextCompressionAt: number;
}

// 预算管理配置
export interface ContextBudgetConfig {
  maxCostPerSession: number;       // 每会话最大成本
  compressionCostThreshold: number; // 压缩成本阈值
  emergencyStopCost: number;       // 紧急停止成本
  budgetWarningLevel: number;      // 预算警告级别
}

/**
 * 模型上下文管理器
 * 核心职责：智能管理模型上下文，避免稀疏注意力，优化token使用效率
 */
export class ModelContextManager {
  private static instance?: ModelContextManager;
  private modelConfigs: Map<string, ModelContextConfig> = new Map();

  constructor() {
    this.initializeModelConfigs();
    log.info('🎯 [ModelContextManager] 模型上下文管理器初始化完成');
  }

  /**
   * 单例模式获取实例
   */
  static getInstance(): ModelContextManager {
    if (!ModelContextManager.instance) {
      ModelContextManager.instance = new ModelContextManager();
    }
    return ModelContextManager.instance;
  }

  /**
   * 初始化模型配置
   */
  private initializeModelConfigs(): void {
    // Claude 3.5 Sonnet配置
    this.modelConfigs.set('claude-3-5-sonnet', {
      modelKey: 'claude-3-5-sonnet',
      provider: 'anthropic',
      maxContextLength: 200000,
      effectiveAttentionWindow: 160000,    // 80%
      sparseAttentionStart: 120000,        // 60%
      optimalContextLength: 80000,         // 40%
      compressionThreshold: 100000,        // 50%
      tokenCostPerK: 3.0
    });

    // Claude 3.5 Haiku配置
    this.modelConfigs.set('claude-3-5-haiku', {
      modelKey: 'claude-3-5-haiku',
      provider: 'anthropic',
      maxContextLength: 200000,
      effectiveAttentionWindow: 160000,
      sparseAttentionStart: 120000,
      optimalContextLength: 80000,
      compressionThreshold: 100000,
      tokenCostPerK: 0.5
    });

    // GPT-4o配置
    this.modelConfigs.set('gpt-4o', {
      modelKey: 'gpt-4o',
      provider: 'openai',
      maxContextLength: 128000,
      effectiveAttentionWindow: 102400,    // 80%
      sparseAttentionStart: 76800,         // 60%
      optimalContextLength: 51200,         // 40%
      compressionThreshold: 64000,         // 50%
      tokenCostPerK: 5.0
    });

    // GPT-4o-mini配置
    this.modelConfigs.set('gpt-4o-mini', {
      modelKey: 'gpt-4o-mini',
      provider: 'openai',
      maxContextLength: 128000,
      effectiveAttentionWindow: 102400,
      sparseAttentionStart: 76800,
      optimalContextLength: 51200,
      compressionThreshold: 64000,
      tokenCostPerK: 0.15
    });

    // Gemini 1.5 Pro配置 (超大上下文)
    this.modelConfigs.set('gemini-1.5-pro', {
      modelKey: 'gemini-1.5-pro',
      provider: 'google',
      maxContextLength: 2000000,
      effectiveAttentionWindow: 1600000,   // 80%
      sparseAttentionStart: 1200000,       // 60%
      optimalContextLength: 800000,        // 40%
      compressionThreshold: 1000000,       // 50%
      tokenCostPerK: 3.5
    });

    log.debug(`🎯 [ModelContextManager] 已加载 ${this.modelConfigs.size} 个模型上下文配置`);
  }


  /**
   * 分析当前上下文状态
   * @param modelKey 模型标识
   * @param currentTokens 当前token数量
   * @param incomingTokens 即将增加的token数量
   * @param sessionId 会话ID（用于成本跟踪）
   * @returns 上下文分析结果
   */
  analyzeContextStatus(
    modelKey: string,
    currentTokens: number,
    incomingTokens: number = 0,
    sessionId?: string
  ): ContextAnalysisResult {
    const config = this.modelConfigs.get(modelKey);
    
    if (!config) {
      log.warn(`⚠️ [ModelContextManager] 未知模型 ${modelKey}，使用默认配置`);
      return this.createDefaultAnalysis(currentTokens, incomingTokens);
    }

    const totalTokens = currentTokens + incomingTokens;
    const usagePercentage = totalTokens / config.maxContextLength;
    
    // 计算使用级别和描述
    const usage = this.calculateUsageLevel(totalTokens, config);
    
    // 生成建议
    const recommendations = this.generateRecommendations(totalTokens, config, usage.level);
    
    // 计算成本估算
    const costEstimate = this.calculateCostEstimate(
      totalTokens, 
      config,
      sessionId
    );

    // 计算下次压缩建议时机
    const nextCompressionAt = Math.max(
      config.compressionThreshold,
      totalTokens + 10000 // 至少再增加10k tokens
    );

    const analysis: ContextAnalysisResult = {
      currentTokens: totalTokens,
      usage,
      recommendations,
      costEstimate,
      nextCompressionAt
    };

    // 记录分析结果
    if (usage.level === 'sparse_attention' || usage.level === 'critical') {
      log.warn(`⚠️ [ModelContextManager] ${modelKey} 上下文警告: ${usage.level} (${Math.round(usagePercentage * 100)}%)`);
    } else {
      log.debug(`🎯 [ModelContextManager] ${modelKey} 上下文状态: ${usage.level} (${Math.round(usagePercentage * 100)}%)`);
    }

    return analysis;
  }

  /**
   * 计算使用级别
   */
  private calculateUsageLevel(tokens: number, config: ModelContextConfig): {
    percentage: number;
    level: 'optimal' | 'good' | 'attention_warning' | 'sparse_attention' | 'critical';
    description: string;
  } {
    const percentage = tokens / config.maxContextLength;
    
    if (tokens <= config.optimalContextLength) {
      return {
        percentage,
        level: 'optimal',
        description: '最佳状态：上下文使用效率高，AI注意力集中'
      };
    } else if (tokens <= config.compressionThreshold) {
      return {
        percentage,
        level: 'good',
        description: '良好状态：上下文使用合理，建议适时压缩'
      };
    } else if (tokens <= config.sparseAttentionStart) {
      return {
        percentage,
        level: 'attention_warning',
        description: '注意力预警：接近稀疏注意力阈值，建议开始压缩'
      };
    } else if (tokens <= config.effectiveAttentionWindow) {
      return {
        percentage,
        level: 'sparse_attention',
        description: '稀疏注意力：AI可能无法充分关注全部内容，需立即压缩'
      };
    } else {
      return {
        percentage,
        level: 'critical',
        description: '临界状态：超出有效窗口，AI表现将显著下降'
      };
    }
  }

  /**
   * 生成操作建议
   */
  private generateRecommendations(
    _tokens: number, 
    _config: ModelContextConfig,
    level: string
  ): {
    action: 'continue' | 'compress_history' | 'reactivate_role' | 'emergency_compress';
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  } {
    switch (level) {
      case 'optimal':
        return {
          action: 'continue',
          reason: '上下文使用效率高，可继续对话',
          urgency: 'low'
        };

      case 'good':
        return {
          action: 'continue',
          reason: '状态良好，可在下一轮考虑压缩',
          urgency: 'low'
        };

      case 'attention_warning':
        return {
          action: 'compress_history',
          reason: '接近稀疏注意力阈值，建议压缩历史对话',
          urgency: 'medium'
        };

      case 'sparse_attention':
        return {
          action: 'reactivate_role',
          reason: '已触发稀疏注意力，需立即压缩并重激活角色',
          urgency: 'high'
        };

      case 'critical':
        return {
          action: 'emergency_compress',
          reason: '超出有效窗口，必须紧急压缩避免AI性能严重下降',
          urgency: 'critical'
        };

      default:
        return {
          action: 'continue',
          reason: '状态未知，保持观察',
          urgency: 'low'
        };
    }
  }

  /**
   * 计算成本估算
   */
  private calculateCostEstimate(
    tokens: number, 
    config: ModelContextConfig,
    _sessionId?: string
  ): {
    currentCost: number;
    projectedCost: number;
    efficiency: 'excellent' | 'good' | 'poor' | 'waste';
  } {
    const currentCost = (tokens / 1000) * (config.tokenCostPerK / 1000);
    
    // 根据当前使用情况预测接下来的成本
    const projectedTokens = tokens * 1.5; // 假设再增长50%
    const projectedCost = (projectedTokens / 1000) * (config.tokenCostPerK / 1000);
    
    // 评估效率
    let efficiency: 'excellent' | 'good' | 'poor' | 'waste';
    if (tokens <= config.optimalContextLength) {
      efficiency = 'excellent';
    } else if (tokens <= config.compressionThreshold) {
      efficiency = 'good';
    } else if (tokens <= config.sparseAttentionStart) {
      efficiency = 'poor';
    } else {
      efficiency = 'waste';
    }

    return {
      currentCost,
      projectedCost,
      efficiency
    };
  }

  /**
   * 创建默认分析结果（未知模型时使用）
   */
  private createDefaultAnalysis(currentTokens: number, incomingTokens: number): ContextAnalysisResult {
    const totalTokens = currentTokens + incomingTokens;
    const assumedMax = 128000; // 假设128k上下文
    const percentage = totalTokens / assumedMax;

    return {
      currentTokens: totalTokens,
      usage: {
        percentage,
        level: percentage > 0.6 ? 'attention_warning' : 'good',
        description: '未知模型，使用默认评估'
      },
      recommendations: {
        action: percentage > 0.6 ? 'compress_history' : 'continue',
        reason: '基于默认配置的建议',
        urgency: percentage > 0.8 ? 'high' : 'medium'
      },
      costEstimate: {
        currentCost: (totalTokens / 1000) * 0.003,
        projectedCost: (totalTokens * 1.5 / 1000) * 0.003,
        efficiency: percentage > 0.6 ? 'poor' : 'good'
      },
      nextCompressionAt: assumedMax * 0.5
    };
  }

  /**
   * 获取模型配置
   * @param modelKey 模型标识
   * @returns 模型上下文配置
   */
  getModelConfig(modelKey: string): ModelContextConfig | null {
    return this.modelConfigs.get(modelKey) || null;
  }

  /**
   * 更新模型配置
   * @param modelKey 模型标识
   * @param config 新的配置
   */
  updateModelConfig(modelKey: string, config: Partial<ModelContextConfig>): void {
    const existing = this.modelConfigs.get(modelKey);
    
    if (existing) {
      const updated = { ...existing, ...config };
      this.modelConfigs.set(modelKey, updated);
      log.info(`🎯 [ModelContextManager] 已更新模型配置: ${modelKey}`);
    } else {
      log.warn(`⚠️ [ModelContextManager] 模型配置不存在: ${modelKey}`);
    }
  }

  /**
   * 检查是否需要压缩
   * @param modelKey 模型标识
   * @param currentTokens 当前token数量
   * @param incomingTokens 即将增加的token数量
   * @returns 是否需要压缩
   */
  shouldCompress(modelKey: string, currentTokens: number, incomingTokens: number = 0): boolean {
    const analysis = this.analyzeContextStatus(modelKey, currentTokens, incomingTokens);
    return analysis.recommendations.action === 'compress_history' ||
           analysis.recommendations.action === 'reactivate_role' ||
           analysis.recommendations.action === 'emergency_compress';
  }

  /**
   * 检查是否需要紧急压缩
   * @param modelKey 模型标识
   * @param currentTokens 当前token数量
   * @returns 是否需要紧急压缩
   */
  needsEmergencyCompression(modelKey: string, currentTokens: number): boolean {
    const analysis = this.analyzeContextStatus(modelKey, currentTokens);
    return analysis.recommendations.action === 'emergency_compress' ||
           analysis.usage.level === 'critical';
  }

  /**
   * 获取最佳压缩时机
   * @param modelKey 模型标识
   * @param currentTokens 当前token数量
   * @returns 建议的压缩时机token数
   */
  getOptimalCompressionPoint(modelKey: string, currentTokens: number): number {
    const config = this.modelConfigs.get(modelKey);
    
    if (!config) {
      return Math.max(currentTokens * 0.8, 50000); // 默认策略
    }

    return config.compressionThreshold;
  }

  /**
   * 计算压缩后的预期token节省
   * @param modelKey 模型标识
   * @param currentTokens 当前token数量
   * @param compressionRatio 压缩比例 (0-1)
   * @returns 压缩收益分析
   */
  calculateCompressionBenefit(
    modelKey: string, 
    currentTokens: number, 
    compressionRatio: number = 0.7
  ): {
    tokensSaved: number;
    costSaved: number;
    newUsageLevel: string;
    performanceGain: string;
  } {
    const config = this.modelConfigs.get(modelKey);
    const tokensSaved = Math.round(currentTokens * compressionRatio);
    const newTokens = currentTokens - tokensSaved;
    
    const costSaved = config ? 
      (tokensSaved / 1000) * (config.tokenCostPerK / 1000) : 
      (tokensSaved / 1000) * 0.003;

    const newAnalysis = this.analyzeContextStatus(modelKey, newTokens);
    
    // 评估性能提升
    let performanceGain: string;
    if (newTokens <= (config?.optimalContextLength || 80000)) {
      performanceGain = '显著提升：回到最佳性能区间';
    } else if (newTokens <= (config?.compressionThreshold || 100000)) {
      performanceGain = '中等提升：注意力质量改善';
    } else {
      performanceGain = '轻微提升：仍需进一步压缩';
    }

    return {
      tokensSaved,
      costSaved,
      newUsageLevel: newAnalysis.usage.level,
      performanceGain
    };
  }

  /**
   * 获取所有模型的统计摘要
   */
  getManagerStats(): {
    supportedModels: number;
    totalConfigurations: number;
    averageContextLimit: number;
    recommendedModel: string;
  } {
    const configs = Array.from(this.modelConfigs.values());
    const totalConfigs = configs.length;
    const avgContextLimit = Math.round(
      configs.reduce((sum, config) => sum + config.maxContextLength, 0) / totalConfigs
    );

    // 推荐最均衡的模型（性价比考量）
    const recommendedModel = configs
      .sort((a, b) => {
        const scoreA = a.maxContextLength / a.tokenCostPerK;
        const scoreB = b.maxContextLength / b.tokenCostPerK;
        return scoreB - scoreA;
      })[0]?.modelKey || 'claude-3-5-sonnet';

    return {
      supportedModels: totalConfigs,
      totalConfigurations: totalConfigs,
      averageContextLimit: avgContextLimit,
      recommendedModel
    };
  }
}

/**
 * 全局模型上下文管理器实例
 */
export const modelContextManager = ModelContextManager.getInstance();