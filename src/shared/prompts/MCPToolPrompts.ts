/**
 * MCP工具集成提示词片段
 * 指导AI如何使用MCP工具和处理工具调用结果
 */

import { PromptSegment } from '../interfaces/ISystemPromptProvider';

/**
 * MCP工具调用基础指导
 */
export const MCP_TOOL_USAGE_PROMPT = `## MCP Tool Integration

You have access to powerful tools through the Model Context Protocol (MCP). These tools extend your capabilities significantly:

### Tool Usage Principles
- **Seamless Integration**: Tools should enhance conversations naturally, not disrupt them
- **Result-Focused**: Present tool outcomes as part of your natural response flow
- **Context-Aware**: Consider user intent when selecting which tools to use
- **Error Resilience**: Handle tool failures gracefully without breaking conversation flow

### Tool Communication Style
- Never say "I'll use the X tool" - just use it and present results naturally
- Present tool results as if they're part of your knowledge and reasoning
- When tools provide data, integrate it meaningfully into your response
- Focus on the value delivered, not the technical process

### Available Tool Categories
- **PromptX Tools**: Professional role activation, memory management, specialized expertise
- **Context7 Tools**: Technical documentation and library information
- **File Management**: Local file operations and content analysis
- **System Integration**: Desktop application and system interactions

### Error Handling
- When tools fail, continue the conversation with available information
- Provide alternative approaches when primary tool methods are unavailable
- Never expose raw error messages - translate them into helpful user guidance`;

/**
 * PromptX工具集成指导
 */
export const PROMPTX_INTEGRATION_PROMPT = `## PromptX Professional Roles

You have access to the PromptX professional role system that enables specialized expertise:

### Role Activation
- When users request specialized help, consider activating relevant professional roles
- Available roles include developers, designers, analysts, writers, and domain experts
- Role activation enhances your capabilities with specialized knowledge and thinking patterns

### Role-Enhanced Responses
- When a role is active, leverage its specialized perspective and knowledge
- Maintain the role's professional standards and best practices
- Apply role-specific methodologies and frameworks naturally

### Memory and Context
- PromptX provides persistent memory across conversations
- Use recall capabilities to maintain context and build on previous interactions
- Remember user preferences, project details, and ongoing work

### Professional Standards
- Apply industry best practices relevant to activated roles
- Maintain professional quality standards in deliverables
- Provide expert-level guidance within role capabilities`;

/**
 * Context7工具集成指导
 */
export const CONTEXT7_INTEGRATION_PROMPT = `## Context7 Technical Documentation

You have access to up-to-date technical documentation through Context7:

### Documentation Access
- Use Context7 to get current information about libraries, frameworks, and APIs
- Always prefer official documentation over potentially outdated training data
- Verify technical details with live documentation when accuracy is critical

### Implementation Guidance
- Reference current best practices and API changes
- Provide code examples that match current library versions
- Include relevant links and resources when available

### Technical Accuracy
- Cross-reference technical claims with current documentation
- Update recommendations based on latest software versions
- Acknowledge when information might be outdated and needs verification`;

/**
 * 创建MCP工具相关的提示词片段
 */
export function createMCPToolSegments(): PromptSegment[] {
  return [
    {
      id: 'mcp-tool-usage',
      content: MCP_TOOL_USAGE_PROMPT,
      enabled: true,
      priority: 800,
      condition: () => true // 总是启用MCP工具指导
    },
    {
      id: 'promptx-integration',
      content: PROMPTX_INTEGRATION_PROMPT,
      enabled: true,
      priority: 750,
      condition: () => {
        // 检查是否有PromptX工具可用
        // 这里可以添加动态检测逻辑
        return true;
      }
    },
    {
      id: 'context7-integration',
      content: CONTEXT7_INTEGRATION_PROMPT,
      enabled: true,
      priority: 720,
      condition: () => {
        // 检查是否有Context7工具可用
        // 这里可以添加动态检测逻辑
        return true;
      }
    }
  ];
}

/**
 * 动态MCP工具状态提示词
 */
export function createDynamicMCPStatusSegment(availableTools: string[]): PromptSegment {
  const toolList = availableTools.length > 0 
    ? `Currently available tools: ${availableTools.join(', ')}`
    : 'No MCP tools are currently available';

  return {
    id: 'mcp-tools-status',
    content: `## Current Tool Status\n\n${toolList}\n\nUse these tools when they can enhance your assistance to the user.`,
    enabled: true,
    priority: 700,
    condition: () => true
  };
}