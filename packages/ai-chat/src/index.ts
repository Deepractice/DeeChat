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

// ============== 版本信息 ==============
export const version = '0.2.0' // 版本升级，表示重大重构

// ============== 包状态 ==============
// 重构完成！新特性：
// ✅ 移除Provider抽象层 - 直接HTTP请求
// ✅ 简化配置 - 只需baseUrl + model
// ✅ 保留核心功能 - 工具调用 + 流式处理
// ✅ 兼容所有OpenAI格式API - OpenAI, Claude, Ollama等
// ✅ 大幅减少代码量和复杂度