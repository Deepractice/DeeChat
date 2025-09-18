/**
 * Context Formatter 测试
 */

import { describe, it, expect } from 'vitest';
import { ContextFormatter, ContextData } from '../src/index.js';

describe('ContextFormatter', () => {

  it('应该格式化基本的角色和当前消息', () => {
    const data: ContextData = {
      role: "You are a helpful assistant",
      current: "Hello world"
    };

    const result = ContextFormatter.format(data);

    expect(result).toContain('<context>');
    expect(result).toContain('<role>You are a helpful assistant</role>');
    expect(result).toContain('<current>Hello world</current>');
    expect(result).toContain('</context>');
  });

  it('应该格式化完整的四层结构', () => {
    const data: ContextData = {
      role: "You are a frontend developer",
      tools: ["tool1: description", "tool2: description"],
      conversation: ["User: Hello", "Assistant: Hi!"],
      current: "Help me"
    };

    const result = ContextFormatter.format(data);

    expect(result).toContain('<role>You are a frontend developer</role>');
    expect(result).toContain('<tools>');
    expect(result).toContain('tool1: description');
    expect(result).toContain('<conversation>');
    expect(result).toContain('User: Hello');
    expect(result).toContain('<current>Help me</current>');
  });

  it('应该处理字符串格式的对话', () => {
    const data: ContextData = {
      role: "Assistant",
      conversation: "User: Hello\nAssistant: Hi there!"
    };

    const result = ContextFormatter.format(data);

    expect(result).toContain('<conversation>');
    expect(result).toContain('User: Hello\nAssistant: Hi there!');
  });

  it('应该跳过空的可选字段', () => {
    const data: ContextData = {
      role: "Assistant",
      tools: [],
      conversation: "",
      current: undefined
    };

    const result = ContextFormatter.format(data);

    expect(result).toContain('<role>Assistant</role>');
    expect(result).not.toContain('<tools>');
    expect(result).not.toContain('<conversation>');
    expect(result).not.toContain('<current>');
  });

  it('应该处理只有角色的最简情况', () => {
    const data: ContextData = {
      role: "You are helpful"
    };

    const result = ContextFormatter.format(data);

    expect(result).toBe('<context>\n<role>You are helpful</role>\n</context>');
  });

  it('应该过滤掉空白的工具和对话', () => {
    const data: ContextData = {
      role: "Assistant",
      tools: ["tool1", "", "  ", "tool2"],
      conversation: ["User: Hi", "", "Assistant: Hello"]
    };

    const result = ContextFormatter.format(data);

    expect(result).toContain('tool1\ntool2');
    expect(result).toContain('User: Hi\nAssistant: Hello');
  });
});
