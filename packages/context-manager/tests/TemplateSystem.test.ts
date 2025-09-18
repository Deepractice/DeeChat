/**
 * 模板系统测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ContextFormatter, StandardTemplate, templateManager } from '../src/index.js';

describe('模板系统', () => {

  beforeEach(() => {
    // 清空模板管理器
    templateManager.clear();
  });

  it('应该能注册和使用标准模板', () => {
    // 注册标准模板
    const standardTemplate = new StandardTemplate();
    templateManager.register(standardTemplate);

    // 使用模板
    const context = ContextFormatter.fromTemplate('standard', {
      role: "You are a helpful assistant",
      tools: ["tool1: description", "tool2: description"],
      current: "Hello world"
    });

    expect(context).toContain('<role>You are a helpful assistant</role>');
    expect(context).toContain('<tools>');
    expect(context).toContain('tool1: description');
    expect(context).toContain('<current>Hello world</current>');
  });

  it('应该能列出已注册的模板', () => {
    const standardTemplate = new StandardTemplate();
    templateManager.register(standardTemplate);

    const templates = templateManager.list();

    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe('standard');
    expect(templates[0].name).toBe('标准四层模板');
  });

  it('应该能检查模板是否存在', () => {
    const standardTemplate = new StandardTemplate();
    templateManager.register(standardTemplate);

    expect(templateManager.has('standard')).toBe(true);
    expect(templateManager.has('nonexistent')).toBe(false);
  });

  it('使用不存在的模板应该抛出错误', () => {
    expect(() => {
      ContextFormatter.fromTemplate('nonexistent', {});
    }).toThrow("Template 'nonexistent' not found");
  });

  it('标准模板应该支持最小输入', () => {
    const standardTemplate = new StandardTemplate();
    templateManager.register(standardTemplate);

    const context = ContextFormatter.fromTemplate('standard', {
      role: "Simple assistant"
    });

    expect(context).toContain('<role>Simple assistant</role>');
    expect(context).not.toContain('<tools>');
    expect(context).not.toContain('<conversation>');
    expect(context).not.toContain('<current>');
  });

});