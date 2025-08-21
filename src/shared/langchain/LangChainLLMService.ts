import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

import { LangChainModelFactory } from './LangChainModelFactory';
import { ModelConfigEntity } from '../entities/ModelConfigEntity';
import { SmartLayeredPromptSystem, ConversationContext, UIInjectionContext } from './SmartLayeredPromptSystem';
import { MCPToolEntity } from '../entities/MCPToolEntity';
import { ToolExecution } from '../types';
import { LLMResponse } from '../interfaces/IModelProvider';
import { ThreadManager, ThreadStatus, ThreadPriority } from '../services/ThreadManager';
import { ThreadMonitor } from '../services/ThreadMonitor';
import { AIStateRouter } from '../services/AIStateRouter';
import { 
  AIState, 
  AIStateOutput, 
  ConversationLoopResult, 
  ConversationLoopConfig
} from '../interfaces/AIStateProtocol';
import log from 'electron-log';

// 流式更新接口 - 扩展支持AI状态机
export interface StreamUpdate {
  type: 'thinking' | 'tool_calling' | 'tool_result' | 'generating' | 'complete' | 'state_machine';
  stage: string;
  currentTool?: {
    name: string;
    description: string;
    progress: number;
  };
  toolResults?: ToolExecution[];
  partialContent?: string;
  // 🔥 新增：AI状态机相关字段
  aiState?: AIStateOutput;
  conversationIteration?: number;
  totalIterations?: number;
  metadata?: any;
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

// MCP服务接口（注入依赖）
interface MCPIntegrationServiceInterface {
  getAllTools(): Promise<MCPToolEntity[]>;
  callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse>;
}

/**
 * 智能分层LangChain LLM服务
 * 集成SmartLayeredPromptSystem，提供智能的上下文管理和提示词生成
 */
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

export class LangChainLLMService {
  private modelCache: Map<string, BaseChatModel> = new Map();
  private configCache: Map<string, ModelConfigEntity> = new Map();
  private mcpService?: MCPIntegrationServiceInterface;
  
  // 🎯 新增：会话级模型缓存 (sessionId_configId -> model)
  private sessionModelCache: Map<string, BaseChatModel> = new Map();
  // 🎯 新增：会话级工具执行记录
  private sessionToolExecutions: Map<string, ToolExecution[]> = new Map();
  
  // 🧵 新增：线程管理系统
  private threadManager: ThreadManager;
  private threadMonitor: ThreadMonitor;
  
  // 智能分层提示词系统
  private smartPromptSystem: SmartLayeredPromptSystem;
  
  // 会话管理
  private sessionContexts: Map<string, ConversationContext> = new Map();
  
  // 🔥 新增：AI状态机系统
  private stateRouter: AIStateRouter;
  private stateMachineConfig: ConversationLoopConfig;

  constructor(
    _configService?: any,
    mcpService?: MCPIntegrationServiceInterface,
    promptSystemConfig?: any
  ) {
    this.mcpService = mcpService;
    
    // 🧵 初始化线程管理系统
    this.threadManager = ThreadManager.getInstance({
      maxConcurrentThreads: 8,
      defaultTimeout: 180000, // 3分钟
      maxIdleTime: 600000,    // 10分钟
      enablePerformanceMonitoring: true,
      enableAutoCleanup: true,
      logLevel: 'info'
    });
    
    this.threadMonitor = new ThreadMonitor(this.threadManager);
    this.threadMonitor.startMonitoring(30000); // 每30秒监控一次
    
    log.info('🧵 [LangChain构造] 线程管理系统已初始化');
    
    // 🔧 添加MCP服务状态调试
    if (this.mcpService) {
      log.info('✅ [LangChain构造] MCP服务已注入，类型:', typeof this.mcpService);
    } else {
      log.warn('⚠️ [LangChain构造] MCP服务未注入，工具调用将不可用');
    }
    
    // 初始化智能分层提示词系统
    const llmFactory = async (modelKey: string) => {
      const config = await this.getDefaultConfig(modelKey);
      return LangChainModelFactory.createChatModel(config);
    };
    
    this.smartPromptSystem = new SmartLayeredPromptSystem(promptSystemConfig, llmFactory);
    
    // 🔥 初始化AI状态机系统
    this.stateMachineConfig = {
      maxIterations: 15,
      iterationDelay: 1000,
      enableStateMachine: true,
      ...promptSystemConfig?.stateMachine
    };
    this.stateRouter = new AIStateRouter(this.stateMachineConfig);
    
    log.info('🎯 [LangChain服务] 智能分层LangChain LLM服务初始化完成');
    log.info('🔄 [AI状态机] AI状态机系统已初始化', this.stateMachineConfig);
  }


  /**
   * 统一的消息发送方法（支持MCP工具调用）
   * @param message 用户消息
   * @param configId 模型配置ID
   * @param sessionId 会话ID（可选）
   * @param activeRole 当前激活的角色（可选）
   * @param baseSystemPrompt 基础系统提示词（可选）
   * @param uiContext UI上下文（可选）
   * @returns 模型响应
   */
  /**
   * 🎭 智能判断是否需要角色激活
   * @param sessionId 会话ID
   * @param roleId 角色ID
   * @param chatHistory 聊天历史
   * @returns 是否需要请求角色激活
   */
  private shouldRequestRoleActivation(sessionId: string, roleId: string, chatHistory: any[]): boolean {
    // 检查当前会话中是否已经激活过该角色
    const isRoleActivatedInSession = chatHistory.some(message => 
      message.role === 'assistant' && 
      message.toolExecutions?.some((tool: any) => 
        tool.toolName === 'promptx_action' && 
        tool.params?.role === roleId
      )
    );

    // 如果角色未在当前会话中激活，则需要激活
    const shouldActivate = !isRoleActivatedInSession;
    
    log.info(`🎭 [角色激活判断] 会话: ${sessionId.slice(0, 8)}, 角色: ${roleId}, 已激活: ${isRoleActivatedInSession}, 需要激活: ${shouldActivate}`);
    
    return shouldActivate;
  }

  // 移除硬编码的工具过滤逻辑，让AI自主判断是否需要工具

  /**
   * 获取工具描述信息
   */
  private getToolDescription(toolName: string): string {
    const toolDescriptions: Record<string, string> = {
      'promptx_init': '初始化PromptX系统',
      'promptx_action': '激活专业角色',
      'promptx_welcome': '获取可用角色列表',
      'promptx_remember': '记忆重要信息',
      'promptx_recall': '检索相关记忆',
      'context7_resolve-library-id': '查找相关资源库',
      'context7_get-library-docs': '获取技术文档',
      'web-search': '搜索网络信息',
      'file-read': '读取文件内容',
      'code-execution': '执行代码'
    };
    return toolDescriptions[toolName] || `使用 ${toolName} 工具`;
  }

