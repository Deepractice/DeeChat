/**
 * AI状态路由器
 * 负责解析AI状态输出和决定对话流程
 */

import log from 'electron-log';
import { 
  AIState, 
  AIStateOutput, 
  StateRoutingDecision, 
  ConversationLoopConfig 
} from '../interfaces/AIStateProtocol';

export class AIStateRouter {
  private config: ConversationLoopConfig;

  constructor(config: Partial<ConversationLoopConfig> = {}) {
    this.config = {
      maxIterations: 15,
      iterationDelay: 1000,
      enableStateMachine: true,
      ...config
    };
  }

  /**
   * 从AI响应中提取状态信息
   * 查找JSON格式的状态输出
   */
  extractAIState(response: string): AIStateOutput | null {
    try {
      // 查找JSON格式的状态输出
      // 匹配模式：```json\n{...}\n``` 或 直接的 {...}
      const jsonPattern = /```json\s*\n?([\s\S]*?)\n?```|(\{[\s\S]*?"aiState"[\s\S]*?\})/g;
      let match;
      
      while ((match = jsonPattern.exec(response)) !== null) {
        const jsonStr = match[1] || match[2];
        if (!jsonStr) continue;
        
        try {
          const parsed = JSON.parse(jsonStr.trim());
          
          // 验证是否包含必需的状态字段
          if (parsed.aiState && this.isValidAIState(parsed.aiState)) {
            const stateOutput: AIStateOutput = {
              aiState: parsed.aiState as AIState,
              taskProgress: this.normalizeProgress(parsed.taskProgress),
              nextAction: parsed.nextAction || '继续处理任务',
              errorMessage: parsed.errorMessage,
              taskSummary: parsed.taskSummary
            };
            
            log.info(`🎯 [状态提取] AI状态: ${stateOutput.aiState}, 进度: ${stateOutput.taskProgress}%, 下一步: ${stateOutput.nextAction}`);
            return stateOutput;
          }
        } catch (parseError) {
          log.debug(`🔍 [状态提取] JSON解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          continue;
        }
      }
      
      // 如果没有找到明确的状态输出，尝试智能推断
      return this.inferAIState(response);
      
    } catch (error) {
      log.error(`❌ [状态提取] 状态提取失败:`, error);
      return null;
    }
  }

  /**
   * 智能推断AI状态（当没有明确状态输出时）
   */
  private inferAIState(response: string): AIStateOutput | null {
    const lowerResponse = response.toLowerCase();
    
    // 检查是否包含继续工作的关键词
    const workingKeywords = [
      '正在', '开始', '接下来', '然后', '继续', '下一步',
      '让我', '我将', '我需要', '现在', '首先', '接着'
    ];
    
    // 检查是否包含完成的关键词
    const completedKeywords = [
      '完成了', '已经完成', '任务完成', '处理完毕', '全部完成',
      'finished', 'completed', 'done', '成功'
    ];
    
    // 检查是否包含错误的关键词
    const errorKeywords = [
      '错误', '失败', '异常', '问题', 'error', 'failed', '无法'
    ];
    
    // 检查是否需要用户输入
    const inputKeywords = [
      '请告诉我', '需要您', '请选择', '请确认', '请提供',
      '你想要', '您希望', '请问'
    ];
    
    let aiState = AIState.WORKING; // 默认状态
    
    if (errorKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.ERROR;
    } else if (inputKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.WAITING_INPUT;
    } else if (completedKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.COMPLETED;
    } else if (workingKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.WORKING;
    }
    
    // 计算简单的进度估算（基于响应长度和关键词）
    const progress = this.estimateProgress(response, aiState);
    
    const inferredState: AIStateOutput = {
      aiState,
      taskProgress: progress,
      nextAction: this.generateNextAction(aiState, response),
      errorMessage: aiState === AIState.ERROR ? '检测到可能的错误' : undefined,
      taskSummary: aiState === AIState.COMPLETED ? '任务可能已完成' : undefined
    };
    
    log.info(`🤖 [状态推断] 推断AI状态: ${inferredState.aiState}, 进度: ${inferredState.taskProgress}%`);
    return inferredState;
  }

  /**
   * 根据AI状态决定路由策略
   */
  routeConversation(
    aiState: AIStateOutput, 
    currentIteration: number
  ): StateRoutingDecision {
    const decision: StateRoutingDecision = {
      shouldContinue: false,
      nextMessage: '请继续',
      delayMs: this.config.iterationDelay,
      reason: '默认策略'
    };

    // 检查是否达到最大迭代次数
    if (currentIteration >= this.config.maxIterations) {
      decision.shouldContinue = false;
      decision.reason = `达到最大迭代次数 ${this.config.maxIterations}`;
      log.warn(`⚠️ [状态路由] ${decision.reason}`);
      return decision;
    }

    // 根据AI状态决定路由
    switch (aiState.aiState) {
      case AIState.WORKING:
        decision.shouldContinue = true;
        decision.nextMessage = this.generateContinueMessage(aiState);
        decision.reason = 'AI仍在工作中，继续对话';
        break;

      case AIState.COMPLETED:
        decision.shouldContinue = false;
        decision.reason = 'AI报告任务已完成';
        break;

      case AIState.WAITING_INPUT:
        decision.shouldContinue = false;
        decision.reason = 'AI等待用户输入';
        break;

      case AIState.ERROR:
        decision.shouldContinue = false;
        decision.reason = 'AI报告发生错误';
        break;

      default:
        decision.shouldContinue = false;
        decision.reason = '未知AI状态';
        break;
    }

    log.info(`🎯 [状态路由] 决策: ${decision.shouldContinue ? '继续' : '停止'}, 原因: ${decision.reason}`);
    return decision;
  }

  /**
   * 生成继续对话的消息
   */
  private generateContinueMessage(aiState: AIStateOutput): string {
    
    // 如果有具体的下一步动作，使用更具体的消息
    if (aiState.nextAction && aiState.nextAction !== '继续处理任务') {
      return `请继续执行：${aiState.nextAction}`;
    }
    
    // 根据进度选择不同的消息
    if (aiState.taskProgress < 30) {
      return '请继续进行初始步骤';
    } else if (aiState.taskProgress < 70) {
      return '请继续执行主要任务';
    } else {
      return '请完成剩余的收尾工作';
    }
  }

  /**
   * 生成下一步动作描述
   */
  private generateNextAction(aiState: AIState, _response: string): string {
    switch (aiState) {
      case AIState.WORKING:
        return '继续分析和处理任务';
      case AIState.COMPLETED:
        return '任务已完成';
      case AIState.WAITING_INPUT:
        return '等待用户输入';
      case AIState.ERROR:
        return '处理错误';
      default:
        return '继续处理任务';
    }
  }

  /**
   * 估算任务进度
   */
  private estimateProgress(response: string, aiState: AIState): number {
    // 简单的进度估算逻辑
    switch (aiState) {
      case AIState.WORKING:
        // 基于响应长度和关键词估算进度
        const length = response.length;
        if (length < 100) return 10;
        if (length < 500) return 30;
        if (length < 1000) return 50;
        return 70;
        
      case AIState.COMPLETED:
        return 100;
        
      case AIState.ERROR:
        return 0;
        
      case AIState.WAITING_INPUT:
        return 50; // 假设需要用户输入时已完成一半
        
      default:
        return 0;
    }
  }

  /**
   * 标准化进度值
   */
  private normalizeProgress(progress: any): number {
    if (typeof progress === 'number') {
      return Math.max(0, Math.min(100, progress));
    }
    
    if (typeof progress === 'string') {
      // 提取数字，包括负号
      const match = progress.match(/(-?\d+)/);
      if (match) {
        const value = parseInt(match[1]);
        return Math.max(0, Math.min(100, value));
      }
    }
    
    return 0;
  }

  /**
   * 验证AI状态值是否有效
   */
  private isValidAIState(state: any): boolean {
    return Object.values(AIState).includes(state as AIState);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ConversationLoopConfig>): void {
    this.config = { ...this.config, ...newConfig };
    log.info(`🔧 [状态路由] 配置已更新:`, this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): ConversationLoopConfig {
    return { ...this.config };
  }
}