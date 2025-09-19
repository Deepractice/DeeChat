/**
 * 标准模板类型定义
 */

/**
 * 标准模板输入 - 直接对应四层结构
 */
export interface StandardInput {
  role: string;
  tools?: string[];
  conversation?: string | string[];
  current?: string;
}