  /**
   * 从LangChain响应中提取工具调用信息
   */
  private extractToolExecutions(response: any): ToolExecution[] {
    const executions: ToolExecution[] = [];
    
    if (response.tool_calls && Array.isArray(response.tool_calls)) {
      response.tool_calls.forEach((toolCall: any, index: number) => {
        const execution: ToolExecution = {
          id: toolCall.id || `tool_${Date.now()}_${index}`,
          toolName: toolCall.name || toolCall.function?.name || 'unknown',
          serverId: 'langchain', // LangChain管理的工具
          serverName: 'LangChain',
          params: toolCall.args || toolCall.function?.arguments || {},
          result: toolCall.result || null,
          success: !toolCall.error,
          error: toolCall.error || undefined,
          duration: toolCall.duration || undefined,
          timestamp: Date.now()
        };
        executions.push(execution);
      });
    }
    
    // 检查additional_kwargs中的工具调用信息（某些模型可能使用这种格式）
    if (response.additional_kwargs?.tool_calls) {
      response.additional_kwargs.tool_calls.forEach((toolCall: any, index: number) => {
        const execution: ToolExecution = {
          id: toolCall.id || `tool_${Date.now()}_${index + 1000}`,
          toolName: toolCall.function?.name || 'unknown',
          serverId: 'langchain',
          serverName: 'LangChain', 
          params: toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {},
          result: null, // 工具调用结果通常在后续消息中
          success: true, // 假设调用成功，除非有错误信息
          timestamp: Date.now()
        };
        executions.push(execution);
      });
    }
    
    log.debug(`🔧 [工具提取] 从LangChain响应中提取到 ${executions.length} 个工具调用`);
    return executions;
  }

