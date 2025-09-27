/**
 * 模板系统导出
 */

export type { ContextTemplate, TemplateBuilder } from './types.js';
export { StandardTemplate, type StandardInput } from './standard/index.js';

// 自动注册标准模板
import { templateManager } from '../core/TemplateManager.js';
import { StandardTemplate } from './standard/index.js';

// 注册标准模板到全局管理器
templateManager.register(new StandardTemplate());