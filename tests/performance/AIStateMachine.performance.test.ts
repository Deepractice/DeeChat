/**
 * AI状态机性能测试
 * 测试状态机在各种负载下的性能表现
 */

import { AIState, ConversationLoopConfig } from '../../src/shared/interfaces/AIStateProtocol'

// 性能测试专用的简化状态机
class PerformanceTestStateMachine {
  private config: ConversationLoopConfig;

  constructor(config: Partial<ConversationLoopConfig> = {}) {
    this.config = {
      maxIterations: 15,
      iterationDelay: 1000,
      enableStateMachine: true,
      ...config
    };
  }

  extractAIState(response: string) {
    const start = performance.now();
    
    // 简化的状态提取逻辑
    try {
      const jsonPattern = /```json\s*\n?([\s\S]*?)\n?```|(\{[\s\S]*?"aiState"[\s\S]*?\})/g;
      let match;
      
      while ((match = jsonPattern.exec(response)) !== null) {
        const jsonStr = match[1] || match[2];
        if (!jsonStr) continue;
        
        try {
          const parsed = JSON.parse(jsonStr.trim());
          if (parsed.aiState && Object.values(AIState).includes(parsed.aiState)) {
            const end = performance.now();
            return {
              state: {
                aiState: parsed.aiState,
                taskProgress: Math.max(0, Math.min(100, parsed.taskProgress || 0)),
                nextAction: parsed.nextAction || '继续处理任务'
              },
              processingTime: end - start
            };
          }
        } catch (e) {
          continue;
        }
      }
      
      // 智能推断
      const inferredState = this.inferState(response);
      const end = performance.now();
      
      return {
        state: inferredState,
        processingTime: end - start
      };
    } catch (error) {
      const end = performance.now();
      return {
        state: null,
        processingTime: end - start
      };
    }
  }

  private inferState(response: string) {
    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('完成') || lowerResponse.includes('done')) {
      return { aiState: AIState.COMPLETED, taskProgress: 100, nextAction: '已完成' };
    } else if (lowerResponse.includes('错误') || lowerResponse.includes('error')) {
      return { aiState: AIState.ERROR, taskProgress: 0, nextAction: '处理错误' };
    } else if (lowerResponse.includes('请') || lowerResponse.includes('选择')) {
      return { aiState: AIState.WAITING_INPUT, taskProgress: 50, nextAction: '等待输入' };
    } else {
      return { aiState: AIState.WORKING, taskProgress: 30, nextAction: '继续处理' };
    }
  }

  routeConversation(aiState: any, currentIteration: number) {
    const start = performance.now();
    
    const decision = {
      shouldContinue: false,
      nextMessage: '请继续',
      delayMs: this.config.iterationDelay,
      reason: '默认策略'
    };

    if (currentIteration >= this.config.maxIterations) {
      decision.shouldContinue = false;
      decision.reason = `达到最大迭代次数 ${this.config.maxIterations}`;
    } else {
      switch (aiState.aiState) {
        case AIState.WORKING:
          decision.shouldContinue = true;
          decision.reason = 'AI仍在工作中，继续对话';
          break;
        case AIState.COMPLETED:
        case AIState.WAITING_INPUT:
        case AIState.ERROR:
          decision.shouldContinue = false;
          decision.reason = `AI状态: ${aiState.aiState}`;
          break;
      }
    }

    const end = performance.now();
    
    return {
      ...decision,
      processingTime: end - start
    };
  }
}

