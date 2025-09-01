/**
 * DeeChat智能分层提示词系统 - 工具集成层
 * 
 * 核心职责：
 * 1. 发现所有可用的MCP工具
 * 2. 格式化工具描述和参数信息
 * 3. 将工具信息注入到系统提示词
 * 4. 为AI提供完整的工具调用指南
 * 
 * 设计原则：
 * - 职责单一：只处理工具相关逻辑
 * - AI自主决策：提供所有工具信息，由AI决定调用什么
 * - 标准化格式：统一的工具描述格式
 * - 动态发现：实时获取最新的MCP工具状态
 */

import log from 'electron-log';

// MCP工具接口
interface MCPTool {
  name: string;
  description?: string;
  serverName: string;
  serverId?: string;
  inputSchema?: any;
  fullDefinition?: any;
}

// 工具集成结果
export interface ToolIntegrationResult {
  toolsPrompt: string;
  toolsCount: number;
  availableServers: string[];
  metadata: {
    discoveredAt: Date;
    toolsByServer: Record<string, number>;
  };
}

/**
 * 第3层：工具集成层
 * 
 * 负责：
 * - MCP工具的发现和收集
 * - 工具描述的标准化格式化
 * - 工具调用指南的生成
 * - 工具状态的实时监控
 */
export class ToolIntegrationLayer {
  
  constructor() {
    log.info('🔧 [ToolIntegrationLayer] 工具集成层初始化完成');
  }

  /**
   * 渲染工具集成内容
   * @param availableTools 可用工具列表
   * @returns 工具集成结果
   */
  async render(availableTools?: MCPTool[]): Promise<ToolIntegrationResult> {
    const startTime = Date.now();
    
    // 🚨 增强调试：详细输出传入的工具信息
    console.log(`🔧 [ToolIntegrationLayer-DEBUG] render方法被调用！`);
    console.log(`🔧 [ToolIntegrationLayer-DEBUG] availableTools类型: ${typeof availableTools}`);
    console.log(`🔧 [ToolIntegrationLayer-DEBUG] availableTools是否为数组: ${Array.isArray(availableTools)}`);
    console.log(`🔧 [ToolIntegrationLayer-DEBUG] availableTools长度: ${availableTools?.length || '未定义'}`);
    
    if (availableTools && availableTools.length > 0) {
      console.log(`🔧 [ToolIntegrationLayer-DEBUG] 第一个工具示例:`, JSON.stringify(availableTools[0], null, 2));
    }
    
    if (!availableTools || availableTools.length === 0) {
      console.log('🔧 [ToolIntegrationLayer-DEBUG] 未检测到可用工具，返回空结果');
      log.info('🔧 [ToolIntegrationLayer] 未检测到可用工具');
      return this.buildEmptyResult();
    }

    console.log(`🔧 [ToolIntegrationLayer-DEBUG] 开始处理 ${availableTools.length} 个工具`);
    log.info(`🔧 [ToolIntegrationLayer] 开始处理 ${availableTools.length} 个工具`);

    // 过滤和分类工具
    const processedTools = this.filterAndClassifyTools(availableTools);
    
    // 生成工具提示词
    const toolsPrompt = this.buildToolsPrompt(processedTools);
    
    // 统计信息
    const metadata = this.buildMetadata(processedTools);
    
    const result: ToolIntegrationResult = {
      toolsPrompt,
      toolsCount: processedTools.length,
      availableServers: [...new Set(processedTools.map(t => t.serverId || t.serverName))],
      metadata
    };

    const processingTime = Date.now() - startTime;
    log.info(`✅ [ToolIntegrationLayer] 工具集成完成: ${result.toolsCount}个工具, ${processingTime}ms`);

    return result;
  }

  /**
   * 过滤和分类工具
   */
  private filterAndClassifyTools(tools: MCPTool[]): MCPTool[] {
    console.log(`🔧 [ToolIntegration-Filter] 开始过滤工具，输入: ${tools.length}个`);
    
    const filtered = tools.filter(tool => {
      const name = tool.name || '';
      
      // 过滤掉action工具 - 角色激活由前端处理
      const isActionTool = name === 'action' || name.includes('__action');
      if (isActionTool) {
        console.log(`🚫 [ToolIntegration-Filter] 过滤action工具: ${name}`);
        return false;
      }
      
      return true;
    });

    console.log(`🔧 [ToolIntegration-Filter] 过滤完成: ${filtered.length}个工具可用`);
    return filtered;
  }

