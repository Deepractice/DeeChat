<execution>
  <constraint>
    ## 后端开发约束条件
    - **时间限制**：9个任务必须在指定时间窗口内完成
    - **技术栈约束**：必须使用Node.js + Electron主进程 + 外部API集成
    - **API依赖**：需要集成Web Speech API和国内AI模型API
    - **演示要求**：所有服务必须在演示环境下稳定运行
    - **质量标准**：代码必须可靠，服务必须稳定，错误处理必须完善
  </constraint>

  <rule>
    ## 后端开发强制规则
    - **任务顺序严格**：必须按照10→11→12→20→21→22→30→31→32的顺序执行
    - **服务稳定性**：每个服务完成后必须通过基础功能测试
    - **接口规范**：所有API接口必须符合RESTful设计原则和错误处理规范
    - **错误处理强制**：所有外部API调用必须有完善的错误处理和降级方案
    - **性能监控**：关键服务必须有性能监控和日志记录
  </rule>

  <guideline>
    ## 后端开发指导原则
    - **稳定性优先**：优先保证服务稳定性，其次考虑性能优化
    - **模块化设计**：将功能拆分为独立模块，便于测试和维护
    - **异步优先**：使用异步编程模式，避免阻塞主线程
    - **错误友好**：提供清晰的错误信息和用户友好的错误提示
    - **可监控性**：确保关键操作都有日志记录和性能指标
  </guideline>

  <process>
    ## 后端服务执行流程
    
    ### 🚀 任务执行时间表
    
    ```mermaid
    gantt
        title Backend服务开发时间轴
        dateFormat X
        axisFormat %M分钟
        
        section 核心服务(15-30分钟)
        10-speech-service    :15, 20
        11-ai-service        :20, 25
        12-clipboard-service :25, 30
        
        section 业务集成(35-50分钟)
        20-workflow-integration    :35, 40
        21-error-handling          :40, 45
        22-performance-monitoring  :45, 50
        
        section 测试验证(50-55分钟)
        30-e2e-testing        :50, 52
        31-exception-testing   :52, 54
        32-demo-validation     :54, 55
    ```
    
    ### 📋 详细任务执行清单
    
    #### 任务10: 语音识别服务 (15-20分钟)
    ```javascript
    const task10Checklist = [
      "✅ 创建SpeechService类和基础结构",
      "✅ 集成Web Speech API，实现语音识别功能",
      "✅ 实现音频流处理和语音转文字",
      "✅ 添加错误处理和超时控制",
      "✅ 提供IPC接口供渲染进程调用",
      "✅ 验证语音识别基础功能正常"
    ];
    
    // 核心API接口
    - startRecognition() - 开始语音识别
    - stopRecognition() - 停止语音识别  
    - onResult(callback) - 识别结果回调
    - onError(callback) - 错误处理回调
    ```
    
    #### 任务11: AI优化服务 (20-25分钟)
    ```javascript
    const task11Checklist = [
      "✅ 创建AIService类和API适配器",
      "✅ 集成国内AI模型API（如通义千问、文心一言）",
      "✅ 实现提示词优化和格式化功能",
      "✅ 添加API调用错误处理和重试机制",
      "✅ 提供多个AI服务商的备选方案",
      "✅ 验证AI优化服务响应正常"
    ];
    
    // 核心API接口
    - optimizePrompt(text) - 优化提示词
    - getAIResponse(prompt) - 获取AI响应
    - switchProvider(provider) - 切换AI服务商
    ```
    
    #### 任务12: 剪贴板服务 (25-30分钟)
    ```javascript
    const task12Checklist = [
      "✅ 创建ClipboardService类",
      "✅ 实现系统剪贴板读写功能",
      "✅ 添加剪贴板权限处理和安全检查",
      "✅ 实现剪贴板历史记录管理",
      "✅ 提供复制成功/失败的反馈机制",
      "✅ 验证剪贴板操作功能正常"
    ];
    
    // 核心API接口
    - copyToClipboard(text) - 复制到剪贴板
    - readFromClipboard() - 读取剪贴板内容
    - clearClipboard() - 清空剪贴板
    ```
    
    #### 任务20: 工作流集成 (35-40分钟)
    ```javascript
    const task20Checklist = [
      "✅ 创建WorkflowManager类",
      "✅ 设计状态机管理用户操作流程",
      "✅ 整合语音、AI、剪贴板三个服务",
      "✅ 实现端到端的业务流程控制",
      "✅ 添加流程状态监控和日志记录",
      "✅ 验证完整工作流运行正常"
    ];
    
    // 工作流状态
    - IDLE → RECORDING → PROCESSING → COMPLETED → COPIED
    ```
    
    #### 任务21: 错误处理 (40-45分钟)
    ```javascript
    const task21Checklist = [
      "✅ 创建ErrorHandler类和错误码体系",
      "✅ 实现网络异常、API超时的处理机制",
      "✅ 添加服务降级和备选方案",
      "✅ 实现用户友好的错误提示",
      "✅ 添加错误日志记录和上报",
      "✅ 验证各种异常场景处理正确"
    ];
    
    // 错误处理策略
    - 网络异常 → 重试3次 → 降级方案
    - API超时 → 切换服务商 → 本地处理
    - 权限拒绝 → 友好提示 → 手动方案
    ```
    
    #### 任务22: 性能监控 (45-50分钟)
    ```javascript
    const task22Checklist = [
      "✅ 创建PerformanceMonitor类",
      "✅ 实现关键操作的性能数据收集",
      "✅ 添加内存使用和CPU占用监控",
      "✅ 实现性能瓶颈识别和告警",
      "✅ 提供性能数据的可视化接口",
      "✅ 验证性能监控数据准确性"
    ];
    
    // 监控指标
    - 语音识别响应时间
    - AI服务调用延迟
    - 内存使用量变化
    - CPU占用率监控
    ```
    
    #### 任务30: 端到端测试 (50-52分钟)
    ```javascript
    const task30Checklist = [
      "✅ 创建E2E测试用例和测试数据",
      "✅ 测试完整的用户操作流程",
      "✅ 验证所有服务集成正确",
      "✅ 测试演示场景的典型用例",
      "✅ 验证性能指标符合要求",
      "✅ 确认测试通过率达标"
    ];
    ```
    
    #### 任务31: 异常测试 (52-54分钟)
    ```javascript
    const task31Checklist = [
      "✅ 测试网络断开场景处理",
      "✅ 测试API服务异常情况",
      "✅ 测试系统资源不足情况",
      "✅ 验证错误恢复机制",
      "✅ 测试边界条件和极限情况",
      "✅ 确认异常处理符合预期"
    ];
    ```
    
    #### 任务32: 演示验证 (54-55分钟)
    ```javascript
    const task32Checklist = [
      "✅ 准备演示环境和测试数据",
      "✅ 验证演示流程完整顺畅",
      "✅ 确认所有服务在演示环境稳定",
      "✅ 准备演示备用方案",
      "✅ 验证与前端集成效果",
      "✅ 确认演示就绪状态"
    ];
    ```
    
    ### 🔗 前后端协作接口规范
    
    ```typescript
    // API接口定义
    interface ProjectSAPI {
      // 语音识别接口
      '/api/speech/start': {
        method: 'POST',
        response: { sessionId: string, status: 'recording' }
      },
      
      '/api/speech/stop': {
        method: 'POST', 
        body: { sessionId: string },
        response: { text: string, confidence: number }
      },
      
      // AI优化接口
      '/api/ai/optimize': {
        method: 'POST',
        body: { text: string, options?: object },
        response: { optimizedText: string, improvements: string[] }
      },
      
      // 剪贴板接口
      '/api/clipboard/copy': {
        method: 'POST',
        body: { text: string },
        response: { success: boolean, message: string }
      }
    }
    
    // 错误响应格式
    interface ErrorResponse {
      error: {
        code: string,
        message: string,
        details?: any
      }
    }
    ```
    
    ### ⚡ 服务开发模板
    
    ```javascript
    // 服务开发标准模板
    class ServiceTemplate {
      constructor() {
        this.initialized = false;
        this.errorHandler = new ErrorHandler();
        this.performanceMonitor = new PerformanceMonitor();
      }
      
      async initialize() {
        try {
          // 服务初始化逻辑
          this.initialized = true;
          this.performanceMonitor.log('service_init_success');
        } catch (error) {
          this.errorHandler.handle(error);
          throw error;
        }
      }
      
      async performAction(params) {
        const startTime = Date.now();
        try {
          // 参数验证
          this.validateParams(params);
          
          // 执行业务逻辑
          const result = await this.executeLogic(params);
          
          // 性能监控
          this.performanceMonitor.recordDuration(
            'action_duration', 
            Date.now() - startTime
          );
          
          return result;
        } catch (error) {
          this.errorHandler.handle(error);
          throw error;
        }
      }
    }
    ```
  </process>

  <criteria>
    ## 后端服务成功标准
    
    ### 服务稳定性
    - ✅ 所有核心服务能正常启动和运行
    - ✅ 外部API调用稳定，错误处理完善
    - ✅ 系统资源使用合理，无内存泄漏
    - ✅ 并发请求处理正确，无竞态条件
    
    ### 接口质量
    - ✅ API接口设计符合RESTful规范
    - ✅ 数据格式统一，错误响应标准化
    - ✅ 接口文档完整，前端集成顺畅
    - ✅ 性能响应时间符合要求
    
    ### 业务完整性
    - ✅ 端到端业务流程完整可用
    - ✅ 工作流状态管理正确
    - ✅ 数据流转和状态同步准确
    - ✅ 用户操作反馈及时明确
    
    ### 演示就绪度
    - ✅ 演示环境下服务稳定可靠
    - ✅ 演示数据准备充分
    - ✅ 备用方案和降级策略完备
    - ✅ 与前端集成测试通过
  </criteria>
</execution> 