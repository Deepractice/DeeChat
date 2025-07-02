<execution>
  <constraint>
    ## 前端开发约束条件
    - **时间限制**：8个任务必须在指定时间窗口内完成
    - **技术栈约束**：必须使用Electron + HTML + CSS + JavaScript
    - **演示要求**：界面必须在演示环境下完美呈现  
    - **依赖限制**：前端开发可以使用Mock数据，不依赖后端完成
    - **质量标准**：代码必须可运行，界面必须美观，交互必须流畅
  </constraint>

  <rule>
    ## 前端开发强制规则
    - **任务顺序严格**：必须按照00→01→02→03→13→40→41→42的顺序执行
    - **代码质量**：每个任务完成后必须能正常运行，不能有致命错误
    - **接口规范**：与后端的数据接口必须提前约定，使用TypeScript定义
    - **演示优先**：所有设计决策都要考虑演示效果和观众体验
    - **文档同步**：重要的接口变更和设计决策必须及时记录
  </rule>

  <guideline>
    ## 前端开发指导原则
    - **用户体验至上**：所有设计都要从用户角度出发
    - **简洁高效**：追求最简洁的代码实现最佳的效果
    - **渐进增强**：从基础功能开始，逐步添加高级特性
    - **错误友好**：提供清晰的错误提示和优雅的降级方案
    - **性能优先**：确保界面响应速度和动画流畅性
  </guideline>

  <process>
    ## 前端开发执行流程
    
    ### 🚀 任务执行时间表
    
    ```mermaid
    gantt
        title Frontend开发时间轴
        dateFormat X
        axisFormat %M分钟
        
        section 基础环境(0-15分钟)
        00-electron-init     :0, 4
        01-html-framework    :4, 8  
        02-css-styling       :8, 12
        03-package-management:12, 15
        
        section 交互开发(30-35分钟)
        13-ui-controller     :30, 35
        
        section 演示优化(55-60分钟)  
        40-ui-polish         :55, 57
        41-demo-optimization :57, 59
        42-final-check       :59, 60
    ```
    
    ### 📋 详细任务执行清单
    
    #### 任务00: Electron初始化 (0-4分钟)
    ```javascript
    // 执行检查清单
    const task00Checklist = [
      "✅ 创建package.json配置文件",
      "✅ 初始化main.js主进程文件", 
      "✅ 配置基础窗口参数和安全策略",
      "✅ 验证Electron应用能正常启动"
    ];
    
    // 质量标准
    - 应用能正常启动并显示窗口
    - 开发者工具可正常打开
    - 无控制台错误信息
    ```
    
    #### 任务01: HTML框架 (4-8分钟)
    ```javascript
    const task01Checklist = [
      "✅ 创建index.html主页面结构",
      "✅ 定义核心UI组件布局(录音按钮、结果显示、状态提示)",
      "✅ 添加基础的DOM元素ID和Class",
      "✅ 验证页面结构完整可访问"
    ];
    
    // 核心UI组件
    - 录音控制区域
    - 结果展示区域  
    - 状态提示区域
    - 操作按钮区域
    ```
    
    #### 任务02: CSS样式 (8-12分钟)
    ```javascript
    const task02Checklist = [
      "✅ 创建style.css样式文件",
      "✅ 应用现代化UI设计(配色、字体、布局)",
      "✅ 实现响应式布局和组件样式",
      "✅ 验证视觉效果符合设计要求"
    ];
    
    // 样式要求
    - 现代化配色方案
    - 清晰的组件边界
    - 适配大屏演示
    ```
    
    #### 任务03: 包管理 (12-15分钟)
    ```javascript
    const task03Checklist = [
      "✅ 完善package.json依赖配置",
      "✅ 添加构建和开发脚本",
      "✅ 配置Electron构建参数",
      "✅ 验证依赖安装和脚本运行正常"
    ];
    ```
    
    #### 任务13: UI控制器 (30-35分钟)
    ```javascript
    const task13Checklist = [
      "✅ 创建app.js前端逻辑文件",
      "✅ 实现录音按钮交互逻辑",
      "✅ 实现结果显示和状态更新",
      "✅ 实现与主进程的IPC通信",
      "✅ 添加错误处理和用户反馈",
      "✅ 验证所有交互功能正常"
    ];
    
    // 核心功能
    - 录音开始/停止控制
    - 实时状态显示
    - 结果展示和复制
    - 错误提示处理
    ```
    
    #### 任务40: 界面美化 (55-57分钟)
    ```javascript
    const task40Checklist = [
      "✅ 优化配色方案和视觉效果",
      "✅ 添加动画效果和过渡",
      "✅ 调整演示环境显示优化",
      "✅ 验证大屏显示效果"
    ];
    ```
    
    #### 任务41: 演示优化 (57-59分钟)  
    ```javascript
    const task41Checklist = [
      "✅ 优化操作流程和用户体验",
      "✅ 准备演示数据和脚本",
      "✅ 调整界面布局适配演示",
      "✅ 验证演示流程顺畅"
    ];
    ```
    
    #### 任务42: 最终检查 (59-60分钟)
    ```javascript
    const task42Checklist = [
      "✅ 检查所有功能完整性",
      "✅ 验证界面美观度",
      "✅ 确认演示就绪状态",
      "✅ 清理开发代码和注释"
    ];
    ```
    
    ### 🔗 与后端协调机制
    
    ```mermaid
    sequenceDiagram
        participant F as Frontend角色
        participant B as Backend角色
        
        Note over F,B: 开发协调时序
        
        F->>B: 01. 约定数据接口格式
        B->>F: 02. 确认接口规范
        F->>F: 03. 使用Mock数据开发
        B->>B: 04. 开发真实服务API
        F->>B: 05. 请求集成测试
        B->>F: 06. 提供测试接口
        F->>F: 07. 替换Mock为真实API
        Note over F,B: 08. 联合测试验证
    ```
    
    ### ⚡ 快速开发模板
    
    ```javascript
    // 前端开发快速模板
    const frontendTemplate = {
      // Mock数据模板
      mockData: {
        speechResult: "帮我写一个关于健康饮食的文章",
        optimizedPrompt: "作为营养学专家，请撰写一篇2000字的健康饮食指南...",
        processingTime: 2.5
      },
      
      // 接口规范模板
      apiInterface: {
        "/api/speech/recognize": "POST - 语音识别",
        "/api/ai/optimize": "POST - AI优化",
        "/api/clipboard/copy": "POST - 剪贴板复制"
      },
      
      // 错误处理模板
      errorHandling: {
        networkError: "网络连接异常，请检查网络设置",
        serviceError: "服务暂时不可用，请稍后重试", 
        validationError: "输入内容有误，请重新输入"
      }
    };
    ```
  </process>

  <criteria>
    ## 前端开发成功标准
    
    ### 基础功能完整性
    - ✅ Electron应用能正常启动和运行
    - ✅ 所有UI组件正确显示和响应
    - ✅ 用户交互逻辑完整无误
    - ✅ 与后端接口通信正常
    
    ### 用户体验质量  
    - ✅ 界面美观现代，符合设计规范
    - ✅ 操作流程简单直观
    - ✅ 响应速度快，无明显卡顿
    - ✅ 错误提示友好清晰
    
    ### 演示效果标准
    - ✅ 在大屏环境下显示清晰
    - ✅ 演示操作流畅无障碍
    - ✅ 视觉效果令人印象深刻
    - ✅ 整体体验专业可靠
    
    ### 代码质量要求
    - ✅ 代码结构清晰，便于维护
    - ✅ 无致命错误和异常
    - ✅ 性能优化合理
    - ✅ 符合前端开发规范
  </criteria>
</execution> 