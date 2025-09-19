/**
 * 模板系统测试 - 极简架构版本
 */

import { describe, it, expect } from "vitest";
import { ContextFormatter, StandardTemplate, templateManager } from "../src/index.js";

describe("模板系统", () => {
  it("应该能注册和使用标准模板", () => {
    // 注册标准模板
    const standardTemplate = new StandardTemplate();
    templateManager.register(standardTemplate);

    // 使用模板生成消息数组
    const messages = ContextFormatter.fromTemplateAsMessages("standard", {
      role: "You are a helpful assistant",
      tools: ["tool1: description", "tool2: description"],
      conversation: ["User: Hello", "Assistant: Hi!"],
      current: "Help me",
    });

    expect(messages).toHaveLength(4); // system + conversation(2) + current(1)
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("You are a helpful assistant");
  });

  it("应该能列出已注册的模板", () => {
    const templateList = templateManager.list();

    expect(Array.isArray(templateList)).toBe(true);
    expect(templateList.some((t) => t.id === "standard")).toBe(true);
  });

  it("应该能检查模板是否存在", () => {
    expect(templateManager.has("standard")).toBe(true);
    expect(templateManager.has("nonexistent")).toBe(false);
  });

  it("使用不存在的模板应该抛出错误", () => {
    expect(() => {
      ContextFormatter.fromTemplateAsMessages("nonexistent", {});
    }).toThrow("Template 'nonexistent' not found");
  });

  it("标准模板应该支持最小输入", () => {
    const standardTemplate = new StandardTemplate();
    templateManager.register(standardTemplate);

    const messages = ContextFormatter.fromTemplateAsMessages("standard", {
      role: "Simple assistant",
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe("Simple assistant");
  });
});
