/**
 * 模板系统核心架构
 */

import type { ContextData } from '../types.js';

/**
 * 模板接口 - 所有模板都需要实现这个接口
 */
export interface ContextTemplate<TInput = any> {
  /**
   * 模板唯一标识
   */
  readonly id: string;

  /**
   * 模板名称
   */
  readonly name: string;

  /**
   * 模板描述
   */
  readonly description: string;

  /**
   * 将特定输入转换为标准的 ContextData
   */
  build(input: TInput): ContextData;
}

/**
 * 模板构造器 - 用于创建和管理模板
 */
export interface TemplateBuilder {
  /**
   * 注册模板
   */
  register<T>(template: ContextTemplate<T>): void;

  /**
   * 获取模板
   */
  get<T>(id: string): ContextTemplate<T> | undefined;

  /**
   * 列出所有模板
   */
  list(): Array<{id: string; name: string; description: string}>;

  /**
   * 使用模板构建上下文
   */
  build<T>(templateId: string, input: T): string;
}