  /**
   * 构建工具提示词
   */
  private buildToolsPrompt(tools: MCPTool[]): string {
    if (tools.length === 0) {
      return '# 🔧 可用工具\n暂无可用工具';
    }

    const sections: string[] = [
      '# 🔧 可用工具',
      '',
      '以下是您可以使用的所有工具。根据需要选择合适的工具来完成任务：',
      ''
    ];

    // 按服务器分组
    const toolsByServer = this.groupToolsByServer(tools);
    
    for (const [serverName, serverTools] of Object.entries(toolsByServer)) {
      sections.push(`## 📦 ${serverName} 服务器工具`);
      sections.push('');
      
      for (const tool of serverTools) {
        const toolSection = this.formatSingleTool(tool);
        sections.push(toolSection);
        sections.push('');
      }
    }

    // 添加使用指南
    sections.push('## 🚨🚨🚨 工具调用绝对规则 🚨🚨🚨');
    sections.push('');
    sections.push('💥 **致命错误预防**：如果您看到"parameter validation failed"错误，说明参数传递有问题！');
    sections.push('');
    sections.push('🚫 **绝对禁止的操作**：');
    sections.push('- ❌ **致命错误**：给有必需参数的工具传递空对象 `{}`');
    sections.push('- ❌ **致命错误**：省略任何标记为"🚨必需"的参数');  
    sections.push('- ❌ **致命错误**：使用undefined、null或空字符串作为必需参数值');
    sections.push('- ❌ **致命错误**：使用错误的参数名称');
    sections.push('');
    sections.push('💡 **参数验证失败的常见原因**：');
    sections.push('1. 传递了空参数对象 `{}` 给需要参数的工具');
    sections.push('2. 使用了错误的参数名称 (如用`role_id`而不是`role`)');
    sections.push('3. 参数值为空字符串或null');
    sections.push('4. 完全省略了必需参数');
    sections.push('');
    sections.push('✅ **必须遵循**：');
    sections.push('- ✅ **必须**为每个标记为"必需"的参数提供有效值');
    sections.push('- ✅ **必须**严格按照工具描述中的参数格式');
    sections.push('- ✅ **必须**在调用前检查参数完整性');
    sections.push('');
    sections.push('**正确的工具调用步骤**：');
    sections.push('1. **查看参数要求**：每个工具都明确列出了必需参数');
    sections.push('2. **按格式提供参数**：严格按照示例格式提供参数对象');
    sections.push('3. **检查参数完整性**：确保所有必需参数都已提供且格式正确');
    sections.push('');
    sections.push('**常见错误及避免方法**：');
    sections.push('❌ 错误：调用toolx工具时参数为空 `{}`');
    sections.push('✅ 正确：必须提供 `{"tool_resource": "@tool://工具名", "parameters": {...}}`');
    sections.push('');
    sections.push('❌ 错误：调用learn工具时参数为空 `{}`'); 
    sections.push('✅ 正确：必须提供 `{"resource": "@manual://手册名"}`');
    sections.push('');
    sections.push('❌ 错误：调用action工具时参数为空 `{}`'); 
    sections.push('✅ 正确：必须提供 `{"role": "角色ID"}`');
    sections.push('');
    sections.push('🔥 **重要**：如果工具调用失败并提示"参数验证失败"，说明您没有提供必需参数！请重新检查工具描述中的参数要求。');
    sections.push('');
    sections.push('💡 **提示**：参数验证失败通常是因为缺少必需参数或参数格式错误，请仔细对照示例格式。');

    return sections.join('\n');
  }

