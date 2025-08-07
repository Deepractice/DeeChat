/**
 * DeeChat提示词系统入口文件
 * 提供统一的导入接口和便利的使用方法
 */

// 导入依赖
import { EnhancedSystemPromptProvider, enhancedSystemPromptProvider } from './EnhancedSystemPromptProvider';
import { DeeChatFeature } from './FeatureContextProvider';

// 主要类和实例导出
export { EnhancedSystemPromptProvider, enhancedSystemPromptProvider } from './EnhancedSystemPromptProvider';

// 提供器类导出
export { PromptXRoleProvider, promptXRoleProvider } from './PromptXRoleProvider';
export { FeatureContextProvider, featureContextProvider, type DeeChatFeature } from './FeatureContextProvider';

// 提示词内容导出
export { DEECHAT_CORE_PROMPT, DEECHAT_BASE_PROMPT_CONFIG } from './DeeChatCorePrompt';
export { 
  createMCPToolSegments, 
  createDynamicMCPStatusSegment,
  MCP_TOOL_USAGE_PROMPT,
  PROMPTX_INTEGRATION_PROMPT,
  FILE_OPERATIONS_INTEGRATION_PROMPT
} from './MCPToolPrompts';
export { 
  createFileOperationScenarioSegment,
  FILE_OPERATION_SCENARIOS_PROMPT
} from './FileOperationScenarios';

// 类型定义重新导出
export type { PromptSegment, PromptProvider, ISystemPromptProvider } from '../interfaces/ISystemPromptProvider';

/**
 * 快速初始化DeeChat提示词系统
 * 这是最简单的使用方式，适合大多数场景
 */
export async function initializeDeeChatPrompts(): Promise<EnhancedSystemPromptProvider> {
  await enhancedSystemPromptProvider.initializeDeeChat();
  return enhancedSystemPromptProvider;
}

/**
 * 便利函数：设置PromptX角色
 */
export function setPromptXRole(role: string, description?: string, capabilities?: string[]): void {
  enhancedSystemPromptProvider.setPromptXRole(role, description, capabilities);
}

/**
 * 便利函数：清除PromptX角色
 */
export function clearPromptXRole(): void {
  enhancedSystemPromptProvider.clearPromptXRole();
}

/**
 * 便利函数：设置功能上下文
 */
export function setFeatureContext(feature: DeeChatFeature, data?: Record<string, any>): void {
  enhancedSystemPromptProvider.setFeatureContext(feature, data);
}

/**
 * 便利函数：更新MCP工具状态
 */
export function updateMCPToolStatus(availableTools: string[]): void {
  enhancedSystemPromptProvider.updateMCPToolStatus(availableTools);
}

/**
 * 便利函数：获取当前系统提示词
 */
export function getCurrentSystemPrompt(): string {
  return enhancedSystemPromptProvider.buildSystemPrompt();
}

/**
 * 便利函数：调试打印当前提示词
 */
export function debugCurrentPrompt(): void {
  enhancedSystemPromptProvider.debugPrintCurrentPrompt();
}

/**
 * 便利函数：获取提示词统计信息
 */
export function getPromptStats() {
  return enhancedSystemPromptProvider.getPromptStats();
}

/**
 * 便利函数：验证提示词完整性
 */
export function validatePromptIntegrity() {
  return enhancedSystemPromptProvider.validatePromptIntegrity();
}

/**
 * 便利函数：重置提示词系统
 */
export function resetDeeChatPrompts(): void {
  enhancedSystemPromptProvider.resetDeeChat();
}

/**
 * 预设配置：开发者模式
 */
export function enableDeveloperMode(): void {
  enhancedSystemPromptProvider.addCustomSegment(
    'developer-mode',
    `## Developer Mode Enabled

You are operating in developer mode with enhanced technical capabilities:

- Provide detailed technical explanations when requested
- Include code examples and implementation details
- Explain architectural decisions and trade-offs
- Support debugging and troubleshooting workflows
- Offer performance optimization suggestions

Focus on technical accuracy and professional development practices.`,
    850, // 高优先级
    () => true
  );
}

/**
 * 预设配置：生产环境模式
 */
export function enableProductionMode(): void {
  enhancedSystemPromptProvider.addCustomSegment(
    'production-mode',
    `## Production Environment

You are operating in a production environment context:

- Prioritize stability and reliability in all recommendations
- Emphasize testing and validation procedures
- Consider performance and security implications
- Provide conservative, well-tested solutions
- Include rollback and recovery considerations

Focus on production-ready implementations and best practices.`,
    800,
    () => true
  );
}

/**
 * 预设配置：简洁模式
 */
export function enableConciseMode(): void {
  enhancedSystemPromptProvider.addCustomSegment(
    'concise-mode',
    `## Concise Communication Mode

Optimize responses for brevity and clarity:

- Provide direct, actionable answers
- Use bullet points and structured formatting
- Minimize explanatory text unless specifically requested
- Focus on essential information only
- Prioritize practical solutions over theoretical discussion`,
    750,
    () => true
  );
}

/**
 * 移除所有预设配置
 */
export function clearPresetModes(): void {
  ['developer-mode', 'production-mode', 'concise-mode'].forEach(id => {
    enhancedSystemPromptProvider.removeCustomSegment(id);
  });
}

/**
 * 检查系统状态
 */
export function getSystemStatus(): {
  initialized: boolean;
  currentFeature: DeeChatFeature;
  activeRole?: string;
  promptLength: number;
  segmentCount: number;
} {
  const config = enhancedSystemPromptProvider.getDeeChatConfiguration();
  const stats = enhancedSystemPromptProvider.getPromptStats();
  
  return {
    initialized: config.initialized,
    currentFeature: config.currentFeature,
    activeRole: config.promptXRole.role,
    promptLength: stats.totalLength,
    segmentCount: stats.segmentCount
  };
}

/**
 * 导出默认实例（向后兼容）
 */
export default enhancedSystemPromptProvider;