  async sendMessageWithMCPTools(
    message: string,
    configId: string,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext,
    onStreamUpdate?: (update: StreamUpdate) => void,
    chatHistory?: any[]
  ): Promise<LLMResponse> {
    // 如果没有提供sessionId，生成一个临时的
    const finalSessionId = sessionId || `temp_${Date.now()}`;
    
    // 🧵 线程管理：确保线程存在并更新状态
    let thread = this.threadManager.getThread(finalSessionId);
    if (!thread) {
      thread = this.threadManager.createThread(finalSessionId, {
        priority: ThreadPriority.NORMAL,
        modelId: configId,
        roleId: activeRole
      });
    }

    // 🧵 更新线程状态为繁忙
    this.threadManager.updateThreadStatus(finalSessionId, ThreadStatus.BUSY);
    
    const startTime = Date.now();
    
    try {
      console.log('🔧 [统一消息发送] 方法被调用');
      console.log('🔧 [统一消息发送] mcpService存在:', !!this.mcpService);

    console.log('🔧 [统一消息发送] 开始获取模型和配置');
    const modelConfig = await this.getModelConfig(configId);
    console.log('🔧 [统一消息发送] 模型和配置获取完成');

    // 构建会话上下文
    const conversationContext: ConversationContext = this.buildConversationContext(
      finalSessionId,
      modelConfig.model,
      activeRole
    );
    log.info(`🎯 [LangChain] 会话上下文已构建 - sessionId: ${finalSessionId.slice(0, 8)}, 角色: ${activeRole || '未选择'}, 模型: ${modelConfig.model}`);

    // 🔥 获取所有可用MCP工具（让AI智能决定使用）
    const mcpTools = this.mcpService ? await this.mcpService.getAllTools() : [];
    
    log.info(`🔧 [MCP工具] 提供 ${mcpTools.length} 个工具供AI智能选择`);
    if (mcpTools.length > 0) {
      log.info(`🔧 [MCP工具列表] ${mcpTools.map(tool => tool.name).join(', ')}`);
    }

    // 🔧 构建UI注入上下文，智能传递角色选择信息
    // 🎭 智能判断是否需要角色激活：当有选择的角色且当前会话中该角色未激活时
    log.info(`🎭 [角色激活判断-入口] 角色: ${activeRole}, 会话: ${finalSessionId.slice(0, 8)}, 历史消息数: ${(chatHistory || []).length}`);
    const shouldRequestActivation = activeRole && this.shouldRequestRoleActivation(finalSessionId, activeRole, chatHistory || []);
    log.info(`🎭 [角色激活判断-结果] shouldRequestActivation: ${shouldRequestActivation}, roleActivationRequest: ${!!shouldRequestActivation}`);
    
    const uiInjectionContext: UIInjectionContext = {
      selectedRole: activeRole, // 从参数传递的当前激活角色
      roleActivationRequest: !!shouldRequestActivation, // 🔥 关键修复：智能判断是否需要激活角色
      ...uiContext // 合并其他UI上下文（如果有的话）
    };

    // 使用智能分层系统构建消息 (mcpTools是MCPToolEntity[]格式)
    const promptResponse = await this.smartPromptSystem.buildMessages(
      message,
      conversationContext,
      baseSystemPrompt || '',
      mcpTools, // availableTools (MCPToolEntity[])
      uiInjectionContext
    );

    log.info(`📝 [LangChain] 智能提示词构建完成 - tokens: ${promptResponse.totalTokens}, 压缩: ${promptResponse.compressionTriggered}, 消息数: ${promptResponse.messages.length}`);

    // 🎯 决定是否使用工具绑定的模型（会话级缓存）
    let model: any;
    if (this.mcpService && mcpTools.length > 0) {
      // 有MCP工具时，使用带工具的模型（会话级缓存）
      const sessionKey = `${finalSessionId}_${configId}_with_tools`;
      
      // 🎯 检查会话级模型缓存
      if (this.sessionModelCache.has(sessionKey)) {
        model = this.sessionModelCache.get(sessionKey);
        log.info(`♻️ [会话缓存] 复用会话模型: ${finalSessionId.slice(0, 8)}`);
      } else {
        // 创建新的会话级模型实例
        const baseModel = await this.getModel(configId);
      
        // 🔥 直接转换MCPToolEntity[]为LangChain工具格式并绑定
        const langchainTools: any[] = mcpTools.map((mcpTool: any) => 
          tool(
            async (args: any): Promise<string> => {
              try {
                log.info(`🔧 [LangChain工具] 执行MCP工具: ${mcpTool.name}`, args);
                
                const response = await this.mcpService!.callTool({
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
              schema: convertMCPSchemaToZod(mcpTool.inputSchema) as any
            }
          )
        );
        
        // 检查model.bindTools方法是否存在
        if (typeof baseModel.bindTools !== 'function') {
          log.error(`❌ [直接转换] 模型没有bindTools方法，模型类型: ${typeof baseModel}, 构造函数: ${baseModel.constructor?.name}`);
          model = baseModel;
        } else {
          model = baseModel.bindTools(langchainTools);
        }
        
        // 🎯 缓存绑定好工具的模型到会话缓存
        this.sessionModelCache.set(sessionKey, model);
        log.info(`🎯 [会话缓存] 新建会话模型: ${finalSessionId.slice(0, 8)}`);
        log.info(`🔧 [直接转换] 成功转换并绑定 ${langchainTools.length} 个工具到模型`);
      }
      console.log(`🔧 [统一消息发送] 使用带 ${mcpTools.length} 个已过滤MCP工具的模型`);
    } else {
      // 没有MCP工具时，使用普通模型（也进行会话级缓存）
      const sessionKey = `${finalSessionId}_${configId}_no_tools`;
      
      if (this.sessionModelCache.has(sessionKey)) {
        model = this.sessionModelCache.get(sessionKey);
        log.info(`♻️ [会话缓存] 复用普通会话模型: ${finalSessionId.slice(0, 8)}`);
      } else {
        model = await this.getModel(configId);
        this.sessionModelCache.set(sessionKey, model);
        log.info(`🎯 [会话缓存] 新建普通会话模型: ${finalSessionId.slice(0, 8)}`);
      }
      console.log('🔧 [统一消息发送] 使用普通模型');
    }

    // 🔥 实现完整的LangChain工具调用循环
    let messages = [...promptResponse.messages];
    
    log.info(`🚀 [第一次模型调用] 开始调用模型，消息数: ${messages.length}`);
    log.info(`🚀 [第一次模型调用] 系统提示词长度: ${messages[0] ? (messages[0].content as string).length : 0} 字符`);
    
    console.log('🚀 [DeeChat调试] 第一次模型调用开始，消息数:', messages.length);
    console.log('🚀 [DeeChat调试] 系统提示词长度:', messages[0] ? (messages[0].content as string).length : 0, '字符');
    
    // 🔥 流式更新：开始思考阶段
    onStreamUpdate?.({
      type: 'thinking',
      stage: 'AI正在分析您的问题...',
      metadata: { messageCount: messages.length }
    });
    
    let currentResponse = await model.invoke(messages);
    let finalAIResponse = currentResponse.content as string;
    let toolExecutions: any[] = [];
    
    log.info(`✅ [第一次模型调用] 完成，响应长度: ${finalAIResponse.length} 字符`);
    console.log('✅ [DeeChat调试] 第一次模型调用完成，响应长度:', finalAIResponse.length, '字符');

    // 🔥 实现完整的工具调用循环机制
    let toolCallIteration = 0;
    const maxToolCallIterations = 10; // 防止无限循环
    
    while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0 && toolCallIteration < maxToolCallIterations) {
      toolCallIteration++;
      log.info(`🔧 [工具调用循环] 第${toolCallIteration}轮工具调用，检测到 ${currentResponse.tool_calls.length} 个工具调用请求`);
      console.log(`🔧 [DeeChat调试] 第${toolCallIteration}轮工具调用，数量:`, currentResponse.tool_calls.length);
      
      // 🔥 流式更新：工具调用阶段
      for (let i = 0; i < currentResponse.tool_calls.length; i++) {
        const toolCall = currentResponse.tool_calls[i];
        onStreamUpdate?.({
          type: 'tool_calling',
          stage: `正在调用 ${toolCall.name} 工具...`,
          currentTool: {
            name: toolCall.name,
            description: this.getToolDescription(toolCall.name),
            progress: (i / currentResponse.tool_calls.length) * 100
          }
        });
      }
      
      // 执行工具调用并收集结果
      const toolResults: any[] = [];
      for (const toolCall of currentResponse.tool_calls) {
        const startTime = Date.now();
        try {
          log.info(`🔧 [工具执行] 执行工具: ${toolCall.name}`);
          
          // 直接通过MCP服务调用工具
          const mcpResponse = await this.mcpService?.callTool({
            serverId: 'promptx-builtin', // 统一使用PromptX，已集成所有文件操作功能
            toolName: toolCall.name,
            arguments: toolCall.args
          });
          
          const duration = Date.now() - startTime;
          const toolResult = mcpResponse?.success ? mcpResponse.result : 
                            (mcpResponse?.error || 'Tool execution failed');

          const execution = {
            id: toolCall.id || `tool_${Date.now()}`,
            toolName: toolCall.name,
            serverId: 'langchain',
            serverName: 'LangChain',
            params: toolCall.args,
            result: typeof toolResult === 'string' ? toolResult : 
                   (toolResult?.result || JSON.stringify(toolResult)),
            success: true,
            duration: duration,
            timestamp: Date.now()
          };
          
          toolResults.push(execution);
          toolExecutions.push(execution);
          
          log.info(`✅ [工具执行] 工具 ${toolCall.name} 执行成功`);
        } catch (error) {
          const duration = Date.now() - startTime;
          log.error(`❌ [工具执行] 工具 ${toolCall.name} 执行失败:`, error);
          
          const execution = {
            id: toolCall.id || `tool_${Date.now()}`,
            toolName: toolCall.name,
            serverId: 'langchain',
            serverName: 'LangChain',
            params: toolCall.args,
            result: null,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            duration: duration,
            timestamp: Date.now()
          };
          
          toolExecutions.push(execution);
        }
      }
      
      // 🔥 流式更新：工具结果阶段
      onStreamUpdate?.({
        type: 'tool_result',
        stage: '工具执行完成，正在分析结果...',
        toolResults: toolExecutions,
        metadata: { toolCount: toolResults.length }
      });

      // 🔥 关键：将工具结果反馈给模型，让AI继续决定后续操作
      log.info(`🔄 [工具结果反馈] 将 ${toolResults.length} 个工具结果反馈给模型，等待下一步决策`);
      console.log(`🔄 [DeeChat调试] 工具结果反馈给模型，等待AI继续决策`);
      
      // 构建工具结果消息（LangChain标准格式）
      const toolResultMessages = currentResponse.tool_calls.map((toolCall: any, index: number) => {
        const toolResult = toolResults[index];
        return {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult ? JSON.stringify(toolResult.result) : 'Tool execution failed'
        };
      });
      
      // 将工具结果添加到消息历史中，继续对话
      messages.push(currentResponse); // AI的工具调用请求
      messages.push(...toolResultMessages); // 工具执行结果
      
      // 🔥 流式更新：思考下一步
      onStreamUpdate?.({
        type: 'thinking',
        stage: 'AI正在基于工具结果思考下一步...',
        metadata: { iteration: toolCallIteration + 1 }
      });
      
      // 🔥 继续调用模型，让AI基于工具结果决定下一步
      log.info(`🚀 [第${toolCallIteration + 1}次模型调用] 基于工具结果继续对话`);
      console.log(`🚀 [DeeChat调试] 第${toolCallIteration + 1}次模型调用，基于工具结果继续`);
      
      currentResponse = await model.invoke(messages);
      finalAIResponse = currentResponse.content as string;
      
      log.info(`✅ [第${toolCallIteration + 1}次模型调用] 完成，响应长度: ${finalAIResponse.length} 字符，是否有新工具调用: ${!!(currentResponse.tool_calls && currentResponse.tool_calls.length > 0)}`);
      console.log(`✅ [DeeChat调试] 第${toolCallIteration + 1}次模型调用完成，有新工具调用:`, !!(currentResponse.tool_calls && currentResponse.tool_calls.length > 0));
    }
    
    if (toolCallIteration >= maxToolCallIterations) {
      log.warn(`⚠️ [工具调用循环] 达到最大迭代次数 ${maxToolCallIterations}，停止工具调用`);
      console.log('⚠️ [DeeChat调试] 工具调用达到最大迭代次数，停止循环');
    }
    
    // 🔥 新架构：角色内容已在第一次调用前直接注入，无需二次调用
    if (toolExecutions.length === 0) {
      // 没有工具调用，提取旧的工具执行信息（用于显示）
      toolExecutions = this.extractToolExecutions(currentResponse);
      log.info(`📝 [标准响应] 没有工具调用，直接返回AI响应`);
      console.log('📝 [DeeChat调试] 没有工具调用，直接返回AI响应');
    }
    
    // 如果没有角色激活工具调用，更新普通会话状态
    if (activeRole) {
      const existingContext = this.sessionContexts.get(finalSessionId);
      if (existingContext) {
        existingContext.activeRole = activeRole;
        existingContext.lastRoleActivationTime = new Date();
        this.sessionContexts.set(finalSessionId, existingContext);
        log.info(`🎭 [会话更新] 角色状态已更新: ${activeRole}`);
      }
    }


    // 构造完整的LLM响应
    const llmResponse: LLMResponse = {
      content: finalAIResponse,
      model: modelConfig.model,
      toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
      usage: currentResponse.usage_metadata ? {
        prompt_tokens: currentResponse.usage_metadata.input_tokens || 0,
        completion_tokens: currentResponse.usage_metadata.output_tokens || 0,
        total_tokens: currentResponse.usage_metadata.total_tokens || 0
      } : undefined,
      finishReason: currentResponse.response_metadata?.finish_reason,
      contextInfo: {
        originalMessageCount: 0, // 暂时设为0，需要从智能分层系统获取
        finalMessageCount: promptResponse.messages.length,
        tokenStats: {
          currentTokens: promptResponse.totalTokens,
          maxTokens: 100000, // 默认值，应该从模型配置获取
          utilizationRate: promptResponse.totalTokens / 100000,
          status: promptResponse.compressionTriggered ? 'compressed' : 
                  (promptResponse.totalTokens / 100000 > 0.8 ? 'near_limit' : 'optimal')
        },
        compressionApplied: promptResponse.compressionTriggered || false,
        removedCount: 0 // 暂时设为0，需要从智能分层系统获取
      },
      // 🔥 新增：角色状态同步信息
      roleStatus: promptResponse.roleStatus
    };

    // 🔥 流式更新：完成状态
    onStreamUpdate?.({
      type: 'complete',
      stage: '回复生成完成',
      partialContent: finalAIResponse,
      toolResults: toolExecutions,
      metadata: { 
        responseLength: finalAIResponse.length,
        toolCount: toolExecutions.length 
      }
    });

    // 🧵 线程管理：更新统计数据和状态
    try {
      const responseTime = Date.now() - startTime;
      const tokensUsed = llmResponse.usage?.total_tokens || 0;
      
      // 更新线程统计
      this.threadManager.updateThreadStats(finalSessionId, {
        responseTime,
        tokensUsed,
        success: true,
        memoryUsage: this.estimateMemoryUsage(finalSessionId),
        modelCacheSize: this.sessionModelCache.size,
        activeConnections: 1
      });
      
      // 更新线程状态为空闲
      this.threadManager.updateThreadStatus(finalSessionId, ThreadStatus.IDLE);
      
      log.info(`🧵 [线程统计] 会话 ${finalSessionId.slice(0, 8)} 完成 - 用时: ${responseTime}ms, Tokens: ${tokensUsed}`);
    } catch (error) {
      log.error('🧵 [线程统计] 更新线程统计失败:', error);
    }

    // 保存AI响应（只有提供了sessionId才保存历史）
    if (sessionId) {
      this.smartPromptSystem.addAIResponse(finalSessionId, message, finalAIResponse);
    }

    return llmResponse;
      
    } catch (error) {
      // 🧵 线程管理：处理错误情况
      const responseTime = Date.now() - startTime;
      
      this.threadManager.updateThreadStats(finalSessionId, {
        responseTime,
        success: false
      });
      
      this.threadManager.updateThreadStatus(finalSessionId, ThreadStatus.ERROR, error as Error);
      
      log.error(`🧵 [线程错误] 会话 ${finalSessionId.slice(0, 8)} 处理失败 - 用时: ${responseTime}ms, 错误: ${(error as Error).message}`);
      
      // 重新抛出错误
      throw error;
    }
  }

  /**
   * 🔄 AI状态机增强的消息发送方法
   * 支持自动对话续接，解决对话中断问题
   */
  async sendMessageWithStateMachine(
    message: string,
    configId: string,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext,
    onStreamUpdate?: (update: StreamUpdate) => void,
    chatHistory?: any[],
    enableStateMachine: boolean = true
  ): Promise<ConversationLoopResult> {
    const finalSessionId = sessionId || `temp_${Date.now()}`;
    
    log.info(`🔄 [AI状态机] 开始智能对话循环 - 会话: ${finalSessionId.slice(0, 8)}, 启用状态机: ${enableStateMachine}`);
    
    // 如果未启用状态机，直接调用原始方法
    if (!enableStateMachine || !this.stateMachineConfig.enableStateMachine) {
      const response = await this.sendMessageWithMCPTools(
        message, configId, sessionId, activeRole, baseSystemPrompt, uiContext, onStreamUpdate, chatHistory
      );
      
      return {
        finalResponse: response.content,
        totalIterations: 1,
        finalState: AIState.COMPLETED,
        allToolExecutions: response.toolExecutions || [],
        stopReason: 'completed'
      };
    }

    let currentMessage = message;
    let currentChatHistory = [...(chatHistory || [])];
    let allToolExecutions: any[] = [];
    let iteration = 0;
    let lastAIState: AIStateOutput | null = null;
    let finalResponse = '';

    // 🔄 AI状态机主循环
    while (iteration < this.stateMachineConfig.maxIterations) {
      iteration++;
      
      log.info(`🔄 [AI状态机] 第${iteration}轮对话开始`);
      
      // 🔥 流式更新：状态机迭代开始
      onStreamUpdate?.({
        type: 'state_machine',
        stage: `AI状态机第${iteration}轮处理中...`,
        conversationIteration: iteration,
        totalIterations: this.stateMachineConfig.maxIterations,
        aiState: lastAIState || undefined,
        metadata: { 
          sessionId: finalSessionId,
          enableStateMachine: true
        }
      });

      try {
        // 调用原始的消息发送方法
        const response = await this.sendMessageWithMCPTools(
          currentMessage,
          configId,
          sessionId,
          activeRole,
          iteration === 1 ? baseSystemPrompt : `${baseSystemPrompt || ''}\n\n[继续之前的任务，这是第${iteration}轮对话]`,
          uiContext,
          onStreamUpdate,
          currentChatHistory
        );

        finalResponse = response.content;
        
        // 收集工具执行记录
        if (response.toolExecutions) {
          allToolExecutions.push(...response.toolExecutions);
        }

        // 更新聊天历史
        currentChatHistory.push({
          role: 'user',
          content: currentMessage,
          timestamp: Date.now()
        });
        currentChatHistory.push({
          role: 'assistant', 
          content: finalResponse,
          toolExecutions: response.toolExecutions,
          timestamp: Date.now()
        });

        // 🎯 提取AI状态
        const aiState = this.stateRouter.extractAIState(finalResponse);
        lastAIState = aiState;
        
        if (aiState) {
          log.info(`🎯 [AI状态机] 第${iteration}轮状态: ${aiState.aiState}, 进度: ${aiState.taskProgress}%`);
          
          // 🔥 流式更新：状态变化
          onStreamUpdate?.({
            type: 'state_machine',
            stage: `AI状态: ${aiState.aiState} (${aiState.taskProgress}%)`,
            conversationIteration: iteration,
            totalIterations: this.stateMachineConfig.maxIterations,
            aiState: aiState,
            metadata: {
              stateChange: true,
              nextAction: aiState.nextAction
            }
          });

          // 🎯 路由决策
          const decision = this.stateRouter.routeConversation(aiState, iteration);
          
          if (!decision.shouldContinue) {
            log.info(`🔄 [AI状态机] 对话结束 - 原因: ${decision.reason}`);
            
            // 确定停止原因
            let stopReason: ConversationLoopResult['stopReason'] = 'completed';
            if (aiState.aiState === AIState.WAITING_INPUT) {
              stopReason = 'user_input_needed';
            } else if (aiState.aiState === AIState.ERROR) {
              stopReason = 'error';
            } else if (iteration >= this.stateMachineConfig.maxIterations) {
              stopReason = 'max_iterations';
            }

            return {
              finalResponse,
              totalIterations: iteration,
              finalState: aiState.aiState,
              allToolExecutions,
              stopReason
            };
          }

          // 🔄 准备下一轮对话
          currentMessage = decision.nextMessage || '请继续';
          
          // 延迟执行（如果配置了延迟）
          if (decision.delayMs && decision.delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, decision.delayMs));
          }
          
        } else {
          // 没有检测到状态，假设AI还在工作
          log.warn(`⚠️ [AI状态机] 第${iteration}轮未检测到状态，假设AI正在工作`);
          
          // 简单的启发式判断：如果没有工具调用且响应较短，可能已完成
          if (!response.toolExecutions?.length && finalResponse.length < 200) {
            log.info(`🔄 [AI状态机] 推断任务可能已完成`);
            return {
              finalResponse,
              totalIterations: iteration,
              finalState: AIState.COMPLETED,
              allToolExecutions,
              stopReason: 'completed'
            };
          }
          
          // 否则继续下一轮
          currentMessage = '请继续完成任务';
        }

      } catch (error) {
        log.error(`❌ [AI状态机] 第${iteration}轮处理失败:`, error);
        
        return {
          finalResponse: finalResponse || `第${iteration}轮处理失败: ${(error as Error).message}`,
          totalIterations: iteration,
          finalState: AIState.ERROR,
          allToolExecutions,
          stopReason: 'error'
        };
      }
    }

    // 达到最大迭代次数
    log.warn(`⚠️ [AI状态机] 达到最大迭代次数 ${this.stateMachineConfig.maxIterations}`);
    
    return {
      finalResponse,
      totalIterations: iteration,
      finalState: lastAIState?.aiState || AIState.WORKING,
      allToolExecutions,
      stopReason: 'max_iterations'
    };
  }

