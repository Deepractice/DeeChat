# 任务13: UI状态管理控制器

**目标(O)**:
- **功能目标**:
  - 实现UI元素的状态管理和交互控制
  - 提供统一的DOM操作和事件处理
  - 协调各个服务与用户界面的交互

- **执行任务**:
  - 修改文件:
    - `renderer/app.js` - 主控制器和事件绑定
  - 实现功能:
    - 初始化DOM元素引用
    - 绑定按钮点击事件
    - 实现状态更新和反馈显示
    - 协调服务调用和UI响应

- **任务边界**:
  - 专注于UI控制逻辑，不实现具体的服务功能
  - 使用原生DOM API，不依赖UI框架
  - 不涉及复杂的状态管理，保持简单直接

**环境(E)**:
- **参考资源**:
  - ARCHITECTURE.md中的UIManager类设计
  - tasks/01中定义的DOM元素结构

- **上下文信息**:
  - 可与其他1x任务并行开发，但需要了解各服务接口
  - 依赖的DOM元素：recordBtn, stopBtn, copyBtn等
  - 依赖的服务：speechService, aiService, clipboardService
  - 界面状态：录音中、处理中、完成、错误等

- **注意事项**:
  - 需要处理按钮的enabled/disabled状态切换
  - 实时更新状态提示，提供良好的用户反馈
  - 错误处理要用户友好，避免技术性错误信息
  - 防止用户重复点击导致的状态混乱

**实现指导(I)**:
- **核心控制器设计**:
  ```javascript
  class UIController {
    constructor() {
      this.elements = {};
      this.currentState = 'ready';
      this.services = {};
    }
    
    // 核心方法
    initializeElements()         // 初始化DOM元素
    bindEvents()                // 绑定事件监听
    updateState(state)          // 更新界面状态
    showMessage(msg, type)      // 显示消息提示
  }
  ```

- **状态管理策略**:
  ```javascript
  const UI_STATES = {
    READY: 'ready',              // 就绪状态
    RECORDING: 'recording',      // 录音中
    PROCESSING: 'processing',    // AI处理中
    COMPLETED: 'completed',      // 完成状态
    ERROR: 'error'              // 错误状态
  };
  ```

