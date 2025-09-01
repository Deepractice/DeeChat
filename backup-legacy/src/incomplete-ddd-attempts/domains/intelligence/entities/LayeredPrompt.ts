/**
 * 分层提示词实体 (Domain Entity)
 * 🏗️ DDD重构: 代表智能分层提示词系统的4层结构
 */

import { PromptContent } from '../value-objects/PromptContent';
import { TokenUsage } from '../value-objects/TokenUsage';

export interface LayerResult {
  layerName: string;
  content: PromptContent;
  tokens: number;
  executionTime: number;
  metadata?: Record<string, any>;
}

export interface LayerConfiguration {
  enabled: boolean;
  priority: number;
  maxTokens?: number;
  cacheEnabled?: boolean;
}

export interface LayeredPromptConfig {
  sessionId: string;
  modelKey: string;
  maxTokens: number;
  layers: {
    roleMonitoring: LayerConfiguration;
    historyContext: LayerConfiguration;
    toolIntegration: LayerConfiguration;
    currentMessage: LayerConfiguration;
  };
}

export class LayeredPrompt {
  private readonly _id: string;
  private readonly _config: LayeredPromptConfig;
  private _layers: Map<string, LayerResult>;
  private _finalContent?: PromptContent;
  private _tokenUsage?: TokenUsage;
  private _buildTime?: number;
  private _compressionTriggered: boolean;
  private _status: 'building' | 'completed' | 'failed';
  private _errors: string[];

  constructor(config: LayeredPromptConfig) {
    this._id = this.generateId();
    this._config = config;
    this._layers = new Map();
    this._compressionTriggered = false;
    this._status = 'building';
    this._errors = [];
  }

  // Getters - 暴露只读属性
  get id(): string { return this._id; }
  get config(): Readonly<LayeredPromptConfig> { return this._config; }
  get layers(): ReadonlyMap<string, LayerResult> { return this._layers; }
  get finalContent(): PromptContent | undefined { return this._finalContent; }
  get tokenUsage(): TokenUsage | undefined { return this._tokenUsage; }
  get buildTime(): number | undefined { return this._buildTime; }
  get compressionTriggered(): boolean { return this._compressionTriggered; }
  get status(): string { return this._status; }
  get errors(): readonly string[] { return this._errors; }
  get hasErrors(): boolean { return this._errors.length > 0; }

  /**
   * 业务方法：添加层级结果
   */
  addLayerResult(result: LayerResult): void {
    if (this._status !== 'building') {
      throw new Error(`无法在${this._status}状态下添加层级结果`);
    }

    this._layers.set(result.layerName, result);
  }

  /**
   * 业务方法：完成构建
   */
  complete(
    finalContent: PromptContent,
    tokenUsage: TokenUsage,
    buildTime: number,
    compressionTriggered: boolean = false
  ): void {
    if (this._status !== 'building') {
      throw new Error(`无法在${this._status}状态下完成构建`);
    }

    // 验证最终内容
    const validation = finalContent.validate();
    if (!validation.isValid) {
      this.fail(validation.errors);
      return;
    }

    this._finalContent = finalContent;
    this._tokenUsage = tokenUsage;
    this._buildTime = buildTime;
    this._compressionTriggered = compressionTriggered;
    this._status = 'completed';
  }

  /**
   * 业务方法：标记失败
   */
  fail(errors: string[]): void {
    this._errors = [...this._errors, ...errors];
    this._status = 'failed';
  }

  /**
   * 业务方法：获取层级执行顺序
   */
  getExecutionOrder(): string[] {
    return Array.from(this._layers.values())
      .sort((a, b) => a.executionTime - b.executionTime)
      .map(layer => layer.layerName);
  }

  /**
   * 业务方法：获取总执行时间
   */
  getTotalExecutionTime(): number {
    return Array.from(this._layers.values())
      .reduce((total, layer) => total + layer.executionTime, 0);
  }

  /**
   * 业务方法：获取总Token使用量（所有层级）
   */
  getTotalTokens(): number {
    return Array.from(this._layers.values())
      .reduce((total, layer) => total + layer.tokens, 0);
  }