  // 为了向后兼容，保留sendMessage别名
  async sendMessage(
    message: string,
    configId: string,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext,
    onStreamUpdate?: (update: StreamUpdate) => void,
    chatHistory?: any[]
  ): Promise<LLMResponse> {
    // 🔥 默认启用状态机功能
    const result = await this.sendMessageWithStateMachine(
      message, configId, sessionId, activeRole, baseSystemPrompt, uiContext, onStreamUpdate, chatHistory, true
    );
    
    // 转换为原格式以保持兼容性
    return {
      content: result.finalResponse,
      model: 'unknown', // 需要从配置中获取
      toolExecutions: result.allToolExecutions,
      usage: undefined, // 状态机模式暂不统计usage
      finishReason: result.stopReason,
      contextInfo: undefined, // 状态机模式暂不提供contextInfo
      // 🔥 新增：状态机结果信息
      stateMachineResult: {
        totalIterations: result.totalIterations,
        finalState: result.finalState,
        stopReason: result.stopReason
      }
    } as LLMResponse & { stateMachineResult?: any };
  }

  /**
   * 为了向后兼容，保留sendMessageWithConfig别名（已合并到统一方法中）
   */
  async sendMessageWithConfig(
    message: string,
    config: ModelConfigEntity,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext,
    onStreamUpdate?: (update: StreamUpdate) => void,
    chatHistory?: any[]
  ): Promise<LLMResponse> {
    // 将config对象临时存储到配置缓存中，然后使用统一方法
    const tempConfigId = `temp_${Date.now()}`;
    this.configCache.set(tempConfigId, config);
    
    try {
      return await this.sendMessageWithMCPTools(message, tempConfigId, sessionId, activeRole, baseSystemPrompt, uiContext, onStreamUpdate, chatHistory);
    } finally {
      // 清理临时配置
      this.configCache.delete(tempConfigId);
    }
  }

