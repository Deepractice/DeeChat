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
 * 将MCP inputSchema转换为Zod schema
 * @param inputSchema MCP工具的输入模式
 * @returns Zod schema对象
 */
function convertMCPSchemaToZod(inputSchema: any): z.ZodType<any> {
  if (!inputSchema || !inputSchema.properties) {
    // 如果没有schema，返回一个通用的object schema
    return z.object({}).passthrough();
  }

  const zodFields: Record<string, z.ZodType<any>> = {};
  const required = inputSchema.required || [];

  // 转换每个属性
  for (const [key, propSchema] of Object.entries(inputSchema.properties as Record<string, any>)) {
    let zodType: z.ZodType<any>;

    switch (propSchema.type) {
      case 'string':
        zodType = z.string();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'boolean':
        zodType = z.boolean();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'array':
        zodType = z.array(z.unknown());
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      case 'object':
        zodType = z.object({}).passthrough();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
        break;
      default:
        // 未知类型，使用any()
        zodType = z.unknown();
        if (propSchema.description) {
          zodType = zodType.describe(propSchema.description);
        }
    }

    // 如果不是必需的，将其设为可选
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    zodFields[key] = zodType;
  }

  return z.object(zodFields);
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
    log.debug(`🔧 [MCPToolConverter] 转换MCP工具: ${mcpTool.name}`);

    // 转换输入schema - 使用any类型避免过深的类型推断
    const zodSchema: any = convertMCPSchemaToZod(mcpTool.inputSchema);

    // 创建LangChain工具
    const langchainTool = tool(
      // 工具执行函数：调用MCP服务
      async (args: any) => {
        try {
          log.info(`🔧 [LangChain工具] 执行MCP工具: ${mcpTool.name}`, args);
          
          const response = await this.mcpService.callTool({
            serverId: mcpTool.serverId,
            toolName: mcpTool.name,
            arguments: args
          });

          if (response.success) {
            const result = typeof response.result === 'string' ? 
              response.result : 
              JSON.stringify(response.result);
            
            log.info(`✅ [LangChain工具] MCP工具执行成功: ${mcpTool.name}`);
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
        name: mcpTool.name,
        description: mcpTool.description || `MCP工具: ${mcpTool.name}`,
        schema: zodSchema
      }
    );

    log.debug(`✅ [MCPToolConverter] 成功转换工具: ${mcpTool.name}`);
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
   * @returns 绑定了工具的模型
   */
  async bindToolsToModel(model: any) {
    try {
      console.log(`🔧 [MCPToolConverter] 开始绑定MCP工具到模型...`);
      log.info(`🔧 [MCPToolConverter] 开始绑定MCP工具到模型...`);
      
      const langchainTools = await this.convertAllMCPTools();
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