/**
 * PromptX角色实体 (Domain Entity)
 * 🏗️ DDD重构: 代表一个PromptX角色及其激活状态
 */

import { RoleId } from '../value-objects/RoleId';
import { PromptContent } from '../value-objects/PromptContent';

export interface RoleMetadata {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  category?: string;
  lastModified?: Date;
}

export interface RoleActivationContext {
  sessionId: string;
  userId?: string;
  currentModel: string;
  conversationHistory: any[];
  uiContext?: any;
}

export class PromptXRole {
  private readonly _id: RoleId;
  private _content: PromptContent;
  private _metadata: RoleMetadata;
  private _isActivated: boolean;
  private _lastActivated?: Date;
  private _activationCount: number;
  private _activationContext?: RoleActivationContext;
  private _errors: string[];

  constructor(
    id: RoleId,
    content: PromptContent,
    metadata: RoleMetadata
  ) {
    this._id = id;
    this._content = content;
    this._metadata = metadata;
    this._isActivated = false;
    this._activationCount = 0;
    this._errors = [];
  }

  // Getters - 暴露只读属性
  get id(): RoleId { return this._id; }
  get content(): PromptContent { return this._content; }
  get metadata(): Readonly<RoleMetadata> { return this._metadata; }
  get isActivated(): boolean { return this._isActivated; }
  get lastActivated(): Date | undefined { return this._lastActivated; }
  get activationCount(): number { return this._activationCount; }
  get activationContext(): Readonly<RoleActivationContext> | undefined { return this._activationContext; }
  get errors(): readonly string[] { return this._errors; }
  get hasErrors(): boolean { return this._errors.length > 0; }

  /**
   * 业务方法：激活角色
   */
  activate(context: RoleActivationContext): void {
    try {
      // 验证激活条件
      this.validateActivationContext(context);
      
      this._isActivated = true;
      this._lastActivated = new Date();
      this._activationCount += 1;
      this._activationContext = context;
      this._errors = []; // 清除之前的错误
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this._errors.push(errorMessage);
      this._isActivated = false;
      throw error;
    }
  }

  /**
   * 业务方法：停用角色
   */
  deactivate(): void {
    this._isActivated = false;
    this._activationContext = undefined;
  }

  /**
   * 业务方法：更新角色内容
   */
  updateContent(newContent: PromptContent): void {
    const validation = newContent.validate();
    if (!validation.isValid) {
      throw new Error(`角色内容无效: ${validation.errors.join(', ')}`);
    }
    
    this._content = newContent;
    this._metadata.lastModified = new Date();
    
    // 如果角色已激活，需要重新激活以使用新内容
    if (this._isActivated && this._activationContext) {
      this.activate(this._activationContext);
    }
  }

  /**
   * 业务方法：更新元数据
   */
  updateMetadata(updates: Partial<RoleMetadata>): void {
    this._metadata = {
      ...this._metadata,
      ...updates,
      lastModified: new Date()
    };
  }

  /**
   * 业务方法：生成最终提示词（带变量注入）
   */
  generatePrompt(variables: Record<string, any>): PromptContent {
    if (!this._isActivated) {
      throw new Error('角色未激活，无法生成提示词');
    }
    
    return this._content.inject(variables);
  }

  /**
   * 业务方法：检查角色是否适用于当前上下文
   */
  isApplicableForContext(context: RoleActivationContext): boolean {
    // 基础检查
    if (!context.sessionId || !context.currentModel) {
      return false;
    }
    
    // 可以扩展更多业务规则，比如：
    // - 角色是否支持当前模型
    // - 角色是否适用于当前会话类型
    // - 用户权限检查等
    
    return true;
  }

  /**
   * 业务方法：获取角色的显示名称
   */
  getDisplayName(): string {
    return this._metadata.name || this._id.value;
  }

  /**
   * 业务方法：获取角色简介
   */
  getSummary(): string {
    const name = this.getDisplayName();
    const description = this._metadata.description || '无描述';
    const status = this._isActivated ? '已激活' : '未激活';
    const lastUsed = this._lastActivated 
      ? `最后使用: ${this._lastActivated.toLocaleString()}`
      : '从未使用';
      
    return `${name} (${status}) - ${description} | ${lastUsed}`;
  }

  /**
   * 私有方法：验证激活上下文
   */
  private validateActivationContext(context: RoleActivationContext): void {
    if (!context.sessionId || context.sessionId.trim() === '') {
      throw new Error('会话ID不能为空');
    }
    
    if (!context.currentModel || context.currentModel.trim() === '') {
      throw new Error('当前模型不能为空');
    }
    
    // 验证角色内容
    const validation = this._content.validate();
    if (!validation.isValid) {
      throw new Error(`角色内容验证失败: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * 工厂方法：创建新的PromptX角色
   */
  static create(
    id: string,
    content: string,
    metadata: Omit<RoleMetadata, 'lastModified'>
  ): PromptXRole {
    return new PromptXRole(
      new RoleId(id),
      PromptContent.fromString(content),
      {
        ...metadata,
        lastModified: new Date()
      }
    );
  }

  /**
   * 工厂方法：创建默认角色
   */
  static createDefault(): PromptXRole {
    return PromptXRole.create(
      'deechat-assistant',
      '你是DeeChat AI助手，一个智能的桌面AI伙伴。',
      {
        name: 'DeeChat Assistant',
        description: 'DeeChat默认智能助手角色',
        category: 'system',
        tags: ['default', 'assistant']
      }
    );
  }

  /**
   * 转换为数据传输对象
   */
  toData(): any {
    return {
      id: this._id.value,
      content: this._content.content,
      metadata: this._metadata,
      isActivated: this._isActivated,
      lastActivated: this._lastActivated?.toISOString(),
      activationCount: this._activationCount,
      activationContext: this._activationContext,
      errors: this._errors
    };
  }
}