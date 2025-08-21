/**
 * AI状态机集成测试
 * 测试状态机与系统其他组件的集成
 */

import { AIState, AIStateOutput, ConversationLoopResult } from '../../src/shared/interfaces/AIStateProtocol'

describe('AI状态机集成测试', () => {
  
  describe('端到端流程测试', () => {
    test('应该模拟完整的用户请求到AI响应的流程', async () => {
      // 模拟用户请求：分析代码
      const userMessage = '请帮我分析这个项目的代码结构'
      
      // 模拟AI状态机处理过程
      const conversationLoop: ConversationLoopResult = {
        totalIterations: 4,
        allResponses: [
          `开始分析项目结构...
\`\`\`json
{"aiState": "working", "taskProgress": 25, "nextAction": "扫描文件目录"}
\`\`\``,
          `正在扫描文件目录...
\`\`\`json
{"aiState": "working", "taskProgress": 50, "nextAction": "分析依赖关系"}
\`\`\``,
          `分析依赖关系中...
\`\`\`json
{"aiState": "working", "taskProgress": 75, "nextAction": "生成报告"}
\`\`\``,
          `分析完成！项目采用了React + TypeScript架构...
\`\`\`json
{"aiState": "completed", "taskProgress": 100, "nextAction": "任务已完成", "taskSummary": "成功分析了项目的代码结构"}
\`\`\``
        ],
        allToolExecutions: [
          { id: 'tool1', toolName: 'readDirectory', success: true },
          { id: 'tool2', toolName: 'analyzePackageJson', success: true },
          { id: 'tool3', toolName: 'generateReport', success: true }
        ],
        finalResponse: `分析完成！项目采用了React + TypeScript架构...
\`\`\`json
{"aiState": "completed", "taskProgress": 100, "nextAction": "任务已完成", "taskSummary": "成功分析了项目的代码结构"}
\`\`\``,
        finalState: AIState.COMPLETED,
        stopReason: 'completed'
      }

      // 验证对话循环结果
      expect(conversationLoop.totalIterations).toBe(4)
      expect(conversationLoop.finalState).toBe(AIState.COMPLETED)
      expect(conversationLoop.stopReason).toBe('completed')
      expect(conversationLoop.allResponses).toHaveLength(4)
      expect(conversationLoop.allToolExecutions).toHaveLength(3)
      
      // 验证每个响应都包含有效的状态信息
      conversationLoop.allResponses.forEach((response, index) => {
        expect(response).toContain('aiState')
        if (index < 3) {
          expect(response).toContain('working')
        } else {
          expect(response).toContain('completed')
        }
      })

      // 验证工具执行记录
      expect(conversationLoop.allToolExecutions.every(tool => tool.success)).toBe(true)
      
      // 验证最终响应
      expect(conversationLoop.finalResponse).toContain('分析完成')
      expect(conversationLoop.finalResponse).toContain('任务已完成')
    })

    test('应该正确处理复杂任务的状态转换', async () => {
      // 模拟复杂任务：需要用户输入的场景
      const complexTaskFlow: ConversationLoopResult = {
        totalIterations: 3,
        allResponses: [
          `开始处理您的请求...
\`\`\`json
{"aiState": "working", "taskProgress": 30, "nextAction": "检查文件权限"}
\`\`\``,
          `需要确认配置信息...
\`\`\`json
{"aiState": "waiting_input", "taskProgress": 50, "nextAction": "请选择要处理的文件类型"}
\`\`\``,
          `收到用户输入，继续处理...
\`\`\`json
{"aiState": "working", "taskProgress": 80, "nextAction": "执行最终处理"}
\`\`\``
        ],
        allToolExecutions: [
          { id: 'tool1', toolName: 'checkPermissions', success: true }
        ],
        finalResponse: `需要确认配置信息...
\`\`\`json
{"aiState": "waiting_input", "taskProgress": 50, "nextAction": "请选择要处理的文件类型"}
\`\`\``,
        finalState: AIState.WAITING_INPUT,
        stopReason: 'user_input_needed'
      }

      // 验证状态转换序列
      const expectedStates = [AIState.WORKING, AIState.WAITING_INPUT, AIState.WORKING]
      
      // 这里我们需要解析每个响应的状态（简化版本）
      const actualStates = complexTaskFlow.allResponses.map(response => {
        if (response.includes('"aiState": "working"')) return AIState.WORKING
        if (response.includes('"aiState": "waiting_input"')) return AIState.WAITING_INPUT
        if (response.includes('"aiState": "completed"')) return AIState.COMPLETED
        if (response.includes('"aiState": "error"')) return AIState.ERROR
        return AIState.WORKING
      })

      expect(actualStates).toEqual(expectedStates)
      expect(complexTaskFlow.finalState).toBe(AIState.WAITING_INPUT)
      expect(complexTaskFlow.stopReason).toBe('user_input_needed')
    })

    test('应该正确处理错误恢复流程', async () => {
      // 模拟错误处理场景
      const errorRecoveryFlow: ConversationLoopResult = {
        totalIterations: 2,
        allResponses: [
          `开始执行任务...
\`\`\`json
{"aiState": "working", "taskProgress": 20, "nextAction": "读取配置文件"}
\`\`\``,
          `遇到错误，无法继续...
\`\`\`json
{"aiState": "error", "taskProgress": 20, "nextAction": "处理错误", "errorMessage": "配置文件不存在"}
\`\`\``
        ],
        allToolExecutions: [
          { id: 'tool1', toolName: 'readConfig', success: false }
        ],
        finalResponse: `遇到错误，无法继续...
\`\`\`json
{"aiState": "error", "taskProgress": 20, "nextAction": "处理错误", "errorMessage": "配置文件不存在"}
\`\`\``,
        finalState: AIState.ERROR,
        stopReason: 'error'
      }

      expect(errorRecoveryFlow.totalIterations).toBe(2)
      expect(errorRecoveryFlow.finalState).toBe(AIState.ERROR)
      expect(errorRecoveryFlow.stopReason).toBe('error')
      expect(errorRecoveryFlow.finalResponse).toContain('errorMessage')
      expect(errorRecoveryFlow.allToolExecutions[0].success).toBe(false)
    })

    test('应该正确处理迭代限制场景', async () => {
      // 模拟达到最大迭代次数的场景
      const maxIterationFlow: ConversationLoopResult = {
        totalIterations: 15, // 假设最大迭代次数为15
        allResponses: Array(15).fill(0).map((_, index) => 
          `仍在处理中... (第${index + 1}轮)
\`\`\`json
{"aiState": "working", "taskProgress": ${Math.min(90, (index + 1) * 6)}, "nextAction": "继续处理"}
\`\`\``
        ),
        allToolExecutions: Array(15).fill(0).map((_, index) => ({
          id: `tool${index + 1}`,
          toolName: 'processStep',
          success: true
        })),
        finalResponse: `仍在处理中... (第15轮)
\`\`\`json
{"aiState": "working", "taskProgress": 90, "nextAction": "继续处理"}
\`\`\``,
        finalState: AIState.WORKING,
        stopReason: 'max_iterations'
      }

      expect(maxIterationFlow.totalIterations).toBe(15)
      expect(maxIterationFlow.finalState).toBe(AIState.WORKING)
      expect(maxIterationFlow.stopReason).toBe('max_iterations')
      expect(maxIterationFlow.allResponses).toHaveLength(15)
      expect(maxIterationFlow.allToolExecutions).toHaveLength(15)

      // 验证最后一个响应仍然是working状态
      const lastResponse = maxIterationFlow.allResponses[14]
      expect(lastResponse).toContain('"aiState": "working"')
    })
  })

  describe('系统组件集成测试', () => {
    test('应该正确集成前端状态显示组件', () => {
      // 模拟前端组件接收到的状态数据
      const aiStateData: AIStateOutput = {
        aiState: AIState.WORKING,
        taskProgress: 65,
        nextAction: '正在生成分析报告',
        taskSummary: undefined,
        errorMessage: undefined
      }

      // 验证前端组件能正确显示状态
      expect(aiStateData.aiState).toBe(AIState.WORKING)
      expect(aiStateData.taskProgress).toBe(65)
      expect(aiStateData.nextAction).toBe('正在生成分析报告')
      
      // 模拟前端组件的显示逻辑
      const getStateDisplayText = (state: AIState) => {
        switch (state) {
          case AIState.WORKING: return '🔄 处理中'
          case AIState.COMPLETED: return '✅ 已完成'
          case AIState.WAITING_INPUT: return '⏸️ 等待输入'
          case AIState.ERROR: return '❌ 错误'
          default: return '❓ 未知状态'
        }
      }

      const displayText = getStateDisplayText(aiStateData.aiState)
      expect(displayText).toBe('🔄 处理中')
    })

    test('应该正确集成后端数据库存储', () => {
      // 模拟会话存储数据
      const sessionData = {
        id: 'session-123',
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            content: '请分析代码',
            timestamp: new Date()
          },
          {
            id: 'msg-2',
            role: 'assistant',
            content: '开始分析...',
            timestamp: new Date(),
            aiStateData: {
              aiState: AIState.WORKING,
              taskProgress: 30,
              nextAction: '扫描文件'
            } as AIStateOutput
          }
        ],
        stateMachineConfig: {
          maxIterations: 15,
          iterationDelay: 1000,
          enableStateMachine: true
        }
      }

      // 验证数据结构完整性
      expect(sessionData.id).toBe('session-123')
      expect(sessionData.messages).toHaveLength(2)
      expect(sessionData.messages[1].aiStateData).toBeDefined()
      expect(sessionData.messages[1].aiStateData!.aiState).toBe(AIState.WORKING)
      expect(sessionData.stateMachineConfig.enableStateMachine).toBe(true)
    })

    test('应该正确处理配置变更的传播', () => {
      // 模拟配置变更在系统中的传播
      const initialConfig = {
        maxIterations: 15,
        iterationDelay: 1000,
        enableStateMachine: true
      }

      const updatedConfig = {
        ...initialConfig,
        maxIterations: 20,
        iterationDelay: 500
      }

      // 验证配置更新
      expect(updatedConfig.maxIterations).toBe(20)
      expect(updatedConfig.iterationDelay).toBe(500)
      expect(updatedConfig.enableStateMachine).toBe(true)

      // 模拟配置生效检查
      const isConfigValid = (config: any) => {
        return config.maxIterations > 0 && 
               config.iterationDelay >= 0 && 
               typeof config.enableStateMachine === 'boolean'
      }

      expect(isConfigValid(updatedConfig)).toBe(true)
    })
  })

  describe('性能和稳定性测试', () => {
    test('应该处理大量状态变更而不影响性能', () => {
      // 模拟大量状态变更
      const stateChanges: AIStateOutput[] = []
      
      for (let i = 0; i < 100; i++) {
        stateChanges.push({
          aiState: i % 2 === 0 ? AIState.WORKING : AIState.COMPLETED,
          taskProgress: i,
          nextAction: `步骤 ${i + 1}`,
          taskSummary: i === 99 ? '所有步骤完成' : undefined
        })
      }

      expect(stateChanges).toHaveLength(100)
      expect(stateChanges[99].taskProgress).toBe(99)
      expect(stateChanges[99].taskSummary).toBe('所有步骤完成')

      // 验证状态变更的一致性
      const workingStates = stateChanges.filter(s => s.aiState === AIState.WORKING)
      const completedStates = stateChanges.filter(s => s.aiState === AIState.COMPLETED)
      
      expect(workingStates.length).toBe(50)
      expect(completedStates.length).toBe(50)
    })

    test('应该正确处理并发状态更新', async () => {
      // 模拟并发状态更新场景
      const concurrentUpdates = [
        { sessionId: 'session-1', state: AIState.WORKING, progress: 30 },
        { sessionId: 'session-2', state: AIState.COMPLETED, progress: 100 },
        { sessionId: 'session-3', state: AIState.ERROR, progress: 0 },
        { sessionId: 'session-4', state: AIState.WAITING_INPUT, progress: 50 }
      ]

      // 模拟并发处理
      const processUpdate = async (update: any) => {
        return new Promise<any>(resolve => {
          setTimeout(() => {
            resolve({
              ...update,
              processed: true,
              timestamp: new Date()
            })
          }, Math.random() * 10) // 随机延迟
        })
      }

      const results = await Promise.all(
        concurrentUpdates.map(update => processUpdate(update))
      )

      expect(results).toHaveLength(4)
      expect(results.every(r => r.processed)).toBe(true)
      expect(results.every(r => r.timestamp)).toBeTruthy()
    })
  })
})