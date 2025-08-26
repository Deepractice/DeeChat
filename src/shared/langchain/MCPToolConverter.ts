import { tool } from "@langchain/core/tools";
import { z } from "zod";
import log from 'electron-log';

/**
 * MCP工具到LangChain工具转换器
 * 将MCP工具定义转换为LangChain标准工具格式
 */

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
  serverId: string;
  serverName?: string;
}

interface MCPToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: any;
}

interface MCPToolCallResponse {
  success: boolean;
  result?: any;
  error?: string;
}

interface MCPIntegrationServiceInterface {
  getAllTools(): Promise<MCPTool[]>;
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;
}


/**
 * MCP工具转换器类
 */
export class MCPToolConverter {
  private mcpService: MCPIntegrationServiceInterface;

  constructor(mcpService: MCPIntegrationServiceInterface) {
    this.mcpService = mcpService;
  }

  /**
   * 将单个MCP工具转换为LangChain工具
   * @param mcpTool MCP工具定义
   * @returns LangChain工具实例
   */
  convertMCPTool(mcpTool: MCPTool): any {
    // 🚨 生成带server前缀的工具名称，符合StreamProcessor的路由逻辑
    const toolNameWithPrefix = `${mcpTool.serverId}__${mcpTool.name}`;
    log.info(`🔧 [MCPToolConverter] 转换MCP工具: ${mcpTool.name} -> ${toolNameWithPrefix}`);
    log.info(`🔧 [MCPToolConverter-DETAIL] - 描述: ${mcpTool.description || '无描述'}`);
    log.info(`🔧 [MCPToolConverter-DETAIL] - inputSchema存在: ${!!mcpTool.inputSchema}`);
    log.info(`🔧 [MCPToolConverter-DETAIL] - serverId: ${mcpTool.serverId}`);

    // 🚀 核心修复：使用最简单的Zod schema构建，确保编译通过和参数传递
    console.log(`🔧 [MCPToolConverter-SimpleZod] 工具: ${mcpTool.name}`);
    console.log(`🔧 [MCPToolConverter-SimpleZod] - 原始inputSchema:`, JSON.stringify(mcpTool.inputSchema, null, 2));
    
    // 使用最简单的Zod schema构建方式，避免复杂的类型推断
    let finalSchema: any;
    if (mcpTool.inputSchema?.properties && Object.keys(mcpTool.inputSchema.properties).length > 0) {
      const zodFields: any = {};
      const required = mcpTool.inputSchema.required || [];
      
      console.log(`🚨 [MCPToolConverter-DEBUG] 开始转换工具: ${mcpTool.name}`);
      console.log(`🚨 [MCPToolConverter-DEBUG] - inputSchema:`, JSON.stringify(mcpTool.inputSchema, null, 2));
      console.log(`🚨 [MCPToolConverter-DEBUG] - required字段:`, required);
      
      for (const [key, propSchema] of Object.entries(mcpTool.inputSchema.properties)) {
        const prop = propSchema as any;
        
        // 🚀 核心修复：正确处理必需和可选参数，让AI知道哪些参数是必需的
        if (required.includes(key)) {
          zodFields[key] = z.string().describe(prop.description || `${key} parameter (required)`);
          console.log(`🚨 [MCPToolConverter-DEBUG] - 字段: ${key} -> z.string() (必需)`);
        } else {
          zodFields[key] = z.string().optional().describe(prop.description || `${key} parameter (optional)`);
          console.log(`🚨 [MCPToolConverter-DEBUG] - 字段: ${key} -> z.string().optional() (可选)`);
        }
      }
      
      finalSchema = z.object(zodFields);
      console.log(`🚨 [MCPToolConverter-DEBUG] - 最终zodFields:`, Object.keys(zodFields));
      console.log(`🚨 [MCPToolConverter-DEBUG] - 最终schema类型:`, finalSchema.constructor?.name);
      
      // 测试schema解析
      try {
        const testParse = finalSchema.safeParse({});
        console.log(`🚨 [MCPToolConverter-DEBUG] - 空对象解析结果:`, testParse.success ? 'SUCCESS' : 'FAILED');
        if (!testParse.success) {
          console.log(`🚨 [MCPToolConverter-DEBUG] - 解析错误:`, testParse.error.issues);
        }
      } catch (error) {
        console.log(`🚨 [MCPToolConverter-DEBUG] - schema测试失败:`, error);
      }
      
    } else {
      finalSchema = z.object({});
      console.log(`🚨 [MCPToolConverter-DEBUG] - 工具 ${mcpTool.name} 使用空schema`);
    }

    // 创建LangChain工具 - 使用最终确定的schema
    const langchainTool = tool(
      // 工具执行函数：调用MCP服务
      async (args: any): Promise<string> => {
        try {
          log.info(`🔧 [LangChain工具] 执行MCP工具: ${toolNameWithPrefix} (原始: ${mcpTool.name})`, args);
          console.log(`🔧 [LangChain工具-参数] 收到参数:`, JSON.stringify(args, null, 2));
          console.log(`🔧 [LangChain工具-参数] 参数类型:`, typeof args, `是否为空:`, Object.keys(args || {}).length === 0);
          
          // 🚀 核心修复：在执行时检查必需参数
          const requiredFields = mcpTool.inputSchema?.required || [];
          for (const field of requiredFields) {
            if (!args || args[field] === undefined || args[field] === null || args[field] === '') {
              const errorMsg = `MCP工具参数验证失败: ${field}: Required`;
              log.error(`❌ [LangChain工具] ${errorMsg}`);
              console.log(`❌ [LangChain工具-参数验证] 缺少必需参数: ${field}`);
              return errorMsg;
            }
          }
          console.log(`✅ [LangChain工具-参数验证] 必需参数检查通过: ${requiredFields.join(', ')}`);
          
          const response = await this.mcpService.callTool({
            serverId: mcpTool.serverId,
            toolName: mcpTool.name, // callTool仍使用原始工具名称
            arguments: args
          });

          if (response.success) {
            const result = typeof response.result === 'string' ? 
              response.result : 
              JSON.stringify(response.result);
            
            log.info(`✅ [LangChain工具] MCP工具执行成功: ${toolNameWithPrefix}`);
            return result;
          } else {
            const errorMsg = `MCP工具执行失败: ${response.error}`;
            log.error(`❌ [LangChain工具] ${errorMsg}`);
            return errorMsg;
          }
        } catch (error) {
          const errorMsg = `工具执行异常: ${error instanceof Error ? error.message : String(error)}`;
          log.error(`❌ [LangChain工具] ${errorMsg}`, error);
          return errorMsg;
        }
      },
      {
        name: toolNameWithPrefix, // 🚨 使用带前缀的名称
        description: mcpTool.description || `MCP工具: ${mcpTool.name} (from ${mcpTool.serverId})`,
        schema: finalSchema // 🚀 使用简化schema
      }
    );

    log.info(`✅ [MCPToolConverter] 成功转换工具（直接Schema）: ${mcpTool.name} -> ${toolNameWithPrefix}`);
    return langchainTool;
  }

