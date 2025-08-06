/**
 * DeeChat提示词系统初始化器
 * 整合所有提示词组件，为DeeChat提供完整的AI提示词支持
 */

import { ISystemPromptProvider } from '../interfaces/ISystemPromptProvider';
import { DEECHAT_BASE_PROMPT_CONFIG } from './DeeChatCorePrompt';
import { createMCPToolSegments, createDynamicMCPStatusSegment } from './MCPToolPrompts';
import { promptXRoleProvider } from './PromptXRoleProvider';
import { featureContextProvider, DeeChatFeature } from './FeatureContextProvider';

/**
 * DeeChat提示词初始化器
 */
export class DeeChatPromptInitializer {
  private promptProvider: ISystemPromptProvider;
  private isInitialized: boolean = false;

  constructor(promptProvider: ISystemPromptProvider) {
    this.promptProvider = promptProvider;
  }

  /**
   * 初始化DeeChat提示词系统
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('DeeChat提示词系统已初始化，跳过重复初始化');
      return;
    }

    try {
      // 1. 设置基础系统提示词
      this.promptProvider.setBasePrompt(DEECHAT_BASE_PROMPT_CONFIG.content);
      console.log('✅ DeeChat基础提示词已设置');

      // 2. 添加MCP工具相关提示词片段
      const mcpSegments = createMCPToolSegments();
      mcpSegments.forEach(segment => {
        this.promptProvider.addSegment(segment);
      });
      console.log('✅ MCP工具提示词片段已添加');

      // 3. 注册PromptX角色提供器
      this.promptProvider.registerProvider(promptXRoleProvider);
      console.log('✅ PromptX角色提供器已注册');

      // 4. 注册功能上下文提供器
      this.promptProvider.registerProvider(featureContextProvider);
      console.log('✅ 功能上下文提供器已注册');

      // 5. 添加环境信息提示词
      this.addEnvironmentSegments();
      console.log('✅ 环境信息提示词已添加');

      this.isInitialized = true;
      console.log('🎉 DeeChat提示词系统初始化完成');

    } catch (error) {
      console.error('❌ DeeChat提示词系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 更新MCP工具状态
   */
  updateMCPToolStatus(availableTools: string[]): void {
    // 移除旧的工具状态段落
    this.promptProvider.removeSegment('mcp-tools-status');
    
    // 添加新的工具状态段落
    const statusSegment = createDynamicMCPStatusSegment(availableTools);
    this.promptProvider.addSegment(statusSegment);
    
    console.log(`🔧 MCP工具状态已更新: ${availableTools.length} 个工具可用`);
  }

  /**
   * 设置PromptX角色上下文
   */
  setPromptXRole(role: string, description?: string, capabilities?: string[]): void {
    promptXRoleProvider.setCurrentRole(role, description, capabilities);
    console.log(`🎭 PromptX角色已设置: ${role}`);
  }

  /**
   * 清除PromptX角色
   */
  clearPromptXRole(): void {
    promptXRoleProvider.clearRole();
    console.log('🎭 PromptX角色已清除');
  }

  /**
   * 设置功能上下文
   */
  setFeatureContext(feature: DeeChatFeature, data?: Record<string, any>): void {
    featureContextProvider.setCurrentFeature(feature, data);
    console.log(`🏗️ 功能上下文已设置: ${feature}`);
  }

  /**
   * 添加环境信息提示词片段
   */
  private addEnvironmentSegments(): void {
    // 时间戳信息
    this.promptProvider.addSegment({
      id: 'environment-timestamp',
      content: `## Environment Information\n\nCurrent time: ${new Date().toISOString()}`,
      enabled: true,
      priority: 200,
      condition: () => true
    });

    // 平台信息
    const platform = typeof process !== 'undefined' ? process.platform : 'unknown';
    this.promptProvider.addSegment({
      id: 'environment-platform',
      content: `Platform: ${platform} desktop application`,
      enabled: true,
      priority: 190,
      condition: () => true
    });

    // DeeChat版本信息（如果可用）
    this.promptProvider.addSegment({
      id: 'environment-version',
      content: 'Application: DeeChat Desktop AI Assistant',
      enabled: true,
      priority: 180,
      condition: () => true
    });
  }

  /**
   * 获取当前提示词构建结果（用于调试）
   */
  getCurrentPrompt(): string {
    return this.promptProvider.buildSystemPrompt();
  }

  /**
   * 获取活跃的提示词片段（用于调试）
   */
  getActiveSegments() {
    return this.promptProvider.getSegments();
  }

  /**
   * 重置提示词系统
   */
  reset(): void {
    this.promptProvider.clearSegments();
    promptXRoleProvider.clearRole();
    featureContextProvider.setCurrentFeature('chat');
    this.isInitialized = false;
    console.log('🔄 DeeChat提示词系统已重置');
  }

  /**
   * 检查初始化状态
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * 添加自定义提示词片段
   */
  addCustomSegment(id: string, content: string, priority: number = 100, condition?: () => boolean): void {
    this.promptProvider.addSegment({
      id,
      content,
      enabled: true,
      priority,
      condition
    });
    console.log(`➕ 自定义提示词片段已添加: ${id}`);
  }

  /**
   * 移除自定义提示词片段
   */
  removeCustomSegment(id: string): void {
    this.promptProvider.removeSegment(id);
    console.log(`➖ 自定义提示词片段已移除: ${id}`);
  }

  /**
   * 导出当前配置（用于调试和配置管理）
   */
  exportConfiguration(): {
    basePrompt: string;
    activeSegments: any[];
    promptXRole: any;
    currentFeature: DeeChatFeature;
    initialized: boolean;
  } {
    return {
      basePrompt: this.promptProvider.getBasePrompt(),
      activeSegments: this.getActiveSegments(),
      promptXRole: promptXRoleProvider.getCurrentRoleInfo(),
      currentFeature: featureContextProvider.getCurrentFeature(),
      initialized: this.isInitialized
    };
  }
}