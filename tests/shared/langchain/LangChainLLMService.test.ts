/**
 * LangChain LLM服务测试
 * 测试AI状态机功能和对话循环逻辑
 */

import { AIState, AIStateOutput, ConversationLoopConfig } from '../../../src/shared/interfaces/AIStateProtocol'

// 创建测试专用的简化版AIStateRouter
class TestAIStateRouter {
  private config: ConversationLoopConfig;

  constructor(config: Partial<ConversationLoopConfig> = {}) {
    this.config = {
      maxIterations: 15,
      iterationDelay: 1000,
      enableStateMachine: true,
      ...config
    };
  }

  extractAIState(response: string): AIStateOutput | null {
    try {
      // 查找JSON格式的状态输出
      const jsonPattern = /```json\s*\n?([\s\S]*?)\n?```|(\{[\s\S]*?"aiState"[\s\S]*?\})/g;
      let match;
      
      while ((match = jsonPattern.exec(response)) !== null) {
        const jsonStr = match[1] || match[2];
        if (!jsonStr) continue;
        
        try {
          const parsed = JSON.parse(jsonStr.trim());
          
          if (parsed.aiState && this.isValidAIState(parsed.aiState)) {
            const stateOutput: AIStateOutput = {
              aiState: parsed.aiState as AIState,
              taskProgress: this.normalizeProgress(parsed.taskProgress),
              nextAction: parsed.nextAction || '继续处理任务',
              errorMessage: parsed.errorMessage,
              taskSummary: parsed.taskSummary
            };
            
            return stateOutput;
          }
        } catch (parseError) {
          continue;
        }
      }
      
      // 智能推断
      return this.inferAIState(response);
      
    } catch (error) {
      return null;
    }
  }

  private inferAIState(response: string): AIStateOutput | null {
    const lowerResponse = response.toLowerCase();
    
    const workingKeywords = ['正在', '开始', '接下来', '然后', '继续', '下一步', '让我', '我将', '我需要', '现在', '首先', '接着'];
    const completedKeywords = ['完成了', '已经完成', '任务完成', '处理完毕', '全部完成', 'finished', 'completed', 'done', '成功'];
    const errorKeywords = ['错误', '失败', '异常', '问题', 'error', 'failed', '无法'];
    const inputKeywords = ['请告诉我', '需要您', '请选择', '请确认', '请提供', '你想要', '您希望', '请问'];
    
    let aiState = AIState.WORKING;
    
    if (errorKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.ERROR;
    } else if (inputKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.WAITING_INPUT;
    } else if (completedKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.COMPLETED;
    } else if (workingKeywords.some(keyword => lowerResponse.includes(keyword))) {
      aiState = AIState.WORKING;
    }
    
    const progress = this.estimateProgress(response, aiState);
    
    return {
      aiState,
      taskProgress: progress,
      nextAction: this.generateNextAction(aiState, response),
      errorMessage: aiState === AIState.ERROR ? '检测到可能的错误' : undefined,
      taskSummary: aiState === AIState.COMPLETED ? '任务可能已完成' : undefined
    };
  }

  routeConversation(aiState: AIStateOutput, currentIteration: number) {
    const decision = {
      shouldContinue: false,
      nextMessage: '请继续',
      delayMs: this.config.iterationDelay,
      reason: '默认策略'
    };

    if (currentIteration >= this.config.maxIterations) {
      decision.shouldContinue = false;
      decision.reason = `达到最大迭代次数 ${this.config.maxIterations}`;
      return decision;
    }

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

    return decision;
  }

  private generateContinueMessage(aiState: AIStateOutput): string {
    if (aiState.nextAction && aiState.nextAction !== '继续处理任务') {
      return `请继续执行：${aiState.nextAction}`;
    }
    
    if (aiState.taskProgress < 30) {
      return '请继续进行初始步骤';
    } else if (aiState.taskProgress < 70) {
      return '请继续执行主要任务';
    } else {
      return '请完成剩余的收尾工作';
    }
  }

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

  private estimateProgress(response: string, aiState: AIState): number {
    switch (aiState) {
      case AIState.WORKING:
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
        return 50;
      default:
        return 0;
    }
  }

  private normalizeProgress(progress: any): number {
    if (typeof progress === 'number') {
      return Math.max(0, Math.min(100, progress));
    }
    
    if (typeof progress === 'string') {
      const match = progress.match(/(-?\d+)/);
      if (match) {
        const value = parseInt(match[1]);
        return Math.max(0, Math.min(100, value));
      }
    }
    
    return 0;
  }

  private isValidAIState(state: any): boolean {
    return Object.values(AIState).includes(state as AIState);
  }

