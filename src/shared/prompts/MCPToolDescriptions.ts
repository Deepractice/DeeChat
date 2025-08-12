/**
 * MCP工具XML描述生成器
 * 基于Roo-Code和Context7的成功实践，使用XML提示词方式让AI调用MCP工具
 * 而不是依赖原生函数调用（因为不是所有模型都支持）
 */

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
  serverId: string;
  serverName?: string;
}

/**
 * 生成MCP工具的XML描述供系统提示词使用
 * 这种方法让AI能够通过XML格式调用MCP工具，无需依赖原生函数调用
 */
export class MCPToolDescriptions {
  
  /**
   * 为系统提示词生成MCP工具描述
   * @param mcpTools MCP工具列表
   * @returns XML格式的工具描述字符串
   */
  static generateToolDescriptions(mcpTools: MCPTool[]): string {
    if (mcpTools.length === 0) {
      return '';
    }

    const promptxTools = mcpTools.filter(tool => tool.serverId === 'promptx-builtin');
    const otherTools = mcpTools.filter(tool => tool.serverId !== 'promptx-builtin');

    let description = '';

    if (promptxTools.length > 0) {
      description += this.generatePromptXSection(promptxTools);
    }

    if (otherTools.length > 0) {
      description += this.generateOtherToolsSection(otherTools);
    }

    return description;
  }

  /**
   * 生成PromptX工具专门描述
   */
  private static generatePromptXSection(_promptxTools: MCPTool[]): string {
    return `
# 🎯 PROMPTX_TOOLS_AVAILABLE
你可以使用以下PromptX工具来获得专业能力：

## promptx_action - 角色激活工具
**用途**: 激活专业角色，获得该领域的专业思维、知识和工作方法
**使用场景**: 
- 用户要求专业帮助（如开发工具、产品管理、设计等）
- 任务需要特定领域专业知识
- 用户明确提到角色名称（如luban、noface、nuwa、sean等）

**使用格式**:
\`\`\`xml
<use_mcp_tool>
<server_name>promptx-builtin</server_name>  
<tool_name>promptx_action</tool_name>
<arguments>
{
  "role": "角色ID"
}
</arguments>
</use_mcp_tool>
\`\`\`

**可用角色**:
- **assistant**: 基础AI助手
- **luban**: 工具开发大师（开发各种工具和脚本）
- **noface**: 万能学习助手（学习任何新知识领域）
- **nuwa**: 角色创造专家（创建和定制AI角色）
- **sean**: 决策专家（复杂问题的矛盾分析和决策）

## promptx_welcome - 查看可用资源
**用途**: 查看所有可用的专业角色和工具
**使用格式**:
\`\`\`xml
<use_mcp_tool>
<server_name>promptx-builtin</server_name>
<tool_name>promptx_welcome</tool_name>  
<arguments>
{}
</arguments>
</use_mcp_tool>
\`\`\`

## promptx_learn - 学习专业资源
**用途**: 深入学习特定领域的专业知识和技能
**使用格式**:
\`\`\`xml
<use_mcp_tool>
<server_name>promptx-builtin</server_name>
<tool_name>promptx_learn</tool_name>
<arguments>
{
  "resource": "资源URL，如thought://creativity, knowledge://scrum"
}
</arguments>
</use_mcp_tool>
\`\`\`

## 重要使用原则：
1. **主动激活角色**: 当任务需要专业能力时，立即使用promptx_action激活对应角色
2. **角色匹配**: 根据任务性质选择最合适的角色（开发→luban，学习→noface，决策→sean等）
3. **首次激活**: 每个会话中首次选择角色时必须激活，获得专业身份
4. **持续专业性**: 激活角色后保持该角色的专业思维和工作方式

`;
  }

