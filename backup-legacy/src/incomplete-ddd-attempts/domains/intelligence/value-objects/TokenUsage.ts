/**
 * Token使用情况值对象
 * 🏗️ DDD重构: Token使用统计和分析
 */

export class TokenUsage {
  private readonly _current: number;
  private readonly _maximum: number;
  private readonly _modelKey: string;

  constructor(current: number, maximum: number, modelKey: string) {
    if (current < 0) {
      throw new Error('当前Token数不能为负数');
    }
    if (maximum <= 0) {
      throw new Error('最大Token数必须大于0');
    }
    if (!modelKey || modelKey.trim() === '') {
      throw new Error('模型标识不能为空');
    }
    
    this._current = current;
    this._maximum = maximum;
    this._modelKey = modelKey;
  }

  get current(): number {
    return this._current;
  }

  get maximum(): number {
    return this._maximum;
  }

  get modelKey(): string {
    return this._modelKey;
  }

  /**
   * 获取使用百分比
   */
  get percentage(): number {
    return Math.round((this._current / this._maximum) * 100);
  }

  /**
   * 获取剩余Token数
   */
  get remaining(): number {
    return Math.max(0, this._maximum - this._current);
  }

  /**
   * 获取使用级别
   */
  get level(): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = this.percentage;
    if (percentage < 30) return 'low';
    if (percentage < 60) return 'medium';
    if (percentage < 85) return 'high';
    return 'critical';
  }

  /**
   * 是否需要压缩
   */
  needsCompression(): boolean {
    return this.percentage >= 80;
  }

  /**
   * 是否需要截断
   */
  needsTruncation(): boolean {
    return this.percentage >= 90;
  }

  /**
   * 是否达到警告阈值
   */
  isWarning(): boolean {
    return this.percentage >= 70;
  }

  /**
   * 是否达到危险阈值
   */
  isCritical(): boolean {
    return this.percentage >= 85;
  }

  /**
   * 添加Token使用量
   */
  add(tokens: number): TokenUsage {
    return new TokenUsage(
      this._current + tokens,
      this._maximum,
      this._modelKey
    );
  }

  /**
   * 减少Token使用量
   */
  subtract(tokens: number): TokenUsage {
    return new TokenUsage(
      Math.max(0, this._current - tokens),
      this._maximum,
      this._modelKey
    );
  }

  /**
   * 重置Token使用量
   */
  reset(): TokenUsage {
    return new TokenUsage(0, this._maximum, this._modelKey);
  }

  /**
   * 获取推荐的最大输出Token数
   */
  getRecommendedMaxOutput(): number {
    const available = this.remaining;
    const reserveForSafety = Math.floor(available * 0.2); // 保留20%安全边际
    return Math.max(1024, available - reserveForSafety);
  }

  /**
   * 获取状态描述
   */
  getStatusDescription(): string {
    const level = this.level;
    const percentage = this.percentage;
    
    switch (level) {
      case 'low':
        return `Token使用正常 (${percentage}%)`;
      case 'medium':
        return `Token使用适中 (${percentage}%)`;
      case 'high':
        return `Token使用偏高 (${percentage}%)，建议优化`;
      case 'critical':
        return `Token使用严重超标 (${percentage}%)，需要立即压缩`;
      default:
        return `Token使用情况未知`;
    }
  }

  /**
   * 静态工厂方法：从模型配置创建
   */
  static fromModel(modelKey: string, maxTokens: number): TokenUsage {
    return new TokenUsage(0, maxTokens, modelKey);
  }

  /**
   * 静态工厂方法：创建默认配置
   */
  static default(): TokenUsage {
    return new TokenUsage(0, 200000, 'claude-3-5-sonnet'); // Claude 3.5 Sonnet的默认配置
  }

  /**
   * 转换为数据对象
   */
  toData(): {
    current: number;
    maximum: number;
    modelKey: string;
    percentage: number;
    level: string;
    remaining: number;
  } {
    return {
      current: this._current,
      maximum: this._maximum,
      modelKey: this._modelKey,
      percentage: this.percentage,
      level: this.level,
      remaining: this.remaining
    };
  }
}