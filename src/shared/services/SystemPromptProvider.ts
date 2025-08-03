/**
 * 系统提示词提供器默认实现
 */

import { 
  ISystemPromptProvider, 
  PromptSegment, 
  PromptProvider 
} from '../interfaces/ISystemPromptProvider';

export class SystemPromptProvider implements ISystemPromptProvider {
  private basePrompt: string = '';
  private segments: Map<string, PromptSegment> = new Map();
  private providers: PromptProvider[] = [];

  getBasePrompt(): string {
    return this.basePrompt;
  }

  setBasePrompt(prompt: string): void {
    this.basePrompt = prompt;
  }

  registerProvider(provider: PromptProvider): void {
    this.providers.push(provider);
  }

  addSegment(segment: PromptSegment): void {
    this.segments.set(segment.id, segment);
  }

  removeSegment(id: string): void {
    this.segments.delete(id);
  }

  getSegments(): PromptSegment[] {
    // 收集所有片段
    const allSegments: PromptSegment[] = [
      ...Array.from(this.segments.values()),
      ...this.providers.flatMap(p => p.getSegments())
    ];

    // 过滤并排序
    return allSegments
      .filter(segment => {
        // 检查是否启用
        if (!segment.enabled) return false;
        // 检查条件
        if (segment.condition && !segment.condition()) return false;
        return true;
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  buildSystemPrompt(): string {
    const parts: string[] = [];

    // 添加基础提示词
    if (this.basePrompt) {
      parts.push(this.basePrompt);
    }

    // 添加所有有效片段
    const segments = this.getSegments();
    segments.forEach(segment => {
      parts.push(segment.content);
    });

    // 用双换行连接
    return parts.join('\n\n');
  }

  clearSegments(): void {
    this.segments.clear();
  }
}

// 创建默认实例
export const systemPromptProvider = new SystemPromptProvider();