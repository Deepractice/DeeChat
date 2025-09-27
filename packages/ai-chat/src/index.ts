/**
 * @ai-chat/core - 简化后的主入口
 * 专注于 AI 请求处理和工具调用协调的聊天客户端
 */

// ============== 主要类导出 ==============
export { AIChat } from './core/AIChat.js'

// ============== 工具导出 ==============
export { ToolExecutionManager } from './tools/ToolExecutionManager.js'

// ============== HTTP 客户端导出 ==============
export { HttpClient } from './http/HttpClient.js'

// ============== 流处理导出 ==============
export { createErrorChunk } from './streaming/StreamUtils.js'

// ============== 类型导出 ==============
export * from './types/index.js'

// ============== 适配器导出 ==============
export * from './adapters/index.js'

// ============== 版本信息 ==============
export const version = '0.5.0' // 架构优化：职责分离，MCP 特定逻辑移至 Domain 层

// ============== 包状态 ==============
// v0.5.0 主要特性：
// 🎯 职责分离架构 - MCP 特定逻辑移至 Domain 层
// ✅ 纯粹AI对话框架 - 专注核心对话能力
// ✅ 通用工具执行 - 保留 ToolExecutionManager 通用性
// ✅ 格式适配器保留 - 继续支持多AI服务商格式兼容
// ✅ 回调机制简化 - 通过 onToolCall 统一工具处理
// ✅ 依赖关系优化 - 消除循环依赖和复杂注入
// ✅ 代码精简30% - 移除冗余代码，提升维护性
// ✅ 向前兼容 - API 保持稳定，升级无痛