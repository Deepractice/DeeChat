/**
 * 模板管理器 - 管理所有模板的注册和使用
 */

import type { ContextTemplate } from "../templates/types.js";

export class TemplateManager {
  private templates = new Map<string, ContextTemplate<any>>();

  /**
   * 注册模板
   */
  register<T>(template: ContextTemplate<T>): void {
    this.templates.set(template.id, template);
  }

  /**
   * 获取模板
   */
  get<T>(id: string): ContextTemplate<T> | undefined {
    return this.templates.get(id);
  }

  /**
   * 列出所有模板
   */
  list(): Array<{ id: string; name: string; description: string }> {
    return Array.from(this.templates.values()).map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
    }));
  }

  /**
   * 检查模板是否存在
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * 移除模板
   */
  unregister(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * 清空所有模板
   */
  clear(): void {
    this.templates.clear();
  }
}

/**
 * 全局模板管理器实例
 */
export const templateManager = new TemplateManager();