  /**
   * 将所有MCP工具转换为LangChain工具列表
   * @returns LangChain工具数组
   */
  async convertAllMCPTools() {
    try {
      const mcpTools = await this.mcpService.getAllTools();
      log.info(`🔧 [MCPToolConverter] 开始转换 ${mcpTools.length} 个MCP工具`);

      const langchainTools = mcpTools.map(mcpTool => this.convertMCPTool(mcpTool));
      
      log.info(`✅ [MCPToolConverter] 成功转换 ${langchainTools.length} 个工具`);
      return langchainTools;
    } catch (error) {
      log.error(`❌ [MCPToolConverter] 工具转换失败:`, error);
      throw error;
    }
  }

  /**
   * 将MCP工具绑定到LangChain模型
   * @param model LangChain聊天模型
   * @param filteredTools 可选的已过滤工具列表，如果提供则使用这个而不是重新获取
   * @returns 绑定了工具的模型
   */
  async bindToolsToModel(model: any, filteredTools?: MCPTool[]) {
    try {
      console.log(`🔧 [MCPToolConverter] 开始绑定MCP工具到模型...`);
      log.info(`🔧 [MCPToolConverter] 开始绑定MCP工具到模型...`);
      
      // 🔥 使用已过滤的工具或重新获取全部工具
      let mcpTools: MCPTool[];
      if (filteredTools) {
        mcpTools = filteredTools;
        console.log(`🎯 [MCPToolConverter] 使用已过滤的 ${mcpTools.length} 个工具`);
        log.info(`🎯 [MCPToolConverter] 使用已过滤的 ${mcpTools.length} 个工具`);
      } else {
        mcpTools = await this.mcpService.getAllTools();
        console.log(`🔧 [MCPToolConverter] 获取到 ${mcpTools.length} 个MCP工具`);
        log.info(`🔧 [MCPToolConverter] 获取到 ${mcpTools.length} 个MCP工具`);
      }
      
      // 转换为LangChain工具
      const langchainTools = mcpTools.map(mcpTool => this.convertMCPTool(mcpTool));
      console.log(`🔧 [MCPToolConverter] 转换得到 ${langchainTools.length} 个LangChain工具`);
      
      if (langchainTools.length === 0) {
        console.log(`⚠️ [MCPToolConverter] 没有可绑定的工具，返回原模型`);
        log.warn(`⚠️ [MCPToolConverter] 没有可绑定的工具，返回原模型`);
        return model;
      }
      
      console.log(`🔧 [MCPToolConverter] 开始绑定 ${langchainTools.length} 个工具到模型`);
      log.info(`🔧 [MCPToolConverter] 绑定 ${langchainTools.length} 个工具到模型`);
      
      // 检查model.bindTools方法是否存在
      if (typeof model.bindTools !== 'function') {
        console.error(`❌ [MCPToolConverter] 模型没有bindTools方法，模型类型:`, typeof model, model.constructor?.name);
        log.error(`❌ [MCPToolConverter] 模型没有bindTools方法，模型类型: ${typeof model}, 构造函数: ${model.constructor?.name}`);
        return model;
      }
      
      const modelWithTools = model.bindTools(langchainTools);
      
      console.log(`✅ [MCPToolConverter] 工具绑定完成，绑定的模型类型:`, modelWithTools.constructor?.name);
      log.info(`✅ [MCPToolConverter] 工具绑定完成`);
      return modelWithTools;
    } catch (error) {
      console.error(`❌ [MCPToolConverter] 工具绑定失败:`, error);
      log.error(`❌ [MCPToolConverter] 工具绑定失败:`, error);
      // 绑定失败时返回原模型，确保基本功能正常
      return model;
    }
  }

  /**
   * 获取工具转换统计信息
   */
  async getConversionStats() {
    try {
      const mcpTools = await this.mcpService.getAllTools();
      const stats = {
        totalTools: mcpTools.length,
        toolsByServer: mcpTools.reduce((acc, tool) => {
          acc[tool.serverId] = (acc[tool.serverId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        toolsWithSchema: mcpTools.filter(tool => tool.inputSchema).length,
        toolsWithoutSchema: mcpTools.filter(tool => !tool.inputSchema).length
      };

      return stats;
    } catch (error) {
      log.error(`❌ [MCPToolConverter] 获取转换统计失败:`, error);
      return null;
    }
  }
}

export default MCPToolConverter;