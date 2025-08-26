/**
 * 发送消息用例
 * 🏗️ DDD重构: 协调对话、智能、工具三个领域的完整消息处理流程
 */

import { ConversationService } from '../../domains/conversation/services/ConversationService';
import { SmartLayeredPromptService, ConversationContext, UIInjectionContext } from '../../domains/intelligence/services/SmartLayeredPromptService';
import { RoleActivationService } from '../../domains/intelligence/services/RoleActivationService';
import { ToolExecutionService } from '../../domains/tool/services/ToolExecutionService';
import { SessionId } from '../../domains/conversation/value-objects/SessionId';
import { MessageContent } from '../../domains/conversation/value-objects/MessageContent';
import { PromptContent } from '../../domains/intelligence/value-objects/PromptContent';
import { RoleId } from '../../domains/intelligence/value-objects/RoleId';
import { Message } from '../../domains/conversation/entities/Message';

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  attachments?: any[];
  modelConfig: string;
  activeRole?: string;
  enableMCPTools?: boolean;
  uiContext?: UIInjectionContext;
  maxTokens?: number;
  temperature?: number;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage?: Message;
  success: boolean;
  error?: string;
  metadata: {
    processingTime: number;
    tokenUsage: {
      prompt: number;
      completion: number;
      total: number;
    };
    toolExecutions: number;
    roleActivation: {
      activeRole: string | null;
      isActivated: boolean;
    };
  };
}

/**
 * 发送消息用例 - 协调三大领域的完整工作流
 */
