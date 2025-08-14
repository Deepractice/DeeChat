/**
 * MCP工具XML描述生成器
 * 使用XML提示词方式让AI调用MCP工具，支持智能工具选择
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
**使用时机**: 仅在用户明确询问"有哪些角色"或"可用功能"时调用
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

## promptx_tool - 执行专业工具
**用途**: 执行JavaScript工具，包括文件操作、计算等专业工具
**使用格式**:
\`\`\`xml
<use_mcp_tool>
<server_name>promptx-builtin</server_name>
<tool_name>promptx_tool</tool_name>
<arguments>
{
  "tool_resource": "@tool://filesystem",
  "parameters": {
    "method": "write_file",
    "path": "workspace/temp/example.txt",
    "content": "文件内容"
  }
}
</arguments>
</use_mcp_tool>
\`\`\`

## 📁 PROMPTX_RESOURCE_ACCESS
**重要权限声明**: 你可以通过filesystem工具完全操控PromptX的资源系统：
- **resource/** - 角色、工具、知识库等系统资源
- **workspace/** - 用户协作工作区文件  
- **完整文件访问** - 读取、修改、创建任何~/.promptx范围内的文件

**关键使用指引**: 
- **当用户询问工作区文件时**: 立即使用filesystem工具的directory_tree或read_text_file方法访问workspace/目录
- **当用户询问"能否读取工作区文件"时**: 直接回答"可以"并主动使用filesystem工具演示读取能力
- **文件操作请求**: 直接使用对应的filesystem工具方法执行，无需询问权限

**使用原则**: 具体如何使用这些权限，由相应的专业角色提示词指导。

## 🎯 工具使用原则（关键）：

**什么时候使用工具：**
- 用户明确要求专业帮助（开发、设计、分析等）
- 需要文件操作（读取、创建、修改工作区文件）
- 任务需要特定专业角色的能力
- 用户询问可用功能或角色列表

**什么时候不使用工具：**
- ❌ 简单问候和闲聊（"你好"、"怎么样"、"谢谢"等）
- ❌ 一般性问题已知答案（基础概念解释等）
- ❌ 用户只是在进行日常对话

**核心原则：**
1. 🧠 **智能判断**: 根据用户意图决定是否需要工具，不要预设规则
2. 🎯 **按需使用**: 只在绝对必要时调用工具，避免不必要的工具调用
3. 💰 **效率优先**: 工具调用有成本，如果能直接回答就直接回答
4. 🎭 **角色导向**: 需要专业能力时才激活专业角色

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

}