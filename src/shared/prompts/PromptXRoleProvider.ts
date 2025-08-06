/**
 * PromptX角色上下文提示词提供器
 * 根据当前激活的PromptX角色提供专业化的提示词片段
 */

import { PromptProvider, PromptSegment } from '../interfaces/ISystemPromptProvider';

/**
 * PromptX角色上下文提供器
 */
export class PromptXRoleProvider implements PromptProvider {
  private currentRole?: string;
  private roleDescription?: string;
  private availableTools: string[] = [];
  private roleCapabilities: string[] = [];

  /**
   * 设置当前激活的角色
   */
  setCurrentRole(role: string, description?: string, capabilities?: string[]): void {
    this.currentRole = role;
    this.roleDescription = description;
    this.roleCapabilities = capabilities || [];
  }

  /**
   * 设置角色可用的工具
   */
  setAvailableTools(tools: string[]): void {
    this.availableTools = tools;
  }

  /**
   * 清除当前角色
   */
  clearRole(): void {
    this.currentRole = undefined;
    this.roleDescription = undefined;
    this.roleCapabilities = [];
    this.availableTools = [];
  }

  /**
   * 获取提示词片段
   */
  getSegments(): PromptSegment[] {
    const segments: PromptSegment[] = [];

    // 当前角色提示
    if (this.currentRole) {
      segments.push({
        id: 'promptx-current-role',
        content: this.buildRolePrompt(),
        enabled: true,
        priority: 600,
        condition: () => !!this.currentRole
      });
    }

    // 角色工具提示
    if (this.availableTools.length > 0 && this.currentRole) {
      segments.push({
        id: 'promptx-role-tools',
        content: this.buildRoleToolsPrompt(),
        enabled: true,
        priority: 580,
        condition: () => !!this.currentRole && this.availableTools.length > 0
      });
    }

    // 角色能力提示
    if (this.roleCapabilities.length > 0 && this.currentRole) {
      segments.push({
        id: 'promptx-role-capabilities',
        content: this.buildRoleCapabilitiesPrompt(),
        enabled: true,
        priority: 560,
        condition: () => !!this.currentRole && this.roleCapabilities.length > 0
      });
    }

    return segments;
  }

  /**
   * 构建角色激活指导提示词
   */
  private buildRolePrompt(): string {
    if (!this.currentRole) return '';

    let prompt = `## PromptX Professional Role Activation Required

**User Selected Role**: ${this.currentRole}`;

    if (this.roleDescription) {
      prompt += `
**Role Description**: ${this.roleDescription}`;
    }

    prompt += `

### Role Activation Instructions
IMPORTANT: Before responding to the user's message, you MUST activate this professional role using the PromptX system:

1. Call the \`mcp__promptx-local__promptx_action\` tool with parameter: "${this.currentRole}"
2. This will provide you with the specialized knowledge and capabilities for this role
3. Only after successful activation, respond with the role's professional expertise

### Post-Activation Guidelines
Once the role is activated, you should:
- Apply the role's specialized knowledge and perspective to your responses
- Use professional terminology and best practices relevant to this role
- Maintain the quality standards expected from this professional domain
- Leverage role-specific methodologies and frameworks when appropriate`;

    return prompt;
  }

  /**
   * 构建角色工具提示词
   */
  private buildRoleToolsPrompt(): string {
    const toolList = this.availableTools.join(', ');
    
    return `## Professional Tools Expected

After activating the ${this.currentRole} role, you will gain access to specialized tools: ${toolList}

### Tool Usage Guidelines
- These tools will become available after successful role activation
- Use them to provide expert-level assistance within the role's domain
- Apply tools according to professional standards and best practices
- Integrate tool results with the role's specialized expertise`;
  }

  /**
   * 构建角色能力提示词
   */
  private buildRoleCapabilitiesPrompt(): string {
    const capabilitiesList = this.roleCapabilities
      .map(cap => `- ${cap}`)
      .join('\n');

    return `## Enhanced Professional Capabilities

Your ${this.currentRole} role provides these specialized capabilities:

${capabilitiesList}

### Capability Application
- Leverage these enhanced abilities to provide superior assistance
- Apply domain-specific expertise and insights
- Use professional judgment and experience patterns
- Maintain excellence standards expected in this professional domain`;
  }

  /**
   * 获取当前角色信息（用于调试和状态查询）
   */
  getCurrentRoleInfo(): {
    role?: string;
    description?: string;
    tools: string[];
    capabilities: string[];
  } {
    return {
      role: this.currentRole,
      description: this.roleDescription,
      tools: [...this.availableTools],
      capabilities: [...this.roleCapabilities]
    };
  }
}

/**
 * 全局PromptX角色提供器实例
 */
export const promptXRoleProvider = new PromptXRoleProvider();