export class SendMessageUseCase {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly smartPromptService: SmartLayeredPromptService,
    private readonly roleActivationService: RoleActivationService,
    private readonly toolExecutionService: ToolExecutionService,
    private readonly llmProvider: any // LLM服务提供者
  ) {}

  /**
   * 执行发送消息用例
   */
  async execute(request: SendMessageRequest): Promise<SendMessageResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 创建会话ID和消息内容
      const sessionId = SessionId.fromString(request.sessionId);
      const messageContent = MessageContent.text(request.content);

      // 2. 发送用户消息到对话领域
      const userMessage = await this.conversationService.sendUserMessage(
        sessionId,
        messageContent,
        {
          attachments: request.attachments,
          metadata: {
            modelConfig: request.modelConfig,
            activeRole: request.activeRole,
            timestamp: new Date().toISOString()
          }
        }
      );

      // 3. 激活智能角色（如果指定）
      let roleActivation = { activeRole: null, isActivated: false };
      
      if (request.activeRole) {
        try {
          const roleId = new RoleId(request.activeRole);
          const activationContext = {
            sessionId: request.sessionId,
            currentModel: request.modelConfig,
            conversationHistory: [],
            uiContext: request.uiContext
          };
          
          const activatedRole = await this.roleActivationService.activateRole(roleId, activationContext);
          roleActivation = {
            activeRole: activatedRole.getDisplayName(),
            isActivated: true
          };
        } catch (error) {
          console.warn('角色激活失败，使用默认处理:', error);
        }
      }

      // 4. 构建智能分层提示词
      const conversationContext: ConversationContext = {
        sessionId: request.sessionId,
        currentModel: request.modelConfig,
        activeRole: request.activeRole,
        chatHistory: await this.getRecentHistory(sessionId),
        maxTokens: request.maxTokens
      };

      // 获取可用工具（如果启用）
      const availableTools = request.enableMCPTools 
        ? await this.getAvailableTools()
        : [];

      const smartPromptResponse = await this.smartPromptService.buildSmartPrompt(
        request.content,
        conversationContext,
        availableTools,
        request.uiContext
      );

      // 5. 调用LLM生成响应
      const llmResponse = await this.generateLLMResponse({
        prompt: smartPromptResponse.finalContent,
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || smartPromptResponse.tokenUsage.getRecommendedMaxOutput(),
        tools: availableTools
      });

      // 6. 处理工具调用（如果有）
      let toolExecutions: any[] = [];
      let finalAssistantContent = llmResponse.content;

      if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
        toolExecutions = await this.executeTools(llmResponse.toolCalls, sessionId);
        
        // 如果有工具执行结果，可能需要再次调用LLM处理结果
        if (toolExecutions.length > 0) {
          const toolResultsContext = this.buildToolResultsContext(toolExecutions);
          const followUpResponse = await this.generateLLMResponse({
            prompt: PromptContent.fromString(`${smartPromptResponse.finalContent.content}\n\n工具执行结果:\n${toolResultsContext}`),
            temperature: request.temperature || 0.7,
            maxTokens: 2000
          });
          
          finalAssistantContent = followUpResponse.content;
        }
      }

      // 7. 保存AI助手消息到对话领域
      const assistantMessage = await this.conversationService.receiveAssistantMessage(
        sessionId,
        MessageContent.text(finalAssistantContent),
        userMessage.id,
        toolExecutions
      );

      // 8. 构建响应
      const processingTime = Date.now() - startTime;
      
      return {
        userMessage,
        assistantMessage,
        success: true,
        metadata: {
          processingTime,
          tokenUsage: {
            prompt: smartPromptResponse.tokenUsage.current,
            completion: llmResponse.tokens || 0,
            total: smartPromptResponse.tokenUsage.current + (llmResponse.tokens || 0)
          },
          toolExecutions: toolExecutions.length,
          roleActivation
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        userMessage: await this.conversationService.sendUserMessage(
          SessionId.fromString(request.sessionId),
          MessageContent.text(request.content)
        ),
        success: false,
        error: errorMessage,
        metadata: {
          processingTime,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          toolExecutions: 0,
          roleActivation: { activeRole: null, isActivated: false }
        }
      };
    }
  }

  /**
   * 获取最近的对话历史
   */
  private async getRecentHistory(sessionId: SessionId, limit: number = 10): Promise<any[]> {
    try {
      const messages = await this.conversationService.getSessionMessages(sessionId, limit);
      return messages.map(msg => ({
        role: msg.role,
        content: msg.content.text,
        timestamp: msg.timestamp.createdAt
      }));
    } catch (error) {
      console.warn('获取对话历史失败:', error);
      return [];
    }
  }

  /**
   * 获取可用工具列表
   */
  private async getAvailableTools(): Promise<any[]> {
    // TODO: 从Tool领域获取可用工具
    // 这里需要集成ToolDiscoveryService
    return [];
  }

  /**
   * 生成LLM响应
   */
  private async generateLLMResponse(options: {
    prompt: PromptContent;
    temperature: number;
    maxTokens: number;
    tools?: any[];
  }): Promise<{ content: string; tokens?: number; toolCalls?: any[] }> {
    // TODO: 集成实际的LLM提供者
    // 这里是简化实现，实际应该调用LangChain或其他LLM服务
    
    try {
      const response = await this.llmProvider.generateResponse({
        prompt: options.prompt.content,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools
      });
      
      return {
        content: response.content,
        tokens: response.tokens,
        toolCalls: response.toolCalls
      };
    } catch (error) {
      throw new Error(`LLM调用失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行工具调用
   */
  private async executeTools(toolCalls: any[], sessionId: SessionId): Promise<any[]> {
    const results: any[] = [];
    
    for (const toolCall of toolCalls) {
      try {
        // TODO: 使用ToolExecutionService执行工具
        // const result = await this.toolExecutionService.executeTool(
        //   toolCall.toolId,
        //   toolCall.args,
        //   sessionId.value
        // );
        // results.push(result);
        
        // 暂时返回模拟结果
        results.push({
          toolName: toolCall.name,
          success: true,
          result: '工具执行结果'
        });
      } catch (error) {
        results.push({
          toolName: toolCall.name,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return results;
  }

  /**
   * 构建工具结果上下文
   */
  private buildToolResultsContext(toolExecutions: any[]): string {
    return toolExecutions
      .map(execution => {
        if (execution.success) {
          return `${execution.toolName}: ${execution.result}`;
        } else {
          return `${execution.toolName}: 执行失败 - ${execution.error}`;
        }
      })
      .join('\n');
  }
}