  /**
   * 业务方法：检查是否所有必需层级都已完成
   */
  hasAllRequiredLayers(): boolean {
    const requiredLayers = this.getEnabledLayers();
    return requiredLayers.every(layerName => this._layers.has(layerName));
  }

  /**
   * 业务方法：获取启用的层级列表
   */
  getEnabledLayers(): string[] {
    return Object.entries(this._config.layers)
      .filter(([_, config]) => config.enabled)
      .map(([layerName]) => layerName);
  }

  /**
   * 业务方法：获取层级性能报告
   */
  getPerformanceReport(): {
    totalLayers: number;
    totalTokens: number;
    totalExecutionTime: number;
    averageTokensPerLayer: number;
    slowestLayer: string;
    mostTokensLayer: string;
  } {
    const layers = Array.from(this._layers.values());
    
    if (layers.length === 0) {
      return {
        totalLayers: 0,
        totalTokens: 0,
        totalExecutionTime: 0,
        averageTokensPerLayer: 0,
        slowestLayer: 'none',
        mostTokensLayer: 'none'
      };
    }

    const totalTokens = this.getTotalTokens();
    const totalExecutionTime = this.getTotalExecutionTime();
    const slowestLayer = layers.reduce((prev, current) => 
      prev.executionTime > current.executionTime ? prev : current
    );
    const mostTokensLayer = layers.reduce((prev, current) => 
      prev.tokens > current.tokens ? prev : current
    );

    return {
      totalLayers: layers.length,
      totalTokens,
      totalExecutionTime,
      averageTokensPerLayer: Math.round(totalTokens / layers.length),
      slowestLayer: slowestLayer.layerName,
      mostTokensLayer: mostTokensLayer.layerName
    };
  }

  /**
   * 业务方法：创建构建摘要
   */
  createBuildSummary(): string {
    const report = this.getPerformanceReport();
    const status = this._status === 'completed' ? '✅ 成功' : 
                  this._status === 'failed' ? '❌ 失败' : '🔄 构建中';
    
    let summary = `## 🏗️ 分层提示词构建报告\n`;
    summary += `**状态**: ${status}\n`;
    summary += `**会话**: ${this._config.sessionId.slice(0, 8)}...\n`;
    summary += `**模型**: ${this._config.modelKey}\n`;
    summary += `**层级数**: ${report.totalLayers}/${this.getEnabledLayers().length}\n`;
    summary += `**总Token**: ${report.totalTokens}\n`;
    summary += `**构建耗时**: ${this._buildTime || 0}ms\n`;
    
    if (this._compressionTriggered) {
      summary += `**压缩**: ⚠️ 已触发\n`;
    }
    
    if (this.hasErrors) {
      summary += `\n**错误**:\n${this._errors.map(e => `- ${e}`).join('\n')}\n`;
    }
    
    return summary;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `layered_${timestamp}_${random}`;
  }

  /**
   * 工厂方法：创建新的分层提示词
   */
  static create(config: LayeredPromptConfig): LayeredPrompt {
    return new LayeredPrompt(config);
  }

  /**
   * 工厂方法：创建默认配置
   */
  static createDefault(sessionId: string, modelKey: string = 'claude-3-5-sonnet'): LayeredPrompt {
    const config: LayeredPromptConfig = {
      sessionId,
      modelKey,
      maxTokens: 200000,
      layers: {
        roleMonitoring: { enabled: true, priority: 1, cacheEnabled: true },
        historyContext: { enabled: true, priority: 2, cacheEnabled: true },
        toolIntegration: { enabled: true, priority: 3, cacheEnabled: false },
        currentMessage: { enabled: true, priority: 4, cacheEnabled: false }
      }
    };
    
    return new LayeredPrompt(config);
  }

  /**
   * 转换为数据传输对象
   */
  toData(): any {
    return {
      id: this._id,
      config: this._config,
      layers: Array.from(this._layers.entries()),
      finalContent: this._finalContent?.content,
      tokenUsage: this._tokenUsage?.toData(),
      buildTime: this._buildTime,
      compressionTriggered: this._compressionTriggered,
      status: this._status,
      errors: this._errors,
      performanceReport: this.getPerformanceReport()
    };
  }
}