  /**
   * 🌊 流式消息发送方法
   * 提供真正的token级别流式输出
   */
  async streamMessage(
    message: string,
    configId: string,
    onStreamUpdate: (update: StreamUpdate) => void,
    sessionId?: string,
    activeRole?: string,
    baseSystemPrompt?: string,
    uiContext?: UIInjectionContext,
    chatHistory?: any[]
  ): Promise<string> {
    // 🔥 添加详细的参数日志
    console.log('🌊 [streamMessage] 接收到的参数:');
    console.log('🌊 [streamMessage]   - message:', typeof message, message?.slice(0, 50));
    console.log('🌊 [streamMessage]   - configId:', configId);
    console.log('🌊 [streamMessage]   - sessionId:', sessionId);
    console.log('🌊 [streamMessage]   - activeRole:', activeRole, '类型:', typeof activeRole);
    console.log('🌊 [streamMessage]   - uiContext:', !!uiContext);
    console.log('🌊 [streamMessage]   - chatHistory length:', chatHistory?.length || 0);
    const finalSessionId = sessionId || `stream_${Date.now()}`;
    
    log.info(`🌊 [流式输出] 开始流式对话 - 会话: ${finalSessionId.slice(0, 8)}, 模型: ${configId}`);
    
    try {
      // 🧵 线程管理：确保线程存在并更新状态
      let thread = this.threadManager.getThread(finalSessionId);
      if (!thread) {
        thread = this.threadManager.createThread(finalSessionId, {
          priority: ThreadPriority.NORMAL,
          modelId: configId,
          roleId: activeRole
        });
      }
      
      // 🧵 更新线程状态为繁忙
      this.threadManager.updateThreadStatus(finalSessionId, ThreadStatus.BUSY);
      
      // 获取模型配置和实例
      const modelConfig = await this.getModelConfig(configId);
      const model = await this.getModel(configId);
      
      // 构建会话上下文
      const conversationContext: ConversationContext = this.buildConversationContext(
        finalSessionId,
        modelConfig.model,
        activeRole
      );
      
      // 获取MCP工具
      const mcpTools = this.mcpService ? await this.mcpService.getAllTools() : [];
      
      // 智能判断是否需要角色激活
      const shouldRequestActivation = activeRole && this.shouldRequestRoleActivation(finalSessionId, activeRole, chatHistory || []);
      
      const uiInjectionContext: UIInjectionContext = {
        selectedRole: activeRole,
        roleActivationRequest: !!shouldRequestActivation,
        ...uiContext
      };
      
      // 🔥 流式更新：开始思考
      onStreamUpdate({
        type: 'thinking',
        stage: 'AI正在分析您的请求...',
        metadata: { sessionId: finalSessionId }
      });
      
      // 使用智能分层系统构建消息
      const promptResponse = await this.smartPromptSystem.buildMessages(
        message,
        conversationContext,
        baseSystemPrompt || '',
        mcpTools,
        uiInjectionContext
      );
      
      log.info(`🌊 [流式输出] 提示词构建完成 - tokens: ${promptResponse.totalTokens}, 消息数: ${promptResponse.messages.length}`);
      
      // 🔥 流式更新：开始生成
      onStreamUpdate({
        type: 'generating',
        stage: 'AI正在生成回复...',
        metadata: { sessionId: finalSessionId }
      });
      
      // 🌊 核心流式调用
      let fullContent = '';
      let buffer = '';
      const BUFFER_SIZE = 1; // 🔥 改为每1个字符发送一次更新，实现真正的逐字显示
      
      // 获取LangChain模型的流式输出
      const stream = await model.stream(promptResponse.messages);
      
      for await (const chunk of stream) {
        const chunkContent = chunk.content || '';
        if (chunkContent) {
          buffer += chunkContent;
          fullContent += chunkContent;
          
          // 当缓冲区达到一定大小时发送更新
          if (buffer.length >= BUFFER_SIZE) {
            onStreamUpdate({
              type: 'generating',
              stage: 'AI正在生成回复...',
              partialContent: fullContent,
              metadata: { 
                sessionId: finalSessionId,
                currentChunk: buffer
              }
            });
            buffer = '';
          }
        }
      }
      
      // 发送最后的缓冲区内容
      if (buffer.length > 0) {
        onStreamUpdate({
          type: 'generating',
          stage: 'AI正在生成回复...',
          partialContent: fullContent,
          metadata: { 
            sessionId: finalSessionId,
            currentChunk: buffer
          }
        });
      }
      
      // 🔥 流式更新：完成
      onStreamUpdate({
        type: 'complete',
        stage: '回复生成完成',
        partialContent: fullContent,
        metadata: { sessionId: finalSessionId }
      });
      
      // 🧵 更新线程状态为空闲
      this.threadManager.updateThreadStatus(finalSessionId, ThreadStatus.IDLE);
      
      log.info(`🌊 [流式输出] 流式对话完成 - 会话: ${finalSessionId.slice(0, 8)}, 内容长度: ${fullContent.length}`);
      
      return fullContent;
      
    } catch (error) {
      log.error(`❌ [流式输出] 流式对话失败 - 会话: ${finalSessionId.slice(0, 8)}`, error);
      
      // 🧵 发生错误时更新线程状态
      this.threadManager.updateThreadStatus(finalSessionId, ThreadStatus.ERROR);
      
      // 🔥 流式更新：错误
      onStreamUpdate({
        type: 'complete',
        stage: '流式输出失败，正在降级到标准模式...',
        metadata: { 
          sessionId: finalSessionId,
          error: error instanceof Error ? error.message : '未知错误'
        }
      });
      
      // 🔄 降级到标准方法
      try {
        log.info(`🔄 [流式输出] 降级到标准消息发送`);
        const fallbackResponse = await this.sendMessageWithMCPTools(
          message, configId, sessionId, activeRole, baseSystemPrompt, uiContext, onStreamUpdate, chatHistory
        );
        
        // 🔥 流式更新：降级完成
        onStreamUpdate({
          type: 'complete',
          stage: '回复生成完成（标准模式）',
          partialContent: fallbackResponse.content,
          metadata: { 
            sessionId: finalSessionId,
            fallbackMode: true
          }
        });
        
        return fallbackResponse.content;
      } catch (fallbackError) {
        log.error(`❌ [流式输出] 降级方法也失败`, fallbackError);
        throw new Error(`流式输出失败且降级失败: ${fallbackError instanceof Error ? fallbackError.message : '未知错误'}`);
      }
    }
  }

