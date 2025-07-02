# 任务20: 核心工作流集成

**目标(O)**:
- **功能目标**:
  - 整合1x系列的所有核心服务为完整的业务工作流
  - 实现语音→转录→优化→复制的端到端状态机
  - 提供工作流执行的统一控制和监控接口

- **执行任务**:
  - 创建文件:
    - `renderer/managers/workflowManager.js` - 工作流管理器
    - `renderer/core/stateManager.js` - 状态管理器
  - 实现功能:
    - 设计并实现工作流状态机
    - 协调各个1x服务的调用时序
    - 处理服务间的数据传递和转换
    - 提供工作流进度和状态监控

- **任务边界**:
  - 专注于业务流程协调，不处理具体的错误恢复
  - 不包含性能优化逻辑，仅关注流程正确性
  - 使用现有1x服务接口，不修改服务内部实现

**环境(E)**:
- **参考资源**:
  - `tasks/1x-overview.md` - 了解各服务的接口规范
  - `docs/USER_JOURNEY.md` - 核心用户流程设计
  - `docs/ARCHITECTURE.md` - 系统架构中的数据流设计

- **上下文信息**:
  - 依赖服务：window.speechService, window.aiService, window.clipboardService, window.uiController
  - 并行开发：可与任务21、22同时进行
  - 目标场景：演示环境下的流畅体验
  - 性能要求：完整流程用时<30秒

- **规范索引**:
  - 遵循JavaScript ES6+语法规范
  - 使用Promise/async-await处理异步流程
  - 采用观察者模式进行事件通知

- **注意事项**:
  - 必须处理异步操作的时序问题
  - 需要考虑用户中断工作流的情况
  - 状态切换必须原子化，避免中间状态
  - 所有服务调用都要有超时处理

**实现指导(I)**:
- **状态机设计**:
  ```javascript
  const WorkflowStates = {
    IDLE: 'idle',              // 空闲状态
    RECORDING: 'recording',     // 录音中
    TRANSCRIBING: 'transcribing', // 转录中
    OPTIMIZING: 'optimizing',   // AI优化中
    COPYING: 'copying',         // 复制中
    COMPLETED: 'completed',     // 完成
    ERROR: 'error'             // 错误状态
  };
  ```

- **工作流步骤**:
  ```javascript
  const workflowSteps = [
    { name: '启动录音', service: 'speechService', method: 'startRecording' },
    { name: '等待转录', trigger: 'onSpeechResult' },
    { name: 'AI优化', service: 'aiService', method: 'optimizeText' },
    { name: '复制文本', service: 'clipboardService', method: 'copyText' },
    { name: '完成反馈', service: 'uiController', method: 'showSuccess' }
  ];
  ```

- **工作流状态机设计**:
  ```mermaid
  stateDiagram-v2
    [*] --> IDLE
    IDLE --> RECORDING : startWorkflow()
    RECORDING --> OPTIMIZING : speechResult
    OPTIMIZING --> COPYING : aiComplete
    COPYING --> COMPLETED : copySuccess
    COMPLETED --> IDLE : reset()
    
    RECORDING --> ERROR : speechError
    OPTIMIZING --> ERROR : aiError
    COPYING --> ERROR : copyError
    ERROR --> IDLE : reset()
  ```

- **核心类设计思路**:
  ```javascript
  class WorkflowManager {
    // 状态管理
    currentState = 'idle'
    currentData = {}
    listeners = []
    
    // 核心方法设计思路
    async startWorkflow() {
      // 1. 检查当前状态是否允许启动
      // 2. 设置初始状态和数据
      // 3. 启动第一步：录音阶段
    }
    
    async executeStep(targetState) {
      // 状态机核心：根据目标状态执行对应逻辑
      // switch case 处理各个状态的具体操作
    }
    
    // 各阶段处理方法
    handleRecording() { /* 语音识别逻辑 */ }
    handleOptimizing() { /* AI优化逻辑 */ }
    handleCopying() { /* 剪贴板操作逻辑 */ }
    handleCompleted() { /* 完成处理逻辑 */ }
  }
  ```
  ```

- **实现策略**:
  1. 先实现基础的状态机和状态切换逻辑
  2. 实现各个工作流步骤的具体处理方法
  3. 添加事件监听和通知机制
  4. 实现错误处理和超时机制
  5. 测试完整的端到端工作流
  6. 优化状态切换的流畅性

- **调试指南**:
  - 添加详细的状态切换日志
  - 监控每个步骤的执行时间
  - 记录服务调用的参数和返回值
  - 追踪异步操作的执行顺序

**成功标准(S)**:
- **基础达标**:
  - WorkflowManager成功实例化并暴露到window对象
  - startWorkflow()能正常启动完整的工作流程
  - 语音→AI优化→复制的流程能正常执行
  - 状态切换正确，事件通知机制工作正常

- **预期品质**:
  - 完整工作流程执行时间<30秒
  - 状态管理稳定，无状态泄漏或不一致
  - 异步操作时序正确，无竞态条件
  - 提供丰富的事件和状态信息供UI使用

- **卓越表现**:
  - 支持工作流中断和恢复
  - 智能的错误恢复和重试机制
  - 工作流执行性能统计和优化建议
  - 支持工作流的暂停和步进调试 