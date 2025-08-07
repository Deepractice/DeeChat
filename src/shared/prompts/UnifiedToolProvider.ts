/**
 * 统一工具发现提供器
 * 通过 MCP 集成服务统一发现和管理所有工具（内置 + 外部）
 */

import { MCPToolEntity } from '../entities/MCPToolEntity';
import { MCPIntegrationService } from '../../main/services/mcp/client/MCPIntegrationService';
import log from 'electron-log';

export interface ToolSection {
  serverName: string;
  isBuiltin: boolean;
  tools: MCPToolEntity[];
}

export class UnifiedToolProvider {
  
  /**
   * 获取当前所有可用工具的描述文本
   */
  async getAvailableToolsDescription(mcpIntegrationService: MCPIntegrationService): Promise<string> {
    try {
      log.info('[UnifiedToolProvider] 开始统一工具发现...');
      
      // 🎯 一次性获取所有工具（内置的PromptX + 外部MCP）
      const allTools = await mcpIntegrationService.getAllTools();
      log.info(`[UnifiedToolProvider] 发现 ${allTools.length} 个工具`);
      
      if (allTools.length === 0) {
        return this.generateEmptyToolsSection();
      }
      
      // 🔍 按服务器分组
      const toolSections = this.groupToolsByServer(allTools);
      
      return this.generateToolsSection(toolSections);
      
    } catch (error) {
      log.error('[UnifiedToolProvider] 工具发现失败:', error);
      return this.generateErrorSection();
    }
  }

  /**
   * 按服务器对工具进行分组
   */
  private groupToolsByServer(tools: MCPToolEntity[]): ToolSection[] {
    const serverGroups: Record<string, MCPToolEntity[]> = {};
    
    // 分组工具
    tools.forEach(tool => {
      const serverName = tool.serverName || 'unknown';
      if (!serverGroups[serverName]) {
        serverGroups[serverName] = [];
      }
      serverGroups[serverName].push(tool);
    });
    
    // 转换为 ToolSection 数组并排序
    return Object.entries(serverGroups)
      .map(([serverName, tools]) => ({
        serverName,
        isBuiltin: this.isBuiltinServer(serverName),
        tools
      }))
      .sort((a, b) => {
        // 内置工具优先显示
        if (a.isBuiltin && !b.isBuiltin) return -1;
        if (!a.isBuiltin && b.isBuiltin) return 1;
        return a.serverName.localeCompare(b.serverName);
      });
  }

  /**
   * 判断是否为内置服务器
   */
  private isBuiltinServer(serverName: string): boolean {
    // PromptX 是内置服务器
    if (serverName === 'promptx-local') return true;
    
    // 文件操作是内置服务器
    if (serverName === 'file-operations-builtin' || serverName === '文件操作 (内置)') return true;
    
    // 可以根据需要添加其他内置服务器标识
    const builtinServers = ['deechat-builtin', 'file-operations'];
    return builtinServers.includes(serverName);
  }

  /**
   * 生成工具描述部分
   */
  private generateToolsSection(sections: ToolSection[]): string {
    let content = '## 当前可用工具\n\n';
    
    sections.forEach(section => {
      // 🏷️ 根据服务器类型显示不同的标题
      const title = section.isBuiltin 
        ? `### 内置工具 (${section.serverName})`
        : `### ${section.serverName} 工具`;
      
      content += `${title}\n`;
      
      // 添加工具列表
      section.tools.forEach(tool => {
        const description = tool.description || '暂无描述';
        content += `- **${tool.name}**: ${description}\n`;
      });
      
      content += '\n';
    });
    
    // 添加使用说明
    content += '**重要说明**: \n';
    content += '- 仅使用上述列出的工具\n';
    content += '- 如需其他功能，请明确告知用户相应工具不可用\n';
    content += '- 工具调用时请使用准确的工具名称和参数格式\n';
    
    // 检查是否有文件操作工具，添加专门的指导
    const hasFileOps = sections.some(section => 
      section.serverName === 'file-operations-builtin' || 
      section.serverName === '文件操作 (内置)'
    );
    
    if (hasFileOps) {
      content += '\n**文件操作指导**: \n';
      content += '- 文件路径受安全限制，只能访问允许的目录\n';
      content += '- 进行文件操作前，先用 get_file_info 或 list_directory 了解文件结构\n';
      content += '- 重要操作（如删除）前请告知用户并获得确认\n';
      content += '- 使用 search_files 来查找位置未知的文件\n';
      content += '- 大型文件操作时考虑用户体验，提供进度反馈\n';
    }
    
    return content;
  }

  /**
   * 生成空工具列表部分
   */
  private generateEmptyToolsSection(): string {
    return `## 工具状态

**当前没有可用的工具**

这可能是由于以下原因：
- MCP 服务器未启动或连接失败
- 工具发现过程遇到问题
- 系统正在初始化中

请稍后重试，或联系管理员检查工具配置。`;
  }

  /**
   * 生成错误状态部分
   */
  private generateErrorSection(): string {
    return `## 工具状态

**工具发现遇到错误**

系统在尝试发现可用工具时遇到问题。当前将以基础对话模式运行，不支持工具调用功能。

如需使用工具功能，请：
1. 检查 MCP 服务配置
2. 重启应用程序
3. 联系技术支持`;
  }

  /**
   * 获取工具统计信息
   */
  async getToolStats(mcpIntegrationService: MCPIntegrationService): Promise<{
    total: number;
    byServer: Record<string, number>;
    builtinCount: number;
    externalCount: number;
  }> {
    try {
      const allTools = await mcpIntegrationService.getAllTools();
      const sections = this.groupToolsByServer(allTools);
      
      const stats = {
        total: allTools.length,
        byServer: {} as Record<string, number>,
        builtinCount: 0,
        externalCount: 0
      };
      
      sections.forEach(section => {
        stats.byServer[section.serverName] = section.tools.length;
        if (section.isBuiltin) {
          stats.builtinCount += section.tools.length;
        } else {
          stats.externalCount += section.tools.length;
        }
      });
      
      return stats;
    } catch (error) {
      return {
        total: 0,
        byServer: {},
        builtinCount: 0,
        externalCount: 0
      };
    }
  }
}