- **代码模板**:
  ```javascript
  // renderer/app.js
  class UIController {
    constructor() {
      this.elements = {};
      this.currentState = 'ready';
      this.currentText = '';
      this.optimizedText = '';
      
      this.initializeElements();
      this.bindEvents();
      this.updateState('ready');
    }
    
    initializeElements() {
      // 获取所有必需的DOM元素
      this.elements = {
        recordBtn: document.getElementById('recordBtn'),
        stopBtn: document.getElementById('stopBtn'),
        copyBtn: document.getElementById('copyBtn'),
        resetBtn: document.getElementById('resetBtn'),
        originalText: document.getElementById('originalText'),
        optimizedText: document.getElementById('optimizedText'),
        statusBar: document.getElementById('statusBar')
      };
      
      // 验证元素是否存在
      Object.keys(this.elements).forEach(key => {
        if (!this.elements[key]) {
          console.error(`DOM元素未找到: ${key}`);
        }
      });
    }
    
    bindEvents() {
      // 录音按钮事件
      this.elements.recordBtn?.addEventListener('click', () => {
        this.handleStartRecording();
      });
      
      // 停止按钮事件
      this.elements.stopBtn?.addEventListener('click', () => {
        this.handleStopRecording();
      });
      
      // 复制按钮事件
      this.elements.copyBtn?.addEventListener('click', () => {
        this.handleCopyText();
      });
      
      // 重置按钮事件
      this.elements.resetBtn?.addEventListener('click', () => {
        this.handleReset();
      });
    }
    
    async handleStartRecording() {
      if (this.currentState !== 'ready') return;
      
      try {
        this.updateState('recording');
        
        // 设置语音识别回调
        if (window.speechService) {
          window.speechService.onResult((result) => {
            this.handleSpeechResult(result);
          });
          
          window.speechService.onError((error) => {
            this.handleSpeechError(error);
          });
          
          const success = window.speechService.startRecording();
          if (!success) {
            throw new Error('语音识别启动失败');
          }
        } else {
          throw new Error('语音服务未初始化');
        }
      } catch (error) {
        this.handleError('录音启动失败: ' + error.message);
      }
    }
    
    async handleStopRecording() {
      if (this.currentState !== 'recording') return;
      
      try {
        if (window.speechService) {
          window.speechService.stopRecording();
        }
        
        if (this.currentText && this.currentText.trim()) {
          await this.handleTextOptimization(this.currentText);
        } else {
          this.updateState('ready');
          this.showMessage('未检测到语音输入', 'warning');
        }
      } catch (error) {
        this.handleError('录音停止失败: ' + error.message);
      }
    }
    
    handleSpeechResult(result) {
      if (result.final) {
        this.currentText = result.final;
        this.updateOriginalText(this.currentText);
      } else if (result.interim) {
        this.updateOriginalText(result.interim + '...');
      }
    }
    
    handleSpeechError(error) {
      console.error('语音识别错误:', error);
      this.handleError('语音识别失败: ' + error);
    }
    
    async handleTextOptimization(text) {
      try {
        this.updateState('processing');
        
        if (window.aiService) {
          const optimizedText = await window.aiService.optimizeText(text);
          this.optimizedText = optimizedText;
          this.updateOptimizedText(optimizedText);
          this.updateState('completed');
        } else {
          throw new Error('AI服务未初始化');
        }
      } catch (error) {
        this.handleError('文本优化失败: ' + error.message);
      }
    }
    
    async handleCopyText() {
      if (!this.optimizedText) {
        this.showMessage('没有可复制的内容', 'warning');
        return;
      }
      
      try {
        if (window.clipboardService) {
          const result = await window.clipboardService.copyText(this.optimizedText);
          if (result.success) {
            this.showMessage('复制成功！', 'success');
            window.clipboardService.showCopyFeedback(this.elements.copyBtn);
          } else {
            throw new Error(result.error || '复制失败');
          }
        } else {
          throw new Error('剪贴板服务未初始化');
        }
      } catch (error) {
        this.handleError('复制失败: ' + error.message);
      }
    }
    
    handleReset() {
      this.currentText = '';
      this.optimizedText = '';
      this.updateOriginalText('点击录音开始...');
      this.updateOptimizedText('等待AI处理...');
      this.updateState('ready');
      this.showMessage('已重置', 'info');
    }
    
    updateState(newState) {
      this.currentState = newState;
      
      // 更新按钮状态
      switch (newState) {
        case 'ready':
          this.enableButton('recordBtn');
          this.disableButton('stopBtn');
          this.disableButton('copyBtn');
          this.showStatus('准备就绪');
          break;
        case 'recording':
          this.disableButton('recordBtn');
          this.enableButton('stopBtn');
          this.disableButton('copyBtn');
          this.showStatus('🎤 正在听...');
          break;
        case 'processing':
          this.disableButton('recordBtn');
          this.disableButton('stopBtn');
          this.disableButton('copyBtn');
          this.showStatus('🤖 AI正在优化...');
          break;
        case 'completed':
          this.enableButton('recordBtn');
          this.disableButton('stopBtn');
          this.enableButton('copyBtn');
          this.showStatus('✅ 处理完成');
          break;
        case 'error':
          this.enableButton('recordBtn');
          this.disableButton('stopBtn');
          this.disableButton('copyBtn');
          break;
      }
    }
    
    enableButton(buttonId) {
      const button = this.elements[buttonId];
      if (button) {
        button.disabled = false;
      }
    }
    
    disableButton(buttonId) {
      const button = this.elements[buttonId];
      if (button) {
        button.disabled = true;
      }
    }
    
    updateOriginalText(text) {
      if (this.elements.originalText) {
        this.elements.originalText.textContent = text;
      }
    }
    
    updateOptimizedText(text) {
      if (this.elements.optimizedText) {
        this.elements.optimizedText.textContent = text;
      }
    }
    
    showStatus(message) {
      if (this.elements.statusBar) {
        this.elements.statusBar.textContent = message;
      }
    }
    
    showMessage(message, type = 'info') {
      console.log(`[${type.toUpperCase()}] ${message}`);
      this.showStatus(message);
    }
    
    handleError(errorMessage) {
      console.error(errorMessage);
      this.updateState('error');
      this.showMessage('❌ ' + errorMessage, 'error');
    }
  }
  
  // 页面加载完成后初始化
  document.addEventListener('DOMContentLoaded', () => {
    window.uiController = new UIController();
    console.log('ProjectS UI Controller initialized');
  });
  ```

- **实现策略**:
  1. 先实现基础的DOM元素获取和事件绑定
  2. 实现状态管理和按钮控制逻辑
  3. 添加服务调用的协调逻辑
  4. 完善错误处理和用户反馈
  5. 测试各种状态切换和边界情况

**成功标准(S)**:
- **基础达标**:
  - UIController成功初始化，无控制台错误
  - 所有按钮事件正常绑定和响应
  - 状态切换逻辑正确，按钮enable/disable正常
  - 能够正确显示状态信息和错误提示

- **预期品质**:
  - 用户交互流畅，状态反馈及时
  - 错误处理用户友好，避免技术术语
  - 防止并发操作导致的状态混乱
  - 界面响应速度快，无明显延迟

- **卓越表现**:
  - 实现智能的状态恢复机制
  - 提供操作历史和撤销功能
  - 支持键盘快捷键操作 