  /**
   * 构建会话上下文
   */
  private buildConversationContext(
    sessionId: string,
    modelName: string,
    activeRole?: string
  ): ConversationContext {
    // 🔥 调试上下文构建
    console.log('🔍 [buildConversationContext] 参数:');
    console.log('🔍 [buildConversationContext]   - sessionId:', sessionId);
    console.log('🔍 [buildConversationContext]   - modelName:', modelName);
    console.log('🔍 [buildConversationContext]   - activeRole:', activeRole, '类型:', typeof activeRole);
    
    const existing = this.sessionContexts.get(sessionId);
    
    const context: ConversationContext = {
      sessionId,
      currentModel: modelName,
      activeRole: activeRole || existing?.activeRole,
      conversationStartTime: existing?.conversationStartTime || new Date(),
      totalRounds: existing?.totalRounds || 0,
      lastRoleActivationTime: existing?.lastRoleActivationTime,
      lastUserInput: existing?.lastUserInput,
      lastAIResponse: existing?.lastAIResponse
    };

    this.sessionContexts.set(sessionId, context);
    return context;
  }

  /**
   * 强制压缩会话历史
   */
  async compressSessionHistory(sessionId: string): Promise<void> {
    const result = await this.smartPromptSystem.forceCompressHistory(sessionId);
    if (result) {
      log.info(`🔄 [历史压缩] 会话 ${sessionId.slice(0, 8)} 压缩完成，节省 ${result.tokensSaved} tokens`);
    }
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(maxAge: number = 24): void {
    const cutoffTime = new Date(Date.now() - maxAge * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [sessionId, context] of this.sessionContexts.entries()) {
      if (context.conversationStartTime < cutoffTime) {
        this.sessionContexts.delete(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.info(`🧹 [会话清理] 已清理 ${cleaned} 个过期会话上下文`);
    }
  }

  /**
   * 获取模型实例
   */
  private async getModel(configId: string): Promise<BaseChatModel> {
    if (this.modelCache.has(configId)) {
      return this.modelCache.get(configId)!;
    }

    const config = await this.getModelConfig(configId);
    const model = LangChainModelFactory.createChatModel(config);
    this.modelCache.set(configId, model);

    return model;
  }

  /**
   * 获取模型配置
   */
  private async getModelConfig(configId: string): Promise<ModelConfigEntity> {
    if (this.configCache.has(configId)) {
      return this.configCache.get(configId)!;
    }

    // 这里应该从配置服务获取，暂时返回默认配置
    const config = await this.getDefaultConfig(configId);
    this.configCache.set(configId, config);

    return config;
  }

  /**
   * 获取默认配置（临时实现）
   */
  private async getDefaultConfig(modelKey: string): Promise<ModelConfigEntity> {
    // 基于模型key返回默认配置
    if (modelKey.includes('claude')) {
      return new ModelConfigEntity({
        id: modelKey,
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        baseURL: '',
        isEnabled: true,
        status: 'available',
        priority: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 统一使用ChatAnywhere代理 - 支持所有OpenAI兼容模型
    // modelKey现在直接是模型名称，无需处理前缀
    return new ModelConfigEntity({
      id: modelKey,
      name: this.getModelDisplayName(modelKey), // 动态生成显示名称
      provider: 'openai',
      model: modelKey, // 直接使用modelKey作为模型名称
      apiKey: 'sk-cVZTEb3pLEKqM0gfWPz3QE9jXc8cq9Zyh0Api8rESjkITqto', // 统一API密钥
      baseURL: 'https://api.chatanywhere.tech/v1', // 统一代理地址
      isEnabled: true,
      status: 'available',
      priority: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * 根据模型ID生成友好的显示名称
   */
  private getModelDisplayName(modelName: string): string {
    if (modelName.includes('gpt-4')) return 'GPT-4';
    if (modelName.includes('gpt-3.5')) return 'GPT-3.5';
    if (modelName.includes('gpt')) return 'GPT';
    if (modelName.includes('kimi')) return 'Kimi';
    if (modelName.includes('qwen')) return 'Qwen';
    if (modelName.includes('claude')) return 'Claude';
    if (modelName.includes('gemini')) return 'Gemini';
    
    // 默认使用模型名称的首字母大写形式
    return modelName.charAt(0).toUpperCase() + modelName.slice(1);
  }

  /**
   * 获取提供商的可用模型列表 - 从真实API获取
   */
  async getAvailableModels(config: ModelConfigEntity): Promise<string[]> {
    if (!config.baseURL || !config.apiKey) {
      log.warn(`⚠️ [模型列表] 配置不完整: baseURL=${!!config.baseURL}, apiKey=${!!config.apiKey}`);
      return [];
    }
    
    try {
      log.info(`🌐 [模型列表] 从API获取模型: ${config.baseURL}`);
      
      // 构造 /models 端点URL
      const baseURL = config.baseURL.replace(/\/+$/, ''); // 移除末尾斜杠
      const modelsURL = `${baseURL}/models`;
      
      const response = await fetch(modelsURL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          // OpenAI格式的响应：{ data: [{id: "model-name"}, ...] }
          const models = data.data
            .map((model: any) => model.id)
            .filter((id: string) => id && typeof id === 'string')
            .sort(); // 按字母排序
          
          log.info(`✅ [模型列表] 从API获取到 ${models.length} 个模型`);
          return models;
        } else {
          log.warn(`⚠️ [模型列表] API响应格式错误:`, data);
          return [];
        }
      } else {
        const errorText = await response.text();
        log.warn(`⚠️ [模型列表] API请求失败: ${response.status} ${response.statusText}`, errorText);
        return [];
      }
    } catch (error) {
      log.error(`❌ [模型列表] API获取失败:`, error);
      return [];
    }
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.modelCache.clear();
    this.configCache.clear();
    this.sessionContexts.clear();
    // 🎯 清理会话级缓存
    this.sessionModelCache.clear();
    this.sessionToolExecutions.clear();
    log.info('🧹 [缓存] LangChain服务缓存已清理（包括会话级缓存）');
  }

  /**
   * 🎯 新增：清理特定会话的缓存
   */
  clearSessionCache(sessionId: string): void {
    // 查找并删除该会话的所有模型缓存
    const keysToDelete = Array.from(this.sessionModelCache.keys()).filter(key => key.startsWith(sessionId));
    keysToDelete.forEach(key => {
      this.sessionModelCache.delete(key);
    });
    
    // 清理会话工具执行记录
    this.sessionToolExecutions.delete(sessionId);
    
    // 清理会话上下文
    this.sessionContexts.delete(sessionId);
    
    if (keysToDelete.length > 0) {
      log.info(`🧹 [会话缓存] 已清理会话 ${sessionId.slice(0, 8)} 的 ${keysToDelete.length} 个模型实例`);
    }
  }

  /**
   * 🎯 新增：获取会话缓存统计信息
   */
  getSessionCacheStats() {
    const sessionCount = new Set(
      Array.from(this.sessionModelCache.keys()).map(key => key.split('_')[0])
    ).size;
    
    return {
      totalSessionModels: this.sessionModelCache.size,
      activeSessions: sessionCount,
      sessionToolExecutions: this.sessionToolExecutions.size,
      sessionContexts: this.sessionContexts.size
    };
  }

  // ==================== 🧵 线程管理相关方法 ====================

  /**
   * 🧵 估算会话内存使用量
   */
  private estimateMemoryUsage(sessionId: string): number {
    let memoryUsage = 0;

    // 统计模型实例内存（估算每个模型实例约100MB）
    const sessionModels = Array.from(this.sessionModelCache.keys()).filter(key => key.startsWith(sessionId));
    memoryUsage += sessionModels.length * 100;

    // 统计会话上下文内存
    const context = this.sessionContexts.get(sessionId);
    if (context) {
      // 估算上下文对象约1MB
      memoryUsage += 1;
    }

    // 统计工具执行记录内存
    const toolExecutions = this.sessionToolExecutions.get(sessionId);
    if (toolExecutions) {
      // 估算每个工具执行记录约0.1MB
      memoryUsage += toolExecutions.length * 0.1;
    }

    // 估算智能提示词系统的会话数据（约10MB）
    if (this.smartPromptSystem) {
      memoryUsage += 10;
    }

    return Math.round(memoryUsage * 100) / 100; // 保留2位小数
  }

  /**
   * 🧵 获取线程管理器实例
   */
  getThreadManager(): ThreadManager {
    return this.threadManager;
  }

  /**
   * 🧵 获取线程监控器实例
   */
  getThreadMonitor(): ThreadMonitor {
    return this.threadMonitor;
  }

  /**
   * 🧵 获取指定会话的线程信息
   */
  getThreadInfo(sessionId: string) {
    return this.threadManager.getThread(sessionId);
  }

  /**
   * 🧵 获取所有线程的统计信息
   */
  getThreadsOverview() {
    const stats = this.threadManager.getSystemStats();
    const latestMetrics = this.threadMonitor.getLatestMetrics();
    const activeAlerts = this.threadMonitor.getActiveAlerts();

    return {
      systemStats: stats,
      performanceMetrics: latestMetrics,
      alerts: activeAlerts,
      healthStatus: latestMetrics?.healthMetrics.overallHealth || 'unknown'
    };
  }

  /**
   * 🧵 手动清理指定线程
   */
  async cleanupThread(sessionId: string): Promise<void> {
    // 清理会话级缓存
    this.clearSessionCache(sessionId);
    
    // 销毁线程管理器中的线程
    await this.threadManager.destroyThread(sessionId, '手动清理');
    
    log.info(`🧹 [线程清理] 会话 ${sessionId.slice(0, 8)} 已完全清理`);
  }

  /**
   * 🧵 重启指定线程
   */
  async restartThread(sessionId: string): Promise<void> {
    const threadInfo = this.threadManager.getThread(sessionId);
    if (threadInfo) {
      // 保存线程配置
      const { modelId, roleId } = threadInfo;
      
      // 清理并重启
      await this.cleanupThread(sessionId);
      
      // 重新创建线程
      this.threadManager.createThread(sessionId, {
        modelId,
        roleId,
        priority: ThreadPriority.NORMAL
      });
      
      log.info(`🔄 [线程重启] 会话 ${sessionId.slice(0, 8)} 已重启`);
    }
  }

  /**
   * 🧵 暂停指定线程
   */
  pauseThread(sessionId: string): void {
    this.threadManager.pauseThread(sessionId);
  }

  /**
   * 🧵 恢复指定线程
   */
  resumeThread(sessionId: string): void {
    this.threadManager.resumeThread(sessionId);
  }

  /**
   * 🧵 获取线程详细报告
   */
  getThreadReport(sessionId: string): string {
    return this.threadManager.getThreadReport(sessionId);
  }

  /**
   * 🧵 设置线程管理配置
   */
  updateThreadConfig(config: Partial<{
    maxConcurrentThreads: number
    defaultTimeout: number
    maxIdleTime: number
    enableAutoCleanup: boolean
  }>) {
    // 注意：ThreadManager是单例，配置会影响所有实例
    log.info('🔧 [线程配置] 线程管理配置更新请求:', config);
    // 实际配置更新需要重新初始化ThreadManager，这里暂时只记录日志
  }

  /**
   * 🧵 销毁线程管理系统
   */
  async shutdownThreadManager(): Promise<void> {
    if (this.threadMonitor) {
      this.threadMonitor.cleanup();
    }
    
    if (this.threadManager) {
      await this.threadManager.shutdown();
    }
    
    log.info('🔧 [线程管理] 线程管理系统已关闭');
  }

  // ==================== 🔄 AI状态机管理方法 ====================

  /**
   * 🔄 更新AI状态机配置
   */
  updateStateMachineConfig(config: Partial<ConversationLoopConfig>): void {
    this.stateMachineConfig = { ...this.stateMachineConfig, ...config };
    this.stateRouter.updateConfig(this.stateMachineConfig);
    log.info('🔄 [AI状态机] 配置已更新:', this.stateMachineConfig);
  }

  /**
   * 🔄 获取AI状态机配置
   */
  getStateMachineConfig(): ConversationLoopConfig {
    return { ...this.stateMachineConfig };
  }

  /**
   * 🔄 启用/禁用AI状态机功能
   */
  setStateMachineEnabled(enabled: boolean): void {
    this.stateMachineConfig.enableStateMachine = enabled;
    this.stateRouter.updateConfig(this.stateMachineConfig);
    log.info(`🔄 [AI状态机] 功能${enabled ? '启用' : '禁用'}`);
  }

  /**
   * 🔄 获取AI状态机状态
   */
  isStateMachineEnabled(): boolean {
    return this.stateMachineConfig.enableStateMachine;
  }

  /**
   * 🔄 测试AI状态提取功能
   */
  testStateExtraction(response: string): AIStateOutput | null {
    return this.stateRouter.extractAIState(response);
  }

  /**
   * 🔄 获取AI状态机统计信息
   */
  getStateMachineStats() {
    return {
      config: this.stateMachineConfig,
      routerConfig: this.stateRouter.getConfig(),
      isEnabled: this.stateMachineConfig.enableStateMachine
    };
  }
}