/**
 * 🎯 对话线程管理器
 * 
 * 核心功能：
 * 1. 每个会话独立的模型实例和工具调用环境
 * 2. 基于队列的异步消息处理
 * 3. 并发控制和资源管理
 * 4. 会话生命周期管理
 */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ToolMessage } from "@langchain/core/messages";
import { EventEmitter } from 'events';
import log from 'electron-log';
import { LangChainModelFactory } from './LangChainModelFactory';
import { ModelConfigEntity } from '../entities/ModelConfigEntity';
import { LLMResponse } from '../interfaces/IModelProvider';
import { ToolExecution } from '../types';
import { SmartLayeredPromptSystem, ConversationContext, UIInjectionContext } from './SmartLayeredPromptSystem';

// 消息队列接口
export interface QueuedMessage {
  id: string;
  sessionId: string;
  message: string;
  config: ModelConfigEntity;
  activeRole?: string;
  baseSystemPrompt?: string;
  uiContext?: UIInjectionContext;
  chatHistory?: any[];
  onStreamUpdate?: (update: any) => void;
  resolve: (response: LLMResponse) => void;
  reject: (error: Error) => void;
  timestamp: number;
  priority: number; // 优先级，数字越小优先级越高
}

// 会话线程状态
export interface ConversationThread {
  sessionId: string;
  model: BaseChatModel;
  config: ModelConfigEntity;
  messageQueue: QueuedMessage[];
  isProcessing: boolean;
  lastActivity: Date;
  modelCache: Map<string, BaseChatModel>;
  smartPromptSystem: SmartLayeredPromptSystem;
  conversationContext: ConversationContext;
  totalProcessed: number;
  status: 'idle' | 'processing' | 'error' | 'destroyed';
}

export class ConversationThreadManager extends EventEmitter {
  private threads: Map<string, ConversationThread> = new Map();
  // private _globalQueue: QueuedMessage[] = []; // Reserved for future global queue implementation
  private isProcessing = false;
  private maxConcurrentThreads = 5; // 最大并发线程数
  private threadTimeout = 30 * 60 * 1000; // 30分钟线程超时
  private cleanupInterval?: NodeJS.Timeout;
  private mcpService?: any;

  constructor(mcpService?: any) {
    super();
    this.mcpService = mcpService;
    this.startCleanupTask();
    log.info('🎯 [ThreadManager] 对话线程管理器初始化完成');
  }

