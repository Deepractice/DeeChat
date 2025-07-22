/**
 * MCP工具服务
 * 管理MCP工具，提供LangChain集成和工具调用功能
 */

import { Tool } from '@langchain/core/tools';
import { MCPIntegrationService } from './MCPIntegrationService';
import { MCPToolEntity } from '../../../shared/entities/MCPToolEntity';
import { MCPToolCallRequest } from '../../../shared/interfaces/IMCPProvider';

/**
 * MCP工具的LangChain包装器
 */
export class MCPLangChainTool extends Tool {
  name: string;
  description: string;
  private mcpService: MCPIntegrationService;
  private mcpTool: MCPToolEntity;

  constructor(mcpService: MCPIntegrationService, mcpTool: MCPToolEntity) {
    super();
    this.mcpService = mcpService;
    this.mcpTool = mcpTool;
    this.name = `mcp_${mcpTool.serverId}_${mcpTool.name}`;
    this.description = this.buildDescription(mcpTool);
  }

  /**
   * 执行MCP工具
   */
  async _call(input: string): Promise<string> {
    try {
      console.log(`[MCP LangChain Tool] 执行工具: ${this.mcpTool.name}`, input);

      // 解析输入参数
      let args: any = {};
      try {
        args = JSON.parse(input);
      } catch {
        // 如果不是JSON，尝试作为简单字符串参数
        if (this.mcpTool.inputSchema?.properties) {
          const firstProperty = Object.keys(this.mcpTool.inputSchema.properties)[0];
          if (firstProperty) {
            args[firstProperty] = input;
          }
        } else {
          args = { input };
        }
      }

      // 调用MCP工具
      const request: MCPToolCallRequest = {
        serverId: this.mcpTool.serverId,
        toolName: this.mcpTool.name,
        arguments: args,
        callId: `langchain_${Date.now()}`
      };

      const response = await this.mcpService.callTool(request);

      if (response.success) {
        // 格式化返回结果
        return this.formatResult(response.result);
      } else {
        throw new Error(response.error || '工具执行失败');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '工具执行失败';
      console.error(`[MCP LangChain Tool] 工具执行失败: ${this.mcpTool.name}`, errorMessage);
      throw new Error(`MCP工具执行失败: ${errorMessage}`);
    }
  }

  /**
   * 构建工具描述
   */
  private buildDescription(tool: MCPToolEntity): string {
    let description = tool.description || `MCP工具: ${tool.name}`;
    
    // 添加服务器信息
    description += `\n来源: ${tool.serverName}`;
    
    // 添加参数信息
    if (tool.inputSchema?.properties) {
      description += '\n参数:';
      const properties = tool.inputSchema.properties;
      const required = tool.inputSchema.required || [];
      
      for (const [key, schema] of Object.entries(properties)) {
        const propSchema = schema as any;
        const isRequired = required.includes(key);
        const type = propSchema.type || 'any';
        const propDesc = propSchema.description || '';
        
        description += `\n- ${key} (${type})${isRequired ? ' *必需' : ''}`;
        if (propDesc) {
          description += `: ${propDesc}`;
        }
      }
      
      description += '\n\n输入格式: JSON字符串，包含所需参数';
    } else {
      description += '\n\n此工具无需参数，可传入空字符串或任意文本';
    }
    
    return description;
  }

  /**
   * 格式化工具执行结果
   */
  private formatResult(result: any): string {
    if (typeof result === 'string') {
      return result;
    }
    
    if (typeof result === 'object' && result !== null) {
      // 尝试提取有意义的信息
      if (result.message) {
        return result.message;
      }
      
      if (result.content) {
        return result.content;
      }
      
      if (result.text) {
        return result.text;
      }
      
      // 格式化对象为可读文本
      return this.objectToReadableText(result);
    }
    
    return String(result);
  }

  /**
   * 将对象转换为可读文本
   */
  private objectToReadableText(obj: any): string {
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
        const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
        
        if (typeof value === 'object') {
          lines.push(`${capitalizedKey}: ${JSON.stringify(value, null, 2)}`);
        } else {
          lines.push(`${capitalizedKey}: ${value}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

/**
 * MCP工具服务
 */
export class MCPToolService {
  private mcpService: MCPIntegrationService;
  private toolCache: Map<string, MCPLangChainTool> = new Map();

  constructor(mcpService: MCPIntegrationService) {
    this.mcpService = mcpService;
  }

  /**
   * 获取所有可用的LangChain工具
   */
  async getAllLangChainTools(): Promise<MCPLangChainTool[]> {
    try {
      const mcpTools = await this.mcpService.getAllTools();
      const langChainTools: MCPLangChainTool[] = [];

      for (const mcpTool of mcpTools) {
        if (mcpTool.isAvailable) {
          const toolKey = `${mcpTool.serverId}:${mcpTool.name}`;
          
          // 检查缓存
          let langChainTool = this.toolCache.get(toolKey);
          if (!langChainTool) {
            langChainTool = new MCPLangChainTool(this.mcpService, mcpTool);
            this.toolCache.set(toolKey, langChainTool);
          }
          
          langChainTools.push(langChainTool);
        }
      }

      console.log(`[MCP LangChain Integration] 获取到 ${langChainTools.length} 个可用工具`);
      return langChainTools;

    } catch (error) {
      console.error('[MCP LangChain Integration] 获取工具失败:', error);
      return [];
    }
  }

  /**
   * 根据查询搜索相关工具
   */
  async searchLangChainTools(query: string): Promise<MCPLangChainTool[]> {
    try {
      const mcpTools = await this.mcpService.searchTools(query);
      const langChainTools: MCPLangChainTool[] = [];

      for (const mcpTool of mcpTools) {
        if (mcpTool.isAvailable) {
          const toolKey = `${mcpTool.serverId}:${mcpTool.name}`;
          
          let langChainTool = this.toolCache.get(toolKey);
          if (!langChainTool) {
            langChainTool = new MCPLangChainTool(this.mcpService, mcpTool);
            this.toolCache.set(toolKey, langChainTool);
          }
          
          langChainTools.push(langChainTool);
        }
      }

      console.log(`[MCP LangChain Integration] 搜索到 ${langChainTools.length} 个相关工具`);
      return langChainTools;

    } catch (error) {
      console.error('[MCP LangChain Integration] 搜索工具失败:', error);
      return [];
    }
  }

  /**
   * 获取特定服务器的工具
   */
  async getServerLangChainTools(serverId: string): Promise<MCPLangChainTool[]> {
    try {
      const mcpTools = await this.mcpService.discoverServerTools(serverId);
      const langChainTools: MCPLangChainTool[] = [];

      for (const mcpTool of mcpTools) {
        if (mcpTool.isAvailable) {
          const toolKey = `${mcpTool.serverId}:${mcpTool.name}`;
          
          let langChainTool = this.toolCache.get(toolKey);
          if (!langChainTool) {
            langChainTool = new MCPLangChainTool(this.mcpService, mcpTool);
            this.toolCache.set(toolKey, langChainTool);
          }
          
          langChainTools.push(langChainTool);
        }
      }

      console.log(`[MCP LangChain Integration] 服务器 ${serverId} 提供 ${langChainTools.length} 个工具`);
      return langChainTools;

    } catch (error) {
      console.error(`[MCP LangChain Integration] 获取服务器工具失败: ${serverId}`, error);
      return [];
    }
  }

  /**
   * 清理工具缓存
   */
  clearCache(): void {
    console.log('[MCP LangChain Integration] 清理工具缓存');
    this.toolCache.clear();
  }

  /**
   * 获取工具使用统计
   */
  async getToolUsageStats(): Promise<{
    totalTools: number;
    availableTools: number;
    toolsByServer: Record<string, number>;
    usageStats: Record<string, number>;
  }> {
    try {
      const mcpTools = await this.mcpService.getAllTools();
      const usageStats = await this.mcpService.getToolUsageStats();
      
      const stats = {
        totalTools: mcpTools.length,
        availableTools: mcpTools.filter(t => t.isAvailable).length,
        toolsByServer: {} as Record<string, number>,
        usageStats
      };

      // 统计每个服务器的工具数量
      for (const tool of mcpTools) {
        const serverName = tool.serverName;
        stats.toolsByServer[serverName] = (stats.toolsByServer[serverName] || 0) + 1;
      }

      return stats;

    } catch (error) {
      console.error('[MCP LangChain Integration] 获取统计信息失败:', error);
      return {
        totalTools: 0,
        availableTools: 0,
        toolsByServer: {},
        usageStats: {}
      };
    }
  }

  /**
   * 刷新工具缓存
   */
  async refreshTools(): Promise<void> {
    console.log('[MCP LangChain Integration] 刷新工具缓存');
    this.clearCache();
    
    // 重新获取所有工具以预热缓存
    await this.getAllLangChainTools();
  }
}