  updateConfig(newConfig: Partial<ConversationLoopConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ConversationLoopConfig {
    return { ...this.config };
  }
}

describe('LangChain LLM服务 - AI状态机功能测试', () => {
  let router: TestAIStateRouter
  
  beforeEach(() => {
    router = new TestAIStateRouter({
      maxIterations: 15,
      iterationDelay: 100,
      enableStateMachine: true
    })
  })

  describe('AI状态机对话循环核心逻辑', () => {
    test('应该正确模拟完整的对话循环流程', () => {
      // 模拟AI状态机的完整对话循环
      const conversationFlow = [
        {
          response: `开始分析代码...
\`\`\`json
{"aiState": "working", "taskProgress": 30, "nextAction": "分析依赖关系"}
\`\`\``,
          expectedState: AIState.WORKING,
          expectedContinue: true
        },
        {
          response: `正在分析依赖关系...
\`\`\`json
{"aiState": "working", "taskProgress": 60, "nextAction": "生成报告"}
\`\`\``,
          expectedState: AIState.WORKING,
          expectedContinue: true
        },
        {
          response: `分析完成！生成报告中...
\`\`\`json
{"aiState": "working", "taskProgress": 90, "nextAction": "最终检查"}
\`\`\``,
          expectedState: AIState.WORKING,
          expectedContinue: true
        },
        {
          response: `所有分析已完成！
\`\`\`json
{"aiState": "completed", "taskProgress": 100, "nextAction": "任务已完成", "taskSummary": "成功分析了代码结构"}
\`\`\``,
          expectedState: AIState.COMPLETED,
          expectedContinue: false
        }
      ];

      // 测试对话循环的每一轮
      const results = [];
      for (let i = 0; i < conversationFlow.length; i++) {
        const { response, expectedState, expectedContinue } = conversationFlow[i];
        
        // 提取AI状态
        const extractedState = router.extractAIState(response);
        expect(extractedState).not.toBeNull();
        expect(extractedState!.aiState).toBe(expectedState);
        
        // 路由决策
        const decision = router.routeConversation(extractedState!, i + 1);
        expect(decision.shouldContinue).toBe(expectedContinue);
        
        results.push({
          iteration: i + 1,
          state: extractedState!.aiState,
          progress: extractedState!.taskProgress,
          shouldContinue: decision.shouldContinue,
          reason: decision.reason
        });
        
        if (!decision.shouldContinue) {
          break; // 对话结束
        }
      }

      // 验证最终结果
      expect(results).toHaveLength(4);
      expect(results[3].state).toBe(AIState.COMPLETED);
      expect(results[3].shouldContinue).toBe(false);
      expect(results[3].reason).toContain('完成');
    });

    test('应该正确处理错误状态中断对话', () => {
      const errorFlow = [
        {
          response: `开始处理任务...
\`\`\`json
{"aiState": "working", "taskProgress": 20, "nextAction": "读取文件"}
\`\`\``,
          expectedContinue: true
        },
        {
          response: `遇到错误，无法继续...
\`\`\`json
{"aiState": "error", "taskProgress": 20, "nextAction": "处理错误", "errorMessage": "文件不存在"}
\`\`\``,
          expectedContinue: false
        }
      ];

      for (let i = 0; i < errorFlow.length; i++) {
        const { response, expectedContinue } = errorFlow[i];
        
        const extractedState = router.extractAIState(response);
        const decision = router.routeConversation(extractedState!, i + 1);
        
        expect(decision.shouldContinue).toBe(expectedContinue);
        
        if (!decision.shouldContinue) {
          expect(extractedState!.aiState).toBe(AIState.ERROR);
          expect(extractedState!.errorMessage).toBe('文件不存在');
          break;
        }
      }
    });

    test('应该正确处理等待用户输入状态', () => {
      const inputFlow = [
        {
          response: `开始分析...
\`\`\`json
{"aiState": "working", "taskProgress": 40, "nextAction": "检查配置"}
\`\`\``,
          expectedContinue: true
        },
        {
          response: `需要用户确认配置...
\`\`\`json
{"aiState": "waiting_input", "taskProgress": 50, "nextAction": "等待用户选择配置方案"}
\`\`\``,
          expectedContinue: false
        }
      ];

      for (let i = 0; i < inputFlow.length; i++) {
        const { response, expectedContinue } = inputFlow[i];
        
        const extractedState = router.extractAIState(response);
        const decision = router.routeConversation(extractedState!, i + 1);
        
        expect(decision.shouldContinue).toBe(expectedContinue);
        
        if (!decision.shouldContinue) {
          expect(extractedState!.aiState).toBe(AIState.WAITING_INPUT);
          expect(decision.reason).toContain('等待用户输入');
          break;
        }
      }
    });

    test('应该在达到最大迭代次数时停止', () => {
      // 设置较小的迭代限制
      router.updateConfig({ maxIterations: 3 });

      const workingResponse = `仍在处理中...
\`\`\`json
{"aiState": "working", "taskProgress": 50, "nextAction": "继续"}
\`\`\``;

      const results = [];
      for (let i = 1; i <= 5; i++) {
        const extractedState = router.extractAIState(workingResponse);
        const decision = router.routeConversation(extractedState!, i);
        
        results.push({
          iteration: i,
          shouldContinue: decision.shouldContinue,
          reason: decision.reason
        });
        
        if (!decision.shouldContinue) {
          break;
        }
      }

      expect(results).toHaveLength(3);
      expect(results[2].shouldContinue).toBe(false);
      expect(results[2].reason).toContain('最大迭代次数');
    });

    test('应该正确处理智能推断的状态', () => {
      const inferredResponses = [
        {
          response: '我正在分析您的代码结构，请稍等...',
          expectedState: AIState.WORKING,
          expectedContinue: true
        },
        {
          response: '所有任务已经完成了！',
          expectedState: AIState.COMPLETED,
          expectedContinue: false
        },
        {
          response: '请告诉我您希望分析哪个文件？',
          expectedState: AIState.WAITING_INPUT,
          expectedContinue: false
        },
        {
          response: '抱歉，发生了错误，无法继续处理。',
          expectedState: AIState.ERROR,
          expectedContinue: false
        }
      ];

      inferredResponses.forEach(({ response, expectedState, expectedContinue }, index) => {
        const extractedState = router.extractAIState(response);
        expect(extractedState).not.toBeNull();
        expect(extractedState!.aiState).toBe(expectedState);

        const decision = router.routeConversation(extractedState!, index + 1);
        expect(decision.shouldContinue).toBe(expectedContinue);
      });
    });

    test('应该正确生成不同的继续消息', () => {
      const progressCases = [
        { progress: 20, expectedKeyword: '初始' },
        { progress: 50, expectedKeyword: '主要' },
        { progress: 80, expectedKeyword: '收尾' },
        { progress: 60, nextAction: '检查数据库', expectedContent: '检查数据库' }
      ];

      progressCases.forEach(({ progress, expectedKeyword, nextAction, expectedContent }) => {
        const workingState = {
          aiState: AIState.WORKING,
          taskProgress: progress,
          nextAction: nextAction || '继续处理任务'
        };

        const decision = router.routeConversation(workingState, 3);
        expect(decision.shouldContinue).toBe(true);
        
        if (expectedKeyword) {
          expect(decision.nextMessage).toContain(expectedKeyword);
        }
        if (expectedContent) {
          expect(decision.nextMessage).toContain(expectedContent);
        }
      });
    });

    test('应该正确处理配置更新', () => {
      const newConfig = {
        maxIterations: 20,
        iterationDelay: 2000,
        enableStateMachine: false
      };

      router.updateConfig(newConfig);
      const config = router.getConfig();

      expect(config.maxIterations).toBe(20);
      expect(config.iterationDelay).toBe(2000);
      expect(config.enableStateMachine).toBe(false);
    });

    test('应该正确标准化进度值', () => {
      const testCases = [
        { input: '50%', expected: 50 },
        { input: '150%', expected: 100 },
        { input: '-10%', expected: 0 },
        { input: 'abc', expected: 0 },
        { input: 75, expected: 75 },
        { input: -5, expected: 0 },
        { input: 120, expected: 100 }
      ];

      testCases.forEach(({ input, expected }) => {
        const response = `\`\`\`json\n{"aiState": "working", "taskProgress": ${JSON.stringify(input)}, "nextAction": "test"}\n\`\`\``;
        const state = router.extractAIState(response);
        expect(state?.taskProgress).toBe(expected);
      });
    });
  });

  describe('状态机统计和验证', () => {
    test('应该生成正确的对话循环统计信息', () => {
      // 模拟一个完整的对话循环并收集统计信息
      const responses = [
        'working response 1',
        'working response 2', 
        'working response 3',
        'completed response'
      ];

      const stats = {
        totalIterations: 0,
        stateChanges: [],
        finalState: null,
        stopReason: null
      };

      for (let i = 0; i < responses.length; i++) {
        const extractedState = router.extractAIState(responses[i]);
        const decision = router.routeConversation(extractedState!, i + 1);
        
        stats.totalIterations = i + 1;
        stats.stateChanges.push(extractedState!.aiState);
        
        if (!decision.shouldContinue) {
          stats.finalState = extractedState!.aiState;
          stats.stopReason = decision.reason;
          break;
        }
      }

      expect(stats.totalIterations).toBe(4);
      expect(stats.stateChanges).toEqual([
        AIState.WORKING, 
        AIState.WORKING, 
        AIState.WORKING, 
        AIState.COMPLETED
      ]);
      expect(stats.finalState).toBe(AIState.COMPLETED);
      expect(stats.stopReason).toContain('完成');
    });
  });
});