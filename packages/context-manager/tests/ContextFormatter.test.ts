/**
 * Context Formatter 测试 - 极简模板驱动架构
 */

import { describe, it, expect } from "vitest";
import { ContextFormatter, AIMessage } from "../src/index.js";

describe("ContextFormatter - 模板驱动架构", () => {
  describe("核心API: fromTemplateAsMessages", () => {
    it("应该使用标准模板生成基本的消息数组", () => {
      const input = {
        role: "You are a helpful assistant",
        current: "Hello world",
      };

      const messages = ContextFormatter.fromTemplateAsMessages(
        "standard",
        input,
      );

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        role: "system",
        content: "You are a helpful assistant",
      });
      expect(messages[1]).toEqual({
        role: "user",
        content: "Hello world",
      });
    });

    it("应该合并角色和工具为系统消息", () => {
      const input = {
        role: "You are a frontend developer",
        tools: ["tool1: description", "tool2: description"],
      };

      const messages = ContextFormatter.fromTemplateAsMessages(
        "standard",
        input,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("You are a frontend developer");
      expect(messages[0].content).toContain("可用工具：");
      expect(messages[0].content).toContain("tool1: description");
      expect(messages[0].content).toContain("tool2: description");
    });

    it("应该将对话历史转换为交替的用户/助手消息", () => {
      const input = {
        role: "Assistant",
        conversation: [
          "User question 1",
          "Assistant answer 1",
          "User question 2",
        ],
      };

      const messages = ContextFormatter.fromTemplateAsMessages(
        "standard",
        input,
      );

      expect(messages).toHaveLength(4); // 1 system + 3 conversation
      expect(messages[0].role).toBe("system");
      expect(messages[1]).toEqual({ role: "user", content: "User question 1" });
      expect(messages[2]).toEqual({
        role: "assistant",
        content: "Assistant answer 1",
      });
      expect(messages[3]).toEqual({ role: "user", content: "User question 2" });
    });

    it("应该处理完整的四层结构", () => {
      const input = {
        role: "You are a helpful assistant",
        tools: ["search: 搜索功能"],
        conversation: ["Hi", "Hello!"],
        current: "Help me",
      };

      const messages = ContextFormatter.fromTemplateAsMessages(
        "standard",
        input,
      );

      expect(messages).toHaveLength(4); // system + conversation(2) + current(1)

      // 检查系统消息
      expect(messages[0].role).toBe("system");
      expect(messages[0].content).toContain("You are a helpful assistant");
      expect(messages[0].content).toContain("search: 搜索功能");

      // 检查对话
      expect(messages[1]).toEqual({ role: "user", content: "Hi" });
      expect(messages[2]).toEqual({ role: "assistant", content: "Hello!" });

      // 检查当前消息
      expect(messages[3]).toEqual({ role: "user", content: "Help me" });
    });

    it("应该处理最小输入（只有角色）", () => {
      const input = {
        role: "Simple assistant",
      };

      const messages = ContextFormatter.fromTemplateAsMessages(
        "standard",
        input,
      );

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        role: "system",
        content: "Simple assistant",
      });
    });
  });

  describe("模板管理器", () => {
    it("应该提供模板管理器访问", () => {
      const templates = ContextFormatter.templates;

      expect(templates).toBeDefined();
      expect(typeof templates.get).toBe("function");
      expect(typeof templates.register).toBe("function");
    });
  });
});