  /**
   * 发送消息到指定会话（主要入口）
   */
  public async sendMessage(
    sessionId: string,
    message: string,
    config: ModelConfigEntity,
    options: {
      activeRole?: string;
      baseSystemPrompt?: string;
      uiContext?: UIInjectionContext;
      chatHistory?: any[];
      onStreamUpdate?: (update: any) => void;
      priority?: number;
    } = {}
  ): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      const queuedMessage: QueuedMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        message,
        config,
        activeRole: options.activeRole,
        baseSystemPrompt: options.baseSystemPrompt,
        uiContext: options.uiContext,
        chatHistory: options.chatHistory,
        onStreamUpdate: options.onStreamUpdate,
        resolve,
        reject,
        timestamp: Date.now(),
        priority: options.priority || 5
      };

      // 获取或创建会话线程
      const thread = this.getOrCreateThread(sessionId, config);
      
      // 将消息添加到会话队列
      thread.messageQueue.push(queuedMessage);
      thread.messageQueue.sort((a, b) => a.priority - b.priority); // 按优先级排序
      
      log.info(`📨 [ThreadManager] 消息已加入队列 - 会话: ${sessionId.slice(0, 8)}, 队列长度: ${thread.messageQueue.length}`);
      
      // 触发处理
      this.processQueues();
    });
  }

  /**
   * 获取或创建会话线程
   */
  private getOrCreateThread(sessionId: string, config: ModelConfigEntity): ConversationThread {
    let thread = this.threads.get(sessionId);
    
    if (!thread) {
      // 创建新线程
      const model = LangChainModelFactory.createChatModel(config);
      
      // 初始化智能分层提示词系统
      const llmFactory = async (_modelKey: string) => {
        return LangChainModelFactory.createChatModel(config);
      };
      const smartPromptSystem = new SmartLayeredPromptSystem({}, llmFactory);
      
      // 构建会话上下文
      const conversationContext: ConversationContext = {
        sessionId,
        currentModel: config.model,
        conversationStartTime: new Date(),
        totalRounds: 0
      };

      thread = {
        sessionId,
        model,
        config,
        messageQueue: [],
        isProcessing: false,
        lastActivity: new Date(),
        modelCache: new Map(),
        smartPromptSystem,
        conversationContext,
        totalProcessed: 0,
        status: 'idle'
      };
      
      this.threads.set(sessionId, thread);
      log.info(`🎯 [ThreadManager] 创建新会话线程: ${sessionId.slice(0, 8)}`);
      
      this.emit('thread-created', { sessionId, config: config.name });
    } else {
      // 更新活动时间
      thread.lastActivity = new Date();
    }
    
    return thread;
  }

  /**
   * 处理所有队列（核心调度器）
   */
  private async processQueues(): Promise<void> {
    if (this.isProcessing) {
      return; // 已经在处理中
    }
    
    this.isProcessing = true;
    
    try {
      // 获取所有有消息的空闲线程
      const availableThreads = Array.from(this.threads.values())
        .filter(thread => 
          !thread.isProcessing && 
          thread.messageQueue.length > 0 && 
          thread.status === 'idle'
        )
        .slice(0, this.maxConcurrentThreads); // 限制并发数
      
      if (availableThreads.length === 0) {
        return; // 没有可处理的线程
      }
      
      log.info(`🔄 [ThreadManager] 开始处理 ${availableThreads.length} 个线程的消息队列`);
      
      // 并行处理多个线程
      const processingPromises = availableThreads.map(thread => this.processThreadQueue(thread));
      
      // 等待所有线程处理完成
      await Promise.allSettled(processingPromises);
      
    } finally {
      this.isProcessing = false;
      
      // 检查是否还有待处理的消息
      const hasMoreMessages = Array.from(this.threads.values())
        .some(thread => thread.messageQueue.length > 0 && thread.status === 'idle');
      
      if (hasMoreMessages) {
        // 递归处理剩余消息
        setImmediate(() => this.processQueues());
      }
    }
  }

  /**
   * 处理单个线程的消息队列
   */
  private async processThreadQueue(thread: ConversationThread): Promise<void> {
    if (thread.isProcessing || thread.messageQueue.length === 0) {
      return;
    }
    
    thread.isProcessing = true;
    thread.status = 'processing';
    
    try {
      while (thread.messageQueue.length > 0) {
        const queuedMessage = thread.messageQueue.shift()!;
        
        try {
          log.info(`🚀 [ThreadManager] 处理消息 - 会话: ${thread.sessionId.slice(0, 8)}, 消息ID: ${queuedMessage.id}`);
          
          // 发送流式更新：开始处理
          queuedMessage.onStreamUpdate?.({
            type: 'thinking',
            stage: 'AI正在分析您的问题...',
            metadata: { sessionId: thread.sessionId, messageId: queuedMessage.id }
          });
          
          // 处理单条消息
          const response = await this.processSingleMessage(thread, queuedMessage);
          
          // 更新线程统计
          thread.totalProcessed++;
          thread.lastActivity = new Date();
          
          // 发送成功响应
          queuedMessage.resolve(response);
          
          log.info(`✅ [ThreadManager] 消息处理完成 - 会话: ${thread.sessionId.slice(0, 8)}, 已处理: ${thread.totalProcessed}`);
          
        } catch (error) {
          log.error(`❌ [ThreadManager] 消息处理失败 - 会话: ${thread.sessionId.slice(0, 8)}`, error);
          queuedMessage.reject(error instanceof Error ? error : new Error(String(error)));
        }
      }
    } finally {
      thread.isProcessing = false;
      thread.status = 'idle';
    }
  }

  /**
   * 处理单条消息（核心逻辑）
   */
  private async processSingleMessage(
    thread: ConversationThread, 
    queuedMessage: QueuedMessage
  ): Promise<LLMResponse> {
    const { message, config, baseSystemPrompt, uiContext, onStreamUpdate } = queuedMessage;
    
    // 🔥 关键：每个线程使用独立的模型实例和工具绑定
    let model = thread.model;
    
    // 如果启用了MCP工具，为这个线程创建独立的工具绑定模型
    if (this.mcpService) {
      const mcpTools = await this.mcpService.getAllTools();
      if (mcpTools.length > 0) {
        // 为当前线程创建带工具的独立模型实例
        const baseModel = LangChainModelFactory.createChatModel(config);
        model = this.bindMCPTools(baseModel, mcpTools);
        
        log.info(`🔧 [ThreadManager] 为线程 ${thread.sessionId.slice(0, 8)} 绑定了 ${mcpTools.length} 个工具`);
      }
    }
    
    // 使用智能分层系统构建消息
    const promptResponse = await thread.smartPromptSystem.buildMessages(
      message,
      thread.conversationContext,
      baseSystemPrompt || '',
      this.mcpService ? await this.mcpService.getAllTools() : [],
      uiContext || {}
    );
    
    log.info(`📝 [ThreadManager] 提示词构建完成 - tokens: ${promptResponse.totalTokens}`);
    
    // 🔥 独立的工具调用循环 - 每个线程互不干扰
    let messages = [...promptResponse.messages];
    let currentResponse = await model.invoke(messages);
    let finalAIResponse = currentResponse.content as string;
    let toolExecutions: ToolExecution[] = [];
    
    // 工具调用循环
    let iteration = 0;
    const maxIterations = 10;
    
    while (currentResponse.tool_calls && currentResponse.tool_calls.length > 0 && iteration < maxIterations) {
      iteration++;
      
      log.info(`🔧 [ThreadManager] 线程 ${thread.sessionId.slice(0, 8)} 第${iteration}轮工具调用`);
      
      // 流式更新：工具调用中
      onStreamUpdate?.({
        type: 'tool_calling',
        stage: `正在执行工具调用...`,
        currentTool: {
          name: currentResponse.tool_calls[0].name,
          description: `执行 ${currentResponse.tool_calls[0].name}`,
          progress: 50
        }
      });
      
      // 执行工具调用
      const toolResults = await this.executeToolCalls(currentResponse.tool_calls, thread.sessionId);
      toolExecutions.push(...toolResults);
      
      // 构建工具结果消息
      const toolResultMessages = currentResponse.tool_calls.map((toolCall: any, index: number) => new ToolMessage({
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResults[index]?.result || 'Tool execution failed')
      }));
      
      // 继续对话
      messages.push(currentResponse);
      messages.push(...toolResultMessages);
      
      currentResponse = await model.invoke(messages);
      finalAIResponse = currentResponse.content as string;
    }
    
    // 保存AI响应到智能系统
    thread.smartPromptSystem.addAIResponse(thread.sessionId, message, finalAIResponse);
    
    // 发送最终完成通知
    onStreamUpdate?.({
      type: 'complete',
      stage: '回复生成完成',
      partialContent: finalAIResponse,
      toolResults: toolExecutions
    });
    
    // 构造响应
    return {
      content: finalAIResponse,
      model: config.model,
      toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
      usage: currentResponse.usage_metadata ? {
        prompt_tokens: currentResponse.usage_metadata.input_tokens || 0,
        completion_tokens: currentResponse.usage_metadata.output_tokens || 0,
        total_tokens: currentResponse.usage_metadata.total_tokens || 0
      } : undefined,
      finishReason: currentResponse.response_metadata?.finish_reason
    };
  }

  /**
   * 执行工具调用
   */
  private async executeToolCalls(toolCalls: any[], sessionId: string): Promise<ToolExecution[]> {
    const results: ToolExecution[] = [];
    
    for (const toolCall of toolCalls) {
      const startTime = Date.now();
      
      try {
        console.log('🔧 [ConversationThread] LangChain工具调用请求:', {
          toolName: toolCall.name,
          toolId: toolCall.id,
          args: toolCall.args,
          argsType: typeof toolCall.args,
          argsKeys: Object.keys(toolCall.args || {}),
          argsJSON: JSON.stringify(toolCall.args, null, 2)
        });
        
        const mcpResponse = await this.mcpService?.callTool({
          serverId: 'promptx-builtin',
          toolName: toolCall.name,
          arguments: toolCall.args
        });
        
        const execution: ToolExecution = {
          id: toolCall.id || `tool_${Date.now()}`,
          toolName: toolCall.name,
          serverId: 'langchain',
          serverName: 'LangChain',
          params: toolCall.args,
          result: mcpResponse?.success ? mcpResponse.result : (mcpResponse?.error || 'Tool execution failed'),
          success: mcpResponse?.success || false,
          duration: Date.now() - startTime,
          timestamp: Date.now()
        };
        
        results.push(execution);
        
        log.info(`✅ [ThreadManager] 工具执行成功 - 会话: ${sessionId.slice(0, 8)}, 工具: ${toolCall.name}`);
        
      } catch (error) {
        const execution: ToolExecution = {
          id: toolCall.id || `tool_${Date.now()}`,
          toolName: toolCall.name,
          serverId: 'langchain',
          serverName: 'LangChain',
          params: toolCall.args,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          timestamp: Date.now()
        };
        
        results.push(execution);
        log.error(`❌ [ThreadManager] 工具执行失败 - 会话: ${sessionId.slice(0, 8)}, 工具: ${toolCall.name}`, error);
      }
    }
    
    return results;
  }

  /**
   * 绑定MCP工具到模型
   */
  private bindMCPTools(model: BaseChatModel, mcpTools: any[]): BaseChatModel {
    if (typeof model.bindTools !== 'function') {
      log.warn(`⚠️ [ThreadManager] 模型不支持工具绑定: ${model.constructor.name}`);
      return model;
    }
    
    // 转换MCP工具为LangChain格式
    const { tool } = require("@langchain/core/tools");
    // const { z } = require("zod"); // Unused for now
    
    const langchainTools = mcpTools.map((mcpTool: any) => 
      tool(
        async (args: any) => {
          try {
            const response = await this.mcpService?.callTool({
              serverId: mcpTool.serverId,
              toolName: mcpTool.name,
              arguments: args
            });
            
            return response?.success ? 
              (typeof response.result === 'string' ? response.result : JSON.stringify(response.result)) :
              `Tool execution failed: ${response?.error}`;
              
          } catch (error) {
            return `Tool execution error: ${error instanceof Error ? error.message : String(error)}`;
          }
        },
        {
          name: `${mcpTool.serverId}__${mcpTool.name}`, // 🚨 使用带server前缀的工具名称
          description: mcpTool.description || `MCP工具: ${mcpTool.name} (from ${mcpTool.serverId})`,
          schema: this.convertMCPSchemaToZod(mcpTool.inputSchema)
        }
      )
    );
    
    return model.bindTools(langchainTools) as BaseChatModel;
  }

  /**
   * 转换MCP schema到Zod格式
   */
  private convertMCPSchemaToZod(inputSchema: any): any {
    const { z } = require("zod");
    
    if (!inputSchema || !inputSchema.properties) {
      return z.object({}).passthrough();
    }
    
    const zodFields: Record<string, any> = {};
    const required = inputSchema.required || [];
    
    for (const [key, propSchema] of Object.entries(inputSchema.properties as Record<string, any>)) {
      let zodType: any;
      
      switch (propSchema.type) {
        case 'string': zodType = z.string(); break;
        case 'number':
        case 'integer': zodType = z.number(); break;
        case 'boolean': zodType = z.boolean(); break;
        case 'array': zodType = z.array(z.unknown()); break;
        case 'object': zodType = z.object({}).passthrough(); break;
        default: zodType = z.unknown(); break;
      }
      
      if (propSchema.description) {
        zodType = zodType.describe(propSchema.description);
      }
      
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }
      
      zodFields[key] = zodType;
    }
    
    return z.object(zodFields);
  }

  /**
   * 获取会话状态
   */
  public getThreadStatus(sessionId: string): ConversationThread | null {
    return this.threads.get(sessionId) || null;
  }

  /**
   * 获取所有线程状态
   */
  public getAllThreads(): ConversationThread[] {
    return Array.from(this.threads.values());
  }

  /**
   * 销毁会话线程
   */
  public destroyThread(sessionId: string): boolean {
    const thread = this.threads.get(sessionId);
    if (!thread) {
      return false;
    }
    
    // 拒绝所有未处理的消息
    thread.messageQueue.forEach(msg => {
      msg.reject(new Error('会话线程已销毁'));
    });
    
    thread.status = 'destroyed';
    thread.messageQueue = [];
    this.threads.delete(sessionId);
    
    log.info(`🗑️ [ThreadManager] 已销毁会话线程: ${sessionId.slice(0, 8)}`);
    this.emit('thread-destroyed', { sessionId });
    
    return true;
  }

  /**
   * 清理过期线程
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredThreads();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  /**
   * 清理过期线程
   */
  private cleanupExpiredThreads(): void {
    const now = new Date();
    const expiredThreads: string[] = [];
    
    for (const [sessionId, thread] of this.threads.entries()) {
      const idleTime = now.getTime() - thread.lastActivity.getTime();
      
      if (idleTime > this.threadTimeout && !thread.isProcessing && thread.messageQueue.length === 0) {
        expiredThreads.push(sessionId);
      }
    }
    
    expiredThreads.forEach(sessionId => {
      this.destroyThread(sessionId);
    });
    
    if (expiredThreads.length > 0) {
      log.info(`🧹 [ThreadManager] 清理了 ${expiredThreads.length} 个过期线程`);
    }
  }

  /**
   * 关闭管理器
   */
  public async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 等待所有正在处理的线程完成
    const processingThreads = Array.from(this.threads.values()).filter(t => t.isProcessing);
    if (processingThreads.length > 0) {
      log.info(`⏳ [ThreadManager] 等待 ${processingThreads.length} 个线程处理完成...`);
      
      // 最多等待10秒
      const timeout = new Promise(resolve => setTimeout(resolve, 10000));
      const completion = Promise.all(
        processingThreads.map(thread => 
          new Promise<void>(resolve => {
            const checkInterval = setInterval(() => {
              if (!thread.isProcessing) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          })
        )
      );
      
      await Promise.race([completion, timeout]);
    }
    
    // 销毁所有线程
    const sessionIds = Array.from(this.threads.keys());
    sessionIds.forEach(sessionId => this.destroyThread(sessionId));
    
    log.info('✅ [ThreadManager] 对话线程管理器已关闭');
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    const threads = Array.from(this.threads.values());
    const totalMessages = threads.reduce((sum, thread) => sum + thread.totalProcessed, 0);
    const activeThreads = threads.filter(thread => thread.status === 'processing').length;
    const queuedMessages = threads.reduce((sum, thread) => sum + thread.messageQueue.length, 0);
    
    return {
      totalThreads: threads.length,
      activeThreads,
      idleThreads: threads.filter(thread => thread.status === 'idle').length,
      queuedMessages,
      totalProcessedMessages: totalMessages,
      averageProcessedPerThread: threads.length > 0 ? totalMessages / threads.length : 0
    };
  }
}