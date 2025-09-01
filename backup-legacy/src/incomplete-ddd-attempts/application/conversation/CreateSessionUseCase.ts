/**
 * 创建会话用例
 * 🏗️ DDD重构: 创建新对话会话的应用服务
 */

import { ConversationService } from '../../domains/conversation/services/ConversationService';
import { RoleActivationService } from '../../domains/intelligence/services/RoleActivationService';
import { ChatSession } from '../../domains/conversation/entities/ChatSession';
import { RoleId } from '../../domains/intelligence/value-objects/RoleId';
import { MessageContent } from '../../domains/conversation/value-objects/MessageContent';

export interface CreateSessionRequest {
  title?: string;
  modelConfig: string;
  activeRole?: string;
  isPrivate?: boolean;
  enableAutoSave?: boolean;
  initialMessage?: string;
  userId?: string;
}

export interface CreateSessionResponse {
  session: ChatSession;
  success: boolean;
  error?: string;
  metadata: {
    creationTime: number;
    roleActivation: {
      roleId?: string;
      roleName?: string;
      isActivated: boolean;
    };
    hasInitialMessage: boolean;
  };
}

/**
 * 创建会话用例
 */
export class CreateSessionUseCase {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly roleActivationService: RoleActivationService
  ) {}

  /**
   * 执行创建会话用例
   */
  async execute(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 生成会话标题
      const title = request.title || this.generateSessionTitle(request.activeRole, request.modelConfig);
      
      // 2. 准备会话上下文
      const conversationContext = {
        userId: request.userId,
        modelConfig: request.modelConfig,
        activeRole: request.activeRole,
        enableAutoSave: request.enableAutoSave ?? true
      };

      // 3. 创建会话
      const session = await this.conversationService.createSession(title, conversationContext);
      
      // 4. 配置会话设置
      if (request.isPrivate) {
        session.updateSettings({ isPrivate: true });
      }

      // 5. 角色激活（如果指定）
      let roleActivation = { isActivated: false };
      
      if (request.activeRole) {
        try {
          const roleId = new RoleId(request.activeRole);
          const activationContext = {
            sessionId: session.id.value,
            currentModel: request.modelConfig,
            conversationHistory: [],
            userId: request.userId
          };
          
          const activatedRole = await this.roleActivationService.activateRole(roleId, activationContext);
          roleActivation = {
            roleId: activatedRole.id.value,
            roleName: activatedRole.getDisplayName(),
            isActivated: true
          };
          
          // 更新会话的活跃角色
          session.updateMetadata({ activeRole: request.activeRole });
          
        } catch (error) {
          console.warn('角色激活失败:', error);
          roleActivation = { isActivated: false };
        }
      }

      // 6. 发送初始消息（如果提供）
      let hasInitialMessage = false;
      
      if (request.initialMessage && request.initialMessage.trim()) {
        try {
          const initialContent = MessageContent.text(request.initialMessage);
          await this.conversationService.sendUserMessage(
            session.id,
            initialContent,
            {
              metadata: {
                isInitialMessage: true,
                sessionCreation: true
              }
            }
          );
          hasInitialMessage = true;
        } catch (error) {
          console.warn('发送初始消息失败:', error);
        }
      }

      // 7. 构建响应
      const creationTime = Date.now() - startTime;
      
      return {
        session,
        success: true,
        metadata: {
          creationTime,
          roleActivation,
          hasInitialMessage
        }
      };

    } catch (error) {
      const creationTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        session: {} as ChatSession, // 错误情况下返回空会话
        success: false,
        error: errorMessage,
        metadata: {
          creationTime,
          roleActivation: { isActivated: false },
          hasInitialMessage: false
        }
      };
    }
  }

  /**
   * 生成会话标题
   */
  private generateSessionTitle(activeRole?: string, modelConfig?: string): string {
    const timestamp = new Date().toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (activeRole && activeRole !== 'deechat-assistant') {
      return `${activeRole} 对话 ${timestamp}`;
    }
    
    if (modelConfig) {
      const modelName = this.getModelDisplayName(modelConfig);
      return `${modelName} 对话 ${timestamp}`;
    }
    
    return `新对话 ${timestamp}`;
  }

  /**
   * 获取模型显示名称
   */
  private getModelDisplayName(modelConfig: string): string {
    const modelDisplayNames: Record<string, string> = {
      'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
      'claude-3-5-haiku': 'Claude 3.5 Haiku',
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gemini-pro': 'Gemini Pro',
      'kimi': 'Kimi',
      'moonshot': 'Moonshot'
    };
    
    return modelDisplayNames[modelConfig] || modelConfig;
  }
}