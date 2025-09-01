/**
 * DeeChat智能分层提示词系统 - 第3层：当前消息层（增强版）
 * 
 * 核心职责：
 * 1. 处理当前用户输入消息
 * 2. 维持消息的纯净性和简洁性
 * 3. **新增**：集成UI驱动的意图注入
 * 
 * 奥卡姆剃刀原则：只保留最必要的功能，但支持明确的用户意图表达
 */

import { HumanMessage } from '@langchain/core/messages';
import log from 'electron-log';
import type { UIInjectionContext } from './RoleStatusMonitorLayer';

/**
 * 第3层：当前消息层（增强版：支持UI驱动意图注入）
 * 
 * 设计原则：保持简洁和纯净，专注于当前用户输入的处理，同时支持UI明确的意图表达
 */
export class CurrentMessageLayer {
  constructor() {
    log.info('📝 [CurrentMessageLayer] 第3层：当前消息层（增强版）初始化完成');
  }

  /**
   * 渲染第3层内容：当前用户消息 + UI意图注入
   * @param userInput 用户输入
   * @param uiContext UI意图注入上下文
   * @returns LangChain HumanMessage实例
   */
  render(userInput: string, uiContext?: UIInjectionContext): HumanMessage {
    // 基础预处理：去除前后空白字符
    let processedInput = userInput.trim();

    // **新增**：处理UI驱动的意图注入
    if (uiContext) {
      const uiIntentAddition = this.buildUIIntentAddition(uiContext);
      if (uiIntentAddition) {
        processedInput += uiIntentAddition;
        log.info(`🎯 [CurrentMessage] 已添加UI意图注入，额外长度: ${uiIntentAddition.length} 字符`);
      }
    }

    // 验证消息长度
    if (processedInput.length > 4000) {
      log.warn(`⚠️ [CurrentMessage] 消息过长 (${processedInput.length}字符)，将被截断`);
      return new HumanMessage(processedInput.substring(0, 4000) + '...[消息被截断]');
    }

    return new HumanMessage(processedInput);
  }

  /**
   * 构建UI意图附加内容（轻量级注入）
   * @param uiContext UI意图上下文
   * @returns 要添加到用户消息的内容
   */
  private buildUIIntentAddition(uiContext: UIInjectionContext): string {
    const additions: string[] = [];

    // 角色激活请求（用户消息层面的提示）
    if (uiContext.roleActivationRequest && uiContext.selectedRole) {
      additions.push(`\n\n🎭 [UI请求]: 用户选择激活 ${uiContext.selectedRole} 角色`);
    }

    // 功能模式简洁提示
    if (uiContext.specialModes) {
      const activeModes: string[] = [];
      if (uiContext.specialModes.codeAnalysis) activeModes.push('代码分析');
      if (uiContext.specialModes.detailedExplanation) activeModes.push('详细解释');
      if (uiContext.specialModes.quickAnswer) activeModes.push('快速回答');
      if (uiContext.specialModes.creativeMode) activeModes.push('创意模式');
      
      if (activeModes.length > 0) {
        additions.push(`\n\n⚡ [用户模式]: ${activeModes.join('、')}`);
      }
    }

    // 自定义指令（简化版）
    if (uiContext.customInstructions && uiContext.customInstructions.length > 0) {
      additions.push(`\n\n📋 [用户指令]: ${uiContext.customInstructions.join('; ')}`);
    }

    return additions.join('');
  }
}