  /**
   * 格式化单个工具
   */
  private formatSingleTool(tool: MCPTool): string {
    const name = tool.name || '未知工具';
    console.log(`🔧 [ToolIntegration-Format] 格式化工具: ${name}`);

    const sections: string[] = [`### 🔧 ${name}`];
    
    // 工具描述
    let description = '无描述';
    if (tool.fullDefinition?.description) {
      description = tool.fullDefinition.description;
    } else if (tool.description) {
      description = tool.description;
    }
    sections.push(`**描述**: ${description}`);
    sections.push('');

    // 参数信息
    const paramInfo = this.buildParameterInfo(tool);
    if (paramInfo) {
      sections.push('**参数**:');
      sections.push(paramInfo);
      sections.push('');
    }

    // 使用示例
    const examples = this.buildUsageExamples(tool);
    if (examples) {
      sections.push('**使用示例**:');
      sections.push(examples);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 构建参数信息
   */
  private buildParameterInfo(tool: MCPTool): string {
    const schema = tool.inputSchema || tool.fullDefinition?.inputSchema;
    if (!schema || !schema.properties) {
      return '- 无参数要求';
    }

    const required = schema.required || [];
    const params: string[] = [];

    for (const [paramName, paramSchema] of Object.entries(schema.properties)) {
      const isRequired = required.includes(paramName);
      const paramType = (paramSchema as any).type || 'any';
      const paramDesc = (paramSchema as any).description || '';
      
      let paramLine = `- \`${paramName}\` (${paramType})`;
      if (isRequired) {
        paramLine += ' 🚨**必需** - **此参数不能为空**';
      }
      if (paramDesc) {
        paramLine += ` - ${paramDesc}`;
      }
      
      params.push(paramLine);
    }

    return params.join('\n');
  }

  /**
   * 构建使用示例
   */
  private buildUsageExamples(tool: MCPTool): string {
    const name = tool.name;
    const schema = tool.inputSchema || tool.fullDefinition?.inputSchema;
    
    if (name.includes('toolx')) {
      return `**使用方式**:
调用此工具时，必须提供以下参数：
- \`tool_resource\`: 工具资源引用，格式为 @tool://工具名
- \`parameters\`: 传递给工具的参数对象

**正确调用示例**:
\`\`\`
工具名: ${name}
参数: {
  "tool_resource": "@tool://filesystem",
  "parameters": {
    "method": "write_file",
    "path": "example.py", 
    "content": "print('Hello World')"
  }
}
\`\`\``;
    }
    
    if (name.includes('learn')) {
      return `**使用方式**:
🚨🚨🚨 **绝对关键**: 此工具必须有resource参数，传递空参数{}将导致失败！🚨🚨🚨

**💥 参数验证失败原因**: 如果您看到"parameter validation failed: resource: Required"错误，说明您没有提供resource参数！

**🎯 必需参数**:
- \`resource\` (string) 🚨**绝对必需** - PromptX资源标识符，不能为空、null或省略

**✅ 正确调用示例** (请严格按此格式):
\`\`\`json
{
  "resource": "@manual://filesystem"
}
\`\`\`

**❌ 错误调用示例** (这些都会失败):
\`\`\`json
❌ 空对象: {}
❌ 空字符串: {"resource": ""}
❌ 错误参数名: {"wrongParam": "value"}
❌ 缺少参数: {"other": "value"}
\`\`\`

**🔥 重要提醒**: 每次调用此工具都必须包含resource参数，否则MCP服务器将拒绝执行！`;
    }
    
    if (name.includes('welcome')) {
      return `**使用方式**:
此工具不需要参数。

**正确调用示例**:
\`\`\`
工具名: ${name}
参数: {}
\`\`\``;
    }
    
    if (name.includes('action')) {
      return `**使用方式**:
🚨 **重要**: 此工具的role参数是必需的，绝对不能为空或省略！

**必需参数**:
- \`role\` (string) 🚨**必需** - 要激活的角色ID

**正确调用示例**:
\`\`\`
工具名: ${name}
参数: {
  "role": "nuwa"
}
\`\`\`

⚠️ **错误示例**:
\`\`\`
❌ 绝对禁止: {"role": ""}
❌ 绝对禁止: {}
❌ 绝对禁止: {"invalidParam": "value"}
\`\`\``;
    }
    
    // 通用示例 - 基于schema生成
    if (schema?.required && schema.required.length > 0) {
      const example: any = {};
      const paramDescriptions: string[] = [];
      
      schema.required.forEach((param: string) => {
        const paramSchema = schema.properties?.[param];
        const paramType = paramSchema?.type || 'string';
        const paramDesc = paramSchema?.description || `${param}参数`;
        
        // 根据参数类型生成合理的示例值
        if (paramType === 'string') {
          example[param] = `示例${param}值`;
        } else if (paramType === 'object') {
          example[param] = {};
        } else if (paramType === 'array') {
          example[param] = [];
        } else if (paramType === 'boolean') {
          example[param] = true;
        } else {
          example[param] = `示例${param}值`;
        }
        
        paramDescriptions.push(`- \`${param}\` (${paramType}): ${paramDesc}`);
      });
      
      return `🚨 **重要**: 此工具有必需参数，绝对不能传递空对象！

**必需参数**:
${paramDescriptions.map(desc => desc.replace('(string): ', '(string) 🚨**必需** - ')).join('\n')}

**正确调用示例**:
\`\`\`
工具名: ${name}
参数: ${JSON.stringify(example, null, 2)}
\`\`\`

⚠️ **错误示例**:
\`\`\`
❌ 绝对禁止: {}
❌ 绝对禁止: null参数
❌ 绝对禁止: 省略必需参数
\`\`\``;
    }
    
    return `**使用方式**:
此工具不需要参数。

**正确调用示例**:
\`\`\`
工具名: ${name}
参数: {}
\`\`\``;
  }

  /**
   * 按服务器分组工具
   */
  private groupToolsByServer(tools: MCPTool[]): Record<string, MCPTool[]> {
    const grouped: Record<string, MCPTool[]> = {};
    
    for (const tool of tools) {
      const serverName = tool.serverName || tool.serverId || 'Unknown';
      if (!grouped[serverName]) {
        grouped[serverName] = [];
      }
      grouped[serverName].push(tool);
    }
    
    return grouped;
  }

  /**
   * 构建元数据
   */
  private buildMetadata(tools: MCPTool[]) {
    const toolsByServer: Record<string, number> = {};
    
    for (const tool of tools) {
      const serverName = tool.serverName || tool.serverId || 'Unknown';
      toolsByServer[serverName] = (toolsByServer[serverName] || 0) + 1;
    }
    
    return {
      discoveredAt: new Date(),
      toolsByServer
    };
  }

  /**
   * 构建空结果
   */
  private buildEmptyResult(): ToolIntegrationResult {
    return {
      toolsPrompt: '# 🔧 可用工具\n暂无可用工具',
      toolsCount: 0,
      availableServers: [],
      metadata: {
        discoveredAt: new Date(),
        toolsByServer: {}
      }
    };
  }
}