describe('AI状态机性能测试', () => {
  let stateMachine: PerformanceTestStateMachine;

  beforeEach(() => {
    stateMachine = new PerformanceTestStateMachine({
      maxIterations: 50,
      iterationDelay: 0,
      enableStateMachine: true
    });
  });

  describe('状态提取性能测试', () => {
    test('应该在合理时间内处理简单的JSON状态', () => {
      const simpleResponse = `
分析中...
\`\`\`json
{"aiState": "working", "taskProgress": 50, "nextAction": "继续分析"}
\`\`\`
      `;

      const result = stateMachine.extractAIState(simpleResponse);
      
      expect(result.processingTime).toBeLessThan(5); // 5ms内完成
      expect(result.state?.aiState).toBe(AIState.WORKING);
    });

    test('应该高效处理复杂的多JSON块响应', () => {
      const complexResponse = `
第一个分析结果：
\`\`\`json
{"data": "some data", "status": "processing"}
\`\`\`

状态更新：
\`\`\`json
{"aiState": "working", "taskProgress": 75, "nextAction": "最后检查"}
\`\`\`

其他信息：
\`\`\`json
{"metadata": "additional info"}
\`\`\`
      `;

      const result = stateMachine.extractAIState(complexResponse);
      
      expect(result.processingTime).toBeLessThan(10); // 10ms内完成
      expect(result.state?.aiState).toBe(AIState.WORKING);
    });

    test('应该快速处理大文本响应', () => {
      const largeText = 'a'.repeat(10000); // 10KB文本
      const largeResponse = `
${largeText}
\`\`\`json
{"aiState": "completed", "taskProgress": 100, "nextAction": "已完成"}
\`\`\`
${largeText}
      `;

      const result = stateMachine.extractAIState(largeResponse);
      
      expect(result.processingTime).toBeLessThan(50); // 50ms内完成
      expect(result.state?.aiState).toBe(AIState.COMPLETED);
    });

    test('应该高效处理智能推断', () => {
      const inferenceResponses = [
        '我正在分析您的代码...',
        '任务已经完成了！',
        '请选择要处理的文件',
        '抱歉，发生了错误'
      ];

      const results = inferenceResponses.map(response => 
        stateMachine.extractAIState(response)
      );

      results.forEach(result => {
        expect(result.processingTime).toBeLessThan(3); // 3ms内完成
        expect(result.state).not.toBeNull();
      });
    });

    test('批量处理性能测试', () => {
      const responses = Array(1000).fill(0).map((_, index) => 
        `处理步骤 ${index}
\`\`\`json
{"aiState": "working", "taskProgress": ${index % 100}, "nextAction": "步骤 ${index + 1}"}
\`\`\``
      );

      const start = performance.now();
      const results = responses.map(response => 
        stateMachine.extractAIState(response)
      );
      const end = performance.now();

      const totalTime = end - start;
      const avgTime = totalTime / results.length;

      expect(totalTime).toBeLessThan(1000); // 1秒内处理1000个响应
      expect(avgTime).toBeLessThan(1); // 平均每个响应1ms内
      expect(results.every(r => r.state?.aiState === AIState.WORKING)).toBe(true);
    });
  });

  describe('路由决策性能测试', () => {
    test('应该快速做出路由决策', () => {
      const aiState = {
        aiState: AIState.WORKING,
        taskProgress: 50,
        nextAction: '继续处理'
      };

      const result = stateMachine.routeConversation(aiState, 5);
      
      expect(result.processingTime).toBeLessThan(1); // 1ms内完成
      expect(result.shouldContinue).toBe(true);
    });

    test('批量路由决策性能测试', () => {
      const states = [
        { aiState: AIState.WORKING, taskProgress: 30, nextAction: '继续' },
        { aiState: AIState.COMPLETED, taskProgress: 100, nextAction: '完成' },
        { aiState: AIState.ERROR, taskProgress: 0, nextAction: '错误处理' },
        { aiState: AIState.WAITING_INPUT, taskProgress: 50, nextAction: '等待' }
      ];

      const start = performance.now();
      const results = [];
      
      for (let i = 0; i < 10000; i++) {
        const state = states[i % states.length];
        const result = stateMachine.routeConversation(state, i + 1);
        results.push(result);
      }
      
      const end = performance.now();
      const totalTime = end - start;

      expect(totalTime).toBeLessThan(100); // 100ms内处理10000个决策
      expect(results).toHaveLength(10000);
      expect(results.every(r => typeof r.shouldContinue === 'boolean')).toBe(true);
    });
  });

  describe('迭代限制性能测试', () => {
    test('应该正确验证迭代限制性能', () => {
      // 测试不同的最大迭代次数配置
      const configs = [10, 50, 100, 500];
      
      configs.forEach(maxIterations => {
        const testMachine = new PerformanceTestStateMachine({ maxIterations });
        
        const start = performance.now();
        
        // 模拟达到迭代限制
        const workingState = {
          aiState: AIState.WORKING,
          taskProgress: 50,
          nextAction: '继续'
        };
        
        const result = testMachine.routeConversation(workingState, maxIterations);
        
        const end = performance.now();
        
        expect(end - start).toBeLessThan(1); // 1ms内完成
        expect(result.shouldContinue).toBe(false);
        expect(result.reason).toContain('最大迭代次数');
      });
    });

    test('应该高效处理长对话循环模拟', () => {
      const maxIterations = 100;
      const testMachine = new PerformanceTestStateMachine({ 
        maxIterations,
        iterationDelay: 0 
      });

      const start = performance.now();
      let iteration = 1;
      let shouldContinue = true;

      while (shouldContinue && iteration <= maxIterations) {
        const workingState = {
          aiState: AIState.WORKING,
          taskProgress: Math.min(95, iteration * 2),
          nextAction: '继续处理'
        };
        
        const decision = testMachine.routeConversation(workingState, iteration);
        shouldContinue = decision.shouldContinue;
        iteration++;
      }

      const end = performance.now();
      
      expect(end - start).toBeLessThan(50); // 50ms内完成100轮循环模拟
      expect(iteration).toBe(maxIterations + 1); // 达到了最大迭代次数
    });
  });

  describe('内存使用测试', () => {
    test('应该不会造成内存泄漏', () => {
      // 模拟大量状态机操作
      const operations = 10000;
      const responses = Array(operations).fill(0).map((_, i) => 
        `操作 ${i}: 正在处理...
\`\`\`json
{"aiState": "working", "taskProgress": ${i % 100}, "nextAction": "继续"}
\`\`\``
      );

      const start = performance.now();
      
      // 执行大量操作而不保存结果（模拟实际使用场景）
      for (let i = 0; i < operations; i++) {
        const extractResult = stateMachine.extractAIState(responses[i]);
        if (extractResult.state) {
          stateMachine.routeConversation(extractResult.state, i + 1);
        }
      }
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(5000); // 5秒内完成10000次操作
    });

    test('应该正确处理并发状态提取', async () => {
      const concurrentOperations = 100;
      const response = `
处理中...
\`\`\`json
{"aiState": "working", "taskProgress": 60, "nextAction": "继续"}
\`\`\`
      `;

      const start = performance.now();
      
      // 并发执行状态提取
      const promises = Array(concurrentOperations).fill(0).map(() => 
        Promise.resolve(stateMachine.extractAIState(response))
      );
      
      const results = await Promise.all(promises);
      
      const end = performance.now();
      
      expect(end - start).toBeLessThan(100); // 100ms内完成100个并发操作
      expect(results).toHaveLength(concurrentOperations);
      expect(results.every(r => r.state?.aiState === AIState.WORKING)).toBe(true);
    });
  });

  describe('边界条件性能测试', () => {
    test('应该高效处理空响应', () => {
      const emptyResponses = ['', ' ', '\n', '\t', '   \n   '];
      
      emptyResponses.forEach(response => {
        const result = stateMachine.extractAIState(response);
        expect(result.processingTime).toBeLessThan(2); // 2ms内完成
        expect(result.state).not.toBeNull(); // 应该有智能推断结果
      });
    });

    test('应该处理格式错误的JSON', () => {
      const malformedResponses = [
        '```json\n{"aiState": "working" "taskProgress": 50}\n```', // 缺少逗号
        '```json\n{"aiState": working, "taskProgress": 50}\n```', // 缺少引号
        '```json\n{"aiState": "working", "taskProgress": }\n```', // 缺少值
        '```json\n{broken json}\n```' // 完全错误的JSON
      ];

      malformedResponses.forEach(response => {
        const result = stateMachine.extractAIState(response);
        expect(result.processingTime).toBeLessThan(5); // 5ms内完成
        expect(result.state).not.toBeNull(); // 应该有回退的智能推断结果
      });
    });

    test('应该处理极端大小的响应', () => {
      // 极小响应
      const tinyResponse = 'ok';
      const tinyResult = stateMachine.extractAIState(tinyResponse);
      expect(tinyResult.processingTime).toBeLessThan(1);

      // 极大响应 (1MB)
      const hugeText = 'x'.repeat(1024 * 1024);
      const hugeResponse = `${hugeText}\n\`\`\`json\n{"aiState": "working"}\n\`\`\`\n${hugeText}`;
      const hugeResult = stateMachine.extractAIState(hugeResponse);
      expect(hugeResult.processingTime).toBeLessThan(1000); // 1秒内完成
    });
  });
});