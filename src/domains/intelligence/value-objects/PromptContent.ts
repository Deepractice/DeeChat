/**
 * 提示词内容值对象
 * 🏗️ DDD重构: 强类型化的提示词内容，包含丰富的业务方法
 */

export class PromptContent {
  private readonly _content: string;
  private readonly _variables: Map<string, any>;

  constructor(content: string, variables?: Map<string, any>) {
    if (!content || content.trim() === '') {
      throw new Error('提示词内容不能为空');
    }
    
    this._content = content;
    this._variables = variables || new Map();
  }

  get content(): string {
    return this._content;
  }

  get variables(): ReadonlyMap<string, any> {
    return this._variables;
  }

  get length(): number {
    return this._content.length;
  }

  /**
   * 是否包含变量占位符
   */
  hasVariables(): boolean {
    return this._content.includes('{{') && this._content.includes('}}');
  }

  /**
   * 获取所有变量占位符
   */
  getVariablePlaceholders(): string[] {
    const matches = this._content.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map(match => match.slice(2, -2).trim()) : [];
  }

  /**
   * 注入变量生成新的提示词内容
   */
  inject(variables: Record<string, any>): PromptContent {
    let result = this._content;
    
    Object.entries(variables).forEach(([key, value]) => {
      if (value !== undefined) {
        // 处理普通变量 {{VARIABLE_NAME}}
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        result = result.replace(pattern, String(value));
        
        // 处理条件变量 {{#VARIABLE}}content{{/VARIABLE}}
        const conditionalPattern = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
        result = result.replace(conditionalPattern, (match, content) => {
          return value && String(value).trim() !== '' ? content.trim() : '';
        });
        
        // 处理反向条件变量 {{^VARIABLE}}content{{/VARIABLE}}
        const inversePattern = new RegExp(`\\{\\{\\^${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
        result = result.replace(inversePattern, (match, content) => {
          return !value || String(value).trim() === '' ? content.trim() : '';
        });
      }
    });
    
    return new PromptContent(result, new Map(Object.entries(variables)));
  }

  /**
   * 截取指定长度的内容
   */
  truncate(maxLength: number): PromptContent {
    if (this._content.length <= maxLength) {
      return this;
    }
    
    const truncated = this._content.substring(0, maxLength - 3) + '...';
    return new PromptContent(truncated, this._variables);
  }

  /**
   * 合并另一个提示词内容
   */
  concat(other: PromptContent, separator: string = '\n\n'): PromptContent {
    const mergedContent = this._content + separator + other._content;
    const mergedVariables = new Map([...this._variables, ...other._variables]);
    
    return new PromptContent(mergedContent, mergedVariables);
  }

  /**
   * 验证提示词内容的有效性
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // 检查内容长度
    if (this._content.length > 100000) {
      errors.push('提示词内容过长，超过100,000字符');
    }
    
    // 检查未替换的变量
    const unresolvedVars = this.getVariablePlaceholders();
    if (unresolvedVars.length > 0) {
      errors.push(`存在未解析的变量: ${unresolvedVars.join(', ')}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 静态工厂方法：从普通字符串创建
   */
  static fromString(content: string): PromptContent {
    return new PromptContent(content);
  }

  /**
   * 静态工厂方法：创建空内容
   */
  static empty(): PromptContent {
    return new PromptContent(' '); // 使用空格而不是空字符串避免验证错误
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    return this._content;
  }
}