  /**
   * 生成其他MCP工具描述
   */
  private static generateOtherToolsSection(otherTools: MCPTool[]): string {
    if (otherTools.length === 0) {
      return '';
    }

    let section = `
# 🔧 OTHER_MCP_TOOLS_AVAILABLE
你还可以使用以下辅助工具：

`;

    for (const tool of otherTools) {
      section += `## ${tool.name}
**服务器**: ${tool.serverName || tool.serverId}
**描述**: ${tool.description || '辅助工具'}

**使用格式**:
\`\`\`xml
<use_mcp_tool>
<server_name>${tool.serverId}</server_name>
<tool_name>${tool.name}</tool_name>
<arguments>
${this.generateArgumentsExample(tool.inputSchema)}
</arguments>
</use_mcp_tool>
\`\`\`

`;
    }

    return section;
  }

  /**
   * 根据输入模式生成参数示例
   */
  private static generateArgumentsExample(inputSchema: any): string {
    if (!inputSchema || !inputSchema.properties) {
      return '{\n  // 根据具体需求填写参数\n}';
    }

    const examples: string[] = [];
    const required = inputSchema.required || [];

    for (const [key, propSchema] of Object.entries(inputSchema.properties as Record<string, any>)) {
      const isRequired = required.includes(key);
      const comment = isRequired ? ' // 必需' : ' // 可选';
      
      switch (propSchema.type) {
        case 'string':
          examples.push(`  "${key}": "示例值"${comment}`);
          break;
        case 'number':
        case 'integer':
          examples.push(`  "${key}": 123${comment}`);
          break;
        case 'boolean':
          examples.push(`  "${key}": true${comment}`);
          break;
        case 'array':
          examples.push(`  "${key}": ["值1", "值2"]${comment}`);
          break;
        case 'object':
          examples.push(`  "${key}": {}${comment}`);
          break;
        default:
          examples.push(`  "${key}": "值"${comment}`);
      }
    }

    return '{\n' + examples.join(',\n') + '\n}';
  }

  /**
   * 生成角色激活提示
   * 当检测到用户需要专业帮助时，生成角色激活建议
   */
  static generateRoleActivationHint(roleId: string, reason: string): string {
    return `
# 🎯 ROLE_ACTIVATION_SUGGESTED
建议激活角色：**${roleId}**
原因：${reason}

请立即使用promptx_action工具激活此角色：
\`\`\`xml
<use_mcp_tool>
<server_name>promptx-builtin</server_name>
<tool_name>promptx_action</tool_name>
<arguments>
{
  "role": "${roleId}"
}
</arguments>
</use_mcp_tool>
\`\`\`
`;
  }

  /**
   * 检测用户输入是否需要特定角色
   */
  static detectRoleNeed(userInput: string): { roleId: string; reason: string } | null {
    const lowerInput = userInput.toLowerCase();

    // 开发相关
    if (lowerInput.includes('开发') || lowerInput.includes('工具') || lowerInput.includes('脚本') || 
        lowerInput.includes('代码') || lowerInput.includes('编程') || lowerInput.includes('程序')) {
      return { roleId: 'luban', reason: '检测到开发需求，luban专精工具开发' };
    }

    // 学习相关
    if (lowerInput.includes('学习') || lowerInput.includes('教') || lowerInput.includes('理解') ||
        lowerInput.includes('解释') || lowerInput.includes('原理') || lowerInput.includes('知识')) {
      return { roleId: 'noface', reason: '检测到学习需求，noface是万能学习助手' };
    }

    // 决策相关
    if (lowerInput.includes('决策') || lowerInput.includes('选择') || lowerInput.includes('建议') ||
        lowerInput.includes('分析') || lowerInput.includes('对比') || lowerInput.includes('评估')) {
      return { roleId: 'sean', reason: '检测到决策需求，sean专精矛盾分析和决策' };
    }

    // 创建角色相关
    if (lowerInput.includes('角色') || lowerInput.includes('创建') || lowerInput.includes('定制') ||
        lowerInput.includes('设计') || lowerInput.includes('个性化')) {
      return { roleId: 'nuwa', reason: '检测到角色创建需求，nuwa是角色创造专家' };
    }

    return null;
  }
}